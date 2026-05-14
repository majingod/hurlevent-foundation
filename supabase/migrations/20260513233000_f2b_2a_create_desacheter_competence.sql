-- F2b-2a — RPC desacheter_competence
-- Permet d'annuler l'achat d'une compétence pendant la création (avant
-- verrouillage). Logique de cascade selon type_achat :
--   - simple / unique_avec_choix / multiple_avec_choix_par_niveau :
--     cascade ascendante (supprime cette ligne + tous niveaux supérieurs
--     pour la même compétence)
--   - multiple_langue / multiple_sans_choix : suppression de la ligne
--     unique seulement
-- Mécanisme XP : INSERT dans historique_xp avec type 'remboursement',
-- le trigger trg_sync_xp_personnage recalcule xp_total et xp_depense.
-- Refus si : non authentifié, ownership refusé, personnage verrouillé,
-- ou compétence gratuite (xp_depense = 0).

CREATE OR REPLACE FUNCTION public.desacheter_competence(
  p_personnage_competence_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_pc personnage_competences%ROWTYPE;
  v_comp competences%ROWTYPE;
  v_lignes_supprimees jsonb := '[]'::jsonb;
  v_xp_total_rembourse integer := 0;
  v_nb_lignes integer := 0;
  v_ligne RECORD;
  v_xp_total_apres integer;
  v_xp_depense_apres integer;
BEGIN
  -- Auth
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Récupérer la ligne d'achat
  SELECT * INTO v_pc FROM personnage_competences WHERE id = p_personnage_competence_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cet achat de compétence n''existe pas')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Lock personnage
  SELECT * INTO v_perso FROM personnages WHERE id = v_pc.personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Ownership
  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Verrouillé
  IF v_perso.est_verrouille THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Le personnage est verrouillé')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Compétence gratuite : refus
  IF v_pc.xp_depense = 0 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','competence_gratuite','message','Une compétence acquise gratuitement (de classe) ne peut pas être désachetée')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Type d'achat
  SELECT * INTO v_comp FROM competences WHERE id = v_pc.competence_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','competence_introuvable','message','Compétence introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  BEGIN
    -- Cas A : cascade ascendante
    IF v_comp.type_achat IN ('simple','unique_avec_choix','multiple_avec_choix_par_niveau') THEN
      FOR v_ligne IN
        SELECT id, niveau_acquis, xp_depense, choix_achat
        FROM personnage_competences
        WHERE personnage_id = v_pc.personnage_id
          AND competence_id = v_pc.competence_id
          AND niveau_acquis >= v_pc.niveau_acquis
        ORDER BY niveau_acquis DESC
      LOOP
        v_lignes_supprimees := v_lignes_supprimees || jsonb_build_object(
          'personnage_competence_id', v_ligne.id,
          'niveau_acquis', v_ligne.niveau_acquis,
          'xp_rembourse', v_ligne.xp_depense,
          'choix_achat', v_ligne.choix_achat
        );
        v_xp_total_rembourse := v_xp_total_rembourse + v_ligne.xp_depense;
        v_nb_lignes := v_nb_lignes + 1;
      END LOOP;

      DELETE FROM personnage_competences
      WHERE personnage_id = v_pc.personnage_id
        AND competence_id = v_pc.competence_id
        AND niveau_acquis >= v_pc.niveau_acquis;

    -- Cas B : ligne unique
    ELSE
      v_lignes_supprimees := jsonb_build_array(jsonb_build_object(
        'personnage_competence_id', v_pc.id,
        'niveau_acquis', v_pc.niveau_acquis,
        'xp_rembourse', v_pc.xp_depense,
        'choix_achat', v_pc.choix_achat
      ));
      v_xp_total_rembourse := v_pc.xp_depense;
      v_nb_lignes := 1;

      DELETE FROM personnage_competences WHERE id = v_pc.id;
    END IF;

    -- Compensation XP via historique_xp 'remboursement'
    IF v_xp_total_rembourse > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, competence_id, acteur_id)
      VALUES (
        v_pc.personnage_id,
        'remboursement',
        v_xp_total_rembourse,
        'Annulation achat compétence (' || v_nb_lignes::text || ' niveau(x))',
        v_pc.competence_id,
        v_uid
      );
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','erreur_suppression','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  -- Lire nouvelles valeurs XP (mises à jour par le trigger)
  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
  FROM personnages WHERE id = v_pc.personnage_id;

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'lignes_supprimees', v_lignes_supprimees,
      'nb_lignes_supprimees', v_nb_lignes,
      'xp_total_rembourse', v_xp_total_rembourse,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres
    ));
END;
$function$;
