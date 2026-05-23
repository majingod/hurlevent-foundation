-- ============================================================
-- Migration : fix_magie_helper_calcul_xp_check_religion
-- Date : session 26, PR-B
-- ============================================================
-- Corrige 4 bugs interconnectes du systeme magie :
-- (E) acheter_sort calculait xp_depense via CEIL(cout_xp_base brut)
--     au lieu d'appliquer la formule (zone+portee+duree+niveau)*base
-- (C) acheter_priere meme bug que E
-- (B) acheter_priere bloquait toute priere via check religion alors
--     que toutes les prieres ont religion_id NULL (mort code,
--     filtrage deja gere par religions.domaines_proscrits)
-- (D) valider_etape_7 idem (check religion qui n'a aucun sens)
--
-- Nouvelle helper SQL `calculer_cout_xp_magie` mirror du frontend
-- @/utils/calculsMagie.ts. Source de verite a maintenir alignee
-- avec @/constants/magie.ts (COUT_ZONE, PORTEES, DUREES).
-- ============================================================

-- 1. HELPER : calculer le cout XP d'un sort/priere selon le manuel 2026.
-- Formule : CEIL((cout_zone + cout_portee + cout_duree + niveau) * cout_xp_base)
CREATE OR REPLACE FUNCTION public.calculer_cout_xp_magie(
  p_zone_choisie text,
  p_portee_choisie text,
  p_duree_choisie text,
  p_niveau integer,
  p_cout_xp_base numeric
) RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $func$
DECLARE
  v_cout_zone integer := 0;
  v_cout_portee integer := 0;
  v_cout_duree integer := 0;
BEGIN
  v_cout_zone := CASE p_zone_choisie
    WHEN 'Personnelle'    THEN 1
    WHEN '1 Cible'        THEN 2
    WHEN '2 Cibles'       THEN 4
    WHEN '3 Cibles'       THEN 6
    WHEN '4 Cibles'       THEN 8
    WHEN '5 Cibles'       THEN 10
    WHEN 'Rayon 3 pieds'  THEN 6
    WHEN 'Rayon 6 pieds'  THEN 8
    WHEN 'Rayon 10 pieds' THEN 10
    WHEN 'Rayon 25 pieds' THEN 14
    WHEN 'Rayon 50 pieds' THEN 18
    ELSE 0
  END;
  v_cout_portee := CASE p_portee_choisie
    WHEN 'Toucher'  THEN 0
    WHEN '5 Pieds'  THEN 1
    WHEN '10 Pieds' THEN 2
    WHEN '25 Pieds' THEN 4
    WHEN '50 Pieds' THEN 8
    WHEN 'À vue'    THEN 10
    ELSE 0
  END;
  v_cout_duree := CASE p_duree_choisie
    WHEN 'Instantanée' THEN 1
    WHEN '1 Minute'    THEN 2
    WHEN '5 Minutes'   THEN 3
    WHEN '10 Minutes'  THEN 4
    WHEN '20 Minutes'  THEN 5
    WHEN '30 Minutes'  THEN 6
    WHEN '40 Minutes'  THEN 7
    WHEN '50 Minutes'  THEN 8
    WHEN '60 Minutes'  THEN 9
    ELSE 0
  END;
  RETURN CEIL((v_cout_zone + v_cout_portee + v_cout_duree + p_niveau) * COALESCE(p_cout_xp_base, 0))::integer;
END;
$func$;

-- 2. acheter_sort : utiliser la helper pour calculer xp_depense correctement
CREATE OR REPLACE FUNCTION public.acheter_sort(
  p_personnage_id uuid, p_sort_id uuid, p_niveau_sort integer,
  p_zone_choisie text, p_portee_choisie text, p_duree_choisie text, p_nom_personnalise text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_cercle text; v_cout_xp_base numeric; v_cout_xp integer; v_niveau_max integer;
  v_xp_disponible integer; v_new_id uuid; v_xp_total integer; v_xp_depense integer;
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
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT cercle, cout_xp_base INTO v_cercle, v_cout_xp_base FROM sorts WHERE id = p_sort_id;
  IF v_cercle IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','sort_introuvable','message','Sort introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  -- FIX session 26 : calcul XP via helper, plus de CEIL(cout_xp_base) brut
  v_cout_xp := public.calculer_cout_xp_magie(
    p_zone_choisie, p_portee_choisie, p_duree_choisie, p_niveau_sort, v_cout_xp_base
  );
  SELECT niveau_max_sorts INTO v_niveau_max FROM vue_cercles_disponibles
   WHERE personnage_id = p_personnage_id AND cercle = v_cercle;
  IF v_niveau_max IS NULL OR p_niveau_sort > v_niveau_max THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de sort supérieur au maximum autorisé pour ce cercle')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_xp_disponible := v_perso.xp_total - v_perso.xp_depense;
  IF v_xp_disponible < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  BEGIN
    INSERT INTO personnage_sorts (personnage_id, sort_id, niveau_sort, xp_depense, nom_personnalise, zone_choisie, portee_choisie, duree_choisie)
    VALUES (p_personnage_id, p_sort_id, p_niveau_sort, v_cout_xp, p_nom_personnalise, p_zone_choisie, p_portee_choisie, p_duree_choisie)
    RETURNING id INTO v_new_id;
    UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
     WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, sort_id, acteur_id)
      VALUES (p_personnage_id, 'depense_sort', -v_cout_xp, 'Achat sort niveau ' || p_niveau_sort || ' (' || v_cout_xp || ' XP)', p_sort_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_sort_id', v_new_id, 'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$func$;

-- 3. acheter_priere : retirer check religion + utiliser helper
CREATE OR REPLACE FUNCTION public.acheter_priere(
  p_personnage_id uuid, p_priere_id uuid, p_niveau_priere integer,
  p_zone_choisie text, p_portee_choisie text, p_duree_choisie text, p_nom_personnalise text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_priere prieres%ROWTYPE;
  v_cout_xp integer; v_niveau_max integer; v_xp_disponible integer;
  v_new_id uuid; v_xp_total integer; v_xp_depense integer;
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
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_priere FROM prieres WHERE id = p_priere_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','priere_introuvable','message','Prière introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  -- FIX session 26 : check religion supprime. Manuel 2026 n'a pas de
  -- prerequis religion pour Acquisition de Domaine. Les domaines proscrits
  -- par la religion du personnage sont deja filtres via
  -- religions.domaines_proscrits cote frontend et vue_domaines_disponibles.
  -- FIX session 26 : calcul XP via helper, plus de CEIL(cout_xp_base) brut
  v_cout_xp := public.calculer_cout_xp_magie(
    p_zone_choisie, p_portee_choisie, p_duree_choisie, p_niveau_priere, v_priere.cout_xp_base
  );
  SELECT niveau_max_prieres INTO v_niveau_max FROM vue_domaines_disponibles
   WHERE personnage_id = p_personnage_id AND domaine = v_priere.domaine;
  IF v_niveau_max IS NULL OR p_niveau_priere > v_niveau_max THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de prière supérieur au maximum autorisé pour ce domaine')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_xp_disponible := v_perso.xp_total - v_perso.xp_depense;
  IF v_xp_disponible < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  BEGIN
    INSERT INTO personnage_prieres (personnage_id, priere_id, niveau_priere, xp_depense, nom_personnalise, zone_choisie, portee_choisie, duree_choisie)
    VALUES (p_personnage_id, p_priere_id, p_niveau_priere, v_cout_xp, p_nom_personnalise, p_zone_choisie, p_portee_choisie, p_duree_choisie)
    RETURNING id INTO v_new_id;
    UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
     WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, priere_id, acteur_id)
      VALUES (p_personnage_id, 'depense_priere', -v_cout_xp, 'Achat prière niveau ' || p_niveau_priere || ' (' || v_cout_xp || ' XP)', p_priere_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_priere_id', v_new_id, 'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$func$;

-- 4. valider_etape_7 : retirer check religion (cause D)
CREATE OR REPLACE FUNCTION public.valider_etape_7(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $func$
DECLARE
  v_perso public.personnages%ROWTYPE;
  v_priere RECORD;
  v_niveau_max integer;
  v_nb_domaines integer;
  v_nb_prieres integer;
  v_erreurs jsonb := '[]'::jsonb;
  v_avertissements jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valide', false, 'ignoree', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb
    );
  END IF;
  IF NOT public.personnage_a_des_prieres(p_personnage_id) THEN
    RETURN jsonb_build_object(
      'valide', true, 'ignoree', true,
      'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb
    );
  END IF;
  FOR v_priere IN
    SELECT pp.priere_id, pp.niveau_priere, pr.domaine, pr.nom AS priere_nom
    FROM public.personnage_prieres pp
    JOIN public.prieres pr ON pr.id = pp.priere_id
    WHERE pp.personnage_id = p_personnage_id
  LOOP
    SELECT niveau_max_prieres INTO v_niveau_max
    FROM public.vue_domaines_disponibles
    WHERE personnage_id = p_personnage_id AND domaine = v_priere.domaine;
    IF NOT FOUND THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','priere_domaine_non_debloque',
        'message', format('La prière %s appartient au domaine %s, non débloqué', v_priere.priere_nom, v_priere.domaine),
        'champ','personnage_prieres');
    ELSIF v_priere.niveau_priere > v_niveau_max THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','priere_niveau_trop_eleve',
        'message', format('La prière %s (niveau %s) dépasse le max %s du domaine %s', v_priere.priere_nom, v_priere.niveau_priere, v_niveau_max, v_priere.domaine),
        'champ','personnage_prieres');
    END IF;
    -- FIX session 26 : check religion supprime. Voir doc acheter_priere.
  END LOOP;
  SELECT count(*) INTO v_nb_domaines FROM public.vue_domaines_disponibles WHERE personnage_id = p_personnage_id;
  SELECT count(*) INTO v_nb_prieres FROM public.personnage_prieres WHERE personnage_id = p_personnage_id;
  IF v_nb_domaines > 0 AND v_nb_prieres = 0 THEN
    v_avertissements := v_avertissements || jsonb_build_object(
      'code','info_domaine_sans_priere',
      'message','Vous avez débloqué un ou plusieurs domaines mais n''avez acheté aucune prière');
  END IF;
  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', v_avertissements
  );
END;
$func$;
