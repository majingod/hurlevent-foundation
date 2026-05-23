-- Fix : annuler_etape violait chk_historique_xp_reference_objet pour les étapes 6-9
-- car les remboursements étaient des INSERTs « bulk » sans FK.
-- Le check exige EXACTEMENT 1 FK pour type_mouvement = 'remboursement'.
--
-- Nouveau comportement : 1 INSERT historique_xp PAR item annulé, avec la FK
-- appropriée (sort_id / priere_id / recette_id / objet_forge_id /
-- objet_joaillerie_id / assemblage_id). Préserve la traçabilité fine et
-- respecte la convention append-only de historique_xp.
--
-- Les items gratuits (xp_depense = 0) sont DELETE sans entrée historique
-- (montant 0 violerait chk_historique_xp_montant_non_nul).

CREATE OR REPLACE FUNCTION public.annuler_etape(
  p_personnage_id uuid,
  p_etape_courante integer,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_items_detail jsonb := '[]'::jsonb;
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

  -- === COMPTAGE + items_detail (inchangé) ============================
  CASE p_etape_courante
    WHEN 4 THEN
      SELECT COUNT(*) INTO v_count_comp
      FROM personnage_competences
      WHERE personnage_id = p_personnage_id
        AND xp_depense = 0
        AND appris_via_maitre = false;

      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', 'competence',
        'type_label', 'Compétence',
        'nom', c.nom,
        'quantite', g.cnt,
        'xp_unitaire', 0,
        'xp_total', 0
      ) ORDER BY c.nom), '[]'::jsonb)
      INTO v_items_detail
      FROM (
        SELECT pc.competence_id, COUNT(*) AS cnt
        FROM personnage_competences pc
        WHERE pc.personnage_id = p_personnage_id
          AND pc.xp_depense = 0
          AND pc.appris_via_maitre = false
        GROUP BY pc.competence_id
      ) g
      JOIN competences c ON c.id = g.competence_id;

    WHEN 5 THEN
      SELECT COUNT(*), COALESCE(SUM(xp_depense), 0)
      INTO v_count_comp, v_xp_rembourse
      FROM personnage_competences
      WHERE personnage_id = p_personnage_id
        AND (xp_depense > 0 OR appris_via_maitre = true);

      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', 'competence',
        'type_label', 'Compétence',
        'nom', c.nom,
        'quantite', g.cnt,
        'xp_unitaire', g.xp_unitaire,
        'xp_total', g.xp_total
      ) ORDER BY c.nom), '[]'::jsonb)
      INTO v_items_detail
      FROM (
        SELECT
          pc.competence_id,
          COUNT(*) AS cnt,
          MIN(pc.xp_depense) AS xp_unitaire,
          SUM(pc.xp_depense)::integer AS xp_total
        FROM personnage_competences pc
        WHERE pc.personnage_id = p_personnage_id
          AND (pc.xp_depense > 0 OR pc.appris_via_maitre = true)
        GROUP BY pc.competence_id
      ) g
      JOIN competences c ON c.id = g.competence_id;

    WHEN 6 THEN
      SELECT COUNT(*), COALESCE(SUM(xp_depense), 0)
      INTO v_count_sorts, v_xp_sorts
      FROM personnage_sorts WHERE personnage_id = p_personnage_id;
      v_xp_rembourse := v_xp_sorts;

      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', 'sort',
        'type_label', 'Sort',
        'nom', COALESCE(ps.nom_personnalise, s.nom),
        'quantite', 1,
        'xp_unitaire', ps.xp_depense,
        'xp_total', ps.xp_depense
      ) ORDER BY COALESCE(ps.nom_personnalise, s.nom)), '[]'::jsonb)
      INTO v_items_detail
      FROM personnage_sorts ps
      JOIN sorts s ON s.id = ps.sort_id
      WHERE ps.personnage_id = p_personnage_id;

    WHEN 7 THEN
      SELECT COUNT(*), COALESCE(SUM(xp_depense), 0)
      INTO v_count_prieres, v_xp_prieres
      FROM personnage_prieres WHERE personnage_id = p_personnage_id;
      v_xp_rembourse := v_xp_prieres;

      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', 'priere',
        'type_label', 'Prière',
        'nom', COALESCE(pp.nom_personnalise, pr.nom),
        'quantite', 1,
        'xp_unitaire', pp.xp_depense,
        'xp_total', pp.xp_depense
      ) ORDER BY COALESCE(pp.nom_personnalise, pr.nom)), '[]'::jsonb)
      INTO v_items_detail
      FROM personnage_prieres pp
      JOIN prieres pr ON pr.id = pp.priere_id
      WHERE pp.personnage_id = p_personnage_id;

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

      WITH combined AS (
        SELECT
          jsonb_build_object(
            'type', 'recette',
            'type_label', 'Recette alchimique',
            'nom', r.nom,
            'quantite', 1,
            'xp_unitaire', pr.xp_depense,
            'xp_total', pr.xp_depense
          ) AS item,
          r.nom AS sort_nom
        FROM personnage_recettes pr
        JOIN recettes_alchimie r ON r.id = pr.recette_id
        WHERE pr.personnage_id = p_personnage_id
        UNION ALL
        SELECT
          jsonb_build_object(
            'type', 'objet_forge',
            'type_label', 'Objet de forge',
            'nom', o.nom,
            'quantite', 1,
            'xp_unitaire', pof.xp_depense,
            'xp_total', pof.xp_depense
          ),
          o.nom
        FROM personnage_objets_forge pof
        JOIN objets_forge o ON o.id = pof.objet_id
        WHERE pof.personnage_id = p_personnage_id
        UNION ALL
        SELECT
          jsonb_build_object(
            'type', 'objet_joaillerie',
            'type_label', 'Objet de joaillerie',
            'nom', o.nom,
            'quantite', 1,
            'xp_unitaire', poj.xp_depense,
            'xp_total', poj.xp_depense
          ),
          o.nom
        FROM personnage_objets_joaillerie poj
        JOIN objets_joaillerie o ON o.id = poj.objet_id
        WHERE poj.personnage_id = p_personnage_id
      )
      SELECT COALESCE(jsonb_agg(item ORDER BY sort_nom), '[]'::jsonb)
      INTO v_items_detail
      FROM combined;

    WHEN 9 THEN
      SELECT COUNT(*), COALESCE(SUM(xp_depense), 0)
      INTO v_count_assemblages, v_xp_assemblages
      FROM personnage_assemblages WHERE personnage_id = p_personnage_id;
      v_xp_rembourse := v_xp_assemblages;

      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', 'assemblage',
        'type_label', 'Assemblage de runes',
        'nom', a.nom,
        'quantite', 1,
        'xp_unitaire', pa.xp_depense,
        'xp_total', pa.xp_depense
      ) ORDER BY a.nom), '[]'::jsonb)
      INTO v_items_detail
      FROM personnage_assemblages pa
      JOIN assemblages_runes a ON a.id = pa.assemblage_id
      WHERE pa.personnage_id = p_personnage_id;

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
    'xp_rembourse', v_xp_rembourse,
    'items_detail', v_items_detail
  );

  IF p_dry_run THEN
    RETURN jsonb_build_object('succes', true,
      'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
      'donnees', v_donnees);
  END IF;

  -- === EXÉCUTION DE L'ANNULATION ====================================
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
      -- 1 INSERT historique_xp par sort avec FK sort_id
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, acteur_id, sort_id)
      SELECT
        p_personnage_id,
        'remboursement',
        ps.xp_depense,
        format('Annulation étape 6 — sort « %s »', COALESCE(ps.nom_personnalise, s.nom)),
        v_uid,
        ps.sort_id
      FROM personnage_sorts ps
      JOIN sorts s ON s.id = ps.sort_id
      WHERE ps.personnage_id = p_personnage_id
        AND ps.xp_depense > 0;

      DELETE FROM personnage_sorts WHERE personnage_id = p_personnage_id;

    WHEN 7 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, acteur_id, priere_id)
      SELECT
        p_personnage_id,
        'remboursement',
        pp.xp_depense,
        format('Annulation étape 7 — prière « %s »', COALESCE(pp.nom_personnalise, pr.nom)),
        v_uid,
        pp.priere_id
      FROM personnage_prieres pp
      JOIN prieres pr ON pr.id = pp.priere_id
      WHERE pp.personnage_id = p_personnage_id
        AND pp.xp_depense > 0;

      DELETE FROM personnage_prieres WHERE personnage_id = p_personnage_id;

    WHEN 8 THEN
      -- Recettes
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, acteur_id, recette_id)
      SELECT
        p_personnage_id,
        'remboursement',
        pr.xp_depense,
        format('Annulation étape 8 — recette « %s »', r.nom),
        v_uid,
        pr.recette_id
      FROM personnage_recettes pr
      JOIN recettes_alchimie r ON r.id = pr.recette_id
      WHERE pr.personnage_id = p_personnage_id
        AND pr.xp_depense > 0;

      DELETE FROM personnage_recettes WHERE personnage_id = p_personnage_id;

      -- Objets de forge
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, acteur_id, objet_forge_id)
      SELECT
        p_personnage_id,
        'remboursement',
        pof.xp_depense,
        format('Annulation étape 8 — objet de forge « %s »', o.nom),
        v_uid,
        pof.objet_id
      FROM personnage_objets_forge pof
      JOIN objets_forge o ON o.id = pof.objet_id
      WHERE pof.personnage_id = p_personnage_id
        AND pof.xp_depense > 0;

      DELETE FROM personnage_objets_forge WHERE personnage_id = p_personnage_id;

      -- Objets de joaillerie
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, acteur_id, objet_joaillerie_id)
      SELECT
        p_personnage_id,
        'remboursement',
        poj.xp_depense,
        format('Annulation étape 8 — objet de joaillerie « %s »', o.nom),
        v_uid,
        poj.objet_id
      FROM personnage_objets_joaillerie poj
      JOIN objets_joaillerie o ON o.id = poj.objet_id
      WHERE poj.personnage_id = p_personnage_id
        AND poj.xp_depense > 0;

      DELETE FROM personnage_objets_joaillerie WHERE personnage_id = p_personnage_id;

      UPDATE personnages
      SET a_forge_legendaire = false, a_joaillerie_legendaire = false
      WHERE id = p_personnage_id;

    WHEN 9 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, acteur_id, assemblage_id)
      SELECT
        p_personnage_id,
        'remboursement',
        pa.xp_depense,
        format('Annulation étape 9 — assemblage « %s »', a.nom),
        v_uid,
        pa.assemblage_id
      FROM personnage_assemblages pa
      JOIN assemblages_runes a ON a.id = pa.assemblage_id
      WHERE pa.personnage_id = p_personnage_id
        AND pa.xp_depense > 0;

      DELETE FROM personnage_assemblages WHERE personnage_id = p_personnage_id;

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
$function$;
