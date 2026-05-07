-- =============================================================================
-- Phase 1.6 — RPC d'achat (8 fonctions)
-- Format de retour standardisé :
--   { "succes": bool, "erreurs": [...], "avertissements": [...], "donnees": {...} }
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. acheter_trait_racial
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acheter_trait_racial(
  p_personnage_id uuid,
  p_trait_id uuid,
  p_est_gratuit boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_cout_xp integer := 0;
  v_check jsonb;
  v_xp_total integer;
  v_xp_depense integer;
  v_traits jsonb;
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
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Le personnage est verrouillé')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Vérification métier
  v_check := peut_acheter_trait_racial(p_personnage_id, p_trait_id, v_perso.race_id, v_perso.sous_type_chimeride);
  IF NOT (v_check->>'peut_acheter')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_refuse','message', COALESCE(v_check->>'raison','Achat refusé'))),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Coût : 0 si gratuit, sinon depuis vue_traits_par_race
  IF p_est_gratuit THEN
    v_cout_xp := 0;
  ELSE
    SELECT cout_xp INTO v_cout_xp
    FROM vue_traits_par_race
    WHERE race_id = v_perso.race_id AND trait_id = p_trait_id
    LIMIT 1;
    IF v_cout_xp IS NULL THEN v_cout_xp := 0; END IF;

    IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;

  BEGIN
    -- Mise à jour traits_raciaux_choisis
    UPDATE personnages
       SET traits_raciaux_choisis = COALESCE(traits_raciaux_choisis, '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object(
                'trait_id', p_trait_id,
                'est_gratuit', p_est_gratuit,
                'xp_depense', v_cout_xp)),
           xp_depense = xp_depense + v_cout_xp,
           date_modification = now(),
           updated_at = now()
     WHERE id = p_personnage_id;

    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
      VALUES (p_personnage_id, 'depense_trait', -v_cout_xp,
              'Achat trait racial (' || v_cout_xp || ' XP)', p_trait_id, v_uid);
    END IF;
  EXCEPTION
    WHEN check_violation OR foreign_key_violation THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  SELECT xp_total, xp_depense, traits_raciaux_choisis
    INTO v_xp_total, v_xp_depense, v_traits
    FROM personnages WHERE id = p_personnage_id;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'traits_raciaux_choisis', v_traits,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense
    )
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 2. acheter_competence
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acheter_competence(
  p_personnage_id uuid,
  p_competence_id uuid,
  p_niveau_desire integer,
  p_choix_achat text DEFAULT NULL,
  p_appris_via_maitre boolean DEFAULT false,
  p_nom_maitre text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_check jsonb;
  v_niveaux jsonb;
  v_cout_xp integer;
  v_xp_disponible integer;
  v_new_id uuid;
  v_xp_total integer;
  v_xp_depense integer;
  v_statut text;
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
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Le personnage est verrouillé')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_check := peut_acheter_competence(p_personnage_id, p_competence_id, p_niveau_desire, p_choix_achat);
  IF NOT (v_check->>'peut_acheter')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_refuse','message', COALESCE(v_check->>'raison','Achat refusé'))),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Extraire le coût XP (niveaux est un array indexé 0)
  SELECT niveaux INTO v_niveaux FROM competences WHERE id = p_competence_id;
  IF v_niveaux IS NULL OR jsonb_array_length(v_niveaux) < p_niveau_desire THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de compétence invalide')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_cout_xp := (v_niveaux->(p_niveau_desire - 1)->>'cout_xp')::integer;
  IF v_cout_xp IS NULL THEN v_cout_xp := 0; END IF;

  v_xp_disponible := v_perso.xp_total - v_perso.xp_depense;
  IF v_xp_disponible < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_statut := CASE WHEN p_appris_via_maitre THEN 'en_attente' ELSE 'non_requis' END;

  BEGIN
    INSERT INTO personnage_competences
      (personnage_id, competence_id, niveau_acquis, appris_via_maitre, xp_depense, nom_maitre, statut_maitre, choix_achat)
    VALUES
      (p_personnage_id, p_competence_id, p_niveau_desire, p_appris_via_maitre, v_cout_xp, p_nom_maitre, v_statut, p_choix_achat)
    RETURNING id INTO v_new_id;

    UPDATE personnages
       SET xp_depense = xp_depense + v_cout_xp,
           date_modification = now(),
           updated_at = now()
     WHERE id = p_personnage_id;

    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, competence_id, acteur_id)
      VALUES (p_personnage_id, 'depense_competence', -v_cout_xp,
              'Achat compétence niveau ' || p_niveau_desire || ' (' || v_cout_xp || ' XP)',
              p_competence_id, v_uid);
    END IF;
  EXCEPTION
    WHEN check_violation OR foreign_key_violation THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense
    FROM personnages WHERE id = p_personnage_id;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_competence_id', v_new_id,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense
    )
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 3. acheter_sort
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acheter_sort(
  p_personnage_id uuid,
  p_sort_id uuid,
  p_niveau_sort integer,
  p_zone_choisie text,
  p_portee_choisie text,
  p_duree_choisie text,
  p_nom_personnalise text,
  p_xp_depense integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_cercle text;
  v_niveau_max integer;
  v_xp_disponible integer;
  v_new_id uuid;
  v_xp_total integer;
  v_xp_depense integer;
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
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Le personnage est verrouillé')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF p_xp_depense IS NULL OR p_xp_depense < 0 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_depense_invalide','message','p_xp_depense doit être un entier positif ou nul')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT cercle INTO v_cercle FROM sorts WHERE id = p_sort_id;
  IF v_cercle IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','sort_introuvable','message','Sort introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT niveau_max_sorts INTO v_niveau_max
    FROM vue_cercles_disponibles
   WHERE personnage_id = p_personnage_id AND cercle = v_cercle;

  IF v_niveau_max IS NULL OR p_niveau_sort > v_niveau_max THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de sort supérieur au maximum autorisé pour ce cercle')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_xp_disponible := v_perso.xp_total - v_perso.xp_depense;
  IF v_xp_disponible < p_xp_depense THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  BEGIN
    INSERT INTO personnage_sorts
      (personnage_id, sort_id, niveau_sort, xp_depense, nom_personnalise, zone_choisie, portee_choisie, duree_choisie)
    VALUES
      (p_personnage_id, p_sort_id, p_niveau_sort, p_xp_depense, p_nom_personnalise, p_zone_choisie, p_portee_choisie, p_duree_choisie)
    RETURNING id INTO v_new_id;

    UPDATE personnages
       SET xp_depense = xp_depense + p_xp_depense,
           date_modification = now(),
           updated_at = now()
     WHERE id = p_personnage_id;

    IF p_xp_depense > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, sort_id, acteur_id)
      VALUES (p_personnage_id, 'depense_sort', -p_xp_depense,
              'Achat sort niveau ' || p_niveau_sort || ' (' || p_xp_depense || ' XP)',
              p_sort_id, v_uid);
    END IF;
  EXCEPTION
    WHEN check_violation OR foreign_key_violation THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense
    FROM personnages WHERE id = p_personnage_id;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_sort_id', v_new_id,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense
    )
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 4. acheter_priere
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acheter_priere(
  p_personnage_id uuid,
  p_priere_id uuid,
  p_niveau_priere integer,
  p_zone_choisie text,
  p_portee_choisie text,
  p_duree_choisie text,
  p_nom_personnalise text,
  p_xp_depense integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_priere prieres%ROWTYPE;
  v_niveau_max integer;
  v_xp_disponible integer;
  v_new_id uuid;
  v_xp_total integer;
  v_xp_depense integer;
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
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Le personnage est verrouillé')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF p_xp_depense IS NULL OR p_xp_depense < 0 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_depense_invalide','message','p_xp_depense doit être un entier positif ou nul')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_priere FROM prieres WHERE id = p_priere_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','priere_introuvable','message','Prière introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Croyant strict : religion_id du personnage doit correspondre
  IF v_perso.religion_id IS NULL OR v_priere.religion_id IS NULL OR v_perso.religion_id <> v_priere.religion_id THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','croyant_requis','message','La religion du personnage ne correspond pas à celle de la prière')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT niveau_max_prieres INTO v_niveau_max
    FROM vue_domaines_disponibles
   WHERE personnage_id = p_personnage_id AND domaine = v_priere.domaine;

  IF v_niveau_max IS NULL OR p_niveau_priere > v_niveau_max THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de prière supérieur au maximum autorisé pour ce domaine')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_xp_disponible := v_perso.xp_total - v_perso.xp_depense;
  IF v_xp_disponible < p_xp_depense THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  BEGIN
    INSERT INTO personnage_prieres
      (personnage_id, priere_id, niveau_priere, xp_depense, nom_personnalise, zone_choisie, portee_choisie, duree_choisie)
    VALUES
      (p_personnage_id, p_priere_id, p_niveau_priere, p_xp_depense, p_nom_personnalise, p_zone_choisie, p_portee_choisie, p_duree_choisie)
    RETURNING id INTO v_new_id;

    UPDATE personnages
       SET xp_depense = xp_depense + p_xp_depense,
           date_modification = now(),
           updated_at = now()
     WHERE id = p_personnage_id;

    IF p_xp_depense > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, priere_id, acteur_id)
      VALUES (p_personnage_id, 'depense_priere', -p_xp_depense,
              'Achat prière niveau ' || p_niveau_priere || ' (' || p_xp_depense || ' XP)',
              p_priere_id, v_uid);
    END IF;
  EXCEPTION
    WHEN check_violation OR foreign_key_violation THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense
    FROM personnages WHERE id = p_personnage_id;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_priere_id', v_new_id,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense
    )
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 5. acheter_recette
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acheter_recette(
  p_personnage_id uuid,
  p_recette_id uuid,
  p_xp_depense integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_quotas vue_artisanat_quotas%ROWTYPE;
  v_niveau_alchimie integer;
  v_quota_total integer;
  v_nb_gratuits integer;
  v_est_gratuit boolean;
  v_cout_xp integer;
  v_new_id uuid;
  v_xp_total integer;
  v_xp_depense integer;
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
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Le personnage est verrouillé')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT niveau_alchimie, quota_recettes_total
    INTO v_niveau_alchimie, v_quota_total
    FROM vue_artisanat_quotas
   WHERE personnage_id = p_personnage_id;

  IF v_niveau_alchimie IS NULL OR v_niveau_alchimie < 1 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint','message','Compétence Alchimie requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT COUNT(*)::integer INTO v_nb_gratuits
    FROM personnage_recettes
   WHERE personnage_id = p_personnage_id AND est_gratuit = true;

  IF v_nb_gratuits < v_quota_total THEN
    v_est_gratuit := true;
    v_cout_xp := 0;
  ELSE
    v_est_gratuit := false;
    IF p_xp_depense IS NULL OR p_xp_depense <= 0 THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','xp_depense_requis','message','Le quota gratuit est épuisé : p_xp_depense doit être fourni')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
    v_cout_xp := p_xp_depense;
    IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;

  BEGIN
    INSERT INTO personnage_recettes (personnage_id, recette_id, xp_depense, est_gratuit)
    VALUES (p_personnage_id, p_recette_id, v_cout_xp, v_est_gratuit)
    RETURNING id INTO v_new_id;

    IF NOT v_est_gratuit AND v_cout_xp > 0 THEN
      UPDATE personnages
         SET xp_depense = xp_depense + v_cout_xp,
             date_modification = now(),
             updated_at = now()
       WHERE id = p_personnage_id;

      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, recette_id, acteur_id)
      VALUES (p_personnage_id, 'depense_recette', -v_cout_xp,
              'Achat recette d''alchimie (' || v_cout_xp || ' XP)', p_recette_id, v_uid);
    END IF;
  EXCEPTION
    WHEN check_violation OR foreign_key_violation OR unique_violation THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense
    FROM personnages WHERE id = p_personnage_id;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'id', v_new_id,
      'est_gratuit', v_est_gratuit,
      'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense
    )
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 6. acheter_assemblage
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acheter_assemblage(
  p_personnage_id uuid,
  p_assemblage_id uuid,
  p_xp_depense integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_niveau_runes integer;
  v_quota_total integer;
  v_nb_gratuits integer;
  v_est_gratuit boolean;
  v_cout_xp integer;
  v_new_id uuid;
  v_xp_total integer;
  v_xp_depense integer;
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
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Le personnage est verrouillé')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT niveau_runes, quota_assemblages_total
    INTO v_niveau_runes, v_quota_total
    FROM vue_artisanat_quotas
   WHERE personnage_id = p_personnage_id;

  IF v_niveau_runes IS NULL OR v_niveau_runes < 1 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint','message','Compétence Assemblage de Runes requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT COUNT(*)::integer INTO v_nb_gratuits
    FROM personnage_assemblages
   WHERE personnage_id = p_personnage_id AND est_gratuit = true;

  IF v_nb_gratuits < v_quota_total THEN
    v_est_gratuit := true;
    v_cout_xp := 0;
  ELSE
    v_est_gratuit := false;
    IF p_xp_depense IS NULL OR p_xp_depense <= 0 THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','xp_depense_requis','message','Le quota gratuit est épuisé : p_xp_depense doit être fourni')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
    v_cout_xp := p_xp_depense;
    IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;

  BEGIN
    INSERT INTO personnage_assemblages (personnage_id, assemblage_id, xp_depense, est_gratuit)
    VALUES (p_personnage_id, p_assemblage_id, v_cout_xp, v_est_gratuit)
    RETURNING id INTO v_new_id;

    IF NOT v_est_gratuit AND v_cout_xp > 0 THEN
      UPDATE personnages
         SET xp_depense = xp_depense + v_cout_xp,
             date_modification = now(),
             updated_at = now()
       WHERE id = p_personnage_id;

      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, assemblage_id, acteur_id)
      VALUES (p_personnage_id, 'depense_assemblage', -v_cout_xp,
              'Achat assemblage de runes (' || v_cout_xp || ' XP)', p_assemblage_id, v_uid);
    END IF;
  EXCEPTION
    WHEN check_violation OR foreign_key_violation OR unique_violation THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense
    FROM personnages WHERE id = p_personnage_id;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'id', v_new_id,
      'est_gratuit', v_est_gratuit,
      'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense
    )
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 7. acheter_objet_forge
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acheter_objet_forge(
  p_personnage_id uuid,
  p_objet_id uuid,
  p_xp_depense integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_niveau_forge integer;
  v_difficulte integer;
  v_new_id uuid;
  v_xp_total integer;
  v_xp_depense integer;
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
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Le personnage est verrouillé')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF p_xp_depense IS NULL OR p_xp_depense < 0 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_depense_invalide','message','p_xp_depense doit être un entier positif ou nul')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT niveau_forge INTO v_niveau_forge FROM vue_artisanat_etat WHERE personnage_id = p_personnage_id;
  SELECT difficulte INTO v_difficulte FROM objets_forge WHERE id = p_objet_id;

  IF v_difficulte IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','objet_introuvable','message','Objet de forge introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF COALESCE(v_niveau_forge, 0) < v_difficulte THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint',
        'message','Niveau de Forge insuffisant (requis : ' || v_difficulte || ', actuel : ' || COALESCE(v_niveau_forge, 0) || ')')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF (v_perso.xp_total - v_perso.xp_depense) < p_xp_depense THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  BEGIN
    INSERT INTO personnage_objets_forge (personnage_id, objet_id, xp_depense)
    VALUES (p_personnage_id, p_objet_id, p_xp_depense)
    RETURNING id INTO v_new_id;

    UPDATE personnages
       SET xp_depense = xp_depense + p_xp_depense,
           date_modification = now(),
           updated_at = now()
     WHERE id = p_personnage_id;

    IF p_xp_depense > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, objet_forge_id, acteur_id)
      VALUES (p_personnage_id, 'depense_objet_forge', -p_xp_depense,
              'Achat objet de forge (' || p_xp_depense || ' XP)', p_objet_id, v_uid);
    END IF;
  EXCEPTION
    WHEN check_violation OR foreign_key_violation OR unique_violation THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense
    FROM personnages WHERE id = p_personnage_id;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'id', v_new_id,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense
    )
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 8. acheter_objet_joaillerie
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acheter_objet_joaillerie(
  p_personnage_id uuid,
  p_objet_id uuid,
  p_xp_depense integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_niveau_joaillerie integer;
  v_difficulte integer;
  v_new_id uuid;
  v_xp_total integer;
  v_xp_depense integer;
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
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Le personnage est verrouillé')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF p_xp_depense IS NULL OR p_xp_depense < 0 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_depense_invalide','message','p_xp_depense doit être un entier positif ou nul')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT niveau_joaillerie INTO v_niveau_joaillerie FROM vue_artisanat_etat WHERE personnage_id = p_personnage_id;
  SELECT difficulte INTO v_difficulte FROM objets_joaillerie WHERE id = p_objet_id;

  IF v_difficulte IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','objet_introuvable','message','Objet de joaillerie introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF COALESCE(v_niveau_joaillerie, 0) < v_difficulte THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint',
        'message','Niveau de Joaillerie insuffisant (requis : ' || v_difficulte || ', actuel : ' || COALESCE(v_niveau_joaillerie, 0) || ')')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF (v_perso.xp_total - v_perso.xp_depense) < p_xp_depense THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  BEGIN
    INSERT INTO personnage_objets_joaillerie (personnage_id, objet_id, xp_depense)
    VALUES (p_personnage_id, p_objet_id, p_xp_depense)
    RETURNING id INTO v_new_id;

    UPDATE personnages
       SET xp_depense = xp_depense + p_xp_depense,
           date_modification = now(),
           updated_at = now()
     WHERE id = p_personnage_id;

    IF p_xp_depense > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, objet_joaillerie_id, acteur_id)
      VALUES (p_personnage_id, 'depense_objet_joaillerie', -p_xp_depense,
              'Achat objet de joaillerie (' || p_xp_depense || ' XP)', p_objet_id, v_uid);
    END IF;
  EXCEPTION
    WHEN check_violation OR foreign_key_violation OR unique_violation THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense
    FROM personnages WHERE id = p_personnage_id;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'id', v_new_id,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense
    )
  );
END;
$function$;
