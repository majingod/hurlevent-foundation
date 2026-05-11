-- =====================================================================
-- Migration 2 — Phase 1.6.2 : Patch sécurité des 8 RPC d'achat
-- =====================================================================
-- Date          : 2026-05-10
-- Auteur        : Claude principal + revue humaine
-- Type          : BREAKING (changement de signatures)
-- État prod     : 0 lignes dans toutes les tables personnage_*
--                 (audit du 10 mai 2026, post-wipe)
--
-- Trou de sécurité corrigé :
--   Les 8 RPC d'achat acceptaient `p_xp_depense` ou `p_est_gratuit` du
--   client. Un client malveillant pouvait envoyer 0 et obtenir
--   gratuitement.
--
-- Patch : calcul du coût et de la gratuité côté serveur, depuis les
--   tables sources :
--     - acheter_trait_racial     : races.nb_traits_raciaux + vue_traits_par_race.cout_xp
--     - acheter_sort             : sorts.cout_xp_base (numeric → CEIL::integer)
--     - acheter_priere           : prieres.cout_xp_base (numeric → CEIL::integer)
--     - acheter_recette          : vue_artisanat_quotas + recettes_alchimie.cout_xp
--     - acheter_assemblage       : vue_artisanat_quotas + assemblages_runes.cout_xp
--     - acheter_objet_forge      : objets_forge.cout_xp + objets_forge.difficulte
--     - acheter_objet_joaillerie : objets_joaillerie.cout_xp + objets_joaillerie.difficulte
--     - sauvegarder_etape_3      : ignore est_gratuit/xp_depense du client,
--                                  recalcule selon ordre du jsonb d'entrée
--                                  (premier arrivé = premier servi pour quota gratuit)
--
-- Conventions :
--   - LANGUAGE plpgsql, SECURITY DEFINER, SET search_path TO 'public'
--   - Format retour standard : {succes, erreurs, avertissements, donnees}
--   - Paramètres p_*, variables locales v_*
--
-- Cast numeric → integer : CEIL()::integer (arrondi supérieur)
--   Justification : ne jamais sous-facturer l'XP en cas de cout_xp_base
--   fractionnaire dans sorts.cout_xp_base ou prieres.cout_xp_base.
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. acheter_trait_racial — retire p_est_gratuit
-- =====================================================================
DROP FUNCTION IF EXISTS public.acheter_trait_racial(uuid, uuid, boolean);

CREATE OR REPLACE FUNCTION public.acheter_trait_racial(
  p_personnage_id uuid,
  p_trait_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_nb_traits_gratuits_race integer;
  v_nb_gratuits_acquis integer;
  v_est_gratuit boolean;
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

  -- Calcul interne du coût : quota gratuit puis tarif payant
  SELECT nb_traits_raciaux INTO v_nb_traits_gratuits_race
    FROM races WHERE id = v_perso.race_id;
  v_nb_traits_gratuits_race := COALESCE(v_nb_traits_gratuits_race, 0);

  SELECT COUNT(*)::integer INTO v_nb_gratuits_acquis
    FROM jsonb_array_elements(COALESCE(v_perso.traits_raciaux_choisis, '[]'::jsonb)) elem
   WHERE (elem->>'est_gratuit')::boolean = true;

  IF v_nb_gratuits_acquis < v_nb_traits_gratuits_race THEN
    v_est_gratuit := true;
    v_cout_xp := 0;
  ELSE
    v_est_gratuit := false;
    SELECT cout_xp INTO v_cout_xp
      FROM vue_traits_par_race
     WHERE race_id = v_perso.race_id AND trait_id = p_trait_id
     LIMIT 1;
    v_cout_xp := COALESCE(v_cout_xp, 0);

    IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;

  BEGIN
    UPDATE personnages
       SET traits_raciaux_choisis = COALESCE(traits_raciaux_choisis, '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object(
                'trait_id', p_trait_id,
                'est_gratuit', v_est_gratuit,
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
      'est_gratuit', v_est_gratuit,
      'xp_depense_achat', v_cout_xp,
      'traits_raciaux_choisis', v_traits,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense
    )
  );
END;
$function$;

-- =====================================================================
-- 2. acheter_sort — retire p_xp_depense, lit sorts.cout_xp_base
-- =====================================================================
DROP FUNCTION IF EXISTS public.acheter_sort(uuid, uuid, integer, text, text, text, text, integer);

CREATE OR REPLACE FUNCTION public.acheter_sort(
  p_personnage_id uuid,
  p_sort_id uuid,
  p_niveau_sort integer,
  p_zone_choisie text,
  p_portee_choisie text,
  p_duree_choisie text,
  p_nom_personnalise text
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
  v_cout_xp_base numeric;
  v_cout_xp integer;
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

  SELECT cercle, cout_xp_base INTO v_cercle, v_cout_xp_base
    FROM sorts WHERE id = p_sort_id;
  IF v_cercle IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','sort_introuvable','message','Sort introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- numeric → integer (arrondi supérieur)
  v_cout_xp := CEIL(COALESCE(v_cout_xp_base, 0))::integer;

  SELECT niveau_max_sorts INTO v_niveau_max
    FROM vue_cercles_disponibles
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
    INSERT INTO personnage_sorts
      (personnage_id, sort_id, niveau_sort, xp_depense, nom_personnalise, zone_choisie, portee_choisie, duree_choisie)
    VALUES
      (p_personnage_id, p_sort_id, p_niveau_sort, v_cout_xp, p_nom_personnalise, p_zone_choisie, p_portee_choisie, p_duree_choisie)
    RETURNING id INTO v_new_id;

    UPDATE personnages
       SET xp_depense = xp_depense + v_cout_xp,
           date_modification = now(),
           updated_at = now()
     WHERE id = p_personnage_id;

    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, sort_id, acteur_id)
      VALUES (p_personnage_id, 'depense_sort', -v_cout_xp,
              'Achat sort niveau ' || p_niveau_sort || ' (' || v_cout_xp || ' XP)',
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
      'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense
    )
  );
END;
$function$;

-- =====================================================================
-- 3. acheter_priere — retire p_xp_depense, lit prieres.cout_xp_base
-- =====================================================================
DROP FUNCTION IF EXISTS public.acheter_priere(uuid, uuid, integer, text, text, text, text, integer);

CREATE OR REPLACE FUNCTION public.acheter_priere(
  p_personnage_id uuid,
  p_priere_id uuid,
  p_niveau_priere integer,
  p_zone_choisie text,
  p_portee_choisie text,
  p_duree_choisie text,
  p_nom_personnalise text
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
  v_cout_xp integer;
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

  SELECT * INTO v_priere FROM prieres WHERE id = p_priere_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','priere_introuvable','message','Prière introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF v_perso.religion_id IS NULL OR v_priere.religion_id IS NULL OR v_perso.religion_id <> v_priere.religion_id THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','croyant_requis','message','La religion du personnage ne correspond pas à celle de la prière')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- numeric → integer (arrondi supérieur)
  v_cout_xp := CEIL(COALESCE(v_priere.cout_xp_base, 0))::integer;

  SELECT niveau_max_prieres INTO v_niveau_max
    FROM vue_domaines_disponibles
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
    INSERT INTO personnage_prieres
      (personnage_id, priere_id, niveau_priere, xp_depense, nom_personnalise, zone_choisie, portee_choisie, duree_choisie)
    VALUES
      (p_personnage_id, p_priere_id, p_niveau_priere, v_cout_xp, p_nom_personnalise, p_zone_choisie, p_portee_choisie, p_duree_choisie)
    RETURNING id INTO v_new_id;

    UPDATE personnages
       SET xp_depense = xp_depense + v_cout_xp,
           date_modification = now(),
           updated_at = now()
     WHERE id = p_personnage_id;

    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, priere_id, acteur_id)
      VALUES (p_personnage_id, 'depense_priere', -v_cout_xp,
              'Achat prière niveau ' || p_niveau_priere || ' (' || v_cout_xp || ' XP)',
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
      'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense
    )
  );
END;
$function$;

-- =====================================================================
-- 4. acheter_recette — retire p_xp_depense, lit recettes_alchimie.cout_xp
-- =====================================================================
DROP FUNCTION IF EXISTS public.acheter_recette(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.acheter_recette(
  p_personnage_id uuid,
  p_recette_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
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
    -- Lecture interne du coût payant
    SELECT cout_xp INTO v_cout_xp FROM recettes_alchimie WHERE id = p_recette_id;
    IF v_cout_xp IS NULL THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','recette_introuvable','message','Recette introuvable ou sans coût défini')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
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

-- =====================================================================
-- 5. acheter_assemblage — retire p_xp_depense, lit assemblages_runes.cout_xp
-- =====================================================================
DROP FUNCTION IF EXISTS public.acheter_assemblage(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.acheter_assemblage(
  p_personnage_id uuid,
  p_assemblage_id uuid
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
    -- Lecture interne du coût payant
    SELECT cout_xp INTO v_cout_xp FROM assemblages_runes WHERE id = p_assemblage_id;
    IF v_cout_xp IS NULL THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','assemblage_introuvable','message','Assemblage introuvable ou sans coût défini')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
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

-- =====================================================================
-- 6. acheter_objet_forge — retire p_xp_depense, lit objets_forge.cout_xp
-- =====================================================================
DROP FUNCTION IF EXISTS public.acheter_objet_forge(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.acheter_objet_forge(
  p_personnage_id uuid,
  p_objet_id uuid
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

  SELECT niveau_forge INTO v_niveau_forge FROM vue_artisanat_etat WHERE personnage_id = p_personnage_id;
  SELECT difficulte, cout_xp INTO v_difficulte, v_cout_xp FROM objets_forge WHERE id = p_objet_id;

  IF v_difficulte IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','objet_introuvable','message','Objet de forge introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_cout_xp := COALESCE(v_cout_xp, 0);

  IF COALESCE(v_niveau_forge, 0) < v_difficulte THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint',
        'message','Niveau de Forge insuffisant (requis : ' || v_difficulte || ', actuel : ' || COALESCE(v_niveau_forge, 0) || ')')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  BEGIN
    INSERT INTO personnage_objets_forge (personnage_id, objet_id, xp_depense)
    VALUES (p_personnage_id, p_objet_id, v_cout_xp)
    RETURNING id INTO v_new_id;

    UPDATE personnages
       SET xp_depense = xp_depense + v_cout_xp,
           date_modification = now(),
           updated_at = now()
     WHERE id = p_personnage_id;

    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, objet_forge_id, acteur_id)
      VALUES (p_personnage_id, 'depense_objet_forge', -v_cout_xp,
              'Achat objet de forge (' || v_cout_xp || ' XP)', p_objet_id, v_uid);
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
      'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense
    )
  );
END;
$function$;

-- =====================================================================
-- 7. acheter_objet_joaillerie — retire p_xp_depense, lit objets_joaillerie.cout_xp
-- =====================================================================
DROP FUNCTION IF EXISTS public.acheter_objet_joaillerie(uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.acheter_objet_joaillerie(
  p_personnage_id uuid,
  p_objet_id uuid
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

  SELECT niveau_joaillerie INTO v_niveau_joaillerie FROM vue_artisanat_etat WHERE personnage_id = p_personnage_id;
  SELECT difficulte, cout_xp INTO v_difficulte, v_cout_xp FROM objets_joaillerie WHERE id = p_objet_id;

  IF v_difficulte IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','objet_introuvable','message','Objet de joaillerie introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_cout_xp := COALESCE(v_cout_xp, 0);

  IF COALESCE(v_niveau_joaillerie, 0) < v_difficulte THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint',
        'message','Niveau de Joaillerie insuffisant (requis : ' || v_difficulte || ', actuel : ' || COALESCE(v_niveau_joaillerie, 0) || ')')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  BEGIN
    INSERT INTO personnage_objets_joaillerie (personnage_id, objet_id, xp_depense)
    VALUES (p_personnage_id, p_objet_id, v_cout_xp)
    RETURNING id INTO v_new_id;

    UPDATE personnages
       SET xp_depense = xp_depense + v_cout_xp,
           date_modification = now(),
           updated_at = now()
     WHERE id = p_personnage_id;

    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, objet_joaillerie_id, acteur_id)
      VALUES (p_personnage_id, 'depense_objet_joaillerie', -v_cout_xp,
              'Achat objet de joaillerie (' || v_cout_xp || ' XP)', p_objet_id, v_uid);
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
      'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense
    )
  );
END;
$function$;

-- =====================================================================
-- 8. sauvegarder_etape_3 — recalcule est_gratuit et xp_depense en interne
-- =====================================================================
-- Signature inchangée. Accepte toujours le jsonb du client mais IGNORE
-- les champs est_gratuit et xp_depense pour les recalculer côté serveur :
--   - est_gratuit = true pour les K premiers traits (K = races.nb_traits_raciaux)
--   - xp_depense lu depuis vue_traits_par_race.cout_xp
--   - premier arrivé, premier servi pour le quota gratuit
-- =====================================================================

CREATE OR REPLACE FUNCTION public.sauvegarder_etape_3(
  p_personnage_id uuid,
  p_traits_raciaux_choisis jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_perso public.personnages%ROWTYPE;
  v_nb_traits_gratuits_race integer;
  v_traits_recalcules jsonb := '[]'::jsonb;
  v_validation jsonb;
  v_etape_apres integer;
  v_trait jsonb;
  v_trait_id uuid;
  v_cout_xp integer;
  v_est_gratuit boolean;
  v_trait_nom text;
  v_index integer := 0;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Ce personnage ne vous appartient pas.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF v_perso.est_verrouille THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Ce personnage est verrouillé et ne peut plus être modifié.')),
      'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END IF;

  -- Quota gratuit de la race
  SELECT nb_traits_raciaux INTO v_nb_traits_gratuits_race
    FROM public.races WHERE id = v_perso.race_id;
  v_nb_traits_gratuits_race := COALESCE(v_nb_traits_gratuits_race, 0);

  -- Réécriture idempotente : on supprime les anciennes dépenses 'depense_trait'
  -- et on régénère le jsonb + l'historique selon le recalcul serveur.
  -- Le trigger sync_xp_personnage recalcule ensuite xp_depense automatiquement.
  BEGIN
    DELETE FROM public.historique_xp
    WHERE personnage_id = p_personnage_id
      AND type_mouvement = 'depense_trait';

    FOR v_trait IN
      SELECT value FROM jsonb_array_elements(COALESCE(p_traits_raciaux_choisis, '[]'::jsonb))
    LOOP
      v_trait_id := (v_trait->>'trait_id')::uuid;

      -- Premier arrivé = gratuit jusqu'à épuisement du quota race
      IF v_index < v_nb_traits_gratuits_race THEN
        v_est_gratuit := true;
        v_cout_xp := 0;
      ELSE
        v_est_gratuit := false;
        SELECT cout_xp INTO v_cout_xp
          FROM public.vue_traits_par_race
         WHERE race_id = v_perso.race_id AND trait_id = v_trait_id
         LIMIT 1;
        v_cout_xp := COALESCE(v_cout_xp, 0);
      END IF;

      v_traits_recalcules := v_traits_recalcules || jsonb_build_array(jsonb_build_object(
        'trait_id', v_trait_id,
        'est_gratuit', v_est_gratuit,
        'xp_depense', v_cout_xp
      ));

      IF NOT v_est_gratuit AND v_cout_xp > 0 THEN
        SELECT nom INTO v_trait_nom FROM public.traits_raciaux WHERE id = v_trait_id;
        INSERT INTO public.historique_xp
          (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
        VALUES
          (p_personnage_id, 'depense_trait', -v_cout_xp,
           format('Achat trait racial : %s', COALESCE(v_trait_nom, v_trait_id::text)),
           v_trait_id, v_joueur_id);
      END IF;

      v_index := v_index + 1;
    END LOOP;

    UPDATE public.personnages
       SET traits_raciaux_choisis = v_traits_recalcules
     WHERE id = p_personnage_id;
  EXCEPTION
    WHEN check_violation OR foreign_key_violation THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
        'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END;

  v_validation := public.valider_etape_3(p_personnage_id);

  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
  END IF;

  IF v_perso.etape_creation = 3 THEN
    UPDATE public.personnages SET etape_creation = 4 WHERE id = p_personnage_id;
    v_etape_apres := 4;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_id', p_personnage_id,
      'etape_creation_apres', v_etape_apres,
      'traits_raciaux_choisis', v_traits_recalcules
    )
  );
END;
$function$;

COMMIT;

-- =====================================================================
-- FIN Migration 2 — Phase 1.6.2 patch sécurité achats
-- =====================================================================
