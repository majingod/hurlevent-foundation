CREATE OR REPLACE FUNCTION public.annuler_etape(
  p_personnage_id uuid,
  p_etape_courante integer,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_count_comp integer := 0;
  v_count_sorts integer := 0;
  v_count_prieres integer := 0;
  v_count_assemblages integer := 0;
  v_count_recettes integer := 0;
  v_count_objets_forge integer := 0;
  v_count_objets_joaillerie integer := 0;
  v_xp_rembourse integer := 0;
  v_xp_sorts integer := 0;
  v_xp_prieres integer := 0;
  v_xp_assemblages integer := 0;
  v_xp_recettes integer := 0;
  v_xp_objets_forge integer := 0;
  v_xp_objets_joaillerie integer := 0;
  v_pc_id uuid;
  v_donnees jsonb;
  v_xp_total_apres integer;
  v_xp_depense_apres integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = p_personnage_id FOR UPDATE;
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
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Le personnage est verrouillé. Utilisez la modification post-finalisation.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF v_perso.etape_creation <> p_etape_courante THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','etape_incoherente',
        'message', format('Étape attendue : %s, étape reçue : %s', v_perso.etape_creation, p_etape_courante))),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF p_etape_courante < 2 OR p_etape_courante > 11 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','etape_invalide',
        'message', format('Étape %s invalide (doit être entre 2 et 11)', p_etape_courante))),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  CASE p_etape_courante
    WHEN 4 THEN
      SELECT COUNT(*) INTO v_count_comp
      FROM personnage_competences
      WHERE personnage_id = p_personnage_id
        AND xp_depense = 0
        AND appris_via_maitre = false;

    WHEN 5 THEN
      SELECT COUNT(*), COALESCE(SUM(xp_depense), 0)
      INTO v_count_comp, v_xp_rembourse
      FROM personnage_competences
      WHERE personnage_id = p_personnage_id
        AND (xp_depense > 0 OR appris_via_maitre = true);

    WHEN 6 THEN
      SELECT COUNT(*), COALESCE(SUM(xp_depense), 0)
      INTO v_count_sorts, v_xp_sorts
      FROM personnage_sorts WHERE personnage_id = p_personnage_id;
      v_xp_rembourse := v_xp_sorts;

    WHEN 7 THEN
      SELECT COUNT(*), COALESCE(SUM(xp_depense), 0)
      INTO v_count_prieres, v_xp_prieres
      FROM personnage_prieres WHERE personnage_id = p_personnage_id;
      v_xp_rembourse := v_xp_prieres;

    WHEN 8 THEN
      SELECT COUNT(*), COALESCE(SUM(xp_depense), 0)
      INTO v_count_recettes, v_xp_recettes
      FROM personnage_recettes WHERE personnage_id = p_personnage_id;

      SELECT COUNT(*), COALESCE(SUM(xp_depense), 0)
      INTO v_count_objets_forge, v_xp_objets_forge
      FROM personnage_objets_forge WHERE personnage_id = p_personnage_id;

      SELECT COUNT(*), COALESCE(SUM(xp_depense), 0)
      INTO v_count_objets_joaillerie, v_xp_objets_joaillerie
      FROM personnage_objets_joaillerie WHERE personnage_id = p_personnage_id;

      v_xp_rembourse := v_xp_recettes + v_xp_objets_forge + v_xp_objets_joaillerie;

    WHEN 9 THEN
      SELECT COUNT(*), COALESCE(SUM(xp_depense), 0)
      INTO v_count_assemblages, v_xp_assemblages
      FROM personnage_assemblages WHERE personnage_id = p_personnage_id;
      v_xp_rembourse := v_xp_assemblages;

    ELSE
      NULL;
  END CASE;

  v_donnees := jsonb_build_object(
    'etape_annulee', p_etape_courante,
    'etape_apres', p_etape_courante - 1,
    'count_competences', v_count_comp,
    'count_sorts', v_count_sorts,
    'count_prieres', v_count_prieres,
    'count_assemblages', v_count_assemblages,
    'count_recettes', v_count_recettes,
    'count_objets_forge', v_count_objets_forge,
    'count_objets_joaillerie', v_count_objets_joaillerie,
    'xp_rembourse', v_xp_rembourse
  );

  IF p_dry_run THEN
    RETURN jsonb_build_object('succes', true,
      'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
      'donnees', v_donnees);
  END IF;

  CASE p_etape_courante
    WHEN 2 THEN
      UPDATE personnages
      SET race_id = NULL, sous_type_chimeride = NULL
      WHERE id = p_personnage_id;
      DELETE FROM personnage_races_demandes
      WHERE personnage_id = p_personnage_id AND statut = 'en_attente';

    WHEN 3 THEN
      UPDATE personnages
      SET traits_raciaux_choisis = NULL
      WHERE id = p_personnage_id;

    WHEN 4 THEN
      DELETE FROM personnage_competences
      WHERE personnage_id = p_personnage_id
        AND xp_depense = 0
        AND appris_via_maitre = false;
      UPDATE personnages
      SET classe_id = NULL, classe_secondaire_id = NULL
      WHERE id = p_personnage_id;

    WHEN 5 THEN
      FOR v_pc_id IN
        SELECT id FROM personnage_competences
        WHERE personnage_id = p_personnage_id
          AND (xp_depense > 0 OR appris_via_maitre = true)
        ORDER BY date_acquisition DESC
      LOOP
        PERFORM desacheter_competence(v_pc_id);
      END LOOP;

    WHEN 6 THEN
      DELETE FROM personnage_sorts WHERE personnage_id = p_personnage_id;
      IF v_xp_sorts > 0 THEN
        INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, acteur_id)
        VALUES (p_personnage_id, 'remboursement', v_xp_sorts,
                format('Annulation étape 6 — %s sort(s)', v_count_sorts), v_uid);
      END IF;

    WHEN 7 THEN
      DELETE FROM personnage_prieres WHERE personnage_id = p_personnage_id;
      IF v_xp_prieres > 0 THEN
        INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, acteur_id)
        VALUES (p_personnage_id, 'remboursement', v_xp_prieres,
                format('Annulation étape 7 — %s prière(s)', v_count_prieres), v_uid);
      END IF;

    WHEN 8 THEN
      DELETE FROM personnage_recettes WHERE personnage_id = p_personnage_id;
      DELETE FROM personnage_objets_forge WHERE personnage_id = p_personnage_id;
      DELETE FROM personnage_objets_joaillerie WHERE personnage_id = p_personnage_id;
      UPDATE personnages
      SET a_forge_legendaire = false, a_joaillerie_legendaire = false
      WHERE id = p_personnage_id;
      IF v_xp_recettes > 0 THEN
        INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, acteur_id)
        VALUES (p_personnage_id, 'remboursement', v_xp_recettes,
                format('Annulation étape 8 — %s recette(s)', v_count_recettes), v_uid);
      END IF;
      IF v_xp_objets_forge > 0 THEN
        INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, acteur_id)
        VALUES (p_personnage_id, 'remboursement', v_xp_objets_forge,
                format('Annulation étape 8 — %s objet(s) de forge', v_count_objets_forge), v_uid);
      END IF;
      IF v_xp_objets_joaillerie > 0 THEN
        INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, acteur_id)
        VALUES (p_personnage_id, 'remboursement', v_xp_objets_joaillerie,
                format('Annulation étape 8 — %s objet(s) de joaillerie', v_count_objets_joaillerie), v_uid);
      END IF;

    WHEN 9 THEN
      DELETE FROM personnage_assemblages WHERE personnage_id = p_personnage_id;
      IF v_xp_assemblages > 0 THEN
        INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, acteur_id)
        VALUES (p_personnage_id, 'remboursement', v_xp_assemblages,
                format('Annulation étape 9 — %s assemblage(s)', v_count_assemblages), v_uid);
      END IF;

    WHEN 10 THEN
      NULL;

    WHEN 11 THEN
      NULL;

    ELSE
      NULL;
  END CASE;

  UPDATE personnages
  SET etape_creation = p_etape_courante - 1
  WHERE id = p_personnage_id;

  SELECT xp_total, xp_depense
  INTO v_xp_total_apres, v_xp_depense_apres
  FROM personnages WHERE id = p_personnage_id;

  v_donnees := v_donnees || jsonb_build_object(
    'xp_total', v_xp_total_apres,
    'xp_depense', v_xp_depense_apres,
    'xp_restant', v_xp_total_apres - v_xp_depense_apres
  );

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', v_donnees);
END;
$$;
