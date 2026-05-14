-- Migration : desacheter_competence — garde anti-incohérence des prérequis
-- Ajoute une vérification post-suppression : si le désachat rend incohérents
-- les prérequis d'une compétence encore possédée, la transaction est annulée
-- et le désachat refusé avec un message clair.
-- Réutilise verifier_prerequis_competences comme source de vérité unique.

CREATE OR REPLACE FUNCTION public.desacheter_competence(p_personnage_competence_id uuid)
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
  v_prereq_apres jsonb;
  v_comp_dependante RECORD;
  v_noms_bloquants text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_pc FROM personnage_competences WHERE id = p_personnage_competence_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cet achat de compétence n''existe pas')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_pc.personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF v_perso.est_verrouille THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Le personnage est verrouillé')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF v_pc.xp_depense = 0 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','competence_gratuite','message','Une compétence acquise gratuitement (de classe) ne peut pas être désachetée')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_comp FROM competences WHERE id = v_pc.competence_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','competence_introuvable','message','Compétence introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  BEGIN
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

    -- GARDE PRÉREQUIS : aucune compétence encore possédée ne doit se retrouver
    -- avec un prérequis non satisfait. Réutilise verifier_prerequis_competences.
    v_prereq_apres := verifier_prerequis_competences(v_pc.personnage_id);

    FOR v_comp_dependante IN
      SELECT c.id, c.nom, max(pc.niveau_acquis) AS niveau_possede
      FROM personnage_competences pc
      JOIN competences c ON c.id = pc.competence_id
      WHERE pc.personnage_id = v_pc.personnage_id
      GROUP BY c.id, c.nom
    LOOP
      IF v_prereq_apres ? v_comp_dependante.id::text THEN
        IF v_comp_dependante.niveau_possede >
           COALESCE((v_prereq_apres -> v_comp_dependante.id::text ->> 'niveau_max_achetable')::int, 3)
        THEN
          v_noms_bloquants := v_noms_bloquants || v_comp_dependante.nom;
        END IF;
      END IF;
    END LOOP;

    IF array_length(v_noms_bloquants, 1) > 0 THEN
      RAISE EXCEPTION 'DEPENDANCES_PREREQUIS:%', array_to_string(v_noms_bloquants, ', ');
    END IF;

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

  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'DEPENDANCES_PREREQUIS:%' THEN
        RETURN jsonb_build_object('succes', false,
          'erreurs', jsonb_build_array(jsonb_build_object(
            'code','dependances_prerequis',
            'message', format(
              'Impossible de désacheter « %s » : les compétences suivantes en dépendent — %s. Désachète-les d''abord.',
              v_comp.nom,
              substring(SQLERRM from 'DEPENDANCES_PREREQUIS:(.*)')
            )
          )),
          'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
      END IF;
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','erreur_suppression','message', SQLERRM)),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

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
