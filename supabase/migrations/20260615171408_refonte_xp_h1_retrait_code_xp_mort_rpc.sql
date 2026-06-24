-- H1 (REFONTE-XP) : retrait du code XP mort (deltas sur le cache personnages.xp_depense).
-- Contexte : recalculer_xp_valeurs dérive xp_depense du ledger historique_xp
-- (SUM(depense_*) - SUM(remboursement)) ; le trigger AFTER sync_xp_personnage sur
-- historique_xp recompute et ÉCRASE toute écriture directe du cache. Chaque delta retiré
-- ici est systématiquement accompagné, dans le même bloc, d'un row historique_xp
-- (depense_*/remboursement) -> recompute correct. Les deltas sont donc du code mort.
-- Le touch « date_modification = now(), updated_at = now() » est CONSERVÉ
-- (set_updated_at() ne pose qu'updated_at ; date_modification n'a pas d'autre writer).
-- No-op fonctionnel ; supprime un footgun (réordonnancement insert/delta -> double comptage).

-- 1/8 ───────────────────────────────────────────────────────── acheter_competence
CREATE OR REPLACE FUNCTION public.acheter_competence(p_personnage_id uuid, p_competence_id uuid, p_niveau_desire integer, p_choix_achat text DEFAULT NULL::text, p_appris_via_maitre boolean DEFAULT false, p_nom_maitre text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_check jsonb; v_niveaux jsonb;
  v_cout_xp integer; v_xp_disponible integer;
  v_new_id uuid; v_xp_total integer; v_xp_depense integer; v_statut text;
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
  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_blocage := public.gate_edition_personnage(p_personnage_id, 'ajout');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
  v_check := peut_acheter_competence(p_personnage_id, p_competence_id, p_niveau_desire, p_choix_achat);
  IF NOT (v_check->>'peut_acheter')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_refuse','message', COALESCE(v_check->>'raison','Achat refusé'))),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT niveaux INTO v_niveaux FROM competences WHERE id = p_competence_id;
  IF v_niveaux IS NULL OR jsonb_array_length(v_niveaux) < p_niveau_desire THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de compétence invalide')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_cout_xp := COALESCE((v_niveaux->(p_niveau_desire - 1)->>'cout_xp')::integer, 0);
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
    VALUES (p_personnage_id, p_competence_id, p_niveau_desire, p_appris_via_maitre, v_cout_xp, p_nom_maitre, v_statut, p_choix_achat)
    RETURNING id INTO v_new_id;
    UPDATE personnages SET date_modification = now(), updated_at = now()
     WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, competence_id, acteur_id)
      VALUES (p_personnage_id, 'depense_competence', -v_cout_xp,
              'Achat compétence niveau ' || p_niveau_desire || ' (' || v_cout_xp || ' XP)',
              p_competence_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'acheter_competence', jsonb_build_object('competence_id', p_competence_id, 'nom', (SELECT nom FROM competences WHERE id = p_competence_id), 'niveau', p_niveau_desire, 'cout_xp', v_cout_xp));
  END IF;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_competence_id', v_new_id,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;

-- 2/8 ────────────────────────────────────────────────────────────────── acheter_priere
CREATE OR REPLACE FUNCTION public.acheter_priere(p_personnage_id uuid, p_priere_id uuid, p_niveau_priere integer, p_zone_choisie text, p_portee_choisie text, p_duree_choisie text, p_nom_personnalise text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_priere prieres%ROWTYPE;
  v_cout_xp integer; v_niveau_max integer; v_xp_disponible integer;
  v_new_id uuid; v_xp_total integer; v_xp_depense integer;
  v_duree_inc integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_perso FROM personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_blocage := public.gate_edition_personnage(p_personnage_id, 'ajout');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
  SELECT * INTO v_priere FROM prieres WHERE id = p_priere_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','priere_introuvable','message','Prière introuvable')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  -- FIX session 26 : check religion supprime (cf. religions.domaines_proscrits + vue_domaines_disponibles).
  v_cout_xp := public.calculer_cout_xp_magie(p_zone_choisie, p_portee_choisie, p_duree_choisie, p_niveau_priere, v_priere.cout_xp_base);
  SELECT niveau_max_prieres INTO v_niveau_max FROM vue_domaines_disponibles WHERE personnage_id = p_personnage_id AND domaine = v_priere.domaine;
  IF v_niveau_max IS NULL OR p_niveau_priere > v_niveau_max THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de prière supérieur au maximum autorisé pour ce domaine')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_xp_disponible := v_perso.xp_total - v_perso.xp_depense;
  IF v_xp_disponible < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  -- session 92 : durée d'incantation autoritative (manuel 2026)
  v_duree_inc := public.calculer_duree_incantation_priere(p_portee_choisie, p_zone_choisie, p_duree_choisie, p_niveau_priere);
  BEGIN
    INSERT INTO personnage_prieres (personnage_id, priere_id, niveau_priere, xp_depense, nom_personnalise, zone_choisie, portee_choisie, duree_choisie, duree_incantation_calculee)
    VALUES (p_personnage_id, p_priere_id, p_niveau_priere, v_cout_xp, p_nom_personnalise, p_zone_choisie, p_portee_choisie, p_duree_choisie, v_duree_inc)
    RETURNING id INTO v_new_id;
    UPDATE personnages SET date_modification = now(), updated_at = now() WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, priere_id, acteur_id)
      VALUES (p_personnage_id, 'depense_priere', -v_cout_xp, 'Achat prière niveau ' || p_niveau_priere || ' (' || v_cout_xp || ' XP)', p_priere_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'acheter_priere', jsonb_build_object('priere_id', p_priere_id, 'nom', (SELECT nom FROM prieres WHERE id = p_priere_id), 'niveau', p_niveau_priere, 'cout_xp', v_cout_xp));
  END IF;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_priere_id', v_new_id, 'xp_depense_achat', v_cout_xp, 'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense, 'duree_incantation_calculee', v_duree_inc));
END;
$function$;

-- 3/8 ──────────────────────────────────────────────────────────────────── acheter_sort
CREATE OR REPLACE FUNCTION public.acheter_sort(p_personnage_id uuid, p_sort_id uuid, p_niveau_sort integer, p_zone_choisie text, p_portee_choisie text, p_duree_choisie text, p_nom_personnalise text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_cercle text; v_cout_xp_base numeric; v_cout_xp integer; v_niveau_max integer;
  v_xp_disponible integer; v_new_id uuid; v_xp_total integer; v_xp_depense integer;
  v_formule_magique text;
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
  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_blocage := public.gate_edition_personnage(p_personnage_id, 'ajout');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
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
  -- NEW session 27 : formule magique calculee auto (manuel 2026)
  v_formule_magique := public.generer_formule_magique(
    v_cercle, p_zone_choisie, p_portee_choisie, p_duree_choisie, p_niveau_sort
  );
  SELECT niveau_max_sorts INTO v_niveau_max FROM vue_cercles_disponibles
   WHERE personnage_id = p_personnage_id AND cercle = v_cercle;
  IF v_niveau_max IS NULL OR p_niveau_sort > v_niveau_max THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de sort superieur au maximum autorise pour ce cercle')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_xp_disponible := v_perso.xp_total - v_perso.xp_depense;
  IF v_xp_disponible < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  BEGIN
    INSERT INTO personnage_sorts (personnage_id, sort_id, niveau_sort, xp_depense, nom_personnalise, zone_choisie, portee_choisie, duree_choisie, formule_magique)
    VALUES (p_personnage_id, p_sort_id, p_niveau_sort, v_cout_xp, p_nom_personnalise, p_zone_choisie, p_portee_choisie, p_duree_choisie, v_formule_magique)
    RETURNING id INTO v_new_id;
    UPDATE personnages SET date_modification = now(), updated_at = now()
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
  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'acheter_sort', jsonb_build_object('sort_id', p_sort_id, 'nom', (SELECT nom FROM sorts WHERE id = p_sort_id), 'niveau', p_niveau_sort, 'cout_xp', v_cout_xp));
  END IF;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_sort_id', v_new_id, 'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;

-- 4/8 ─────────────────────────────────────────────────────────── acheter_trait_racial
-- NB : la clé 'xp_depense' du jsonb traits_raciaux_choisis est CONSERVÉE (coût par trait,
-- légitime) ; seul le delta cache « xp_depense = xp_depense + v_cout_xp » est retiré.
CREATE OR REPLACE FUNCTION public.acheter_trait_racial(p_personnage_id uuid, p_trait_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_nb_traits_gratuits_race integer; v_nb_gratuits_acquis integer;
  v_est_gratuit boolean; v_cout_xp integer := 0;
  v_check jsonb; v_xp_total integer; v_xp_depense integer; v_traits jsonb;
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
  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_blocage := public.gate_edition_personnage(p_personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
  v_check := peut_acheter_trait_racial(p_personnage_id, p_trait_id, v_perso.race_id, v_perso.sous_type_chimeride);
  IF NOT (v_check->>'peut_acheter')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_refuse','message', COALESCE(v_check->>'raison','Achat refusé'))),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT nb_traits_raciaux INTO v_nb_traits_gratuits_race FROM races WHERE id = v_perso.race_id;
  v_nb_traits_gratuits_race := COALESCE(v_nb_traits_gratuits_race, 0);
  SELECT COUNT(*)::integer INTO v_nb_gratuits_acquis
    FROM jsonb_array_elements(COALESCE(v_perso.traits_raciaux_choisis, '[]'::jsonb)) elem
   WHERE (elem->>'est_gratuit')::boolean = true;
  IF v_nb_gratuits_acquis < v_nb_traits_gratuits_race THEN
    v_est_gratuit := true; v_cout_xp := 0;
  ELSE
    v_est_gratuit := false;
    SELECT cout_xp INTO v_cout_xp FROM vue_traits_par_race
     WHERE race_id = v_perso.race_id AND trait_id = p_trait_id LIMIT 1;
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
                'trait_id', p_trait_id, 'est_gratuit', v_est_gratuit, 'xp_depense', v_cout_xp)),
           date_modification = now(), updated_at = now()
     WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
      VALUES (p_personnage_id, 'depense_trait', -v_cout_xp,
              'Achat trait racial (' || v_cout_xp || ' XP)', p_trait_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense, traits_raciaux_choisis INTO v_xp_total, v_xp_depense, v_traits
    FROM personnages WHERE id = p_personnage_id;
  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'acheter_trait_racial', jsonb_build_object('trait_id', p_trait_id, 'nom', (SELECT nom FROM traits_raciaux WHERE id = p_trait_id), 'cout_xp', v_cout_xp));
  END IF;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('est_gratuit', v_est_gratuit, 'xp_depense_achat', v_cout_xp,
      'traits_raciaux_choisis', v_traits, 'xp_total', v_xp_total,
      'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;

-- 5/8 ─────────────────────────────────────────────────────────────── desacheter_priere
CREATE OR REPLACE FUNCTION public.desacheter_priere(p_personnage_priere_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_campagne boolean := false;
  v_photo jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_pp personnage_prieres%ROWTYPE;
  v_xp_total_apres integer;
  v_xp_depense_apres integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_pp FROM personnage_prieres WHERE id = p_personnage_priere_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cette prière n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_pp.personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_blocage := public.gate_edition_personnage(v_pp.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN
    IF (public.etat_edition_personnage(v_pp.personnage_id)->>'etat') = 'campagne' THEN
      v_campagne := true;
    ELSE
      RETURN v_blocage;
    END IF;
  END IF;

  -- INV-1/INV-3 : match par instance ; repli conservateur par prière de base
  -- pour les photos antérieures au format instance_id.
  IF v_campagne THEN
    v_photo := public.derniere_photo_compo(v_pp.personnage_id);
    IF v_photo IS NULL OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_photo->'prieres','[]'::jsonb)) e
      WHERE CASE
        WHEN e.value ? 'instance_id'
          THEN (e.value->>'instance_id')::uuid = p_personnage_priere_id
        ELSE (e.value->>'id')::uuid = v_pp.priere_id
      END
    ) THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','acquis_intouchable','message','Cette prière fait partie des acquis du personnage (dernière présence confirmée) — elle ne peut pas être annulée en campagne.')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;

  DELETE FROM personnage_prieres WHERE id = p_personnage_priere_id;

  IF v_pp.xp_depense > 0 THEN
    UPDATE personnages
    SET date_modification = now(),
        updated_at = now()
    WHERE id = v_pp.personnage_id;

    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, priere_id, acteur_id)
    VALUES (v_pp.personnage_id, 'remboursement', v_pp.xp_depense,
      'Remboursement prière (' || v_pp.xp_depense || ' XP)', v_pp.priere_id, v_uid);
  END IF;

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
  FROM personnages WHERE id = v_pp.personnage_id;

  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'desacheter_priere', jsonb_build_object('personnage_priere_id', p_personnage_priere_id, 'nom', (SELECT nom FROM prieres WHERE id = v_pp.priere_id), 'niveau', v_pp.niveau_priere, 'xp_rembourse', v_pp.xp_depense));
  END IF;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_priere_id', p_personnage_priere_id,
      'priere_id', v_pp.priere_id,
      'xp_rembourse', v_pp.xp_depense,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres));
END;
$function$;

-- 6/8 ──────────────────────────────────────────────────────────────── desacheter_sort
CREATE OR REPLACE FUNCTION public.desacheter_sort(p_personnage_sort_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_campagne boolean := false;
  v_photo jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_ps personnage_sorts%ROWTYPE;
  v_xp_total_apres integer;
  v_xp_depense_apres integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_ps FROM personnage_sorts WHERE id = p_personnage_sort_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Ce sort n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_ps.personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_blocage := public.gate_edition_personnage(v_ps.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN
    IF (public.etat_edition_personnage(v_ps.personnage_id)->>'etat') = 'campagne' THEN
      v_campagne := true;
    ELSE
      RETURN v_blocage;
    END IF;
  END IF;

  -- INV-1/INV-3 : en campagne, seul un sort hors de la dernière photo est annulable.
  -- Match par instance (entrées photo avec instance_id) ; repli conservateur par
  -- sort de base pour les photos antérieures au format instance_id.
  IF v_campagne THEN
    v_photo := public.derniere_photo_compo(v_ps.personnage_id);
    IF v_photo IS NULL OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_photo->'sorts','[]'::jsonb)) e
      WHERE CASE
        WHEN e.value ? 'instance_id'
          THEN (e.value->>'instance_id')::uuid = p_personnage_sort_id
        ELSE (e.value->>'id')::uuid = v_ps.sort_id
      END
    ) THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','acquis_intouchable','message','Ce sort fait partie des acquis du personnage (dernière présence confirmée) — il ne peut pas être annulé en campagne.')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;

  DELETE FROM personnage_sorts WHERE id = p_personnage_sort_id;

  IF v_ps.xp_depense > 0 THEN
    UPDATE personnages
    SET date_modification = now(),
        updated_at = now()
    WHERE id = v_ps.personnage_id;

    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, sort_id, acteur_id)
    VALUES (v_ps.personnage_id, 'remboursement', v_ps.xp_depense,
      'Remboursement sort (' || v_ps.xp_depense || ' XP)', v_ps.sort_id, v_uid);
  END IF;

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
  FROM personnages WHERE id = v_ps.personnage_id;

  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'desacheter_sort', jsonb_build_object('personnage_sort_id', p_personnage_sort_id, 'nom', (SELECT nom FROM sorts WHERE id = v_ps.sort_id), 'niveau', v_ps.niveau_sort, 'xp_rembourse', v_ps.xp_depense));
  END IF;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_sort_id', p_personnage_sort_id,
      'sort_id', v_ps.sort_id,
      'xp_rembourse', v_ps.xp_depense,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres));
END;
$function$;

-- 7/8 ─────────────────────────────────────────────────────────────────── modifier_priere
CREATE OR REPLACE FUNCTION public.modifier_priere(p_personnage_priere_id uuid, p_niveau_priere integer, p_zone_choisie text, p_portee_choisie text, p_duree_choisie text, p_nom_personnalise text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_campagne boolean := false;
  v_photo jsonb;
  v_entry jsonb;
  v_floor jsonb := NULL;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_pp personnage_prieres%ROWTYPE;
  v_priere prieres%ROWTYPE;
  v_niveau_max integer;
  v_cout_nouveau integer;
  v_diff integer;
  v_duree_inc integer;
  v_xp_total integer; v_xp_depense integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_pp FROM personnage_prieres WHERE id = p_personnage_priere_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cette prière n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_pp.personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_blocage := public.gate_edition_personnage(v_pp.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN
    IF (public.etat_edition_personnage(v_pp.personnage_id)->>'etat') = 'campagne' THEN
      v_campagne := true;
    ELSE
      RETURN v_blocage;
    END IF;
  END IF;

  IF v_campagne THEN
    v_photo := public.derniere_photo_compo(v_pp.personnage_id);
    IF v_photo IS NULL THEN
      v_floor := jsonb_build_object('niveau', v_pp.niveau_priere, 'zone', v_pp.zone_choisie,
                                    'portee', v_pp.portee_choisie, 'duree', v_pp.duree_choisie);
    ELSE
      SELECT e.value INTO v_entry
      FROM jsonb_array_elements(COALESCE(v_photo->'prieres','[]'::jsonb)) e
      WHERE e.value ? 'instance_id'
        AND (e.value->>'instance_id')::uuid = p_personnage_priere_id;
      IF v_entry IS NOT NULL THEN
        v_floor := jsonb_build_object('niveau', (v_entry->>'niveau')::int, 'zone', v_entry->>'zone',
                                      'portee', v_entry->>'portee', 'duree', v_entry->>'duree');
      ELSIF EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(v_photo->'prieres','[]'::jsonb)) e
        WHERE NOT (e.value ? 'instance_id') AND (e.value->>'id')::uuid = v_pp.priere_id
      ) THEN
        v_floor := jsonb_build_object('niveau', v_pp.niveau_priere, 'zone', v_pp.zone_choisie,
                                      'portee', v_pp.portee_choisie, 'duree', v_pp.duree_choisie);
      END IF;
    END IF;
  END IF;

  IF v_floor IS NOT NULL THEN
    IF p_niveau_priere < (v_floor->>'niveau')::int
       OR public.cout_pts_zone(p_zone_choisie) < public.cout_pts_zone(v_floor->>'zone')
       OR public.cout_pts_portee(p_portee_choisie) < public.cout_pts_portee(v_floor->>'portee')
       OR public.cout_pts_duree(p_duree_choisie) < public.cout_pts_duree(v_floor->>'duree') THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','acquis_regression','message','Cette prière fait partie des acquis du personnage : son niveau et ses variables ne peuvent pas descendre sous la dernière présence confirmée.')),
        'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('plancher', v_floor));
    END IF;
  END IF;

  SELECT * INTO v_priere FROM prieres WHERE id = v_pp.priere_id;

  SELECT niveau_max_prieres INTO v_niveau_max FROM vue_domaines_disponibles
   WHERE personnage_id = v_pp.personnage_id AND domaine = v_priere.domaine;
  IF v_niveau_max IS NULL OR p_niveau_priere > v_niveau_max THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de prière supérieur au maximum autorisé pour ce domaine')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_cout_nouveau := public.calculer_cout_xp_magie(
    p_zone_choisie, p_portee_choisie, p_duree_choisie, p_niveau_priere, v_priere.cout_xp_base);
  v_diff := v_cout_nouveau - v_pp.xp_depense;

  IF v_diff > 0 AND (v_perso.xp_total - v_perso.xp_depense) < v_diff THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_duree_inc := public.calculer_duree_incantation_priere(
    p_portee_choisie, p_zone_choisie, p_duree_choisie, p_niveau_priere);

  BEGIN
    UPDATE personnage_prieres
    SET niveau_priere = p_niveau_priere,
        zone_choisie = p_zone_choisie,
        portee_choisie = p_portee_choisie,
        duree_choisie = p_duree_choisie,
        xp_depense = v_cout_nouveau,
        nom_personnalise = COALESCE(p_nom_personnalise, nom_personnalise),
        duree_incantation_calculee = v_duree_inc
    WHERE id = p_personnage_priere_id;

    IF v_diff <> 0 THEN
      UPDATE personnages
      SET date_modification = now(), updated_at = now()
      WHERE id = v_pp.personnage_id;

      IF v_diff > 0 THEN
        INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, priere_id, acteur_id)
        VALUES (v_pp.personnage_id, 'depense_priere', -v_diff,
          'Modification prière niveau ' || p_niveau_priere || ' (' || v_diff || ' XP)', v_pp.priere_id, v_uid);
      ELSE
        INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, priere_id, acteur_id)
        VALUES (v_pp.personnage_id, 'remboursement', -v_diff,
          'Modification prière niveau ' || p_niveau_priere || ' (remboursement ' || (-v_diff) || ' XP)', v_pp.priere_id, v_uid);
      END IF;
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense
  FROM personnages WHERE id = v_pp.personnage_id;

  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'modifier_priere', jsonb_build_object(
      'personnage_priere_id', p_personnage_priere_id,
      'nom', v_priere.nom,
      'avant', jsonb_build_object('niveau', v_pp.niveau_priere, 'zone', v_pp.zone_choisie, 'portee', v_pp.portee_choisie, 'duree', v_pp.duree_choisie, 'xp', v_pp.xp_depense),
      'apres', jsonb_build_object('niveau', p_niveau_priere, 'zone', p_zone_choisie, 'portee', p_portee_choisie, 'duree', p_duree_choisie, 'xp', v_cout_nouveau),
      'xp_diff', v_diff));
  END IF;

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_priere_id', p_personnage_priere_id,
      'cout_avant', v_pp.xp_depense,
      'cout_apres', v_cout_nouveau,
      'xp_diff', v_diff,
      'duree_incantation_calculee', v_duree_inc,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;

-- 8/8 ──────────────────────────────────────────────────────────────────── modifier_sort
CREATE OR REPLACE FUNCTION public.modifier_sort(p_personnage_sort_id uuid, p_niveau_sort integer, p_zone_choisie text, p_portee_choisie text, p_duree_choisie text, p_nom_personnalise text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_campagne boolean := false;
  v_photo jsonb;
  v_entry jsonb;
  v_floor jsonb := NULL;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_ps personnage_sorts%ROWTYPE;
  v_sort sorts%ROWTYPE;
  v_niveau_max integer;
  v_cout_nouveau integer;
  v_diff integer;
  v_formule text;
  v_xp_total integer; v_xp_depense integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_ps FROM personnage_sorts WHERE id = p_personnage_sort_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Ce sort n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_ps.personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_blocage := public.gate_edition_personnage(v_ps.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN
    IF (public.etat_edition_personnage(v_ps.personnage_id)->>'etat') = 'campagne' THEN
      v_campagne := true;
    ELSE
      RETURN v_blocage;
    END IF;
  END IF;

  -- Plancher (campagne) : la photo fige les valeurs minimales de CETTE instance.
  -- Instance absente de la photo = ajout de la fenêtre courante → modification libre.
  -- Photo ancien format (sans instance_id) : repli conservateur = valeurs actuelles
  -- (montée seule), auto-guéri à la photo suivante.
  IF v_campagne THEN
    v_photo := public.derniere_photo_compo(v_ps.personnage_id);
    IF v_photo IS NULL THEN
      v_floor := jsonb_build_object('niveau', v_ps.niveau_sort, 'zone', v_ps.zone_choisie,
                                    'portee', v_ps.portee_choisie, 'duree', v_ps.duree_choisie);
    ELSE
      SELECT e.value INTO v_entry
      FROM jsonb_array_elements(COALESCE(v_photo->'sorts','[]'::jsonb)) e
      WHERE e.value ? 'instance_id'
        AND (e.value->>'instance_id')::uuid = p_personnage_sort_id;
      IF v_entry IS NOT NULL THEN
        v_floor := jsonb_build_object('niveau', (v_entry->>'niveau')::int, 'zone', v_entry->>'zone',
                                      'portee', v_entry->>'portee', 'duree', v_entry->>'duree');
      ELSIF EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(v_photo->'sorts','[]'::jsonb)) e
        WHERE NOT (e.value ? 'instance_id') AND (e.value->>'id')::uuid = v_ps.sort_id
      ) THEN
        v_floor := jsonb_build_object('niveau', v_ps.niveau_sort, 'zone', v_ps.zone_choisie,
                                      'portee', v_ps.portee_choisie, 'duree', v_ps.duree_choisie);
      END IF;
    END IF;
  END IF;

  IF v_floor IS NOT NULL THEN
    IF p_niveau_sort < (v_floor->>'niveau')::int
       OR public.cout_pts_zone(p_zone_choisie) < public.cout_pts_zone(v_floor->>'zone')
       OR public.cout_pts_portee(p_portee_choisie) < public.cout_pts_portee(v_floor->>'portee')
       OR public.cout_pts_duree(p_duree_choisie) < public.cout_pts_duree(v_floor->>'duree') THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','acquis_regression','message','Ce sort fait partie des acquis du personnage : son niveau et ses variables ne peuvent pas descendre sous la dernière présence confirmée.')),
        'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('plancher', v_floor));
    END IF;
  END IF;

  SELECT * INTO v_sort FROM sorts WHERE id = v_ps.sort_id;

  SELECT niveau_max_sorts INTO v_niveau_max FROM vue_cercles_disponibles
   WHERE personnage_id = v_ps.personnage_id AND cercle = v_sort.cercle;
  IF v_niveau_max IS NULL OR p_niveau_sort > v_niveau_max THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de sort superieur au maximum autorise pour ce cercle')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_cout_nouveau := public.calculer_cout_xp_magie(
    p_zone_choisie, p_portee_choisie, p_duree_choisie, p_niveau_sort, v_sort.cout_xp_base);
  v_diff := v_cout_nouveau - v_ps.xp_depense;

  IF v_diff > 0 AND (v_perso.xp_total - v_perso.xp_depense) < v_diff THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_formule := public.generer_formule_magique(
    v_sort.cercle, p_zone_choisie, p_portee_choisie, p_duree_choisie, p_niveau_sort);

  BEGIN
    UPDATE personnage_sorts
    SET niveau_sort = p_niveau_sort,
        zone_choisie = p_zone_choisie,
        portee_choisie = p_portee_choisie,
        duree_choisie = p_duree_choisie,
        xp_depense = v_cout_nouveau,
        nom_personnalise = COALESCE(p_nom_personnalise, nom_personnalise),
        formule_magique = v_formule
    WHERE id = p_personnage_sort_id;

    IF v_diff <> 0 THEN
      UPDATE personnages
      SET date_modification = now(), updated_at = now()
      WHERE id = v_ps.personnage_id;

      IF v_diff > 0 THEN
        INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, sort_id, acteur_id)
        VALUES (v_ps.personnage_id, 'depense_sort', -v_diff,
          'Modification sort niveau ' || p_niveau_sort || ' (' || v_diff || ' XP)', v_ps.sort_id, v_uid);
      ELSE
        INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, sort_id, acteur_id)
        VALUES (v_ps.personnage_id, 'remboursement', -v_diff,
          'Modification sort niveau ' || p_niveau_sort || ' (remboursement ' || (-v_diff) || ' XP)', v_ps.sort_id, v_uid);
      END IF;
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense
  FROM personnages WHERE id = v_ps.personnage_id;

  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'modifier_sort', jsonb_build_object(
      'personnage_sort_id', p_personnage_sort_id,
      'nom', v_sort.nom,
      'avant', jsonb_build_object('niveau', v_ps.niveau_sort, 'zone', v_ps.zone_choisie, 'portee', v_ps.portee_choisie, 'duree', v_ps.duree_choisie, 'xp', v_ps.xp_depense),
      'apres', jsonb_build_object('niveau', p_niveau_sort, 'zone', p_zone_choisie, 'portee', p_portee_choisie, 'duree', p_duree_choisie, 'xp', v_cout_nouveau),
      'xp_diff', v_diff));
  END IF;

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_sort_id', p_personnage_sort_id,
      'cout_avant', v_ps.xp_depense,
      'cout_apres', v_cout_nouveau,
      'xp_diff', v_diff,
      'formule_magique', v_formule,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;
