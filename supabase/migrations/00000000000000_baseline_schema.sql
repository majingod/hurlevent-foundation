--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: acheter_assemblage(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acheter_assemblage(p_personnage_id uuid, p_assemblage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
  SELECT niveau_runes, quota_assemblages_total INTO v_niveau_runes, v_quota_total
    FROM vue_artisanat_quotas WHERE personnage_id = p_personnage_id;
  IF v_niveau_runes IS NULL OR v_niveau_runes < 1 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint','message','Compétence Assemblage de Runes requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT COUNT(*)::integer INTO v_nb_gratuits FROM personnage_assemblages
   WHERE personnage_id = p_personnage_id AND est_gratuit = true;
  IF v_nb_gratuits < v_quota_total THEN
    v_est_gratuit := true;
    v_cout_xp := 0;
  ELSE
    v_est_gratuit := false;
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
      UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
       WHERE id = p_personnage_id;
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, assemblage_id, acteur_id)
      VALUES (p_personnage_id, 'depense_assemblage', -v_cout_xp,
              'Achat assemblage de runes (' || v_cout_xp || ' XP)', p_assemblage_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('id', v_new_id, 'est_gratuit', v_est_gratuit, 'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$$;


--
-- Name: acheter_competence(uuid, uuid, integer, text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acheter_competence(p_personnage_id uuid, p_competence_id uuid, p_niveau_desire integer, p_choix_achat text DEFAULT NULL::text, p_appris_via_maitre boolean DEFAULT false, p_nom_maitre text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
    VALUES
      (p_personnage_id, p_competence_id, p_niveau_desire, p_appris_via_maitre, v_cout_xp, p_nom_maitre, v_statut, p_choix_achat)
    RETURNING id INTO v_new_id;
    UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
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
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_competence_id', v_new_id,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense));
END;
$$;


--
-- Name: acheter_objet_forge(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acheter_objet_forge(p_personnage_id uuid, p_objet_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
    VALUES (p_personnage_id, p_objet_id, v_cout_xp) RETURNING id INTO v_new_id;
    UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
     WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, objet_forge_id, acteur_id)
      VALUES (p_personnage_id, 'depense_objet_forge', -v_cout_xp, 'Achat objet de forge (' || v_cout_xp || ' XP)', p_objet_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('id', v_new_id, 'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$$;


--
-- Name: acheter_objet_joaillerie(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acheter_objet_joaillerie(p_personnage_id uuid, p_objet_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
    VALUES (p_personnage_id, p_objet_id, v_cout_xp) RETURNING id INTO v_new_id;
    UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
     WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, objet_joaillerie_id, acteur_id)
      VALUES (p_personnage_id, 'depense_objet_joaillerie', -v_cout_xp, 'Achat objet de joaillerie (' || v_cout_xp || ' XP)', p_objet_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('id', v_new_id, 'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$$;


--
-- Name: acheter_priere(uuid, uuid, integer, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acheter_priere(p_personnage_id uuid, p_priere_id uuid, p_niveau_priere integer, p_zone_choisie text, p_portee_choisie text, p_duree_choisie text, p_nom_personnalise text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
  v_cout_xp := CEIL(COALESCE(v_priere.cout_xp_base, 0))::integer;
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
$$;


--
-- Name: acheter_recette(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acheter_recette(p_personnage_id uuid, p_recette_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
  SELECT niveau_alchimie, quota_recettes_total INTO v_niveau_alchimie, v_quota_total
    FROM vue_artisanat_quotas WHERE personnage_id = p_personnage_id;
  IF v_niveau_alchimie IS NULL OR v_niveau_alchimie < 1 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint','message','Compétence Alchimie requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT COUNT(*)::integer INTO v_nb_gratuits FROM personnage_recettes
   WHERE personnage_id = p_personnage_id AND est_gratuit = true;
  IF v_nb_gratuits < v_quota_total THEN
    v_est_gratuit := true;
    v_cout_xp := 0;
  ELSE
    v_est_gratuit := false;
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
      UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
       WHERE id = p_personnage_id;
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, recette_id, acteur_id)
      VALUES (p_personnage_id, 'depense_recette', -v_cout_xp,
              'Achat recette d''alchimie (' || v_cout_xp || ' XP)', p_recette_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('id', v_new_id, 'est_gratuit', v_est_gratuit, 'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$$;


--
-- Name: acheter_sort(uuid, uuid, integer, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acheter_sort(p_personnage_id uuid, p_sort_id uuid, p_niveau_sort integer, p_zone_choisie text, p_portee_choisie text, p_duree_choisie text, p_nom_personnalise text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
  SELECT cercle, cout_xp_base INTO v_cercle, v_cout_xp_base FROM sorts WHERE id = p_sort_id;
  IF v_cercle IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','sort_introuvable','message','Sort introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_cout_xp := CEIL(COALESCE(v_cout_xp_base, 0))::integer;
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
$$;


--
-- Name: acheter_trait_racial(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acheter_trait_racial(p_personnage_id uuid, p_trait_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
    v_est_gratuit := true;
    v_cout_xp := 0;
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
           xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
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

  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('est_gratuit', v_est_gratuit, 'xp_depense_achat', v_cout_xp,
      'traits_raciaux_choisis', v_traits, 'xp_total', v_xp_total,
      'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$$;


--
-- Name: ajouter_presence_tardive(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ajouter_presence_tardive(p_evenement_id uuid, p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_evt public.evenements%ROWTYPE;
  v_joueur_id uuid;
  v_inscription uuid;
  v_xp_montant integer;
  v_niveaux integer;
  v_existe boolean;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'acces_refuse', 'message', 'Accès refusé.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_evt FROM public.evenements WHERE id = p_evenement_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'evenement_introuvable', 'message', 'Événement introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT joueur_id INTO v_joueur_id FROM public.personnages WHERE id = p_personnage_id;
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_introuvable', 'message', 'Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.inscriptions_evenements
     WHERE evenement_id = p_evenement_id AND personnage_id = p_personnage_id
  ) INTO v_existe;
  IF v_existe THEN
    UPDATE public.inscriptions_evenements
       SET statut = 'present',
           date_confirmation = COALESCE(date_confirmation, now()),
           updated_at = now()
     WHERE evenement_id = p_evenement_id AND personnage_id = p_personnage_id
    RETURNING id INTO v_inscription;
  ELSE
    INSERT INTO public.inscriptions_evenements
      (evenement_id, personnage_id, joueur_id, statut, date_inscription, date_confirmation)
    VALUES
      (p_evenement_id, p_personnage_id, v_joueur_id, 'present', now(), now())
    RETURNING id INTO v_inscription;
  END IF;
  v_xp_montant := COALESCE(v_evt.xp_recompense, 0);
  v_niveaux := COALESCE(v_evt.niveaux_recompense, 0);
  PERFORM public.attribuer_xp_evenement(v_inscription, v_xp_montant);
  IF v_niveaux > 0 THEN
    UPDATE public.personnages SET niveau = COALESCE(niveau, 1) + v_niveaux, updated_at = now()
     WHERE id = p_personnage_id;
  END IF;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'inscription_id', v_inscription,
      'evenement_id', p_evenement_id,
      'personnage_id', p_personnage_id,
      'xp_attribue', v_xp_montant,
      'niveaux_ajoutes', v_niveaux,
      'inscription_existante', v_existe));
END;
$$;


--
-- Name: approuver_maitre_competence(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approuver_maitre_competence(p_personnage_competence_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DECLARE
    v_pc        RECORD;
      v_comp_nom  text;
      BEGIN
        IF NOT est_animateur_ou_admin() THEN
            RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
              END IF;

                -- Récupérer l'enregistrement + nom de la compétence + joueur_id
                  SELECT pc.id,
                           pc.personnage_id,
                                    pc.statut_maitre,
                                             pc.niveau_acquis,
                                                      p.joueur_id,
                                                               c.nom AS competence_nom
                                                                   INTO v_pc
                                                                       FROM personnage_competences pc
                                                                           JOIN personnages p ON p.id = pc.personnage_id
                                                                               JOIN competences c ON c.id = pc.competence_id
                                                                                   WHERE pc.id = p_personnage_competence_id;

                                                                                     IF NOT FOUND THEN
                                                                                         RETURN jsonb_build_object('succes', false, 'raison', 'Compétence introuvable');
                                                                                           END IF;

                                                                                             IF v_pc.statut_maitre <> 'en_attente' THEN
                                                                                                 RETURN jsonb_build_object('succes', false,
                                                                                                                               'raison', format('Statut actuel : %s (attendu : en_attente)', v_pc.statut_maitre));
                                                                                                                                 END IF;

                                                                                                                                   UPDATE personnage_competences
                                                                                                                                        SET statut_maitre = 'approuve'
                                                                                                                                           WHERE id = p_personnage_competence_id;

                                                                                                                                             INSERT INTO notifications (user_id, message)
                                                                                                                                               VALUES (
                                                                                                                                                   v_pc.joueur_id,
                                                                                                                                                       format('Votre maître a été approuvé pour %s niveau %s.',
                                                                                                                                                                  v_pc.competence_nom, v_pc.niveau_acquis)
                                                                                                                                                                    );

                                                                                                                                                                      RETURN jsonb_build_object('succes', true, 'competence', v_pc.competence_nom);
                                                                                                                                                                      END;
                                                                                                                                                                      $$;


--
-- Name: FUNCTION approuver_maitre_competence(p_personnage_competence_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.approuver_maitre_competence(p_personnage_competence_id uuid) IS 'Passe statut_maitre de en_attente à approuve pour une ligne personnage_competences. Notifie le joueur.';


--
-- Name: approuver_race_demande(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approuver_race_demande(p_demande_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DECLARE
    v_demande RECORD;
      v_personnage RECORD;
      BEGIN
        -- 1. Vérifier que l'utilisateur est admin/animateur
          IF NOT est_animateur_ou_admin() THEN
              RETURN jsonb_build_object('succes', false, 
                    'erreur', 'Seuls les administrateurs peuvent approuver');
                      END IF;

                        -- 2. Récupérer la demande
                          SELECT * INTO v_demande 
                            FROM public.personnage_races_demandes 
                              WHERE id = p_demande_id;
                                
                                  IF v_demande IS NULL THEN
                                      RETURN jsonb_build_object('succes', false, 'erreur', 'Demande introuvable');
                                        END IF;

                                          -- 3. Vérifier que la demande est bien en attente
                                            IF v_demande.statut != 'en_attente' THEN
                                                RETURN jsonb_build_object('succes', false, 
                                                      'erreur', format('Cette demande est déjà %s', v_demande.statut));
                                                        END IF;

                                                          -- 4. Mettre à jour la demande
                                                            UPDATE public.personnage_races_demandes
                                                              SET statut = 'approuvee',
                                                                    approuve_par = auth.uid(),
                                                                          date_approbation = now()
                                                                            WHERE id = p_demande_id;

                                                                              -- 5. Récupérer les infos du personnage pour la notification
                                                                                SELECT p.*, r.nom AS race_nom 
                                                                                  INTO v_personnage
                                                                                    FROM public.personnages p
                                                                                      JOIN public.races r ON r.id = v_demande.race_id
                                                                                        WHERE p.id = v_demande.personnage_id;

                                                                                          -- 6. Envoyer notification au joueur
                                                                                            INSERT INTO public.notifications (user_id, type, message, reference_id, statut)
                                                                                              VALUES (
                                                                                                  v_personnage.joueur_id,
                                                                                                      'race_approuvee',
                                                                                                          format('✅ Votre demande pour la race "%s" (personnage "%s") a été APPROUVÉE !', 
                                                                                                                v_personnage.race_nom, v_personnage.nom),
                                                                                                                    p_demande_id,
                                                                                                                        'non_traite'
                                                                                                                          );

                                                                                                                            -- 7. Retourner le succès
                                                                                                                              RETURN jsonb_build_object('succes', true, 
                                                                                                                                  'message', format('Race "%s" approuvée pour %s', 
                                                                                                                                        v_personnage.race_nom, v_personnage.nom));
                                                                                                                                        END;
                                                                                                                                        $$;


--
-- Name: archiver_personnage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archiver_personnage(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          DECLARE
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            v_personnage RECORD;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            BEGIN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              IF NOT est_animateur_ou_admin() THEN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    END IF;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      SELECT id, nom, joueur_id
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          INTO v_personnage
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              FROM personnages
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  WHERE id = p_personnage_id;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    IF NOT FOUND THEN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable');
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          END IF;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            UPDATE personnages SET est_actif = false WHERE id = p_personnage_id;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              INSERT INTO notifications (user_id, message)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                VALUES (
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    v_personnage.joueur_id,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        format('Votre personnage « %s » a été archivé.',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   COALESCE(v_personnage.nom, 'Sans nom'))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     );

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       RETURN jsonb_build_object('succes', true);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       END;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       $$;


--
-- Name: FUNCTION archiver_personnage(p_personnage_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.archiver_personnage(p_personnage_id uuid) IS 'Archive soft d''un personnage (est_actif = false). Notifie le joueur.';


--
-- Name: attribuer_competences_gratuites_classe(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.attribuer_competences_gratuites_classe(p_personnage_id uuid, p_choix_par_competence jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_perso          public.personnages%ROWTYPE;
  v_classe         public.classes%ROWTYPE;
  v_gratuites      jsonb;
  v_gratuite       jsonb;
  v_competence_id  uuid;
  v_niveau         integer;
  v_competence     public.competences%ROWTYPE;
  v_choix          text;
  v_erreurs        jsonb := '[]'::jsonb;
  v_existe         boolean;
  v_religion_uuid  uuid;
  v_nb_purgees     integer := 0;
BEGIN
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.classe_id IS NULL THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','classe_manquante','message','Le personnage n''a pas de classe.')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_classe FROM public.classes WHERE id = v_perso.classe_id;
  v_gratuites := COALESCE(v_classe.competences_gratuites, '[]'::jsonb);

  -- NOUVEAU : Purger les anciennes competences gratuites obsoletes.
  -- Supprime les lignes xp_depense=0 dont le competence_id n'est pas
  -- dans la liste des competences gratuites de la nouvelle classe.
  -- Les lignes payantes (xp_depense > 0) sont conservees pour ne pas
  -- perdre l'XP investi par le joueur.
  WITH nouvelles_gratuites AS (
    SELECT DISTINCT (g->>'competence_id')::uuid AS competence_id
    FROM jsonb_array_elements(v_gratuites) g
    WHERE g ? 'competence_id'
  )
  DELETE FROM public.personnage_competences pc
  WHERE pc.personnage_id = p_personnage_id
    AND pc.xp_depense = 0
    AND NOT EXISTS (
      SELECT 1 FROM nouvelles_gratuites ng
      WHERE ng.competence_id = pc.competence_id
    );

  GET DIAGNOSTICS v_nb_purgees = ROW_COUNT;

  FOR v_gratuite IN SELECT * FROM jsonb_array_elements(v_gratuites)
  LOOP
    v_competence_id := (v_gratuite->>'competence_id')::uuid;
    v_niveau := COALESCE((v_gratuite->>'niveau')::integer, 1);

    SELECT * INTO v_competence FROM public.competences WHERE id = v_competence_id;
    IF NOT FOUND THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','competence_introuvable',
        'message', format('Compétence gratuite introuvable (id %s)', v_competence_id),
        'competence_id', v_competence_id
      );
      CONTINUE;
    END IF;

    v_choix := p_choix_par_competence->>(v_competence_id::text);

    -- Validation du choix obligatoire selon type_choix
    IF v_competence.type_choix IS NOT NULL AND v_choix IS NULL THEN
      -- Cas spécial religion : fallback sur religion_id du perso s'il en a une
      IF v_competence.type_choix = 'religion' AND v_perso.religion_id IS NOT NULL THEN
        v_choix := v_perso.religion_id::text;
      ELSE
        v_erreurs := v_erreurs || jsonb_build_object(
          'code','choix_manquant',
          'message', format('Un choix de type "%s" est obligatoire pour %s', v_competence.type_choix, v_competence.nom),
          'competence_id', v_competence_id,
          'competence_nom', v_competence.nom,
          'type_choix', v_competence.type_choix
        );
        CONTINUE;
      END IF;
    END IF;

    -- B2 : si type_choix='religion' avec un choix défini, sync personnages
    IF v_competence.type_choix = 'religion' AND v_choix IS NOT NULL THEN
      BEGIN
        v_religion_uuid := v_choix::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        v_erreurs := v_erreurs || jsonb_build_object(
          'code','religion_uuid_invalide',
          'message', format('Le choix de religion fourni n''est pas un UUID valide : %s', v_choix),
          'competence_id', v_competence_id
        );
        CONTINUE;
      END;

      IF NOT EXISTS (SELECT 1 FROM public.religions WHERE id = v_religion_uuid) THEN
        v_erreurs := v_erreurs || jsonb_build_object(
          'code','religion_introuvable',
          'message', format('Religion introuvable : %s', v_choix),
          'competence_id', v_competence_id
        );
        CONTINUE;
      END IF;

      IF v_perso.religion_id IS DISTINCT FROM v_religion_uuid OR v_perso.est_croyant = false THEN
        UPDATE public.personnages
        SET religion_id = v_religion_uuid,
            est_croyant = true
        WHERE id = p_personnage_id;
        v_perso.religion_id := v_religion_uuid;
        v_perso.est_croyant := true;
      END IF;
    END IF;

    -- INSERT idempotent
    SELECT EXISTS(
      SELECT 1 FROM public.personnage_competences
      WHERE personnage_id = p_personnage_id
        AND competence_id = v_competence_id
        AND niveau_acquis = v_niveau
    ) INTO v_existe;

    IF v_existe THEN
      UPDATE public.personnage_competences
      SET choix_achat = v_choix
      WHERE personnage_id = p_personnage_id
        AND competence_id = v_competence_id
        AND niveau_acquis = v_niveau
        AND xp_depense = 0;
    ELSE
      INSERT INTO public.personnage_competences (
        personnage_id, competence_id, niveau_acquis,
        xp_depense, appris_via_maitre, statut_maitre, choix_achat
      ) VALUES (
        p_personnage_id, v_competence_id, v_niveau,
        0, false, 'non_requis', v_choix
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'succes', jsonb_array_length(v_erreurs) = 0,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_id', p_personnage_id,
      'nb_competences_gratuites_purgees', v_nb_purgees
    )
  );
END;
$$;


--
-- Name: attribuer_xp_evenement(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.attribuer_xp_evenement(p_inscription_id uuid, p_xp_montant integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_inscription  RECORD;
  v_evenement    RECORD;
  v_niveau_up    boolean;
  v_description  text;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
  END IF;

  IF p_xp_montant IS NULL OR p_xp_montant <= 0 THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Montant invalide (doit être > 0)');
  END IF;

  SELECT * INTO v_inscription
  FROM public.inscriptions_evenements
  WHERE id = p_inscription_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Inscription introuvable');
  END IF;

  IF v_inscription.personnage_id IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Inscription sans personnage attaché');
  END IF;

  SELECT * INTO v_evenement
  FROM public.evenements
  WHERE id = v_inscription.evenement_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Événement introuvable');
  END IF;

  v_niveau_up := (v_evenement.type_evenement = 'gn_regulier');

  -- Met à jour l'inscription : XP attribué + statut 'present'
  UPDATE public.inscriptions_evenements
  SET xp_attribue = p_xp_montant,
      statut      = 'present'
  WHERE id = p_inscription_id;

  -- Met à jour le personnage : niveau et compteurs uniquement
  -- (xp_total est désormais géré par le trigger via historique_xp)
  UPDATE public.personnages
  SET niveau              = COALESCE(niveau, 1)              + CASE WHEN v_niveau_up                                       THEN 1 ELSE 0 END,
      gn_completes        = COALESCE(gn_completes, 0)        + CASE WHEN v_evenement.type_evenement = 'gn_regulier'        THEN 1 ELSE 0 END,
      mini_gn_completes   = COALESCE(mini_gn_completes, 0)   + CASE WHEN v_evenement.type_evenement = 'mini_gn'            THEN 1 ELSE 0 END,
      ouvertures_terrain  = COALESCE(ouvertures_terrain, 0)  + CASE WHEN v_evenement.type_evenement = 'entretien_terrain'  THEN 1 ELSE 0 END
  WHERE id = v_inscription.personnage_id;

  -- Description auto-générée
  v_description := format('XP gagné lors de l''événement « %s »%s',
    COALESCE(v_evenement.titre, 'Sans titre'),
    CASE WHEN v_evenement.date_evenement IS NOT NULL
      THEN ' du ' || to_char(v_evenement.date_evenement, 'DD/MM/YYYY')
      ELSE '' END
  );

  -- Le trigger trg_sync_xp_personnage met à jour xp_total automatiquement
  INSERT INTO public.historique_xp (
    personnage_id, type_mouvement, montant, description,
    evenement_id, inscription_id, acteur_id
  ) VALUES (
    v_inscription.personnage_id, 'gain_evenement', p_xp_montant, v_description,
    v_inscription.evenement_id, p_inscription_id, auth.uid()
  );

  -- Notification au joueur
  INSERT INTO public.notifications (user_id, message)
  VALUES (
    v_inscription.joueur_id,
    'Vous avez reçu ' || p_xp_montant || ' XP pour « ' || v_evenement.titre || ' »' ||
    CASE WHEN v_niveau_up THEN ' (+1 niveau)' ELSE '' END || '.'
  );

  RETURN jsonb_build_object(
    'succes',    true,
    'xp_ajoute', p_xp_montant,
    'niveau_up', v_niveau_up
  );
END;
$$;


--
-- Name: FUNCTION attribuer_xp_evenement(p_inscription_id uuid, p_xp_montant integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.attribuer_xp_evenement(p_inscription_id uuid, p_xp_montant integer) IS 'Attribue des XP à un personnage pour sa participation à un événement. +1 niveau si type_evenement = gn_regulier. Incrémente les compteurs gn_completes/mini_gn_completes/ouvertures_terrain selon le type. Met le statut d''inscription à ''present''. Crée une notification.';


--
-- Name: avancer_etape(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.avancer_etape(p_personnage_id uuid, p_etape_courante integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_perso public.personnages%ROWTYPE;
  v_validation jsonb;
  v_etape_apres integer;
BEGIN
  -- Authentification
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'non_authentifie', 'message', 'Authentification requise.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Borne : avancer_etape ne couvre que les etapes d'achat 5 a 9.
  -- Les etapes 1-4 et 10 ont leur propre sauvegarder_etape_N qui avance etape_creation.
  IF p_etape_courante < 5 OR p_etape_courante > 9 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'etape_invalide',
        'message', 'avancer_etape ne couvre que les etapes 5 a 9.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Lock optimiste + existence
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_introuvable', 'message', 'Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Ownership
  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'ownership_refuse', 'message', 'Ce personnage ne vous appartient pas.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Verrou
  IF v_perso.est_verrouille THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_verrouille', 'message', 'Ce personnage est verrouille et ne peut plus etre modifie.')),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END IF;

  -- Validation de l'etape courante (valider_etape renvoie {valide, ignoree, erreurs, avertissements})
  v_validation := public.valider_etape(p_personnage_id, p_etape_courante);
  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
  END IF;

  -- Avancement idempotent : on n'avance que si on est exactement sur l'etape courante.
  -- Si etape_creation a deja depasse p_etape_courante (re-clic, navigation), on ne touche a rien.
  IF v_perso.etape_creation = p_etape_courante THEN
    UPDATE public.personnages SET etape_creation = p_etape_courante + 1 WHERE id = p_personnage_id;
    v_etape_apres := p_etape_courante + 1;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', v_validation->'avertissements',
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_etape_apres));
END;
$$;


--
-- Name: changer_role_utilisateur(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.changer_role_utilisateur(p_user_id uuid, p_nouveau_role text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
      DECLARE
        v_actor_role text;
          v_user_email text;
          BEGIN
            -- Vérifier que l'appelant est admin ou animateur
              SELECT role INTO v_actor_role
                FROM public.profiles
                  WHERE id = auth.uid();
                    
                      IF COALESCE(v_actor_role, 'joueur') NOT IN ('admin', 'animateur') THEN
                          RAISE EXCEPTION 'Permission refusée' USING ERRCODE = '42501';
                            END IF;

                              -- Empêcher un admin de se retirer son propre rôle admin
                                IF auth.uid() = p_user_id AND p_nouveau_role != 'admin' THEN
                                    RAISE EXCEPTION 'Vous ne pouvez pas retirer votre propre rôle administrateur' USING ERRCODE = '42501';
                                      END IF;

                                        -- Récupérer l'email pour la notification
                                          SELECT email INTO v_user_email
                                            FROM auth.users
                                              WHERE id = p_user_id;

                                                -- Mettre à jour le rôle
                                                  UPDATE public.profiles
                                                    SET role = p_nouveau_role,
                                                          updated_at = now()
                                                            WHERE id = p_user_id;

                                                              -- Envoyer une notification à l'utilisateur
                                                                INSERT INTO public.notifications (user_id, message)
                                                                  VALUES (
                                                                      p_user_id,
                                                                          format('Votre rôle a été modifié. Nouveau rôle : %s.', p_nouveau_role)
                                                                            );

                                                                              RETURN jsonb_build_object(
                                                                                  'success', true,
                                                                                      'message', format('Rôle de %s changé en %s', v_user_email, p_nouveau_role)
                                                                                        );
                                                                                        END;
                                                                                        $$;


--
-- Name: changer_statut_inscription(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.changer_statut_inscription(p_inscription_id uuid, p_nouveau_statut text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ancien_statut text;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'acces_refuse', 'message', 'Accès refusé.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF p_nouveau_statut NOT IN ('en_attente', 'present', 'absent', 'annule') THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'statut_invalide',
        'message', format('Statut invalide. Valeurs acceptées : en_attente, present, absent, annule. Reçu : %s', p_nouveau_statut))),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT statut INTO v_ancien_statut FROM public.inscriptions_evenements WHERE id = p_inscription_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'inscription_introuvable', 'message', 'Inscription introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  UPDATE public.inscriptions_evenements
     SET statut = p_nouveau_statut,
         updated_at = now(),
         date_confirmation = CASE
           WHEN p_nouveau_statut = 'present' THEN COALESCE(date_confirmation, now())
           ELSE date_confirmation
         END
   WHERE id = p_inscription_id;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'inscription_id', p_inscription_id,
      'ancien_statut', v_ancien_statut,
      'nouveau_statut', p_nouveau_statut));
END;
$$;


--
-- Name: cleanup_demande_si_race_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_demande_si_race_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Si la race a changé ET qu'une demande existe pour ce perso
    IF (OLD.race_id IS DISTINCT FROM NEW.race_id) THEN
        DELETE FROM public.personnage_races_demandes
            WHERE personnage_id = NEW.id;
              END IF;
                
                  RETURN NEW;
                  END;
                  $$;


--
-- Name: cloturer_evenement(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cloturer_evenement(p_evenement_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_evt public.evenements%ROWTYPE;
  v_inscription record;
  v_xp_montant integer;
  v_niveaux integer;
  v_count_present integer := 0;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'acces_refuse', 'message', 'Accès refusé.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_evt FROM public.evenements WHERE id = p_evenement_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'evenement_introuvable', 'message', 'Événement introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF v_evt.est_termine THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'evenement_deja_termine', 'message', 'Événement déjà terminé.')),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('evenement_id', p_evenement_id));
  END IF;
  v_xp_montant := COALESCE(v_evt.xp_recompense, 0);
  v_niveaux := COALESCE(v_evt.niveaux_recompense, 0);
  FOR v_inscription IN
    SELECT id, personnage_id FROM public.inscriptions_evenements
     WHERE evenement_id = p_evenement_id AND statut = 'present' AND personnage_id IS NOT NULL
  LOOP
    PERFORM public.attribuer_xp_evenement(v_inscription.id, v_xp_montant);
    IF v_niveaux > 0 THEN
      UPDATE public.personnages SET niveau = COALESCE(niveau, 1) + v_niveaux, updated_at = now()
       WHERE id = v_inscription.personnage_id;
    END IF;
    v_count_present := v_count_present + 1;
  END LOOP;
  UPDATE public.evenements SET est_termine = true, updated_at = now() WHERE id = p_evenement_id;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'evenement_id', p_evenement_id,
      'nb_presences_recompensees', v_count_present,
      'xp_par_presence', v_xp_montant,
      'niveaux_par_presence', v_niveaux));
END;
$$;


--
-- Name: creer_demande_race(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.creer_demande_race(p_personnage_id uuid, p_background text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_personnage RECORD;
  v_race RECORD;
  v_demande_id uuid;
BEGIN
  SELECT * INTO v_personnage FROM public.personnages WHERE id = p_personnage_id;
  IF v_personnage IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Personnage introuvable');
  END IF;

  IF v_personnage.joueur_id != auth.uid() AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Accès refusé');
  END IF;

  SELECT * INTO v_race FROM public.races WHERE id = v_personnage.race_id;
  IF v_race.nom NOT IN ('Chiméride', 'Les Non-Races') THEN
    RETURN jsonb_build_object('succes', false,
      'erreur', 'Cette race ne nécessite pas d''approbation');
  END IF;

  IF EXISTS (SELECT 1 FROM public.personnage_races_demandes
             WHERE personnage_id = p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreur', 'Une demande existe déjà pour ce personnage');
  END IF;

  IF p_background IS NULL OR char_length(trim(p_background)) < 100 THEN
    RETURN jsonb_build_object('succes', false,
      'erreur', 'Le background doit contenir au moins 100 caractères');
  END IF;

  INSERT INTO public.personnage_races_demandes (personnage_id, race_id, background)
  VALUES (p_personnage_id, v_personnage.race_id, trim(p_background))
  RETURNING id INTO v_demande_id;

  INSERT INTO public.notifications (user_id, type, message, reference_id, statut)
  SELECT
    p.id,
    'demande_race_nouvelle',
    format('📋 Nouvelle demande de race : "%s" pour le personnage "%s"',
           v_race.nom, v_personnage.nom),
    v_demande_id,
    'non_traite'  -- ← FIX (anciennement 'non_lu')
  FROM public.profiles p
  WHERE p.role IN ('admin', 'animateur')
    AND COALESCE(p.is_active, true) = true;

  RETURN jsonb_build_object(
    'succes', true,
    'message', 'Demande créée. Les administrateurs vont l''examiner.',
    'demande_id', v_demande_id
  );
END;
$$;


--
-- Name: creer_profil_nouveau_joueur(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.creer_profil_nouveau_joueur() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, nom_affichage, role, is_active)
    VALUES (
        NEW.id,
            NEW.email,
                COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
                    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
                        'joueur',
                            true
                              )
                                ON CONFLICT (id) DO NOTHING;
                                  RETURN NEW;
                                  END;
                                  $$;


--
-- Name: demarrer_creation_personnage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.demarrer_creation_personnage() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_brouillon_id uuid;
  v_brouillon_etape integer;
  v_nouveau_id uuid;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'non_authentifie',
        'message', 'Authentification requise pour démarrer la création d''un personnage.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  -- Détection brouillon : non verrouillé, actif, et pas encore finalisé.
  -- etape_creation = 12 signifie post-finalisation (cf. valider_personnage_final) :
  -- un tel personnage n'est PAS un brouillon, même s'il n'est pas verrouillé
  -- (cas pré-lancement où un perso peut être à etape 12 sans est_verrouille=true).
  SELECT id, etape_creation
  INTO v_brouillon_id, v_brouillon_etape
  FROM public.personnages
  WHERE joueur_id = v_joueur_id
    AND est_verrouille = false
    AND est_actif = true
    AND etape_creation < 12
  LIMIT 1;

  IF v_brouillon_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'brouillon_existant',
        'message', 'Vous avez déjà un personnage en cours de création.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object(
        'personnage_id', v_brouillon_id,
        'etape_creation', v_brouillon_etape
      )
    );
  END IF;

  v_nouveau_id := gen_random_uuid();
  INSERT INTO public.personnages (id, joueur_id) VALUES (v_nouveau_id, v_joueur_id);

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_id', v_nouveau_id,
      'etape_creation', 1
    )
  );
END;
$$;


--
-- Name: FUNCTION demarrer_creation_personnage(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.demarrer_creation_personnage() IS 'Phase 1.6.1 — Démarre la création d''un personnage pour auth.uid(). Retourne brouillon_existant (avec personnage_id du brouillon) si un perso non verrouillé et actif existe déjà pour ce joueur. Codes erreurs : non_authentifie, brouillon_existant.';


--
-- Name: desacheter_competence(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.desacheter_competence(p_personnage_competence_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: deverrouiller_personnage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deverrouiller_personnage(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         DECLARE
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           v_personnage RECORD;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           BEGIN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             IF NOT est_animateur_ou_admin() THEN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   END IF;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     SELECT id, nom, joueur_id, est_verrouille
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         INTO v_personnage
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             FROM personnages
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 WHERE id = p_personnage_id;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   IF NOT FOUND THEN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable');
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         END IF;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           UPDATE personnages SET est_verrouille = false WHERE id = p_personnage_id;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             INSERT INTO notifications (user_id, message)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               VALUES (
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   v_personnage.joueur_id,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       format('Votre personnage « %s » a été déverrouillé.',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  COALESCE(v_personnage.nom, 'Sans nom'))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    );

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      RETURN jsonb_build_object('succes', true);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      END;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      $$;


--
-- Name: FUNCTION deverrouiller_personnage(p_personnage_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.deverrouiller_personnage(p_personnage_id uuid) IS 'Met est_verrouille = false. Notifie le joueur.';


--
-- Name: donner_xp_bonus(uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.donner_xp_bonus(p_personnage_id uuid, p_montant integer, p_raison text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_personnage   RECORD;
  v_description  text;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
  END IF;

  -- Le bonus doit être strictement positif (cohérent avec le type gain_bonus).
  -- Pour retirer de l'XP, utiliser une fonction de correction dédiée (à venir).
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Montant invalide (doit être > 0)');
  END IF;

  SELECT id, nom, joueur_id
    INTO v_personnage
  FROM public.personnages
  WHERE id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable');
  END IF;

  v_description := CASE
    WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0
      THEN 'Bonus : ' || trim(p_raison)
    ELSE 'Bonus XP attribué par un animateur/admin'
  END;

  -- Le trigger trg_sync_xp_personnage met à jour xp_total automatiquement
  INSERT INTO public.historique_xp (
    personnage_id, type_mouvement, montant, description, acteur_id
  ) VALUES (
    p_personnage_id, 'gain_bonus', p_montant, v_description, auth.uid()
  );

  INSERT INTO public.notifications (user_id, message)
  VALUES (
    v_personnage.joueur_id,
    format('Vous avez reçu %s XP bonus pour « %s ».%s',
      p_montant,
      COALESCE(v_personnage.nom, 'Sans nom'),
      CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0
        THEN ' ' || p_raison
        ELSE '' END)
  );

  RETURN jsonb_build_object('succes', true, 'xp_ajoute', p_montant);
END;
$$;


--
-- Name: FUNCTION donner_xp_bonus(p_personnage_id uuid, p_montant integer, p_raison text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.donner_xp_bonus(p_personnage_id uuid, p_montant integer, p_raison text) IS 'Attribue un XP bonus manuel à un personnage. Ne touche pas au niveau ni aux compteurs événements. Notifie le joueur avec la raison si fournie.';


--
-- Name: est_animateur_ou_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.est_animateur_ou_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('animateur', 'admin')
  );
END;
$$;


--
-- Name: get_joueurs_avec_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_joueurs_avec_count() RETURNS TABLE(id uuid, nom_affichage text, email text, role text, created_at timestamp without time zone, nb_personnages bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RAISE EXCEPTION 'Accès refusé' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.nom_affichage,
    p.email,
    p.role,
    p.created_at,
    COUNT(pe.id)::bigint AS nb_personnages
  FROM public.profiles p
  LEFT JOIN public.personnages pe ON pe.joueur_id = p.id
  GROUP BY p.id, p.nom_affichage, p.email, p.role, p.created_at
  ORDER BY p.created_at DESC NULLS LAST;
END;
$$;


--
-- Name: get_stats_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_stats_admin() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    DECLARE
        result json;
        BEGIN
            IF NOT est_animateur_ou_admin() THEN
                    RAISE EXCEPTION 'Accès refusé.';
                        END IF;

                            SELECT json_build_object(
                                    'nbJoueurs', (SELECT COUNT(*) FROM profiles WHERE role = 'joueur'),
                                            'nbPersonnagesActifs', (SELECT COUNT(*) FROM personnages WHERE est_actif = true AND est_mort = false),
                                                    'nbPresencesAttente', (SELECT COUNT(*) FROM inscriptions_evenements WHERE statut = 'en_attente'),
                                                            'nbCompetencesAttente', (SELECT COUNT(*) FROM personnage_competences WHERE statut_maitre = 'en_attente'),
                                                                    'prochainEvenement', (SELECT json_build_object('titre', titre, 'date_evenement', date_evenement) FROM evenements WHERE est_publie = true AND date_evenement > now() ORDER BY date_evenement LIMIT 1)
                                                                        ) INTO result;
                                                                            
                                                                                RETURN result;
                                                                                END;
                                                                                $$;


--
-- Name: marquer_absent(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.marquer_absent(p_inscription_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    DECLARE
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      v_inscription RECORD;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      BEGIN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        IF NOT est_animateur_ou_admin() THEN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              END IF;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                SELECT * INTO v_inscription FROM inscriptions_evenements WHERE id = p_inscription_id;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  IF NOT FOUND THEN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      RETURN jsonb_build_object('succes', false, 'raison', 'Inscription introuvable');
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        END IF;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          UPDATE inscriptions_evenements
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               SET statut = 'absent'
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  WHERE id = p_inscription_id;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    RETURN jsonb_build_object('succes', true, 'statut', 'absent');
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    END;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    $$;


--
-- Name: FUNCTION marquer_absent(p_inscription_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.marquer_absent(p_inscription_id uuid) IS 'Marque une inscription comme ''absent''.';


--
-- Name: marquer_present(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.marquer_present(p_inscription_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                DECLARE
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  v_inscription RECORD;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  BEGIN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    IF NOT est_animateur_ou_admin() THEN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          END IF;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            SELECT * INTO v_inscription FROM inscriptions_evenements WHERE id = p_inscription_id;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              IF NOT FOUND THEN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  RETURN jsonb_build_object('succes', false, 'raison', 'Inscription introuvable');
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    END IF;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      UPDATE inscriptions_evenements
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           SET statut = 'present'
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              WHERE id = p_inscription_id;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                RETURN jsonb_build_object('succes', true, 'statut', 'present');
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                END;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                $$;


--
-- Name: FUNCTION marquer_present(p_inscription_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.marquer_present(p_inscription_id uuid) IS 'Marque une inscription comme ''present''. N''attribue pas l''XP (voir attribuer_xp_evenement).';


--
-- Name: personnage_a_des_prieres(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.personnage_a_des_prieres(p_personnage_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM personnage_competences pc
    JOIN competences c ON c.id = pc.competence_id
    WHERE pc.personnage_id = p_personnage_id
      AND c.nom = 'Acquisition de Domaine'
  );
$$;


--
-- Name: personnage_a_des_sorts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.personnage_a_des_sorts(p_personnage_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM personnage_competences pc
    JOIN competences c ON c.id = pc.competence_id
    WHERE pc.personnage_id = p_personnage_id
      AND c.nom = 'Acquisition de Cercle'
  );
$$;


--
-- Name: personnage_est_runiste(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.personnage_est_runiste(p_personnage_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM personnage_competences pc
    JOIN competences c ON c.id = pc.competence_id
    WHERE pc.personnage_id = p_personnage_id
      AND c.nom = 'Assemblage de Runes'
  );
$$;


--
-- Name: peut_acheter_competence(uuid, uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peut_acheter_competence(p_personnage_id uuid, p_competence_id uuid, p_niveau_desire integer, p_choix_achat text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_personnage          RECORD;
  v_competence          RECORD;
  v_est_propre_classe   boolean;
  v_classe_normalisee   text;
  v_niveau_max_actuel   integer;
  v_niveau_max_autorise integer;
  v_deja_choisi         boolean;
  v_cout_xp             integer;
  v_necessite_maitre    boolean;
  v_prereq              jsonb;
  v_prereq_item         jsonb;
  v_manquants           text[];
  v_niveau_actuel_pre   integer;
  v_nom_lisible         text;
  v_choix_existant      text;
BEGIN
  SELECT p.id, p.classe_id, cl.nom AS classe_nom,
         (COALESCE(p.xp_total,0) - COALESCE(p.xp_depense,0)) AS xp_dispo,
         p.est_verrouille, p.ps_max
    INTO v_personnage
    FROM personnages p
    LEFT JOIN classes cl ON cl.id = p.classe_id
   WHERE p.id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Personnage introuvable');
  END IF;
  IF v_personnage.est_verrouille THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Personnage verrouillé (décédé ou archivé)');
  END IF;

  SELECT * INTO v_competence FROM competences WHERE id = p_competence_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Compétence introuvable');
  END IF;
  IF NOT v_competence.est_actif THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Compétence inactive');
  END IF;

  IF v_competence.classes_requises IS NOT NULL AND array_length(v_competence.classes_requises, 1) > 0 THEN
    v_classe_normalisee := CASE v_personnage.classe_nom
      WHEN 'Guerrier' THEN 'guerrier'
      WHEN 'Voleur'   THEN 'voleur'
      WHEN 'Mage'     THEN 'mage'
      WHEN 'Prêtre'   THEN 'pretre'
      ELSE NULL
    END;
    IF v_classe_normalisee IS NULL OR NOT (v_classe_normalisee = ANY(v_competence.classes_requises)) THEN
      RETURN jsonb_build_object(
        'peut_acheter', false,
        'raison', format('Classe requise : %s', array_to_string(v_competence.classes_requises, ' ou '))
      );
    END IF;
  END IF;

  v_est_propre_classe := (
    (v_competence.categorie = 'guerrier' AND v_personnage.classe_nom = 'Guerrier') OR
    (v_competence.categorie = 'voleur'   AND v_personnage.classe_nom = 'Voleur')   OR
    (v_competence.categorie = 'mage'     AND v_personnage.classe_nom = 'Mage')     OR
    (v_competence.categorie = 'pretre'   AND v_personnage.classe_nom = 'Prêtre')
  );

  IF v_competence.est_general OR v_est_propre_classe THEN
    v_niveau_max_autorise := 3;
  ELSE
    v_niveau_max_autorise := 2;
  END IF;

  IF p_niveau_desire > v_niveau_max_autorise THEN
    RETURN jsonb_build_object(
      'peut_acheter', false,
      'raison', format('Niveau %s inaccessible hors de votre classe (maximum autorisé : %s)', p_niveau_desire, v_niveau_max_autorise)
    );
  END IF;
  IF p_niveau_desire < 1 OR p_niveau_desire > 3 THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Niveau invalide (1 à 3 attendu)');
  END IF;

  IF v_competence.verrouillage_croise THEN
    IF EXISTS (
      SELECT 1 FROM personnage_competences pc2
        JOIN competences c2 ON c2.id = pc2.competence_id
       WHERE pc2.personnage_id = p_personnage_id
         AND c2.nom = v_competence.nom
         AND c2.id <> v_competence.id
    ) THEN
      RETURN jsonb_build_object(
        'peut_acheter', false,
        'raison', format('Vous avez déjà acquis "%s" dans l''autre catégorie', v_competence.nom)
      );
    END IF;
  END IF;

  SELECT COALESCE(max(niveau_acquis), 0) INTO v_niveau_max_actuel
    FROM personnage_competences
   WHERE personnage_id = p_personnage_id AND competence_id = p_competence_id;

  CASE v_competence.type_achat
    WHEN 'simple' THEN
      IF p_niveau_desire <> v_niveau_max_actuel + 1 THEN
        RETURN jsonb_build_object(
          'peut_acheter', false,
          'raison', format('Vous devez d''abord acquérir le niveau %s', v_niveau_max_actuel + 1)
        );
      END IF;

    WHEN 'unique_avec_choix' THEN
      IF v_niveau_max_actuel >= 1 THEN
        SELECT choix_achat INTO v_choix_existant
          FROM personnage_competences
         WHERE personnage_id = p_personnage_id
           AND competence_id = p_competence_id
         LIMIT 1;
        v_nom_lisible := CASE
          WHEN v_competence.type_choix = 'religion' AND v_choix_existant IS NOT NULL
            THEN COALESCE((SELECT nom FROM religions WHERE id::text = v_choix_existant), v_choix_existant)
          WHEN v_competence.type_choix IN ('langue', 'langue_ancienne') AND v_choix_existant IS NOT NULL
            THEN COALESCE((SELECT nom FROM langues WHERE id::text = v_choix_existant), v_choix_existant)
          ELSE NULL
        END;
        IF v_nom_lisible IS NOT NULL THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', format('Déjà acquis : %s', v_nom_lisible));
        ELSE
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Déjà acquis');
        END IF;
      END IF;
      IF p_niveau_desire <> 1 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Seul le niveau 1 est achetable pour cette compétence');
      END IF;
      IF p_choix_achat IS NULL OR length(trim(p_choix_achat)) = 0 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Un choix est obligatoire');
      END IF;

    WHEN 'multiple_avec_choix_par_niveau' THEN
      IF v_competence.nom = 'Connaissances Criminelles' AND p_niveau_desire = 1 THEN
        IF v_niveau_max_actuel >= 1 THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Déjà acquis au niveau 1');
        END IF;
      ELSE
        IF p_choix_achat IS NULL OR length(trim(p_choix_achat)) = 0 THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Un choix est obligatoire');
        END IF;
        SELECT EXISTS (
          SELECT 1 FROM personnage_competences
           WHERE personnage_id = p_personnage_id
             AND competence_id = p_competence_id
             AND niveau_acquis = p_niveau_desire
             AND choix_achat = p_choix_achat
        ) INTO v_deja_choisi;
        IF v_deja_choisi THEN
          RETURN jsonb_build_object(
            'peut_acheter', false,
            'raison', format('"%s" est déjà acquis au niveau %s', p_choix_achat, p_niveau_desire)
          );
        END IF;
        IF p_niveau_desire >= 2 THEN
          IF v_competence.nom = 'Connaissances Criminelles' AND p_niveau_desire = 2 THEN
            IF v_niveau_max_actuel < 1 THEN
              RETURN jsonb_build_object(
                'peut_acheter', false,
                'raison', 'Vous devez d''abord acquérir Connaissances Criminelles niveau 1'
              );
            END IF;
          ELSE
            IF NOT EXISTS (
              SELECT 1 FROM personnage_competences
               WHERE personnage_id = p_personnage_id
                 AND competence_id = p_competence_id
                 AND niveau_acquis = p_niveau_desire - 1
                 AND choix_achat = p_choix_achat
            ) THEN
              RETURN jsonb_build_object(
                'peut_acheter', false,
                'raison', format('Vous devez d''abord acquérir "%s" niveau %s pour "%s"', v_competence.nom, p_niveau_desire - 1, p_choix_achat)
              );
            END IF;
          END IF;
        END IF;
      END IF;

    WHEN 'multiple_langue' THEN
      IF p_niveau_desire <> 1 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Seul le niveau 1 est achetable pour cette compétence');
      END IF;
      IF p_choix_achat IS NULL OR length(trim(p_choix_achat)) = 0 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Un choix est obligatoire');
      END IF;
      SELECT EXISTS (
        SELECT 1 FROM personnage_competences
         WHERE personnage_id = p_personnage_id
           AND competence_id = p_competence_id
           AND choix_achat = p_choix_achat
      ) INTO v_deja_choisi;
      IF v_deja_choisi THEN
        v_nom_lisible := CASE
          WHEN v_competence.type_choix IN ('langue', 'langue_ancienne')
            THEN COALESCE((SELECT nom FROM langues WHERE id::text = p_choix_achat), p_choix_achat)
          WHEN v_competence.type_choix = 'religion'
            THEN COALESCE((SELECT nom FROM religions WHERE id::text = p_choix_achat), p_choix_achat)
          ELSE p_choix_achat
        END;
        RETURN jsonb_build_object('peut_acheter', false, 'raison', format('Vous avez déjà acquis "%s"', v_nom_lisible));
      END IF;

    WHEN 'multiple_sans_choix' THEN
      IF p_niveau_desire <> 1 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Seul le niveau 1 est achetable pour cette compétence');
      END IF;
      IF v_competence.nom = 'Développement Spirituel' THEN
        IF COALESCE(v_personnage.ps_max,0) >= 20 THEN
          RETURN jsonb_build_object(
            'peut_acheter', false,
            'raison', 'Maximum de 20 PS atteint — achetez Développement Spirituel Supérieur'
          );
        END IF;
      ELSIF v_competence.nom = 'Développement Spirituel Supérieur' THEN
        IF COALESCE(v_personnage.ps_max,0) < 20 THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Nécessite 20 PS (achetez d''abord Développement Spirituel)');
        END IF;
        IF v_personnage.ps_max >= 30 THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Maximum absolu atteint (30 PS)');
        END IF;
      END IF;
  END CASE;

  -- 8a. Dépeçage niveau 1
  IF v_competence.nom = 'Dépeçage' AND p_niveau_desire = 1 THEN
    IF NOT EXISTS (
      SELECT 1 FROM vue_personnage_etat
       WHERE personnage_id = p_personnage_id
         AND a_connaissance_creatures_1 = true
         AND a_premiers_soins = true
    ) THEN
      RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Prérequis : Connaissance des Créatures niveau 1 ET Premiers Soins');
    END IF;
    IF p_choix_achat IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM personnage_competences pc3
        JOIN competences c3 ON c3.id = pc3.competence_id
       WHERE pc3.personnage_id = p_personnage_id
         AND c3.nom = 'Connaissance des Créatures'
         AND pc3.niveau_acquis >= 1
         AND pc3.choix_achat = p_choix_achat
    ) THEN
      RETURN jsonb_build_object(
        'peut_acheter', false,
        'raison', format('Vous devez d''abord avoir Connaissance des Créatures pour la catégorie "%s"', p_choix_achat)
      );
    END IF;
  END IF;

  -- 8b. Dépeçage niveau 2
  IF v_competence.nom = 'Dépeçage' AND p_niveau_desire = 2 THEN
    IF NOT EXISTS (
      SELECT 1 FROM vue_personnage_etat
       WHERE personnage_id = p_personnage_id AND a_connaissance_creatures_2 = true
    ) THEN
      RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Prérequis : Connaissance des Créatures niveau 2');
    END IF;
    IF p_choix_achat IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM personnage_competences pc4
        JOIN competences c4 ON c4.id = pc4.competence_id
       WHERE pc4.personnage_id = p_personnage_id
         AND c4.nom = 'Connaissance des Créatures'
         AND pc4.niveau_acquis >= 2
         AND pc4.choix_achat = p_choix_achat
    ) THEN
      RETURN jsonb_build_object(
        'peut_acheter', false,
        'raison', format('Vous devez d''abord avoir Connaissance des Créatures niveau 2 pour "%s"', p_choix_achat)
      );
    END IF;
  END IF;

  -- 8c. Data-driven (Migration 11)
  v_prereq := v_competence.prerequis_competences -> p_niveau_desire::text;
  IF v_prereq IS NOT NULL AND jsonb_array_length(v_prereq) > 0 THEN
    v_manquants := ARRAY[]::text[];
    FOR v_prereq_item IN SELECT * FROM jsonb_array_elements(v_prereq) LOOP
      SELECT COALESCE(max(pc.niveau_acquis), 0)
        INTO v_niveau_actuel_pre
        FROM personnage_competences pc
        JOIN competences c ON c.id = pc.competence_id
       WHERE pc.personnage_id = p_personnage_id
         AND c.nom = (v_prereq_item->>'competence_nom');
      IF v_niveau_actuel_pre < (v_prereq_item->>'niveau_min')::integer THEN
        v_manquants := v_manquants || format('%s niveau %s',
          v_prereq_item->>'competence_nom',
          v_prereq_item->>'niveau_min'
        );
      END IF;
    END LOOP;
    IF array_length(v_manquants, 1) > 0 THEN
      RETURN jsonb_build_object(
        'peut_acheter', false,
        'raison', format('Prérequis manquant(s) : %s', array_to_string(v_manquants, ', '))
      );
    END IF;
  END IF;

  SELECT (elem->>'cout_xp')::integer INTO v_cout_xp
    FROM jsonb_array_elements(v_competence.niveaux) elem
   WHERE (elem->>'niveau')::integer = p_niveau_desire
   LIMIT 1;

  IF v_cout_xp IS NULL THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', format('Niveau %s non défini pour cette compétence', p_niveau_desire));
  END IF;

  IF v_personnage.xp_dispo < v_cout_xp THEN
    RETURN jsonb_build_object(
      'peut_acheter', false,
      'raison', format('XP insuffisant. Requis : %s | Disponible : %s', v_cout_xp, v_personnage.xp_dispo)
    );
  END IF;

  v_necessite_maitre := (
    (v_competence.est_general AND p_niveau_desire = 3) OR
    (v_est_propre_classe       AND p_niveau_desire = 3) OR
    (NOT v_competence.est_general AND NOT v_est_propre_classe AND p_niveau_desire = 2)
  );

  RETURN jsonb_build_object(
    'peut_acheter',        true,
    'raison',              'OK',
    'cout_xp',             v_cout_xp,
    'niveau_actuel',       v_niveau_max_actuel,
    'niveau_desire',       p_niveau_desire,
    'necessite_maitre',    v_necessite_maitre,
    'type_achat',          v_competence.type_achat,
    'type_choix',          v_competence.type_choix,
    'verrouillage_croise', v_competence.verrouillage_croise
  );
END;
$$;


--
-- Name: FUNCTION peut_acheter_competence(p_personnage_id uuid, p_competence_id uuid, p_niveau_desire integer, p_choix_achat text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.peut_acheter_competence(p_personnage_id uuid, p_competence_id uuid, p_niveau_desire integer, p_choix_achat text) IS 'Valide qu''un personnage peut acheter une compétence à un niveau donné, en tenant compte du multiclassage, du type d''achat (simple/multiple/choix), du verrouillage croisé, des prérequis et de l''XP disponible. Retourne un JSON avec peut_acheter, raison, cout_xp, necessite_maitre, type_achat, type_choix, verrouillage_croise.';


--
-- Name: peut_acheter_trait_racial(uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.peut_acheter_trait_racial(p_personnage_id uuid, p_trait_id uuid, p_race_id uuid, p_sous_type text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
                                                                                                                                                                                                                                                          DECLARE
                                                                                                                                                                                                                                                            v_xp_disponible   INTEGER;
                                                                                                                                                                                                                                                              v_nb_traits       INTEGER;
                                                                                                                                                                                                                                                                v_trait_existe    BOOLEAN;
                                                                                                                                                                                                                                                                  v_cout_xp         INTEGER;
                                                                                                                                                                                                                                                                    v_deja_acquis     BOOLEAN;
                                                                                                                                                                                                                                                                    BEGIN
                                                                                                                                                                                                                                                                      -- Vérifier XP disponible
                                                                                                                                                                                                                                                                        SELECT xp_total - xp_depense INTO v_xp_disponible
                                                                                                                                                                                                                                                                          FROM personnages WHERE id = p_personnage_id;

                                                                                                                                                                                                                                                                            IF NOT FOUND THEN
                                                                                                                                                                                                                                                                                RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Personnage introuvable');
                                                                                                                                                                                                                                                                                  END IF;

                                                                                                                                                                                                                                                                                    -- Vérifier que ce trait existe bien pour cette race (et sous_type si Chimeride)
                                                                                                                                                                                                                                                                                      SELECT EXISTS (
                                                                                                                                                                                                                                                                                          SELECT 1 FROM race_traits
                                                                                                                                                                                                                                                                                              WHERE race_id = p_race_id
                                                                                                                                                                                                                                                                                                  AND trait_id = p_trait_id
                                                                                                                                                                                                                                                                                                      AND (p_sous_type IS NULL OR sous_type = p_sous_type OR sous_type IS NULL)
                                                                                                                                                                                                                                                                                                        ) INTO v_trait_existe;

                                                                                                                                                                                                                                                                                                          IF NOT v_trait_existe THEN
                                                                                                                                                                                                                                                                                                              RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Ce trait n est pas disponible pour cette race');
                                                                                                                                                                                                                                                                                                                END IF;

                                                                                                                                                                                                                                                                                                                  -- Vérifier que le trait n'est pas déjà dans traits_raciaux_choisis
                                                                                                                                                                                                                                                                                                                    SELECT EXISTS (
                                                                                                                                                                                                                                                                                                                        SELECT 1 FROM personnages
                                                                                                                                                                                                                                                                                                                            WHERE id = p_personnage_id
                                                                                                                                                                                                                                                                                                                                AND traits_raciaux_choisis @> jsonb_build_array(jsonb_build_object('trait_id', p_trait_id))
                                                                                                                                                                                                                                                                                                                                  ) INTO v_deja_acquis;

                                                                                                                                                                                                                                                                                                                                    IF v_deja_acquis THEN
                                                                                                                                                                                                                                                                                                                                        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Ce trait est deja acquis');
                                                                                                                                                                                                                                                                                                                                          END IF;

                                                                                                                                                                                                                                                                                                                                            -- Compter les traits déjà choisis
                                                                                                                                                                                                                                                                                                                                              SELECT COALESCE(jsonb_array_length(traits_raciaux_choisis), 0) INTO v_nb_traits
                                                                                                                                                                                                                                                                                                                                                FROM personnages WHERE id = p_personnage_id;

                                                                                                                                                                                                                                                                                                                                                  -- 1er trait = gratuit, suivants = 10 XP
                                                                                                                                                                                                                                                                                                                                                    v_cout_xp := CASE WHEN v_nb_traits = 0 THEN 0 ELSE 10 END;

                                                                                                                                                                                                                                                                                                                                                      -- Vérifier XP si payant
                                                                                                                                                                                                                                                                                                                                                        IF v_cout_xp > 0 AND v_xp_disponible < v_cout_xp THEN
                                                                                                                                                                                                                                                                                                                                                            RETURN jsonb_build_object(
                                                                                                                                                                                                                                                                                                                                                                  'peut_acheter', false,
                                                                                                                                                                                                                                                                                                                                                                        'raison', 'XP insuffisant. Requis : 10 | Disponible : ' || v_xp_disponible
                                                                                                                                                                                                                                                                                                                                                                            );
                                                                                                                                                                                                                                                                                                                                                                              END IF;

                                                                                                                                                                                                                                                                                                                                                                                RETURN jsonb_build_object(
                                                                                                                                                                                                                                                                                                                                                                                    'peut_acheter', true,
                                                                                                                                                                                                                                                                                                                                                                                        'raison',       'OK',
                                                                                                                                                                                                                                                                                                                                                                                            'cout_xp',      v_cout_xp,
                                                                                                                                                                                                                                                                                                                                                                                                'est_gratuit',  v_cout_xp = 0,
                                                                                                                                                                                                                                                                                                                                                                                                    'nb_traits_actuels', v_nb_traits
                                                                                                                                                                                                                                                                                                                                                                                                      );
                                                                                                                                                                                                                                                                                                                                                                                                      END;
                                                                                                                                                                                                                                                                                                                                                                                                      $$;


--
-- Name: proteger_profile_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proteger_profile_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_actor_role text;
  BEGIN
    -- Si l'opération est effectuée par le superuser, autoriser sans vérification.
      IF current_user IN ('postgres', 'supabase_admin') OR session_user IN ('postgres', 'supabase_admin') THEN
          IF TG_OP = 'INSERT' THEN
                NEW.role := COALESCE(NEW.role, 'joueur');
                    END IF;
                        RETURN NEW;
                          END IF;

                            IF TG_OP = 'INSERT' THEN
                                IF auth.uid() IS NULL OR NEW.id IS DISTINCT FROM auth.uid() THEN
                                      RAISE EXCEPTION 'Création de profil non autorisée' USING ERRCODE = '42501';
                                          END IF;

                                              NEW.role := 'joueur';
                                                  RETURN NEW;
                                                    END IF;

                                                      IF TG_OP = 'UPDATE' THEN
                                                          IF NEW.id IS DISTINCT FROM OLD.id THEN
                                                                RAISE EXCEPTION 'Modification de l''identifiant profil non autorisée' USING ERRCODE = '42501';
                                                                    END IF;

                                                                        SELECT role INTO v_actor_role
                                                                            FROM public.profiles
                                                                                WHERE id = auth.uid();

                                                                                    IF auth.uid() = OLD.id AND NEW.role IS DISTINCT FROM OLD.role THEN
                                                                                          RAISE EXCEPTION 'Modification de votre propre rôle non autorisée' USING ERRCODE = '42501';
                                                                                              END IF;

                                                                                                  IF COALESCE(v_actor_role, 'joueur') NOT IN ('admin', 'animateur')
                                                                                                         AND NEW.role IS DISTINCT FROM OLD.role THEN
                                                                                                               RAISE EXCEPTION 'Modification du rôle non autorisée' USING ERRCODE = '42501';
                                                                                                                   END IF;

                                                                                                                       RETURN NEW;
                                                                                                                         END IF;

                                                                                                                           RETURN NEW;
                                                                                                                           END;
                                                                                                                           $$;


--
-- Name: recalculer_ps_max(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculer_ps_max(p_personnage_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ps_depart integer;
  v_nb_dev_spi integer;
  v_nb_dev_spi_sup integer;
BEGIN
  SELECT COALESCE(c.ps_depart, 5) INTO v_ps_depart
  FROM personnages p LEFT JOIN classes c ON c.id = p.classe_id
  WHERE p.id = p_personnage_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_nb_dev_spi
  FROM personnage_competences pc
  JOIN competences c ON c.id = pc.competence_id
  WHERE pc.personnage_id = p_personnage_id AND c.nom = 'Développement Spirituel';

  SELECT COUNT(*) INTO v_nb_dev_spi_sup
  FROM personnage_competences pc
  JOIN competences c ON c.id = pc.competence_id
  WHERE pc.personnage_id = p_personnage_id AND c.nom = 'Développement Spirituel Supérieur';

  UPDATE personnages
  SET ps_max = v_ps_depart + v_nb_dev_spi + v_nb_dev_spi_sup
  WHERE id = p_personnage_id;
END;
$$;


--
-- Name: recalculer_xp_personnage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculer_xp_personnage(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_xp_initial   integer;
  v_xp_gains     integer;
  v_xp_depenses  integer;
BEGIN
  SELECT COALESCE(r.xp_depart, 0)
    INTO v_xp_initial
  FROM personnages p
  LEFT JOIN races r ON r.id = p.race_id
  WHERE p.id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('xp_total', 0, 'xp_depense', 0);
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN montant > 0 THEN montant  ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN montant < 0 THEN -montant ELSE 0 END), 0)
    INTO v_xp_gains, v_xp_depenses
  FROM historique_xp
  WHERE personnage_id = p_personnage_id;

  RETURN jsonb_build_object(
    'xp_total',   v_xp_initial + v_xp_gains,
    'xp_depense', v_xp_depenses
  );
END;
$$;


--
-- Name: rechercher_encyclopedie(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rechercher_encyclopedie(p_terme text) RETURNS TABLE(type text, id uuid, titre text, sous_titre text, categorie text, snippet text, rang real)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_query tsquery;
BEGIN
  IF p_terme IS NULL OR length(trim(p_terme)) < 2 THEN
    RETURN;
  END IF;
  v_query := plainto_tsquery('french', p_terme);
  IF v_query::text = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  (
    SELECT
      'lore'::text AS type,
      l.id,
      l.nom AS titre,
      l.sous_titre,
      l.categorie,
      ts_headline('french', coalesce(l.description, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10') AS snippet,
      ts_rank(l.recherche_tsv, v_query) AS rang
    FROM lore l
    WHERE l.est_actif = true AND l.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT
      'bestiaire'::text AS type,
      b.id,
      b.nom AS titre,
      NULL::text AS sous_titre,
      b.categorie,
      ts_headline('french', coalesce(b.description, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10') AS snippet,
      ts_rank(b.recherche_tsv, v_query) AS rang
    FROM bestiaire b
    WHERE b.est_actif = true AND b.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT
      'religion'::text AS type,
      r.id,
      r.nom AS titre,
      r.dirigeant AS sous_titre,
      'religion'::text AS categorie,
      ts_headline('french', coalesce(r.description_longue, r.description, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10') AS snippet,
      ts_rank(r.recherche_tsv, v_query) AS rang
    FROM religions r
    WHERE r.est_actif = true AND r.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT
      'competence'::text AS type,
      c.id,
      c.nom AS titre,
      NULL::text AS sous_titre,
      c.categorie,
      ts_headline('french', coalesce(c.description, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10') AS snippet,
      ts_rank(c.recherche_tsv, v_query) AS rang
    FROM competences c
    WHERE c.est_actif = true AND c.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT
      'sort'::text AS type,
      s.id,
      s.nom AS titre,
      s.cercle AS sous_titre,
      s.type_sort AS categorie,
      ts_headline('french', coalesce(s.description, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10') AS snippet,
      ts_rank(s.recherche_tsv, v_query) AS rang
    FROM sorts s
    WHERE s.est_actif = true AND s.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT
      'priere'::text AS type,
      p.id,
      p.nom AS titre,
      p.domaine AS sous_titre,
      p.type_priere AS categorie,
      ts_headline('french', coalesce(p.description, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10') AS snippet,
      ts_rank(p.recherche_tsv, v_query) AS rang
    FROM prieres p
    WHERE p.est_actif = true AND p.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT
      'regle'::text AS type,
      sr.id,
      sr.titre AS titre,
      sr.categorie AS sous_titre,
      'regle'::text AS categorie,
      ts_headline('french', coalesce(sr.contenu, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10') AS snippet,
      ts_rank(sr.recherche_tsv, v_query) AS rang
    FROM sections_regles sr
    WHERE sr.est_actif = true AND sr.recherche_tsv @@ v_query
  )
  ORDER BY rang DESC
  LIMIT 50;
END;
$$;


--
-- Name: refuser_maitre_competence(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refuser_maitre_competence(p_personnage_competence_id uuid, p_raison text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
                                                                                                                                                                            DECLARE
                                                                                                                                                                              v_pc RECORD;
                                                                                                                                                                              BEGIN
                                                                                                                                                                                IF NOT est_animateur_ou_admin() THEN
                                                                                                                                                                                    RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
                                                                                                                                                                                      END IF;

                                                                                                                                                                                        SELECT pc.id,
                                                                                                                                                                                                 pc.personnage_id,
                                                                                                                                                                                                          pc.statut_maitre,
                                                                                                                                                                                                                   pc.niveau_acquis,
                                                                                                                                                                                                                            p.joueur_id,
                                                                                                                                                                                                                                     c.nom AS competence_nom
                                                                                                                                                                                                                                         INTO v_pc
                                                                                                                                                                                                                                             FROM personnage_competences pc
                                                                                                                                                                                                                                                 JOIN personnages p ON p.id = pc.personnage_id
                                                                                                                                                                                                                                                     JOIN competences c ON c.id = pc.competence_id
                                                                                                                                                                                                                                                         WHERE pc.id = p_personnage_competence_id;

                                                                                                                                                                                                                                                           IF NOT FOUND THEN
                                                                                                                                                                                                                                                               RETURN jsonb_build_object('succes', false, 'raison', 'Compétence introuvable');
                                                                                                                                                                                                                                                                 END IF;

                                                                                                                                                                                                                                                                   IF v_pc.statut_maitre <> 'en_attente' THEN
                                                                                                                                                                                                                                                                       RETURN jsonb_build_object('succes', false,
                                                                                                                                                                                                                                                                                                     'raison', format('Statut actuel : %s (attendu : en_attente)', v_pc.statut_maitre));
                                                                                                                                                                                                                                                                                                       END IF;

                                                                                                                                                                                                                                                                                                         UPDATE personnage_competences
                                                                                                                                                                                                                                                                                                              SET statut_maitre = 'refuse'
                                                                                                                                                                                                                                                                                                                 WHERE id = p_personnage_competence_id;

                                                                                                                                                                                                                                                                                                                   INSERT INTO notifications (user_id, message)
                                                                                                                                                                                                                                                                                                                     VALUES (
                                                                                                                                                                                                                                                                                                                         v_pc.joueur_id,
                                                                                                                                                                                                                                                                                                                             format('Votre maître a été refusé pour %s niveau %s.%s',
                                                                                                                                                                                                                                                                                                                                        v_pc.competence_nom,
                                                                                                                                                                                                                                                                                                                                                   v_pc.niveau_acquis,
                                                                                                                                                                                                                                                                                                                                                              CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0
                                                                                                                                                                                                                                                                                                                                                                              THEN ' Raison : ' || p_raison
                                                                                                                                                                                                                                                                                                                                                                                              ELSE '' END)
                                                                                                                                                                                                                                                                                                                                                                                                );

                                                                                                                                                                                                                                                                                                                                                                                                  RETURN jsonb_build_object('succes', true, 'competence', v_pc.competence_nom);
                                                                                                                                                                                                                                                                                                                                                                                                  END;
                                                                                                                                                                                                                                                                                                                                                                                                  $$;


--
-- Name: FUNCTION refuser_maitre_competence(p_personnage_competence_id uuid, p_raison text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.refuser_maitre_competence(p_personnage_competence_id uuid, p_raison text) IS 'Passe statut_maitre de en_attente à refuse pour une ligne personnage_competences, avec raison optionnelle. Notifie le joueur.';


--
-- Name: refuser_race_demande(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refuser_race_demande(p_demande_id uuid, p_raison text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    DECLARE
      v_demande RECORD;
        v_personnage RECORD;
        BEGIN
          -- 1. Vérifier que l'utilisateur est admin/animateur
            IF NOT est_animateur_ou_admin() THEN
                RETURN jsonb_build_object('succes', false, 
                      'erreur', 'Seuls les administrateurs peuvent refuser');
                        END IF;

                          -- 2. Validation de la raison (min 10 caractères)
                            IF p_raison IS NULL OR char_length(trim(p_raison)) < 10 THEN
                                RETURN jsonb_build_object('succes', false, 
                                      'erreur', 'Une raison d''au moins 10 caractères est obligatoire');
                                        END IF;

                                          -- 3. Récupérer la demande
                                            SELECT * INTO v_demande 
                                              FROM public.personnage_races_demandes 
                                                WHERE id = p_demande_id;
                                                  
                                                    IF v_demande IS NULL THEN
                                                        RETURN jsonb_build_object('succes', false, 'erreur', 'Demande introuvable');
                                                          END IF;

                                                            -- 4. Vérifier que la demande est bien en attente
                                                              IF v_demande.statut != 'en_attente' THEN
                                                                  RETURN jsonb_build_object('succes', false, 
                                                                        'erreur', format('Cette demande est déjà %s', v_demande.statut));
                                                                          END IF;

                                                                            -- 5. Mettre à jour la demande
                                                                              UPDATE public.personnage_races_demandes
                                                                                SET statut = 'refusee',
                                                                                      raison_refus = trim(p_raison),
                                                                                            approuve_par = auth.uid(),
                                                                                                  date_approbation = now()
                                                                                                    WHERE id = p_demande_id;

                                                                                                      -- 6. Récupérer les infos du personnage pour la notification
                                                                                                        SELECT p.*, r.nom AS race_nom 
                                                                                                          INTO v_personnage
                                                                                                            FROM public.personnages p
                                                                                                              JOIN public.races r ON r.id = v_demande.race_id
                                                                                                                WHERE p.id = v_demande.personnage_id;

                                                                                                                  -- 7. Envoyer notification au joueur (avec la raison)
                                                                                                                    INSERT INTO public.notifications (user_id, type, message, reference_id, statut)
                                                                                                                      VALUES (
                                                                                                                          v_personnage.joueur_id,
                                                                                                                              'race_refusee',
                                                                                                                                  format('❌ Votre demande pour la race "%s" (personnage "%s") a été REFUSÉE. Raison : %s', 
                                                                                                                                        v_personnage.race_nom, v_personnage.nom, trim(p_raison)),
                                                                                                                                            p_demande_id,
                                                                                                                                                'non_traite'
                                                                                                                                                  );

                                                                                                                                                    -- 8. Retourner le succès
                                                                                                                                                      RETURN jsonb_build_object('succes', true, 
                                                                                                                                                          'message', format('Race "%s" refusée pour %s', 
                                                                                                                                                                v_personnage.race_nom, v_personnage.nom));
                                                                                                                                                                END;
                                                                                                                                                                $$;


--
-- Name: role_du_profil(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.role_du_profil(_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  SELECT role FROM public.profiles WHERE id = _user_id
$$;


--
-- Name: sauvegarder_etape_1(uuid, text, integer, integer, integer, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sauvegarder_etape_1(p_personnage_id uuid, p_nom text, p_gn_completes integer, p_mini_gn_completes integer, p_ouvertures_terrain integer, p_est_croyant boolean, p_religion_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_perso public.personnages%ROWTYPE;
  v_validation jsonb;
  v_etape_apres integer;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'non_authentifie',
        'message', 'Authentification requise.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_perso
  FROM public.personnages
  WHERE id = p_personnage_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'personnage_introuvable',
        'message', 'Personnage introuvable.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  -- Ownership : owner OU admin/animateur
  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'ownership_refuse',
        'message', 'Ce personnage ne vous appartient pas.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.est_verrouille THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'personnage_verrouille',
        'message', 'Ce personnage est verrouillé et ne peut plus être modifié.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END IF;

  -- UPDATE avec catch des contraintes CHECK (ex. chk_croyant_religion_coherence)
  BEGIN
    UPDATE public.personnages
    SET
      nom = p_nom,
      gn_completes = p_gn_completes,
      mini_gn_completes = p_mini_gn_completes,
      ouvertures_terrain = p_ouvertures_terrain,
      est_croyant = p_est_croyant,
      religion_id = p_religion_id
    WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'contrainte_violee',
        'message', SQLERRM
      )),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END;

  v_validation := public.valider_etape_1(p_personnage_id);

  IF NOT (v_validation->>'valide')::boolean THEN
    -- Sauvegarde partielle conservée, pas de transition d'étape
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object(
        'personnage_id', p_personnage_id,
        'etape_creation_apres', v_perso.etape_creation
      )
    );
  END IF;

  -- Transition vers étape 2 uniquement si on était à l'étape 1 (pas de régression)
  IF v_perso.etape_creation = 1 THEN
    UPDATE public.personnages
    SET etape_creation = 2
    WHERE id = p_personnage_id;
    v_etape_apres := 2;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_id', p_personnage_id,
      'etape_creation_apres', v_etape_apres
    )
  );
END;
$$;


--
-- Name: FUNCTION sauvegarder_etape_1(p_personnage_id uuid, p_nom text, p_gn_completes integer, p_mini_gn_completes integer, p_ouvertures_terrain integer, p_est_croyant boolean, p_religion_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sauvegarder_etape_1(p_personnage_id uuid, p_nom text, p_gn_completes integer, p_mini_gn_completes integer, p_ouvertures_terrain integer, p_est_croyant boolean, p_religion_id uuid) IS 'Phase 1.6.1 — Sauvegarde l''étape 1 (InfosBase). UPDATE conservé même si validation échoue (sauvegarde partielle). Transition vers étape 2 uniquement si etape_creation = 1 ET validation OK. Comportement souple : autorise re-sauvegarder l''étape 1 même si etape_creation > 1 sans régression. Codes erreurs : non_authentifie, personnage_introuvable, ownership_refuse, personnage_verrouille, contrainte_violee + erreurs propagées de valider_etape_1.';


--
-- Name: sauvegarder_etape_10(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sauvegarder_etape_10(p_personnage_id uuid, p_historique text, p_ame_personnage text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_perso public.personnages%ROWTYPE;
  v_validation jsonb;
  v_etape_apres integer;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'non_authentifie', 'message', 'Authentification requise.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_introuvable', 'message', 'Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'ownership_refuse', 'message', 'Ce personnage ne vous appartient pas.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF v_perso.est_verrouille THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_verrouille', 'message', 'Ce personnage est verrouillé et ne peut plus être modifié.')),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END IF;
  BEGIN
    UPDATE public.personnages SET historique = p_historique, ame_personnage = p_ame_personnage WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'contrainte_violee', 'message', SQLERRM)),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END;
  v_validation := public.valider_etape_10(p_personnage_id);
  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', v_validation->'erreurs', 'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
  END IF;
  IF v_perso.etape_creation = 10 THEN
    UPDATE public.personnages SET etape_creation = 11 WHERE id = p_personnage_id;
    v_etape_apres := 11;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_etape_apres));
END;
$$;


--
-- Name: sauvegarder_etape_2(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sauvegarder_etape_2(p_personnage_id uuid, p_race_id uuid, p_sous_type_chimeride text DEFAULT NULL::text, p_justification text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_perso public.personnages%ROWTYPE;
  v_race_nom text;
  v_validation jsonb;
  v_etape_apres integer;
  v_demande_resultat jsonb;
  v_demande_existante boolean;
  v_avertissements jsonb := '[]'::jsonb;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'non_authentifie', 'message', 'Authentification requise.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_introuvable', 'message', 'Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'ownership_refuse', 'message', 'Ce personnage ne vous appartient pas.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF v_perso.est_verrouille THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_verrouille', 'message', 'Ce personnage est verrouillé et ne peut plus être modifié.')),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END IF;
  BEGIN
    UPDATE public.personnages SET race_id = p_race_id, sous_type_chimeride = p_sous_type_chimeride
     WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'contrainte_violee', 'message', SQLERRM)),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END;
  SELECT nom INTO v_race_nom FROM public.races WHERE id = p_race_id;
  IF v_race_nom IN ('Chiméride', 'Les Non-Races') THEN
    SELECT EXISTS (SELECT 1 FROM public.personnage_races_demandes WHERE personnage_id = p_personnage_id) INTO v_demande_existante;
    IF NOT v_demande_existante THEN
      IF p_justification IS NULL OR char_length(trim(p_justification)) < 100 THEN
        v_avertissements := v_avertissements || jsonb_build_object(
          'code', 'justification_race_speciale_requise',
          'message', 'Cette race nécessite une demande d''approbation avec une justification d''au moins 100 caractères.');
      ELSE
        v_demande_resultat := public.creer_demande_race(p_personnage_id, p_justification);
        IF NOT COALESCE((v_demande_resultat->>'succes')::boolean, false) THEN
          v_avertissements := v_avertissements || jsonb_build_object(
            'code', 'demande_race_echec',
            'message', COALESCE(v_demande_resultat->>'erreur', 'Création de la demande de race échouée.'));
        END IF;
      END IF;
    END IF;
  END IF;
  v_validation := public.valider_etape_2(p_personnage_id);
  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', (v_validation->'avertissements') || v_avertissements,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
  END IF;
  IF v_perso.etape_creation = 2 THEN
    UPDATE public.personnages SET etape_creation = 3 WHERE id = p_personnage_id;
    v_etape_apres := 3;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', v_avertissements,
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_etape_apres));
END;
$$;


--
-- Name: sauvegarder_etape_3(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sauvegarder_etape_3(p_personnage_id uuid, p_traits_raciaux_choisis jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
  SELECT nb_traits_raciaux INTO v_nb_traits_gratuits_race FROM public.races WHERE id = v_perso.race_id;
  v_nb_traits_gratuits_race := COALESCE(v_nb_traits_gratuits_race, 0);
  BEGIN
    DELETE FROM public.historique_xp
    WHERE personnage_id = p_personnage_id AND type_mouvement = 'depense_trait';
    FOR v_trait IN SELECT value FROM jsonb_array_elements(COALESCE(p_traits_raciaux_choisis, '[]'::jsonb))
    LOOP
      v_trait_id := (v_trait->>'trait_id')::uuid;
      IF v_index < v_nb_traits_gratuits_race THEN
        v_est_gratuit := true;
        v_cout_xp := 0;
      ELSE
        v_est_gratuit := false;
        SELECT cout_xp INTO v_cout_xp FROM public.vue_traits_par_race
         WHERE race_id = v_perso.race_id AND trait_id = v_trait_id LIMIT 1;
        v_cout_xp := COALESCE(v_cout_xp, 0);
      END IF;
      v_traits_recalcules := v_traits_recalcules || jsonb_build_array(jsonb_build_object(
        'trait_id', v_trait_id, 'est_gratuit', v_est_gratuit, 'xp_depense', v_cout_xp));
      IF NOT v_est_gratuit AND v_cout_xp > 0 THEN
        SELECT nom INTO v_trait_nom FROM public.traits_raciaux WHERE id = v_trait_id;
        INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
        VALUES (p_personnage_id, 'depense_trait', -v_cout_xp,
                format('Achat trait racial : %s', COALESCE(v_trait_nom, v_trait_id::text)),
                v_trait_id, v_joueur_id);
      END IF;
      v_index := v_index + 1;
    END LOOP;
    UPDATE public.personnages SET traits_raciaux_choisis = v_traits_recalcules WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
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
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_id', p_personnage_id,
      'etape_creation_apres', v_etape_apres,
      'traits_raciaux_choisis', v_traits_recalcules));
END;
$$;


--
-- Name: sauvegarder_etape_4(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sauvegarder_etape_4(p_personnage_id uuid, p_classe_id uuid, p_choix_par_competence jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_joueur_id    uuid := auth.uid();
  v_perso        public.personnages%ROWTYPE;
  v_validation   jsonb;
  v_attribution  jsonb;
  v_etape_apres  integer;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'non_authentifie',
        'message', 'Authentification requise.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'personnage_introuvable',
        'message', 'Personnage introuvable.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'ownership_refuse',
        'message', 'Ce personnage ne vous appartient pas.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.est_verrouille THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'personnage_verrouille',
        'message', 'Ce personnage est verrouillé et ne peut plus être modifié.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END IF;

  -- UPDATE classe_id
  BEGIN
    UPDATE public.personnages
    SET classe_id = p_classe_id
    WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'contrainte_violee',
        'message', SQLERRM
      )),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END;

  -- Re-charger v_perso (classe_id à jour)
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id;

  -- Attribuer les compétences gratuites de la classe
  v_attribution := public.attribuer_competences_gratuites_classe(
    p_personnage_id,
    COALESCE(p_choix_par_competence, '{}'::jsonb)
  );

  IF NOT (v_attribution->>'succes')::boolean THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', v_attribution->'erreurs',
      'avertissements', v_attribution->'avertissements',
      'donnees', jsonb_build_object(
        'personnage_id', p_personnage_id,
        'etape_creation_apres', v_perso.etape_creation
      )
    );
  END IF;

  -- Valider l'étape 4
  v_validation := public.valider_etape_4(p_personnage_id);

  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object(
        'personnage_id', p_personnage_id,
        'etape_creation_apres', v_perso.etape_creation
      )
    );
  END IF;

  -- Avancer
  IF v_perso.etape_creation = 4 THEN
    UPDATE public.personnages SET etape_creation = 5 WHERE id = p_personnage_id;
    v_etape_apres := 5;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_id', p_personnage_id,
      'etape_creation_apres', v_etape_apres
    )
  );
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
            BEGIN
              NEW.updated_at = now();
                RETURN NEW;
                END;
                $$;


--
-- Name: set_xp_initial_on_race_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_xp_initial_on_race_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_xp_depart    integer;
  v_xp_gains     integer;
  v_xp_depenses  integer;
BEGIN
  -- À l'UPDATE : ne rien faire si race_id n'a pas réellement changé
  IF TG_OP = 'UPDATE' AND OLD.race_id IS NOT DISTINCT FROM NEW.race_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(r.xp_depart, 0)
    INTO v_xp_depart
  FROM races r
  WHERE r.id = NEW.race_id;

  v_xp_depart := COALESCE(v_xp_depart, 0);

  SELECT
    COALESCE(SUM(CASE WHEN montant > 0 THEN montant  ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN montant < 0 THEN -montant ELSE 0 END), 0)
    INTO v_xp_gains, v_xp_depenses
  FROM historique_xp
  WHERE personnage_id = NEW.id;

  NEW.xp_total   := v_xp_depart + v_xp_gains;
  NEW.xp_depense := v_xp_depenses;

  RETURN NEW;
END;
$$;


--
-- Name: sync_xp_personnage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_xp_personnage() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_personnage_id uuid;
  v_calc          jsonb;
BEGIN
  v_personnage_id := COALESCE(NEW.personnage_id, OLD.personnage_id);

  PERFORM 1 FROM public.personnages WHERE id = v_personnage_id;
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_calc := public.recalculer_xp_personnage(v_personnage_id);

  IF (v_calc->>'xp_depense')::integer > (v_calc->>'xp_total')::integer THEN
    RAISE WARNING 'sync_xp_personnage: anomalie pour personnage % — xp_depense=% > xp_total=%',
      v_personnage_id, v_calc->>'xp_depense', v_calc->>'xp_total';
  END IF;

  UPDATE public.personnages
  SET xp_total   = (v_calc->>'xp_total')::integer,
      xp_depense = (v_calc->>'xp_depense')::integer
  WHERE id = v_personnage_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: FUNCTION sync_xp_personnage(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sync_xp_personnage() IS 'Trigger AFTER INSERT/UPDATE/DELETE sur historique_xp. Recalcule personnages.xp_total et xp_depense en mode total (race.xp_depart + somme des mouvements). Auto-correctif.';


--
-- Name: trg_recalculer_ps_max_sur_classe(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_recalculer_ps_max_sur_classe() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM recalculer_ps_max(NEW.id);
  RETURN NEW;
END;
$$;


--
-- Name: trg_recalculer_ps_max_sur_competence(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_recalculer_ps_max_sur_competence() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_nom_comp text;
  v_personnage_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_personnage_id := OLD.personnage_id;
    SELECT nom INTO v_nom_comp FROM competences WHERE id = OLD.competence_id;
  ELSE
    v_personnage_id := NEW.personnage_id;
    SELECT nom INTO v_nom_comp FROM competences WHERE id = NEW.competence_id;
  END IF;
  IF v_nom_comp IN ('Développement Spirituel', 'Développement Spirituel Supérieur') THEN
    PERFORM recalculer_ps_max(v_personnage_id);
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: update_user_role(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_role(user_id uuid, new_role text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Vérifier que l'appelant a le droit
    IF NOT est_animateur_ou_admin() THEN
        RAISE EXCEPTION 'Permission refusée.';
          END IF;

            -- Seul un admin peut donner le rôle 'admin'
              IF new_role = 'admin' AND (SELECT role FROM profiles WHERE id = auth.uid()) != 'admin' THEN
                  RAISE EXCEPTION 'Seul un administrateur peut attribuer le rôle admin.';
                    END IF;

                      -- Mise à jour
                        UPDATE profiles
                          SET role = new_role,
                                updated_at = now()
                                  WHERE id = user_id;
                                  END;
                                  $$;


--
-- Name: valider_etape(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_etape(p_personnage_id uuid, p_etape integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  CASE p_etape
    WHEN 1  THEN RETURN public.valider_etape_1(p_personnage_id);
    WHEN 2  THEN RETURN public.valider_etape_2(p_personnage_id);
    WHEN 3  THEN RETURN public.valider_etape_3(p_personnage_id);
    WHEN 4  THEN RETURN public.valider_etape_4(p_personnage_id);
    WHEN 5  THEN RETURN public.valider_etape_5(p_personnage_id);
    WHEN 6  THEN RETURN public.valider_etape_6(p_personnage_id);
    WHEN 7  THEN RETURN public.valider_etape_7(p_personnage_id);
    WHEN 8  THEN RETURN public.valider_etape_8(p_personnage_id);
    WHEN 9  THEN RETURN public.valider_etape_9(p_personnage_id);
    WHEN 10 THEN RETURN public.valider_etape_10(p_personnage_id);
    WHEN 11 THEN RETURN public.valider_etape_11(p_personnage_id);
    ELSE
      RAISE EXCEPTION 'Étape invalide : % (doit être entre 1 et 11)', p_etape
        USING ERRCODE = '22023';
  END CASE;
END;
$$;


--
-- Name: valider_etape_1(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_etape_1(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_perso public.personnages%ROWTYPE;
  v_erreurs jsonb := '[]'::jsonb;
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

  IF v_perso.nom IS NULL THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','nom_manquant','message','Le nom du personnage est obligatoire','champ','nom');
  ELSIF length(trim(v_perso.nom)) < 2 THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','nom_trop_court','message','Le nom doit contenir au moins 2 caractères','champ','nom');
  END IF;

  IF v_perso.est_croyant = true AND v_perso.religion_id IS NULL THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','religion_manquante','message','Un personnage croyant doit avoir une religion','champ','religion_id');
  ELSIF v_perso.est_croyant = false AND v_perso.religion_id IS NOT NULL THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','religion_incoherente','message','Un personnage non-croyant ne doit pas avoir de religion','champ','religion_id');
  END IF;

  IF COALESCE(v_perso.gn_completes, 0) < 0 THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','gn_completes_negatif','message','Le nombre de GN complétés ne peut pas être négatif','champ','gn_completes');
  END IF;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb
  );
END;
$$;


--
-- Name: valider_etape_10(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_etape_10(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.personnages WHERE id = p_personnage_id) THEN
    RETURN jsonb_build_object(
      'valide', false, 'ignoree', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'valide', true, 'ignoree', false,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb
  );
END;
$$;


--
-- Name: valider_etape_11(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_etape_11(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_perso public.personnages%ROWTYPE;
  v_erreurs jsonb := '[]'::jsonb;
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

  IF COALESCE(v_perso.xp_depense, 0) > COALESCE(v_perso.xp_total, 0) THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','xp_insuffisant',
      'message', format('XP dépensée (%s) supérieure à XP totale (%s)', v_perso.xp_depense, v_perso.xp_total),
      'champ','xp_depense');
  END IF;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb
  );
END;
$$;


--
-- Name: valider_etape_2(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_etape_2(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_perso public.personnages%ROWTYPE;
  v_race_nom text;
  v_demande_statut text;
  v_erreurs jsonb := '[]'::jsonb;
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

  IF v_perso.race_id IS NULL THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','race_manquante','message','La race est obligatoire','champ','race_id');
    RETURN jsonb_build_object(
      'valide', false, 'ignoree', false,
      'erreurs', v_erreurs, 'avertissements', '[]'::jsonb
    );
  END IF;

  SELECT nom INTO v_race_nom FROM public.races WHERE id = v_perso.race_id;

  IF v_race_nom = 'Chiméride' THEN
    IF v_perso.sous_type_chimeride IS NULL THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','sous_type_chimeride_manquant',
        'message','Un Chiméride doit avoir un sous-type (carnivore ou herbivore)',
        'champ','sous_type_chimeride');
    END IF;
  ELSE
    IF v_perso.sous_type_chimeride IS NOT NULL THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','sous_type_chimeride_invalide_pour_race',
        'message','Seuls les Chimérides ont un sous-type',
        'champ','sous_type_chimeride');
    END IF;
  END IF;

  SELECT statut INTO v_demande_statut
  FROM public.personnage_races_demandes
  WHERE personnage_id = p_personnage_id;

  IF FOUND AND v_demande_statut = 'refusee' THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','race_demande_refusee',
      'message','La demande pour cette race a été refusée',
      'champ','race_id');
  END IF;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb
  );
END;
$$;


--
-- Name: valider_etape_3(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_etape_3(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_perso public.personnages%ROWTYPE;
  v_nb_quota integer;
  v_nb_gratuits integer;
  v_traits jsonb;
  v_trait jsonb;
  v_trait_id uuid;
  v_est_gratuit boolean;
  v_xp_depense integer;
  v_cout_xp integer;
  v_trait_existe boolean;
  v_erreurs jsonb := '[]'::jsonb;
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

  IF v_perso.race_id IS NULL THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','race_manquante',
      'message','Sélectionnez une race avant de choisir des traits',
      'champ','race_id');
    RETURN jsonb_build_object(
      'valide', false, 'ignoree', false,
      'erreurs', v_erreurs, 'avertissements', '[]'::jsonb
    );
  END IF;

  SELECT nb_traits_raciaux INTO v_nb_quota FROM public.races WHERE id = v_perso.race_id;
  v_traits := COALESCE(v_perso.traits_raciaux_choisis, '[]'::jsonb);

  SELECT count(*) INTO v_nb_gratuits
  FROM jsonb_array_elements(v_traits) AS t
  WHERE (t->>'est_gratuit')::boolean = true;

  IF v_nb_gratuits <> v_nb_quota THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','traits_gratuits_quota_incorrect',
      'message', format('Vous devez choisir exactement %s trait(s) gratuit(s), pas %s', v_nb_quota, v_nb_gratuits),
      'champ','traits_raciaux_choisis');
  END IF;

  IF EXISTS (
    SELECT (t->>'trait_id')::uuid
    FROM jsonb_array_elements(v_traits) AS t
    GROUP BY (t->>'trait_id')::uuid
    HAVING count(*) > 1
  ) THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','traits_doublon',
      'message','Un même trait apparaît plusieurs fois',
      'champ','traits_raciaux_choisis');
  END IF;

  FOR v_trait IN SELECT * FROM jsonb_array_elements(v_traits) LOOP
    v_trait_id := (v_trait->>'trait_id')::uuid;
    v_est_gratuit := (v_trait->>'est_gratuit')::boolean;
    v_xp_depense := (v_trait->>'xp_depense')::integer;

    SELECT EXISTS (
      SELECT 1 FROM public.race_traits rt
      WHERE rt.race_id = v_perso.race_id
        AND rt.trait_id = v_trait_id
        AND (rt.sous_type IS NULL OR rt.sous_type = v_perso.sous_type_chimeride)
    ) INTO v_trait_existe;

    IF NOT v_trait_existe THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','trait_invalide_pour_race',
        'message', format('Le trait %s n''est pas accessible à cette race', v_trait_id),
        'champ','traits_raciaux_choisis');
    ELSE
      IF v_est_gratuit THEN
        IF v_xp_depense <> 0 THEN
          v_erreurs := v_erreurs || jsonb_build_object(
            'code','trait_gratuit_xp_non_nul',
            'message', format('Le trait %s est gratuit mais a un xp_depense non nul', v_trait_id),
            'champ','traits_raciaux_choisis');
        END IF;
      ELSE
        SELECT cout_xp INTO v_cout_xp FROM public.traits_raciaux WHERE id = v_trait_id;
        IF v_xp_depense <> v_cout_xp THEN
          v_erreurs := v_erreurs || jsonb_build_object(
            'code','trait_payant_xp_incorrect',
            'message', format('Le trait %s coûte %s XP, pas %s', v_trait_id, v_cout_xp, v_xp_depense),
            'champ','traits_raciaux_choisis');
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb
  );
END;
$$;


--
-- Name: valider_etape_4(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_etape_4(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_perso       public.personnages%ROWTYPE;
  v_classe      public.classes%ROWTYPE;
  v_gratuites   jsonb;
  v_gratuite    jsonb;
  v_competence  public.competences%ROWTYPE;
  v_pc_choix    text;
  v_erreurs     jsonb := '[]'::jsonb;
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

  IF v_perso.classe_id IS NULL THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','classe_manquante','message','La classe est obligatoire','champ','classe_id');
  ELSE
    SELECT * INTO v_classe FROM public.classes WHERE id = v_perso.classe_id;
    IF NOT FOUND THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','classe_introuvable','message','La classe sélectionnée n''existe pas','champ','classe_id');
    ELSE
      v_gratuites := COALESCE(v_classe.competences_gratuites, '[]'::jsonb);
      FOR v_gratuite IN SELECT * FROM jsonb_array_elements(v_gratuites)
      LOOP
        SELECT * INTO v_competence
        FROM public.competences
        WHERE id = (v_gratuite->>'competence_id')::uuid;

        IF FOUND AND v_competence.type_choix IS NOT NULL THEN
          SELECT choix_achat INTO v_pc_choix
          FROM public.personnage_competences
          WHERE personnage_id = p_personnage_id
            AND competence_id = v_competence.id
          LIMIT 1;

          IF v_pc_choix IS NULL THEN
            v_erreurs := v_erreurs || jsonb_build_object(
              'code', 'choix_manquant',
              'message', format('Choix de %s manquant pour %s', v_competence.type_choix, v_competence.nom),
              'champ', 'choix_par_competence',
              'competence_id', v_competence.id,
              'competence_nom', v_competence.nom,
              'type_choix', v_competence.type_choix
            );
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb
  );
END;
$$;


--
-- Name: valider_etape_5(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_etape_5(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_avertissements jsonb := '[]'::jsonb;
  v_nb_competences integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.personnages WHERE id = p_personnage_id) THEN
    RETURN jsonb_build_object(
      'valide', false, 'ignoree', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  SELECT count(*) INTO v_nb_competences
  FROM public.personnage_competences
  WHERE personnage_id = p_personnage_id;

  IF v_nb_competences = 0 THEN
    v_avertissements := v_avertissements || jsonb_build_object(
      'code','info_aucune_competence_payante',
      'message','Vous n''avez acheté aucune compétence supplémentaire');
  END IF;

  RETURN jsonb_build_object(
    'valide', true,
    'ignoree', false,
    'erreurs', '[]'::jsonb,
    'avertissements', v_avertissements
  );
END;
$$;


--
-- Name: valider_etape_6(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_etape_6(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_sort RECORD;
  v_niveau_max integer;
  v_nb_cercles integer;
  v_nb_sorts integer;
  v_erreurs jsonb := '[]'::jsonb;
  v_avertissements jsonb := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.personnages WHERE id = p_personnage_id) THEN
    RETURN jsonb_build_object(
      'valide', false, 'ignoree', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  IF NOT public.personnage_a_des_sorts(p_personnage_id) THEN
    RETURN jsonb_build_object(
      'valide', true, 'ignoree', true,
      'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb
    );
  END IF;

  FOR v_sort IN
    SELECT ps.sort_id, ps.niveau_sort, s.cercle, s.nom AS sort_nom
    FROM public.personnage_sorts ps
    JOIN public.sorts s ON s.id = ps.sort_id
    WHERE ps.personnage_id = p_personnage_id
  LOOP
    SELECT niveau_max_sorts INTO v_niveau_max
    FROM public.vue_cercles_disponibles
    WHERE personnage_id = p_personnage_id AND cercle = v_sort.cercle;

    IF NOT FOUND THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','sort_cercle_non_debloque',
        'message', format('Le sort %s appartient au cercle %s, non débloqué', v_sort.sort_nom, v_sort.cercle),
        'champ','personnage_sorts');
    ELSIF v_sort.niveau_sort > v_niveau_max THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','sort_niveau_trop_eleve',
        'message', format('Le sort %s (niveau %s) dépasse le max %s du cercle %s', v_sort.sort_nom, v_sort.niveau_sort, v_niveau_max, v_sort.cercle),
        'champ','personnage_sorts');
    END IF;
  END LOOP;

  SELECT count(*) INTO v_nb_cercles FROM public.vue_cercles_disponibles WHERE personnage_id = p_personnage_id;
  SELECT count(*) INTO v_nb_sorts FROM public.personnage_sorts WHERE personnage_id = p_personnage_id;

  IF v_nb_cercles > 0 AND v_nb_sorts = 0 THEN
    v_avertissements := v_avertissements || jsonb_build_object(
      'code','info_cercle_sans_sort',
      'message','Vous avez débloqué un ou plusieurs cercles mais n''avez acheté aucun sort');
  END IF;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', v_avertissements
  );
END;
$$;


--
-- Name: valider_etape_7(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_etape_7(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
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
    SELECT pp.priere_id, pp.niveau_priere, pr.domaine, pr.religion_id, pr.nom AS priere_nom
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

    IF v_priere.religion_id IS DISTINCT FROM v_perso.religion_id THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','priere_religion_incompatible',
        'message', format('La prière %s n''appartient pas à votre religion', v_priere.priere_nom),
        'champ','personnage_prieres');
    END IF;
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
$$;


--
-- Name: valider_etape_8(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_etape_8(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_a_artisanat boolean;
  v_quotas record;
  v_erreurs jsonb := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.personnages WHERE id = p_personnage_id) THEN
    RETURN jsonb_build_object(
      'valide', false, 'ignoree', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.personnage_competences pc
    JOIN public.competences c ON c.id = pc.competence_id
    WHERE pc.personnage_id = p_personnage_id
      AND c.nom IN ('Alchimie', 'Forge', 'Joaillerie')
  ) INTO v_a_artisanat;

  IF NOT v_a_artisanat THEN
    RETURN jsonb_build_object(
      'valide', true, 'ignoree', true,
      'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb
    );
  END IF;

  SELECT * INTO v_quotas FROM public.vue_artisanat_quotas WHERE personnage_id = p_personnage_id;

  IF v_quotas.quota_alchimie_mineure_utilises > v_quotas.quota_alchimie_mineure_total THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','artisanat_quota_depasse',
      'message', format('Quota recettes alchimie mineure dépassé (%s/%s)', v_quotas.quota_alchimie_mineure_utilises, v_quotas.quota_alchimie_mineure_total),
      'champ','personnage_recettes');
  END IF;

  IF v_quotas.quota_alchimie_intermediaire_utilises > v_quotas.quota_alchimie_intermediaire_total THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','artisanat_quota_depasse',
      'message', format('Quota recettes alchimie intermédiaire dépassé (%s/%s)', v_quotas.quota_alchimie_intermediaire_utilises, v_quotas.quota_alchimie_intermediaire_total),
      'champ','personnage_recettes');
  END IF;

  IF v_quotas.quota_alchimie_majeure_utilises > v_quotas.quota_alchimie_majeure_total THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','artisanat_quota_depasse',
      'message', format('Quota recettes alchimie majeure dépassé (%s/%s)', v_quotas.quota_alchimie_majeure_utilises, v_quotas.quota_alchimie_majeure_total),
      'champ','personnage_recettes');
  END IF;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb
  );
END;
$$;


--
-- Name: valider_etape_9(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_etape_9(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_quotas record;
  v_erreurs jsonb := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.personnages WHERE id = p_personnage_id) THEN
    RETURN jsonb_build_object(
      'valide', false, 'ignoree', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  IF NOT public.personnage_est_runiste(p_personnage_id) THEN
    RETURN jsonb_build_object(
      'valide', true, 'ignoree', true,
      'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb
    );
  END IF;

  SELECT * INTO v_quotas FROM public.vue_artisanat_quotas WHERE personnage_id = p_personnage_id;

  IF v_quotas.quota_assemblages_utilises > v_quotas.quota_assemblages_total THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','artisanat_quota_depasse',
      'message', format('Quota assemblages gratuits dépassé (%s/%s)', v_quotas.quota_assemblages_utilises, v_quotas.quota_assemblages_total),
      'champ','personnage_assemblages');
  END IF;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb
  );
END;
$$;


--
-- Name: valider_format_traits_raciaux(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_format_traits_raciaux(p_traits jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  -- NULL est autorisé (état initial du personnage)
  IF p_traits IS NULL THEN
    RETURN true;
  END IF;

  -- Doit être un tableau JSON
  IF jsonb_typeof(p_traits) != 'array' THEN
    RETURN false;
  END IF;

  -- Tableau vide autorisé
  IF jsonb_array_length(p_traits) = 0 THEN
    RETURN true;
  END IF;

  -- Chaque élément doit avoir trait_id (string), est_gratuit (bool), xp_depense (int >= 0)
  RETURN NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_traits) AS elem
    WHERE NOT (elem ? 'trait_id')
       OR NOT (elem ? 'est_gratuit')
       OR NOT (elem ? 'xp_depense')
       OR jsonb_typeof(elem->'trait_id') != 'string'
       OR jsonb_typeof(elem->'est_gratuit') != 'boolean'
       OR jsonb_typeof(elem->'xp_depense') != 'number'
       OR (elem->>'xp_depense')::int < 0
  );
END;
$$;


--
-- Name: FUNCTION valider_format_traits_raciaux(p_traits jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.valider_format_traits_raciaux(p_traits jsonb) IS 'Helper IMMUTABLE pour la contrainte CHECK du nouveau format de traits_raciaux_choisis. Format attendu : [{"trait_id": uuid, "est_gratuit": bool, "xp_depense": int>=0}].';


--
-- Name: valider_personnage_final(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valider_personnage_final(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_perso public.personnages%ROWTYPE;
  v_user_id uuid;
  v_etape integer;
  v_resultat jsonb;
  v_erreurs jsonb := '[]'::jsonb;
  v_avertissements jsonb := '[]'::jsonb;
  v_toutes_valides boolean := true;
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valide', false, 'est_verrouille', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  IF v_perso.joueur_id IS DISTINCT FROM v_user_id
     AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object(
      'valide', false, 'est_verrouille', v_perso.est_verrouille,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','non_autorise','message','Vous n''êtes pas autorisé à finaliser ce personnage')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  IF v_perso.est_verrouille = true THEN
    RETURN jsonb_build_object(
      'valide', false, 'est_verrouille', true,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_deja_verrouille','message','Ce personnage est déjà verrouillé')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  FOR v_etape IN 1..11 LOOP
    v_resultat := public.valider_etape(p_personnage_id, v_etape);

    IF (v_resultat->>'valide')::boolean = false THEN
      v_toutes_valides := false;
    END IF;

    v_erreurs := v_erreurs || COALESCE(v_resultat->'erreurs', '[]'::jsonb);
    v_avertissements := v_avertissements || COALESCE(v_resultat->'avertissements', '[]'::jsonb);
  END LOOP;

  IF v_toutes_valides THEN
    UPDATE public.personnages
    SET est_verrouille = true,
        etape_creation = 12
    WHERE id = p_personnage_id;

    RETURN jsonb_build_object(
      'valide', true, 'est_verrouille', true,
      'erreurs', '[]'::jsonb, 'avertissements', v_avertissements
    );
  END IF;

  RETURN jsonb_build_object(
    'valide', false, 'est_verrouille', false,
    'erreurs', v_erreurs, 'avertissements', v_avertissements
  );
END;
$$;


--
-- Name: verifier_prerequis_competences(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verifier_prerequis_competences(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_resultat        jsonb := '{}'::jsonb;
  v_competence      RECORD;
  v_niveau          integer;
  v_niveau_max_ok   integer;
  v_raisons         jsonb;
  v_raison_niv      text;
  v_prereq          jsonb;
  v_prereq_item     jsonb;
  v_manquants       text[];
  v_niveau_actuel_pre integer;
  v_ps_max          integer;
  v_a_creat1        boolean;
  v_a_creat2        boolean;
  v_a_ps            boolean;
BEGIN
  SELECT COALESCE(p.ps_max, 0) INTO v_ps_max FROM personnages p WHERE p.id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('erreur', 'Personnage introuvable');
  END IF;

  SELECT a_connaissance_creatures_1, a_connaissance_creatures_2, a_premiers_soins
    INTO v_a_creat1, v_a_creat2, v_a_ps
    FROM vue_personnage_etat
   WHERE personnage_id = p_personnage_id;

  FOR v_competence IN
    SELECT id, nom, prerequis_competences, type_achat
      FROM competences
     WHERE est_actif = true
  LOOP
    v_niveau_max_ok := 3;
    v_raisons       := '{}'::jsonb;

    FOR v_niveau IN 1..3 LOOP
      v_raison_niv := NULL;

      IF v_competence.nom = 'Dépeçage' AND v_niveau = 1 THEN
        IF NOT COALESCE(v_a_creat1, false) OR NOT COALESCE(v_a_ps, false) THEN
          v_raison_niv := 'Prérequis : Connaissance des Créatures niveau 1 ET Premiers Soins';
        END IF;
      ELSIF v_competence.nom = 'Dépeçage' AND v_niveau = 2 THEN
        IF NOT COALESCE(v_a_creat2, false) THEN
          v_raison_niv := 'Prérequis : Connaissance des Créatures niveau 2';
        END IF;
      ELSIF v_competence.nom = 'Développement Spirituel Supérieur' AND v_niveau = 1 THEN
        IF v_ps_max < 20 THEN
          v_raison_niv := 'Nécessite 20 PS (achetez d''abord Développement Spirituel)';
        END IF;
      ELSE
        v_prereq := v_competence.prerequis_competences -> v_niveau::text;
        IF v_prereq IS NOT NULL AND jsonb_array_length(v_prereq) > 0 THEN
          v_manquants := ARRAY[]::text[];
          FOR v_prereq_item IN SELECT * FROM jsonb_array_elements(v_prereq) LOOP
            SELECT COALESCE(max(pc.niveau_acquis), 0)
              INTO v_niveau_actuel_pre
              FROM personnage_competences pc
              JOIN competences c ON c.id = pc.competence_id
             WHERE pc.personnage_id = p_personnage_id
               AND c.nom = (v_prereq_item->>'competence_nom');
            IF v_niveau_actuel_pre < (v_prereq_item->>'niveau_min')::integer THEN
              v_manquants := v_manquants || format('%s niveau %s',
                v_prereq_item->>'competence_nom',
                v_prereq_item->>'niveau_min'
              );
            END IF;
          END LOOP;
          IF array_length(v_manquants, 1) > 0 THEN
            v_raison_niv := format('Prérequis manquant(s) : %s', array_to_string(v_manquants, ', '));
          END IF;
        END IF;
      END IF;

      IF v_raison_niv IS NOT NULL THEN
        IF v_niveau_max_ok = 3 THEN
          v_niveau_max_ok := v_niveau - 1;
        END IF;
        v_raisons := v_raisons || jsonb_build_object(v_niveau::text, v_raison_niv);
      END IF;
    END LOOP;

    IF v_niveau_max_ok < 3 THEN
      v_resultat := v_resultat || jsonb_build_object(
        v_competence.id::text,
        jsonb_build_object(
          'niveau_max_achetable', v_niveau_max_ok,
          'raisons_par_niveau',   v_raisons
        )
      );
    END IF;
  END LOOP;

  RETURN v_resultat;
END;
$$;


--
-- Name: verifier_race_approuvee_avant_inscription(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verifier_race_approuvee_avant_inscription() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
                  DECLARE
                    v_race_nom text;
                      v_demande_statut text;
                      BEGIN
                        -- Récupérer le nom de la race du personnage
                          SELECT r.nom INTO v_race_nom
                            FROM public.personnages p
                              JOIN public.races r ON r.id = p.race_id
                                WHERE p.id = NEW.personnage_id;

                                  -- Si race nécessite approbation
                                    IF v_race_nom IN ('Chiméride', 'Les Non-Races') THEN
                                        -- Vérifier le statut de la demande
                                            SELECT statut INTO v_demande_statut
                                                FROM public.personnage_races_demandes
                                                    WHERE personnage_id = NEW.personnage_id;

                                                        IF v_demande_statut IS NULL THEN
                                                              RAISE EXCEPTION 'Aucune demande de race trouvée pour ce personnage. Veuillez créer une demande dans le créateur de personnage.';
                                                                  ELSIF v_demande_statut = 'en_attente' THEN
                                                                        RAISE EXCEPTION 'Votre demande de race est en attente d''approbation. Vous pourrez vous inscrire une fois approuvée.';
                                                                            ELSIF v_demande_statut = 'refusee' THEN
                                                                                  RAISE EXCEPTION 'Votre demande de race a été refusée. Vous devez changer de race pour vous inscrire.';
                                                                                      END IF;
                                                                                          -- Si 'approuvee', on continue normalement
                                                                                            END IF;
                                                                                              
                                                                                                RETURN NEW;
                                                                                                END;
                                                                                                $$;


--
-- Name: verifier_verrous_competences(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verifier_verrous_competences() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_competence_nom text;
  v_competence_categorie text;
  v_paire_opposee_id uuid;
  v_paire_opposee_categorie text;
BEGIN
  SELECT nom, categorie
    INTO v_competence_nom, v_competence_categorie
  FROM public.competences
  WHERE id = NEW.competence_id;

  -- Hors-perimetre : seules ces compétences sont concernées par les verrous mutuels.
  IF v_competence_nom NOT IN (
    'Assemblage de Runes',
    'Canalisation',
    'Développement Spirituel',
    'Développement Spirituel Supérieur'
  ) THEN
    RETURN NEW;
  END IF;

  -- Identifier la version opposee (meme nom, categorie inverse)
  v_paire_opposee_categorie := CASE
    WHEN v_competence_categorie = 'mage' THEN 'pretre'
    ELSE 'mage'
  END;

  SELECT id INTO v_paire_opposee_id
  FROM public.competences
  WHERE nom = v_competence_nom
    AND categorie = v_paire_opposee_categorie
    AND id <> NEW.competence_id
  LIMIT 1;

  -- Verrou mutuel : bloquer si la version opposee est deja possedee
  IF v_paire_opposee_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.personnage_competences
    WHERE personnage_id = NEW.personnage_id
      AND competence_id = v_paire_opposee_id
  ) THEN
    RAISE EXCEPTION 'Cette compétence est incompatible avec « % (%) » que ce personnage possède déjà.',
      v_competence_nom,
      v_paire_opposee_categorie;
  END IF;

  -- Migration 33 (17 mai 2026) : suppression de la verification "version pretre
  -- reservee aux croyants". Ces 4 competences sont accessibles a toutes les
  -- classes sans contrainte de croyance. Developpement Spirituel Superieur
  -- pretre reste reserve a la classe Pretre via classes_requises=['pretre'].

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION verifier_verrous_competences(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.verifier_verrous_competences() IS 'Phase 1.6 — Bloque les achats incompatibles entre versions mage et prêtre des compétences Assemblage de Runes, Développement Spirituel et Développement Spirituel Supérieur. Bloque aussi l''achat de la version prêtre par un personnage non-croyant.';


--
-- Name: verrouiller_personnage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verrouiller_personnage(p_personnage_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        DECLARE
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          v_personnage RECORD;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          BEGIN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            IF NOT est_animateur_ou_admin() THEN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  END IF;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    SELECT id, nom, joueur_id, est_verrouille
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        INTO v_personnage
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            FROM personnages
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                WHERE id = p_personnage_id;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  IF NOT FOUND THEN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable');
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        END IF;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          UPDATE personnages SET est_verrouille = true WHERE id = p_personnage_id;

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            INSERT INTO notifications (user_id, message)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              VALUES (
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  v_personnage.joueur_id,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      format('Votre personnage « %s » a été verrouillé par l''équipe d''animation.',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 COALESCE(v_personnage.nom, 'Sans nom'))
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   );

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     RETURN jsonb_build_object('succes', true);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     END;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     $$;


--
-- Name: FUNCTION verrouiller_personnage(p_personnage_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.verrouiller_personnage(p_personnage_id uuid) IS 'Met est_verrouille = true. Notifie le joueur.';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assemblages_runes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assemblages_runes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text,
    description text,
    runes_requises text[],
    effet text,
    cout_xp integer,
    est_actif boolean,
    description_longue text,
    cible text,
    cout_ps integer DEFAULT 5,
    effet_maitrise text,
    cout_ps_maitrise integer
);


--
-- Name: bestiaire; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bestiaire (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    categorie text NOT NULL,
    pv_formule text,
    description text NOT NULL,
    immunites text,
    capacites_speciales text,
    est_actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    recherche_tsv tsvector GENERATED ALWAYS AS (((((setweight(to_tsvector('french'::regconfig, COALESCE(nom, ''::text)), 'A'::"char") || setweight(to_tsvector('french'::regconfig, COALESCE(categorie, ''::text)), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, COALESCE(description, ''::text)), 'C'::"char")) || setweight(to_tsvector('french'::regconfig, COALESCE(immunites, ''::text)), 'D'::"char")) || setweight(to_tsvector('french'::regconfig, COALESCE(capacites_speciales, ''::text)), 'D'::"char"))) STORED,
    CONSTRAINT bestiaire_categorie_check CHECK ((categorie = ANY (ARRAY['mort_vivant'::text, 'animal'::text, 'creature_magique'::text, 'humanoide'::text, 'demon'::text, 'esprit'::text, 'feerique'::text])))
);


--
-- Name: cartes_accueil; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cartes_accueil (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    emoji text NOT NULL,
    titre text NOT NULL,
    description text NOT NULL,
    tab_cible text NOT NULL,
    ordre integer DEFAULT 0 NOT NULL,
    est_actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: categories_creatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories_creatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    ordre integer DEFAULT 0 NOT NULL,
    est_actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text,
    description text,
    role_combat text,
    pv_depart integer,
    ps_depart integer,
    competences_gratuites jsonb,
    est_actif boolean,
    peut_utiliser_armes_deux_mains boolean DEFAULT false,
    emoji text
);


--
-- Name: TABLE classes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.classes IS 'Classes de personnage. Guerrier:6PV/5PS, Voleur:5PV/5PS, Mage:4PV/10PS, Pretre:4PV/10PS.';


--
-- Name: competences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text,
    description text,
    categorie text,
    niveaux jsonb,
    est_general boolean,
    est_actif boolean,
    type_achat text DEFAULT 'simple'::text NOT NULL,
    type_choix text,
    verrouillage_croise boolean DEFAULT false NOT NULL,
    classes_requises text[],
    prerequis_competences jsonb,
    recherche_tsv tsvector GENERATED ALWAYS AS (((setweight(to_tsvector('french'::regconfig, COALESCE(nom, ''::text)), 'A'::"char") || setweight(to_tsvector('french'::regconfig, COALESCE(categorie, ''::text)), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, COALESCE(description, ''::text)), 'C'::"char"))) STORED,
    CONSTRAINT competences_type_achat_check CHECK ((type_achat = ANY (ARRAY['simple'::text, 'unique_avec_choix'::text, 'multiple_avec_choix_par_niveau'::text, 'multiple_langue'::text, 'multiple_sans_choix'::text]))),
    CONSTRAINT competences_type_choix_check CHECK (((type_choix IS NULL) OR (type_choix = ANY (ARRAY['categorie_creature'::text, 'langue'::text, 'langue_ancienne'::text, 'cercle'::text, 'domaine'::text, 'religion'::text, 'famille_criminelle'::text, 'categorie_depecage'::text]))))
);


--
-- Name: TABLE competences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.competences IS 'Competences achetables avec XP. Niveau 3 necessite un maitre en jeu.';


--
-- Name: COLUMN competences.classes_requises; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.competences.classes_requises IS 'Liste des classes autorisées à acheter cette compétence (noms normalisés en minuscule sans accent : guerrier, voleur, mage, pretre). NULL = toutes classes autorisées.';


--
-- Name: COLUMN competences.prerequis_competences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.competences.prerequis_competences IS 'Map { "niveau_cible": [{"competence_nom": "...", "niveau_min": N}] }. ET logique. NULL = aucun prereq inter-compétences.';


--
-- Name: config_jeu; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.config_jeu (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cle text,
    valeur jsonb
);


--
-- Name: effets_combat; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.effets_combat (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text,
    description text,
    duree text,
    conditions text,
    type text,
    source text,
    CONSTRAINT effets_combat_source_check CHECK ((source = ANY (ARRAY['magie'::text, 'competence'::text, 'les_deux'::text]))),
    CONSTRAINT effets_combat_type_check CHECK ((type = ANY (ARRAY['debuff'::text, 'controle'::text, 'degats'::text, 'utilitaire'::text, 'mort'::text])))
);


--
-- Name: evenements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evenements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titre text,
    description text,
    date_evenement timestamp without time zone,
    lieu text,
    xp_recompense integer,
    max_participants integer,
    est_publie boolean DEFAULT false,
    created_by uuid,
    created_at timestamp without time zone,
    updated_at timestamp with time zone DEFAULT now(),
    date_fin timestamp with time zone,
    type_evenement text DEFAULT 'gn_regulier'::text,
    adresse_physique text,
    niveaux_recompense integer DEFAULT 0,
    est_termine boolean DEFAULT false,
    CONSTRAINT evenements_type_evenement_check CHECK ((type_evenement = ANY (ARRAY['mini_gn'::text, 'gn_regulier'::text, 'entretien_terrain'::text])))
);


--
-- Name: COLUMN evenements.type_evenement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.evenements.type_evenement IS 'gn_complet = 15 XP + 1 niveau | mini_gn = 15 XP seulement, pas de niveau';


--
-- Name: familles_criminelles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.familles_criminelles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text,
    description text,
    avantages text,
    est_actif boolean,
    description_longue text
);


--
-- Name: historique_xp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historique_xp (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personnage_id uuid NOT NULL,
    type_mouvement text NOT NULL,
    montant integer NOT NULL,
    description text NOT NULL,
    competence_id uuid,
    trait_id uuid,
    sort_id uuid,
    priere_id uuid,
    recette_id uuid,
    assemblage_id uuid,
    objet_forge_id uuid,
    objet_joaillerie_id uuid,
    evenement_id uuid,
    inscription_id uuid,
    acteur_id uuid,
    personnage_source_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_historique_xp_description_non_vide CHECK ((char_length(TRIM(BOTH FROM description)) >= 1)),
    CONSTRAINT chk_historique_xp_montant_non_nul CHECK ((montant <> 0)),
    CONSTRAINT chk_historique_xp_reference_objet CHECK (
CASE
    WHEN ((type_mouvement ~~ 'depense_%'::text) OR (type_mouvement = 'remboursement'::text)) THEN ((((((((
    CASE
        WHEN (competence_id IS NOT NULL) THEN 1
        ELSE 0
    END +
    CASE
        WHEN (trait_id IS NOT NULL) THEN 1
        ELSE 0
    END) +
    CASE
        WHEN (sort_id IS NOT NULL) THEN 1
        ELSE 0
    END) +
    CASE
        WHEN (priere_id IS NOT NULL) THEN 1
        ELSE 0
    END) +
    CASE
        WHEN (recette_id IS NOT NULL) THEN 1
        ELSE 0
    END) +
    CASE
        WHEN (assemblage_id IS NOT NULL) THEN 1
        ELSE 0
    END) +
    CASE
        WHEN (objet_forge_id IS NOT NULL) THEN 1
        ELSE 0
    END) +
    CASE
        WHEN (objet_joaillerie_id IS NOT NULL) THEN 1
        ELSE 0
    END) = 1)
    WHEN (type_mouvement = ANY (ARRAY['gain_evenement'::text, 'gain_bonus'::text, 'gain_correction'::text])) THEN ((competence_id IS NULL) AND (trait_id IS NULL) AND (sort_id IS NULL) AND (priere_id IS NULL) AND (recette_id IS NULL) AND (assemblage_id IS NULL) AND (objet_forge_id IS NULL) AND (objet_joaillerie_id IS NULL))
    ELSE false
END),
    CONSTRAINT chk_historique_xp_signe_coherent CHECK ((((type_mouvement = ANY (ARRAY['gain_evenement'::text, 'gain_bonus'::text, 'gain_correction'::text, 'remboursement'::text])) AND (montant > 0)) OR ((type_mouvement ~~ 'depense_%'::text) AND (montant < 0)))),
    CONSTRAINT chk_historique_xp_type_alignement_fk CHECK ((((type_mouvement = 'depense_competence'::text) AND (competence_id IS NOT NULL)) OR ((type_mouvement = 'depense_trait'::text) AND (trait_id IS NOT NULL)) OR ((type_mouvement = 'depense_sort'::text) AND (sort_id IS NOT NULL)) OR ((type_mouvement = 'depense_priere'::text) AND (priere_id IS NOT NULL)) OR ((type_mouvement = 'depense_recette'::text) AND (recette_id IS NOT NULL)) OR ((type_mouvement = 'depense_assemblage'::text) AND (assemblage_id IS NOT NULL)) OR ((type_mouvement = 'depense_objet_forge'::text) AND (objet_forge_id IS NOT NULL)) OR ((type_mouvement = 'depense_objet_joaillerie'::text) AND (objet_joaillerie_id IS NOT NULL)) OR (type_mouvement = 'remboursement'::text) OR (type_mouvement = ANY (ARRAY['gain_evenement'::text, 'gain_bonus'::text, 'gain_correction'::text])))),
    CONSTRAINT chk_historique_xp_type_valide CHECK ((type_mouvement = ANY (ARRAY['gain_evenement'::text, 'gain_bonus'::text, 'gain_correction'::text, 'remboursement'::text, 'depense_competence'::text, 'depense_trait'::text, 'depense_sort'::text, 'depense_priere'::text, 'depense_recette'::text, 'depense_assemblage'::text, 'depense_objet_forge'::text, 'depense_objet_joaillerie'::text])))
);


--
-- Name: TABLE historique_xp; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.historique_xp IS 'Source de vérité des mouvements d''XP par personnage. xp_total et xp_depense des personnages sont recalculés par le trigger trg_sync_xp_personnage à chaque modification.';


--
-- Name: COLUMN historique_xp.type_mouvement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.historique_xp.type_mouvement IS 'Type de mouvement parmi 12 valeurs : gain_evenement, gain_bonus, gain_correction, remboursement (positifs) ; depense_competence, depense_trait, depense_sort, depense_priere, depense_recette, depense_assemblage, depense_objet_forge, depense_objet_joaillerie (négatifs).';


--
-- Name: COLUMN historique_xp.personnage_source_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.historique_xp.personnage_source_id IS 'Réservé pour les transferts d''XP entre personnages (ex. : XP Mini-GN d''hiver gardé en banque pour un futur personnage). Pas utilisé pour l''instant.';


--
-- Name: ingredients_alchimiques; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingredients_alchimiques (
    id uuid NOT NULL,
    nom text,
    manipulations text,
    niveau integer
);


--
-- Name: inscriptions_evenements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inscriptions_evenements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    evenement_id uuid,
    personnage_id uuid,
    joueur_id uuid,
    statut text DEFAULT 'en_attente'::text,
    date_inscription timestamp without time zone,
    date_confirmation timestamp without time zone,
    updated_at timestamp with time zone DEFAULT now(),
    xp_attribue integer DEFAULT 0,
    recompense_distribuee boolean DEFAULT false,
    CONSTRAINT inscriptions_evenements_statut_check CHECK ((statut = ANY (ARRAY['en_attente'::text, 'present'::text, 'absent'::text, 'annule'::text])))
);


--
-- Name: COLUMN inscriptions_evenements.xp_attribue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.inscriptions_evenements.xp_attribue IS 'XP reellement attribue apres l evenement. 0 si pas encore attribue.';


--
-- Name: langues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.langues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    est_ancienne boolean DEFAULT false NOT NULL,
    ordre integer DEFAULT 0 NOT NULL,
    est_actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: lore; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lore (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    categorie text NOT NULL,
    nom text NOT NULL,
    sous_titre text,
    embleme text,
    description text NOT NULL,
    ordre integer DEFAULT 0,
    est_actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    recherche_tsv tsvector GENERATED ALWAYS AS (((setweight(to_tsvector('french'::regconfig, COALESCE(nom, ''::text)), 'A'::"char") || setweight(to_tsvector('french'::regconfig, COALESCE(sous_titre, ''::text)), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, COALESCE(description, ''::text)), 'C'::"char"))) STORED,
    CONSTRAINT lore_categorie_check CHECK ((categorie = ANY (ARRAY['region'::text, 'cite'::text, 'faction'::text, 'histoire'::text])))
);


--
-- Name: menu_navigation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_navigation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    libelle text NOT NULL,
    url text NOT NULL,
    roles_autorises text[],
    afficher_navbar boolean DEFAULT true NOT NULL,
    afficher_footer boolean DEFAULT false NOT NULL,
    ordre integer DEFAULT 0 NOT NULL,
    est_actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    message text,
    lu boolean DEFAULT false,
    created_at timestamp without time zone,
    updated_at timestamp with time zone DEFAULT now(),
    type text DEFAULT 'info'::text NOT NULL,
    reference_id uuid,
    statut text DEFAULT 'non_traite'::text NOT NULL,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['info'::text, 'validation_race'::text, 'validation_maitre'::text, 'xp'::text, 'evenement'::text, 'demande_race_nouvelle'::text, 'race_approuvee'::text, 'race_refusee'::text])))
);


--
-- Name: objets_forge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objets_forge (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text,
    description text,
    type text,
    stats jsonb,
    difficulte integer,
    cout_xp integer,
    est_actif boolean,
    materiaux_communs text,
    materiaux_rares text
);


--
-- Name: objets_joaillerie; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objets_joaillerie (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text,
    description text,
    effet text,
    difficulte integer,
    cout_xp integer,
    est_actif boolean,
    materiaux_communs text,
    materiaux_rares text
);


--
-- Name: parametres_jeu; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parametres_jeu (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom_gn text DEFAULT 'Hurlevent'::text NOT NULL,
    description_gn text,
    lien_facebook text,
    lien_discord text,
    lien_instagram text,
    lien_site_web text,
    email_contact text,
    texte_envoi_photos_race text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: personnage_assemblages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnage_assemblages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    personnage_id uuid NOT NULL,
    assemblage_id uuid NOT NULL,
    xp_depense integer DEFAULT 0 NOT NULL,
    date_acquisition timestamp with time zone DEFAULT now() NOT NULL,
    est_gratuit boolean DEFAULT false NOT NULL
);


--
-- Name: personnage_competences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnage_competences (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    personnage_id uuid NOT NULL,
    competence_id uuid NOT NULL,
    niveau_acquis integer DEFAULT 1 NOT NULL,
    appris_via_maitre boolean DEFAULT false NOT NULL,
    xp_depense integer DEFAULT 0 NOT NULL,
    date_acquisition timestamp with time zone DEFAULT now() NOT NULL,
    nom_maitre text,
    statut_maitre text DEFAULT 'non_requis'::text,
    choix_achat text,
    CONSTRAINT personnage_competences_niveau_acquis_check CHECK (((niveau_acquis >= 1) AND (niveau_acquis <= 3))),
    CONSTRAINT personnage_competences_statut_maitre_check CHECK ((statut_maitre = ANY (ARRAY['non_requis'::text, 'en_attente'::text, 'approuve'::text, 'refuse'::text])))
);


--
-- Name: TABLE personnage_competences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.personnage_competences IS 'Competences acquises par un personnage. Niveau 3 = maitre requis en jeu.';


--
-- Name: personnage_objets_forge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnage_objets_forge (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    personnage_id uuid NOT NULL,
    objet_id uuid NOT NULL,
    xp_depense integer DEFAULT 0 NOT NULL,
    date_acquisition timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: personnage_objets_joaillerie; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnage_objets_joaillerie (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    personnage_id uuid NOT NULL,
    objet_id uuid NOT NULL,
    xp_depense integer DEFAULT 0 NOT NULL,
    date_acquisition timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: personnage_prieres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnage_prieres (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    personnage_id uuid NOT NULL,
    priere_id uuid NOT NULL,
    niveau_priere integer DEFAULT 1 NOT NULL,
    xp_depense integer DEFAULT 0 NOT NULL,
    date_acquisition timestamp with time zone DEFAULT now() NOT NULL,
    nom_personnalise text,
    zone_choisie text,
    portee_choisie text,
    duree_choisie text,
    duree_incantation_calculee integer
);


--
-- Name: personnage_races_demandes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnage_races_demandes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personnage_id uuid NOT NULL,
    race_id uuid NOT NULL,
    background text NOT NULL,
    statut text DEFAULT 'en_attente'::text NOT NULL,
    raison_refus text,
    approuve_par uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    date_approbation timestamp with time zone,
    CONSTRAINT approuve_par_requis_si_traite CHECK (((statut = 'en_attente'::text) OR (approuve_par IS NOT NULL))),
    CONSTRAINT personnage_races_demandes_background_check CHECK ((char_length(background) >= 100)),
    CONSTRAINT personnage_races_demandes_statut_check CHECK ((statut = ANY (ARRAY['en_attente'::text, 'approuvee'::text, 'refusee'::text]))),
    CONSTRAINT raison_requise_si_refusee CHECK (((statut <> 'refusee'::text) OR ((raison_refus IS NOT NULL) AND (char_length(raison_refus) >= 10))))
);


--
-- Name: personnage_recettes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnage_recettes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    personnage_id uuid NOT NULL,
    recette_id uuid NOT NULL,
    xp_depense integer DEFAULT 0 NOT NULL,
    date_acquisition timestamp with time zone DEFAULT now() NOT NULL,
    est_gratuit boolean DEFAULT false NOT NULL
);


--
-- Name: personnage_sorts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnage_sorts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    personnage_id uuid NOT NULL,
    sort_id uuid NOT NULL,
    niveau_sort integer DEFAULT 1 NOT NULL,
    xp_depense integer DEFAULT 0 NOT NULL,
    date_acquisition timestamp with time zone DEFAULT now() NOT NULL,
    nom_personnalise text,
    zone_choisie text,
    portee_choisie text,
    duree_choisie text,
    formule_magique text
);


--
-- Name: personnages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnages (
    id uuid NOT NULL,
    joueur_id uuid NOT NULL,
    nom text,
    race_id uuid,
    classe_id uuid,
    niveau integer DEFAULT 1,
    xp_total integer DEFAULT 0,
    xp_depense integer DEFAULT 0,
    traits_raciaux_choisis jsonb,
    famille_criminelle_id uuid,
    religion_id uuid,
    historique text,
    ame_personnage text,
    est_verrouille boolean DEFAULT false,
    etape_creation integer DEFAULT 1 NOT NULL,
    date_creation timestamp without time zone,
    date_modification timestamp without time zone DEFAULT now(),
    gn_completes integer DEFAULT 0,
    mini_gn_completes integer DEFAULT 0,
    ouvertures_terrain integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    pv_max integer DEFAULT 4 NOT NULL,
    ps_max integer DEFAULT 5 NOT NULL,
    est_actif boolean DEFAULT true NOT NULL,
    est_mort boolean DEFAULT false NOT NULL,
    classe_secondaire_id uuid,
    a_forge_legendaire boolean DEFAULT false NOT NULL,
    a_joaillerie_legendaire boolean DEFAULT false NOT NULL,
    sous_type_chimeride text,
    est_croyant boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_croyant_religion_coherence CHECK ((est_croyant = (religion_id IS NOT NULL))),
    CONSTRAINT personnages_nom_longueur CHECK (((nom IS NULL) OR (char_length(TRIM(BOTH FROM nom)) >= 2))),
    CONSTRAINT personnages_sous_type_chimeride_check CHECK (((sous_type_chimeride = ANY (ARRAY['carnivore'::text, 'herbivore'::text])) OR (sous_type_chimeride IS NULL))),
    CONSTRAINT personnages_traits_raciaux_format CHECK (public.valider_format_traits_raciaux(traits_raciaux_choisis)),
    CONSTRAINT personnages_xp_depense_max CHECK ((xp_depense <= xp_total)),
    CONSTRAINT personnages_xp_depense_positif CHECK ((xp_depense >= 0)),
    CONSTRAINT personnages_xp_total_positif CHECK ((xp_total >= 0))
);


--
-- Name: TABLE personnages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.personnages IS 'Fiche de personnage. XP disponible = xp_total - xp_depense.';


--
-- Name: CONSTRAINT chk_croyant_religion_coherence ON personnages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT chk_croyant_religion_coherence ON public.personnages IS 'Cohérence stricte : un personnage est croyant SI ET SEULEMENT SI il a une religion. est_croyant = TRUE <=> religion_id IS NOT NULL.';


--
-- Name: pieges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pieges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    niveau integer NOT NULL,
    cout_xp integer NOT NULL,
    cible text NOT NULL,
    duree text NOT NULL,
    effets text NOT NULL,
    niveau_effet integer,
    type_piege text DEFAULT 'physique'::text NOT NULL,
    est_actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    construction text,
    CONSTRAINT "pièges_niveau_check" CHECK ((niveau = ANY (ARRAY[1, 2, 3]))),
    CONSTRAINT "pièges_type_piege_check" CHECK ((type_piege = ANY (ARRAY['physique'::text, 'magique'::text])))
);


--
-- Name: prieres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prieres (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    nom text NOT NULL,
    domaine text NOT NULL,
    niveau integer DEFAULT 1 NOT NULL,
    description text,
    type_priere text,
    zone_effet text,
    portee text,
    duree text,
    duree_incantation text,
    cout_xp_base numeric(4,2),
    religion_id uuid,
    est_actif boolean DEFAULT true NOT NULL,
    recherche_tsv tsvector GENERATED ALWAYS AS ((((setweight(to_tsvector('french'::regconfig, COALESCE(nom, ''::text)), 'A'::"char") || setweight(to_tsvector('french'::regconfig, COALESCE(domaine, ''::text)), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, COALESCE(type_priere, ''::text)), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, COALESCE(description, ''::text)), 'C'::"char"))) STORED,
    CONSTRAINT prieres_duree_check CHECK ((duree = ANY (ARRAY['Instantanée'::text, '1 Minute'::text, '5 Minutes'::text, '10 Minutes'::text, '20 Minutes'::text, '30 Minutes'::text, '40 Minutes'::text, '50 Minutes'::text, '60 Minutes'::text]))),
    CONSTRAINT prieres_niveau_check CHECK (((niveau >= 1) AND (niveau <= 20))),
    CONSTRAINT prieres_portee_check CHECK ((portee = ANY (ARRAY['Toucher'::text, '5 Pieds'::text, '10 Pieds'::text, '25 Pieds'::text, '50 Pieds'::text, 'À vue'::text]))),
    CONSTRAINT prieres_type_priere_check CHECK ((type_priere = ANY (ARRAY['effet'::text, 'effet bénéfique'::text, 'dégâts'::text]))),
    CONSTRAINT prieres_zone_effet_check CHECK ((zone_effet = ANY (ARRAY['Personnelle'::text, '1 cible'::text, '1 cible (mort)'::text, '1 cible (objet)'::text, 'Nombre de cibles'::text, 'Nombre de cibles (objets)'::text, 'Nombre de cibles ou rayon 3 pieds'::text, 'Tous rayons'::text, 'Nombre de cibles ou tous rayons'::text])))
);


--
-- Name: TABLE prieres; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.prieres IS 'Prieres de pretre organisees par domaines. Necessitent une incantation minimale.';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text,
    email text,
    role text DEFAULT 'joueur'::text,
    created_at timestamp without time zone,
    is_active boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now(),
    nom_affichage text,
    avatar_url text
);


--
-- Name: TABLE profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.profiles IS 'Profil public lié au compte auth Supabase. Un profil par joueur.';


--
-- Name: race_traits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.race_traits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    race_id uuid NOT NULL,
    trait_id uuid NOT NULL,
    sous_type text,
    CONSTRAINT race_traits_sous_type_check CHECK (((sous_type IS NULL) OR (sous_type = ANY (ARRAY['carnivore'::text, 'herbivore'::text]))))
);


--
-- Name: races; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.races (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text,
    description text,
    restrictions_classes text[],
    image_url text,
    est_actif boolean,
    nom_latin text,
    xp_depart integer DEFAULT 60 NOT NULL,
    esperance_vie text,
    exigences_costume text,
    nb_traits_raciaux integer DEFAULT 1 NOT NULL,
    est_jouable boolean DEFAULT true NOT NULL,
    emoji character varying(10)
);


--
-- Name: TABLE races; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.races IS 'Races jouables et non-jouables du monde de Destea.';


--
-- Name: recettes_alchimie; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recettes_alchimie (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text,
    description text,
    formule text,
    effet text,
    ingredients jsonb,
    niveau_requis integer,
    cout_xp integer,
    est_actif boolean,
    type text,
    CONSTRAINT check_niveau_requis CHECK ((niveau_requis = ANY (ARRAY[1, 2, 3]))),
    CONSTRAINT recettes_alchimie_type_check CHECK ((type = ANY (ARRAY['potion'::text, 'poison'::text, 'autre'::text])))
);


--
-- Name: TABLE recettes_alchimie; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.recettes_alchimie IS 'Recettes alchimiques achetables. Potions limitees par saturation alchimique (PV max / 2).';


--
-- Name: religions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.religions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text,
    dirigeant text,
    fondateur text,
    description text,
    domaines_principaux text[],
    domaines_proscrits text[],
    symbole_sacre text,
    pouvoir_symbole text,
    est_actif boolean,
    description_longue text,
    recherche_tsv tsvector GENERATED ALWAYS AS (((((setweight(to_tsvector('french'::regconfig, COALESCE(nom, ''::text)), 'A'::"char") || setweight(to_tsvector('french'::regconfig, COALESCE(dirigeant, ''::text)), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, COALESCE(description, ''::text)), 'C'::"char")) || setweight(to_tsvector('french'::regconfig, COALESCE(description_longue, ''::text)), 'C'::"char")) || setweight(to_tsvector('french'::regconfig, COALESCE(pouvoir_symbole, ''::text)), 'D'::"char"))) STORED
);


--
-- Name: TABLE religions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.religions IS 'Religions disponibles dans le monde de Destea.';


--
-- Name: reparations_forge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reparations_forge (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    categorie text NOT NULL,
    nom_affichage text NOT NULL,
    temps_minutes integer NOT NULL,
    temps_rare_minutes integer NOT NULL,
    materiaux text NOT NULL,
    materiaux_rares text NOT NULL,
    notes text,
    est_actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reparations_forge_categorie_check CHECK ((categorie = ANY (ARRAY['arme'::text, 'armure'::text, 'bouclier'::text])))
);


--
-- Name: sections_encyclopedie; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sections_encyclopedie (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cle text NOT NULL,
    label text NOT NULL,
    icon_nom text NOT NULL,
    url_key text NOT NULL,
    ordre integer DEFAULT 0 NOT NULL,
    est_actif boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: sections_regles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sections_regles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    categorie text NOT NULL,
    titre text NOT NULL,
    contenu text NOT NULL,
    ordre integer DEFAULT 0 NOT NULL,
    est_actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    recherche_tsv tsvector GENERATED ALWAYS AS (((setweight(to_tsvector('french'::regconfig, COALESCE(titre, ''::text)), 'A'::"char") || setweight(to_tsvector('french'::regconfig, COALESCE(categorie, ''::text)), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, COALESCE(contenu, ''::text)), 'C'::"char"))) STORED,
    CONSTRAINT sections_regles_categorie_check CHECK ((categorie = ANY (ARRAY['generaux'::text, 'objets_enjeu'::text, 'combat'::text, 'magie'::text, 'creation_sorts'::text, 'artisanat'::text])))
);


--
-- Name: sorts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sorts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    nom text NOT NULL,
    cercle text NOT NULL,
    niveau integer DEFAULT 1 NOT NULL,
    description text,
    type_sort text,
    zone_effet text,
    portee text,
    duree text,
    cout_xp_base numeric(4,2),
    est_actif boolean DEFAULT true NOT NULL,
    recherche_tsv tsvector GENERATED ALWAYS AS ((((setweight(to_tsvector('french'::regconfig, COALESCE(nom, ''::text)), 'A'::"char") || setweight(to_tsvector('french'::regconfig, COALESCE(cercle, ''::text)), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, COALESCE(type_sort, ''::text)), 'B'::"char")) || setweight(to_tsvector('french'::regconfig, COALESCE(description, ''::text)), 'C'::"char"))) STORED,
    CONSTRAINT sorts_duree_check CHECK ((duree = ANY (ARRAY['Instantanée'::text, '1 Minute'::text, '5 Minutes'::text, '10 Minutes'::text, '20 Minutes'::text, '30 Minutes'::text, '40 Minutes'::text, '50 Minutes'::text, '60 Minutes'::text]))),
    CONSTRAINT sorts_niveau_check CHECK (((niveau >= 1) AND (niveau <= 20))),
    CONSTRAINT sorts_portee_check CHECK ((portee = ANY (ARRAY['Toucher'::text, '5 Pieds'::text, '10 Pieds'::text, '25 Pieds'::text, '50 Pieds'::text, 'À vue'::text]))),
    CONSTRAINT sorts_type_sort_check CHECK ((type_sort = ANY (ARRAY['effet'::text, 'effet bénéfique'::text, 'dégâts'::text]))),
    CONSTRAINT sorts_zone_effet_check CHECK ((zone_effet = ANY (ARRAY['Personnelle'::text, '1 cible'::text, '1 cible (mort)'::text, '1 cible (objet)'::text, 'Nombre de cibles'::text, 'Nombre de cibles (objets)'::text, 'Nombre de cibles ou rayon 3 pieds'::text, 'Tous rayons'::text, 'Nombre de cibles ou tous rayons'::text])))
);


--
-- Name: TABLE sorts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.sorts IS 'Sorts de mage organises par cercles. Niveau 1-20.';


--
-- Name: traits_raciaux; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.traits_raciaux (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom text NOT NULL,
    description text NOT NULL,
    cout_xp integer DEFAULT 0 NOT NULL,
    est_actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE traits_raciaux; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.traits_raciaux IS 'Traits raciaux disponibles par race, le joueur en choisit un au depart.';


--
-- Name: vue_admin_joueurs; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_admin_joueurs AS
 SELECT pr.id AS joueur_id,
    pr.username,
    pr.email,
    pr.nom_affichage,
    pr.role,
    pr.is_active,
    pr.created_at AS compte_cree_le,
    count(p.id) FILTER (WHERE ((p.est_actif = true) AND (p.est_mort = false))) AS nb_personnages_actifs,
    count(p.id) FILTER (WHERE (p.est_mort = true)) AS nb_personnages_morts,
    count(p.id) FILTER (WHERE (p.est_actif = false)) AS nb_personnages_archives,
    count(p.id) AS nb_personnages_total,
    ( SELECT p2.nom
           FROM public.personnages p2
          WHERE ((p2.joueur_id = pr.id) AND (p2.est_actif = true) AND (p2.est_mort = false))
          ORDER BY p2.created_at DESC NULLS LAST
         LIMIT 1) AS personnage_actif_principal
   FROM (public.profiles pr
     LEFT JOIN public.personnages p ON ((p.joueur_id = pr.id)))
  GROUP BY pr.id, pr.username, pr.email, pr.nom_affichage, pr.role, pr.is_active, pr.created_at
  ORDER BY pr.nom_affichage;


--
-- Name: vue_personnage_etat; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_personnage_etat WITH (security_invoker='true') AS
 SELECT p.id AS personnage_id,
    p.joueur_id,
    (COALESCE(p.xp_total, 0) - COALESCE(p.xp_depense, 0)) AS xp_disponible,
    p.niveau,
    COALESCE(max(
        CASE
            WHEN (c.nom = 'Alchimie'::text) THEN pc.niveau_acquis
            ELSE NULL::integer
        END), 0) AS niveau_alchimie,
    COALESCE(max(
        CASE
            WHEN (c.nom = 'Forge'::text) THEN pc.niveau_acquis
            ELSE NULL::integer
        END), 0) AS niveau_forge,
    COALESCE(max(
        CASE
            WHEN (c.nom = 'Joaillerie'::text) THEN pc.niveau_acquis
            ELSE NULL::integer
        END), 0) AS niveau_joaillerie,
    COALESCE(max(
        CASE
            WHEN (c.nom = 'Assemblage de Runes'::text) THEN pc.niveau_acquis
            ELSE NULL::integer
        END), 0) AS niveau_runes,
    COALESCE(max(
        CASE
            WHEN (c.nom = 'Acquisition de Cercle'::text) THEN pc.niveau_acquis
            ELSE NULL::integer
        END), 0) AS niveau_cercle,
    COALESCE(max(
        CASE
            WHEN (c.nom = 'Acquisition de Domaine'::text) THEN pc.niveau_acquis
            ELSE NULL::integer
        END), 0) AS niveau_domaine,
    COALESCE(bool_or(((c.nom = 'Connaissances des Religions'::text) AND (pc.niveau_acquis >= 1))), false) AS a_connaissance_religions,
    COALESCE(bool_or(((c.nom = 'Premiers Soins'::text) AND (pc.niveau_acquis >= 1))), false) AS a_premiers_soins,
    COALESCE(bool_or(((c.nom = 'Connaissance des Créatures'::text) AND (pc.niveau_acquis >= 1))), false) AS a_connaissance_creatures_1,
    COALESCE(bool_or(((c.nom = 'Connaissance des Créatures'::text) AND (pc.niveau_acquis >= 2))), false) AS a_connaissance_creatures_2
   FROM ((public.personnages p
     LEFT JOIN public.personnage_competences pc ON ((pc.personnage_id = p.id)))
     LEFT JOIN public.competences c ON ((c.id = pc.competence_id)))
  GROUP BY p.id, p.joueur_id, p.xp_total, p.xp_depense, p.niveau;


--
-- Name: vue_artisanat_etat; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_artisanat_etat WITH (security_invoker='true') AS
 SELECT vpe.personnage_id,
    vpe.niveau_alchimie,
    vpe.niveau_forge,
    vpe.niveau_joaillerie,
    vpe.niveau_runes,
    p.a_forge_legendaire,
    p.a_joaillerie_legendaire
   FROM (public.vue_personnage_etat vpe
     JOIN public.personnages p ON ((p.id = vpe.personnage_id)));


--
-- Name: vue_artisanat_quotas; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_artisanat_quotas WITH (security_invoker='true') AS
 SELECT personnage_id,
    niveau_alchimie,
    niveau_forge,
    niveau_joaillerie,
    niveau_runes,
    a_forge_legendaire,
    a_joaillerie_legendaire,
        CASE
            WHEN (niveau_alchimie >= 3) THEN 12
            WHEN (niveau_alchimie >= 2) THEN 9
            WHEN (niveau_alchimie >= 1) THEN 5
            ELSE 0
        END AS quota_recettes_total,
        CASE
            WHEN (niveau_runes >= 3) THEN 5
            WHEN (niveau_runes >= 2) THEN 4
            WHEN (niveau_runes >= 1) THEN 2
            ELSE 0
        END AS quota_assemblages_total,
        CASE
            WHEN (niveau_alchimie >= 1) THEN 5
            ELSE 0
        END AS quota_alchimie_mineure_total,
        CASE
            WHEN (niveau_alchimie >= 2) THEN 4
            ELSE 0
        END AS quota_alchimie_intermediaire_total,
        CASE
            WHEN (niveau_alchimie >= 3) THEN 3
            ELSE 0
        END AS quota_alchimie_majeure_total,
    COALESCE(( SELECT (count(*))::integer AS count
           FROM (public.personnage_recettes pr
             JOIN public.recettes_alchimie ra ON ((ra.id = pr.recette_id)))
          WHERE ((pr.personnage_id = e.personnage_id) AND (pr.est_gratuit = true) AND (ra.niveau_requis = 1))), 0) AS quota_alchimie_mineure_utilises,
    COALESCE(( SELECT (count(*))::integer AS count
           FROM (public.personnage_recettes pr
             JOIN public.recettes_alchimie ra ON ((ra.id = pr.recette_id)))
          WHERE ((pr.personnage_id = e.personnage_id) AND (pr.est_gratuit = true) AND (ra.niveau_requis = 2))), 0) AS quota_alchimie_intermediaire_utilises,
    COALESCE(( SELECT (count(*))::integer AS count
           FROM (public.personnage_recettes pr
             JOIN public.recettes_alchimie ra ON ((ra.id = pr.recette_id)))
          WHERE ((pr.personnage_id = e.personnage_id) AND (pr.est_gratuit = true) AND (ra.niveau_requis = 3))), 0) AS quota_alchimie_majeure_utilises,
    COALESCE(( SELECT (count(*))::integer AS count
           FROM public.personnage_assemblages pa
          WHERE ((pa.personnage_id = e.personnage_id) AND (pa.est_gratuit = true))), 0) AS quota_assemblages_utilises
   FROM public.vue_artisanat_etat e;


--
-- Name: vue_assemblages_personnage; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_assemblages_personnage WITH (security_invoker='true') AS
 SELECT pa.id,
    pa.personnage_id,
    pa.xp_depense,
    ar.nom,
    ar.cible,
    ar.cout_ps,
    ar.description,
    ar.effet,
    ar.runes_requises
   FROM (public.personnage_assemblages pa
     JOIN public.assemblages_runes ar ON ((ar.id = pa.assemblage_id)));


--
-- Name: vue_cercles_disponibles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_cercles_disponibles WITH (security_invoker='true') AS
 SELECT pc.personnage_id,
    pc.choix_achat AS cercle,
        CASE max(pc.niveau_acquis)
            WHEN 1 THEN 5
            WHEN 2 THEN 10
            WHEN 3 THEN 20
            ELSE NULL::integer
        END AS niveau_max_sorts
   FROM (public.personnage_competences pc
     JOIN public.competences c ON ((pc.competence_id = c.id)))
  WHERE ((c.nom = 'Acquisition de Cercle'::text) AND (pc.choix_achat IS NOT NULL))
  GROUP BY pc.personnage_id, pc.choix_achat;


--
-- Name: vue_competences_maitre_admin; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_competences_maitre_admin WITH (security_invoker='true') AS
 SELECT pc.id,
    COALESCE(p.nom, 'Personnage inconnu'::text) AS personnage_nom,
    COALESCE(pr.nom_affichage, pr.email, 'Joueur inconnu'::text) AS joueur_nom,
    COALESCE(c.nom, 'Compétence inconnue'::text) AS competence_nom,
    pc.niveau_acquis,
    COALESCE(pc.nom_maitre, ''::text) AS nom_maitre,
    COALESCE(pc.statut_maitre, 'non_requis'::text) AS statut_maitre,
    pc.date_acquisition AS date_demande
   FROM (((public.personnage_competences pc
     JOIN public.personnages p ON ((p.id = pc.personnage_id)))
     LEFT JOIN public.profiles pr ON ((pr.id = p.joueur_id)))
     LEFT JOIN public.competences c ON ((c.id = pc.competence_id)))
  WHERE (public.est_animateur_ou_admin() AND (pc.appris_via_maitre = true));


--
-- Name: vue_competences_maitre_attente; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_competences_maitre_attente WITH (security_invoker='true') AS
 SELECT pc.id,
    pc.niveau_acquis,
    pc.nom_maitre,
    pc.statut_maitre,
    pc.xp_depense,
    pc.personnage_id,
    c.nom AS competence_nom,
    c.description AS competence_description,
    p.nom AS personnage_nom,
    p.niveau AS personnage_niveau,
    pr.nom_affichage AS joueur_nom,
    pr.id AS joueur_id
   FROM (((public.personnage_competences pc
     JOIN public.competences c ON ((pc.competence_id = c.id)))
     JOIN public.personnages p ON ((pc.personnage_id = p.id)))
     JOIN public.profiles pr ON ((p.joueur_id = pr.id)))
  WHERE (pc.appris_via_maitre = true)
  ORDER BY pc.statut_maitre, pr.nom_affichage;


--
-- Name: vue_competences_personnage; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_competences_personnage WITH (security_invoker='true') AS
 SELECT pc.id,
    pc.personnage_id,
    pc.niveau_acquis,
    pc.xp_depense,
    pc.choix_achat,
    pc.appris_via_maitre,
    pc.nom_maitre,
    COALESCE(pc.statut_maitre, 'non_requis'::text) AS statut_maitre,
    comp.nom,
    comp.categorie,
    comp.description AS competence_description
   FROM (public.personnage_competences pc
     JOIN public.competences comp ON ((comp.id = pc.competence_id)));


--
-- Name: vue_demandes_races_attente; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_demandes_races_attente AS
 SELECT prd.id,
    prd.personnage_id,
    p.nom AS personnage_nom,
    p.niveau AS personnage_niveau,
    p.joueur_id,
    prof.nom_affichage AS joueur_nom,
    prof.email AS joueur_email,
    r.id AS race_id,
    r.nom AS race_nom,
    r.nom_latin AS race_nom_latin,
    prd.background,
    prd.created_at AS date_demande
   FROM (((public.personnage_races_demandes prd
     JOIN public.personnages p ON ((p.id = prd.personnage_id)))
     JOIN public.profiles prof ON ((prof.id = p.joueur_id)))
     JOIN public.races r ON ((r.id = prd.race_id)))
  WHERE (prd.statut = 'en_attente'::text)
  ORDER BY prd.created_at;


--
-- Name: vue_demandes_races_complet; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_demandes_races_complet AS
 SELECT prd.id,
    prd.personnage_id,
    p.nom AS personnage_nom,
    p.niveau AS personnage_niveau,
    p.joueur_id,
    prof.nom_affichage AS joueur_nom,
    prof.email AS joueur_email,
    r.id AS race_id,
    r.nom AS race_nom,
    r.nom_latin AS race_nom_latin,
    prd.background,
    prd.statut,
    prd.raison_refus,
    prd.approuve_par,
    approuveur.nom_affichage AS approuve_par_nom,
    prd.created_at AS date_demande,
    prd.date_approbation
   FROM ((((public.personnage_races_demandes prd
     JOIN public.personnages p ON ((p.id = prd.personnage_id)))
     JOIN public.profiles prof ON ((prof.id = p.joueur_id)))
     JOIN public.races r ON ((r.id = prd.race_id)))
     LEFT JOIN public.profiles approuveur ON ((approuveur.id = prd.approuve_par)))
  ORDER BY prd.created_at DESC;


--
-- Name: vue_domaines_disponibles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_domaines_disponibles WITH (security_invoker='true') AS
 SELECT pc.personnage_id,
    pc.choix_achat AS domaine,
        CASE max(pc.niveau_acquis)
            WHEN 1 THEN 5
            WHEN 2 THEN 10
            WHEN 3 THEN 20
            ELSE NULL::integer
        END AS niveau_max_prieres
   FROM (public.personnage_competences pc
     JOIN public.competences c ON ((pc.competence_id = c.id)))
  WHERE ((c.nom = 'Acquisition de Domaine'::text) AND (pc.choix_achat IS NOT NULL))
  GROUP BY pc.personnage_id, pc.choix_achat;


--
-- Name: vue_evenements_admin; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_evenements_admin WITH (security_invoker='true') AS
 SELECT e.id,
    e.titre,
    e.description,
    e.date_evenement AS date_debut,
    e.date_fin,
    e.lieu,
    (count(i.id))::integer AS nb_participants,
    COALESCE(e.est_publie, false) AS est_publie
   FROM (public.evenements e
     LEFT JOIN public.inscriptions_evenements i ON ((i.evenement_id = e.id)))
  WHERE public.est_animateur_ou_admin()
  GROUP BY e.id, e.titre, e.description, e.date_evenement, e.date_fin, e.lieu, e.est_publie;


--
-- Name: vue_evenements_publies; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_evenements_publies WITH (security_invoker='true') AS
 SELECT id,
    titre,
    date_evenement,
    date_fin,
    lieu,
    type_evenement,
    xp_recompense,
    max_participants,
    description,
    COALESCE(( SELECT (count(*))::integer AS count
           FROM public.inscriptions_evenements ie
          WHERE ((ie.evenement_id = e.id) AND (ie.statut = ANY (ARRAY['en_attente'::text, 'present'::text])))), 0) AS nb_inscrits
   FROM public.evenements e
  WHERE (est_publie = true)
  ORDER BY date_evenement;


--
-- Name: vue_fiche_personnage; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_fiche_personnage WITH (security_invoker='true') AS
 SELECT p.id,
    p.nom,
    p.niveau,
    p.xp_total,
    p.xp_depense,
    p.pv_max,
    p.ps_max,
    p.historique,
    p.ame_personnage,
    p.joueur_id,
    p.race_id,
    p.classe_id,
    p.religion_id,
    p.gn_completes,
    p.mini_gn_completes,
    p.ouvertures_terrain,
    p.traits_raciaux_choisis,
    p.est_actif,
    p.est_mort,
    r.nom AS race_nom,
    r.nom_latin AS race_nom_latin,
    c.nom AS classe_nom,
    rel.nom AS religion_nom
   FROM (((public.personnages p
     LEFT JOIN public.races r ON ((r.id = p.race_id)))
     LEFT JOIN public.classes c ON ((c.id = p.classe_id)))
     LEFT JOIN public.religions rel ON ((rel.id = p.religion_id)));


--
-- Name: vue_inscriptions_par_evenement; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_inscriptions_par_evenement WITH (security_invoker='true') AS
 SELECT i.id AS inscription_id,
    i.evenement_id,
    i.statut,
    i.xp_attribue,
    i.date_inscription,
    i.date_confirmation,
    e.titre AS evenement_titre,
    e.date_evenement,
    e.type_evenement,
    p.id AS personnage_id,
    p.nom AS personnage_nom,
    p.niveau AS personnage_niveau,
    p.pv_max,
    p.ps_max,
    p.est_mort,
    p.est_actif,
    p.est_verrouille,
    r.nom AS race_nom,
    c.nom AS classe_nom,
    pr.id AS joueur_id,
    pr.nom_affichage AS joueur_nom,
    pr.email AS joueur_email,
    pr.username AS joueur_username
   FROM (((((public.inscriptions_evenements i
     JOIN public.evenements e ON ((e.id = i.evenement_id)))
     JOIN public.personnages p ON ((p.id = i.personnage_id)))
     JOIN public.profiles pr ON ((pr.id = i.joueur_id)))
     LEFT JOIN public.races r ON ((r.id = p.race_id)))
     LEFT JOIN public.classes c ON ((c.id = p.classe_id)))
  ORDER BY e.date_evenement DESC, pr.nom_affichage;


--
-- Name: VIEW vue_inscriptions_par_evenement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.vue_inscriptions_par_evenement IS 'Liste complète des inscriptions avec infos personnage et joueur. Utile pour le panel admin : affichage de qui vient à chaque événement.';


--
-- Name: vue_inscriptions_resumees; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_inscriptions_resumees WITH (security_invoker='true') AS
 SELECT i.id,
    i.joueur_id,
    i.personnage_id,
    i.evenement_id,
    i.statut,
    i.xp_attribue,
    i.date_inscription,
    e.titre AS evenement_titre,
    e.date_evenement,
    e.date_fin,
    e.lieu,
    e.type_evenement,
    e.xp_recompense,
    e.max_participants,
    p.nom AS personnage_nom,
    pr.nom_affichage AS joueur_nom,
    ( SELECT count(*) AS count
           FROM public.inscriptions_evenements ie2
          WHERE ((ie2.evenement_id = i.evenement_id) AND (ie2.statut = 'present'::text))) AS nb_inscrits_confirmes
   FROM (((public.inscriptions_evenements i
     JOIN public.evenements e ON ((i.evenement_id = e.id)))
     JOIN public.personnages p ON ((i.personnage_id = p.id)))
     JOIN public.profiles pr ON ((i.joueur_id = pr.id)));


--
-- Name: vue_joueurs_complete; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_joueurs_complete WITH (security_invoker='true') AS
 SELECT pr.id AS joueur_id,
    pr.username,
    pr.email,
    pr.nom_affichage,
    pr.role,
    pr.is_active,
    pr.created_at AS compte_cree_le,
    count(p.id) FILTER (WHERE ((p.est_actif = true) AND (p.est_mort = false))) AS nb_personnages_actifs,
    count(p.id) FILTER (WHERE (p.est_mort = true)) AS nb_personnages_morts,
    count(p.id) FILTER (WHERE (p.est_actif = false)) AS nb_personnages_archives,
    count(p.id) AS nb_personnages_total,
    ( SELECT p2.nom
           FROM public.personnages p2
          WHERE ((p2.joueur_id = pr.id) AND (p2.est_actif = true) AND (p2.est_mort = false))
          ORDER BY p2.created_at DESC NULLS LAST
         LIMIT 1) AS personnage_actif_principal
   FROM (public.profiles pr
     LEFT JOIN public.personnages p ON ((p.joueur_id = pr.id)))
  WHERE (pr.role = 'joueur'::text)
  GROUP BY pr.id, pr.username, pr.email, pr.nom_affichage, pr.role, pr.is_active, pr.created_at
  ORDER BY pr.nom_affichage;


--
-- Name: VIEW vue_joueurs_complete; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.vue_joueurs_complete IS 'Liste complète des joueurs avec leurs compteurs de personnages (actifs, morts, archivés). Utile pour le panel admin.';


--
-- Name: vue_joueurs_maitres; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_joueurs_maitres WITH (security_invoker='true') AS
 SELECT DISTINCT pr.id AS joueur_id,
    pr.nom_affichage AS joueur_nom,
    p.id AS personnage_id,
    p.nom AS personnage_nom,
    r.nom AS race,
    c.nom AS classe,
    p.niveau,
    p.xp_total
   FROM ((((public.personnage_competences pc
     JOIN public.personnages p ON ((pc.personnage_id = p.id)))
     JOIN public.profiles pr ON ((p.joueur_id = pr.id)))
     JOIN public.races r ON ((p.race_id = r.id)))
     JOIN public.classes c ON ((p.classe_id = c.id)))
  WHERE ((pc.niveau_acquis = 3) AND (pc.statut_maitre = ANY (ARRAY['non_requis'::text, 'approuve'::text])) AND (p.est_actif = true) AND (p.est_mort = false))
  ORDER BY pr.nom_affichage;


--
-- Name: vue_prieres_personnage; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_prieres_personnage WITH (security_invoker='true') AS
 SELECT pp.id,
    pp.personnage_id,
    pp.nom_personnalise,
    pp.niveau_priere,
    pp.zone_choisie,
    pp.portee_choisie,
    pp.duree_choisie,
    pr.domaine,
    pr.description AS priere_description,
    pr.duree_incantation,
    pr.cout_xp_base
   FROM (public.personnage_prieres pp
     JOIN public.prieres pr ON ((pr.id = pp.priere_id)));


--
-- Name: vue_recettes_personnage; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_recettes_personnage WITH (security_invoker='true') AS
 SELECT pr.id,
    pr.personnage_id,
    pr.xp_depense,
    ra.nom,
    ra.type,
    ra.niveau_requis,
    ra.description,
    ra.effet
   FROM (public.personnage_recettes pr
     JOIN public.recettes_alchimie ra ON ((ra.id = pr.recette_id)));


--
-- Name: vue_sorts_personnage; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_sorts_personnage WITH (security_invoker='true') AS
 SELECT ps.id,
    ps.personnage_id,
    ps.nom_personnalise,
    ps.formule_magique,
    ps.niveau_sort,
    ps.zone_choisie,
    ps.portee_choisie,
    ps.duree_choisie,
    s.cercle,
    s.cout_xp_base,
    s.nom AS sort_nom_base,
    s.description AS sort_description
   FROM (public.personnage_sorts ps
     JOIN public.sorts s ON ((s.id = ps.sort_id)));


--
-- Name: vue_personnage_creation_complet; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_personnage_creation_complet WITH (security_invoker='true') AS
 SELECT p.id,
    p.joueur_id,
    p.nom,
    p.niveau,
    p.etape_creation,
    p.est_verrouille,
    p.est_actif,
    p.est_mort,
    COALESCE(((p.est_verrouille = true) AND ((r.est_jouable = true) OR ((r.est_jouable = false) AND (demande_active.statut = 'approuvee'::text)))), false) AS peut_sinscrire_evenement,
    p.xp_total,
    p.xp_depense,
    (COALESCE(p.xp_total, 0) - COALESCE(p.xp_depense, 0)) AS xp_disponible,
    p.race_id,
    r.nom AS race_nom,
    r.nom_latin AS race_nom_latin,
    r.xp_depart AS race_xp_depart,
    r.est_jouable AS race_est_jouable,
    p.sous_type_chimeride,
    demande_active.statut AS demande_race_statut,
    demande_active.background AS demande_race_background,
    p.classe_id,
    c1.nom AS classe_nom,
    c1.pv_depart AS classe_pv_depart,
    c1.ps_depart AS classe_ps_depart,
    p.classe_secondaire_id,
    c2.nom AS classe_secondaire_nom,
    p.est_croyant,
    p.religion_id,
    rel.nom AS religion_nom,
    p.pv_max,
    p.ps_max,
    p.a_forge_legendaire,
    p.a_joaillerie_legendaire,
    p.historique,
    p.ame_personnage,
    p.gn_completes,
    p.mini_gn_completes,
    p.ouvertures_terrain,
    p.created_at,
    p.updated_at,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('trait_id', ((elem.value ->> 'trait_id'::text))::uuid, 'est_gratuit', ((elem.value ->> 'est_gratuit'::text))::boolean, 'xp_depense', COALESCE(((elem.value ->> 'xp_depense'::text))::integer, 0), 'trait_nom', tr.nom, 'trait_description', tr.description, 'cout_xp', tr.cout_xp)) AS jsonb_agg
           FROM (jsonb_array_elements(COALESCE(p.traits_raciaux_choisis, '[]'::jsonb)) elem(value)
             LEFT JOIN public.traits_raciaux tr ON ((tr.id = ((elem.value ->> 'trait_id'::text))::uuid)))), '[]'::jsonb) AS traits_raciaux,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', vcp.id, 'niveau_acquis', vcp.niveau_acquis, 'xp_depense', vcp.xp_depense, 'choix_achat', vcp.choix_achat, 'appris_via_maitre', vcp.appris_via_maitre, 'nom_maitre', vcp.nom_maitre, 'statut_maitre', vcp.statut_maitre, 'nom', vcp.nom, 'categorie', vcp.categorie, 'competence_description', vcp.competence_description)) AS jsonb_agg
           FROM public.vue_competences_personnage vcp
          WHERE (vcp.personnage_id = p.id)), '[]'::jsonb) AS competences,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', vsp.id, 'nom_personnalise', vsp.nom_personnalise, 'formule_magique', vsp.formule_magique, 'niveau_sort', vsp.niveau_sort, 'zone_choisie', vsp.zone_choisie, 'portee_choisie', vsp.portee_choisie, 'duree_choisie', vsp.duree_choisie, 'cercle', vsp.cercle, 'cout_xp_base', vsp.cout_xp_base, 'sort_nom_base', vsp.sort_nom_base, 'sort_description', vsp.sort_description)) AS jsonb_agg
           FROM public.vue_sorts_personnage vsp
          WHERE (vsp.personnage_id = p.id)), '[]'::jsonb) AS sorts,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', vpp.id, 'nom_personnalise', vpp.nom_personnalise, 'niveau_priere', vpp.niveau_priere, 'zone_choisie', vpp.zone_choisie, 'portee_choisie', vpp.portee_choisie, 'duree_choisie', vpp.duree_choisie, 'domaine', vpp.domaine, 'priere_description', vpp.priere_description, 'duree_incantation', vpp.duree_incantation, 'cout_xp_base', vpp.cout_xp_base)) AS jsonb_agg
           FROM public.vue_prieres_personnage vpp
          WHERE (vpp.personnage_id = p.id)), '[]'::jsonb) AS prieres,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', vrp.id, 'xp_depense', vrp.xp_depense, 'nom', vrp.nom, 'type', vrp.type, 'niveau_requis', vrp.niveau_requis, 'description', vrp.description, 'effet', vrp.effet)) AS jsonb_agg
           FROM public.vue_recettes_personnage vrp
          WHERE (vrp.personnage_id = p.id)), '[]'::jsonb) AS recettes,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', vap.id, 'xp_depense', vap.xp_depense, 'nom', vap.nom, 'cible', vap.cible, 'cout_ps', vap.cout_ps, 'description', vap.description, 'effet', vap.effet, 'runes_requises', vap.runes_requises)) AS jsonb_agg
           FROM public.vue_assemblages_personnage vap
          WHERE (vap.personnage_id = p.id)), '[]'::jsonb) AS assemblages,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', pof.id, 'xp_depense', pof.xp_depense, 'nom', oforge.nom, 'description', oforge.description, 'type', oforge.type, 'stats', oforge.stats, 'difficulte', oforge.difficulte)) AS jsonb_agg
           FROM (public.personnage_objets_forge pof
             JOIN public.objets_forge oforge ON ((oforge.id = pof.objet_id)))
          WHERE (pof.personnage_id = p.id)), '[]'::jsonb) AS objets_forge,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', poj.id, 'xp_depense', poj.xp_depense, 'nom', ojoa.nom, 'description', ojoa.description, 'effet', ojoa.effet, 'difficulte', ojoa.difficulte)) AS jsonb_agg
           FROM (public.personnage_objets_joaillerie poj
             JOIN public.objets_joaillerie ojoa ON ((ojoa.id = poj.objet_id)))
          WHERE (poj.personnage_id = p.id)), '[]'::jsonb) AS objets_joaillerie,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('cercle', vcd.cercle, 'niveau_max_sorts', vcd.niveau_max_sorts)) AS jsonb_agg
           FROM public.vue_cercles_disponibles vcd
          WHERE (vcd.personnage_id = p.id)), '[]'::jsonb) AS cercles_acquis,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('domaine', vdd.domaine, 'niveau_max_prieres', vdd.niveau_max_prieres)) AS jsonb_agg
           FROM public.vue_domaines_disponibles vdd
          WHERE (vdd.personnage_id = p.id)), '[]'::jsonb) AS domaines_acquis,
    ( SELECT (to_jsonb(vaq.*) - 'personnage_id'::text)
           FROM public.vue_artisanat_quotas vaq
          WHERE (vaq.personnage_id = p.id)) AS quotas_artisanat
   FROM (((((public.personnages p
     LEFT JOIN public.races r ON ((r.id = p.race_id)))
     LEFT JOIN public.classes c1 ON ((c1.id = p.classe_id)))
     LEFT JOIN public.classes c2 ON ((c2.id = p.classe_secondaire_id)))
     LEFT JOIN public.religions rel ON ((rel.id = p.religion_id)))
     LEFT JOIN LATERAL ( SELECT prd.statut,
            prd.background
           FROM public.personnage_races_demandes prd
          WHERE (prd.personnage_id = p.id)
          ORDER BY prd.created_at DESC NULLS LAST
         LIMIT 1) demande_active ON (true));


--
-- Name: VIEW vue_personnage_creation_complet; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.vue_personnage_creation_complet IS 'Vue d''agrégation complète d''un personnage pour le récap de création (étape 11) et la fiche personnage finalisée. Hybride : scalaires plats + JSONB hydratés alignés sur les vues data-first existantes. security_invoker = true (respecte RLS personnages).';


--
-- Name: COLUMN vue_personnage_creation_complet.peut_sinscrire_evenement; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vue_personnage_creation_complet.peut_sinscrire_evenement IS 'true si le personnage est verrouillé ET (race jouable OU race spéciale dont la dernière demande est approuvée).';


--
-- Name: COLUMN vue_personnage_creation_complet.xp_disponible; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vue_personnage_creation_complet.xp_disponible IS 'xp_total - xp_depense. Maintenu cohérent par le trigger de synchro XP.';


--
-- Name: COLUMN vue_personnage_creation_complet.race_est_jouable; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vue_personnage_creation_complet.race_est_jouable IS 'false = race spéciale nécessitant approbation MJ (Fée, Haut-Elfe, Orc).';


--
-- Name: COLUMN vue_personnage_creation_complet.demande_race_statut; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vue_personnage_creation_complet.demande_race_statut IS 'Statut de la dernière demande de race spéciale (en_attente / approuvee / refusee). NULL si aucune demande.';


--
-- Name: COLUMN vue_personnage_creation_complet.traits_raciaux; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vue_personnage_creation_complet.traits_raciaux IS 'Tableau JSONB hydraté : [{trait_id, est_gratuit, xp_depense, trait_nom, trait_description, cout_xp}]. Source : personnages.traits_raciaux_choisis enrichi via JOIN sur traits_raciaux.';


--
-- Name: COLUMN vue_personnage_creation_complet.competences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vue_personnage_creation_complet.competences IS 'Tableau JSONB issu de vue_competences_personnage (compétences hydratées avec nom, catégorie, description, choix_achat, etc.).';


--
-- Name: COLUMN vue_personnage_creation_complet.sorts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vue_personnage_creation_complet.sorts IS 'Tableau JSONB issu de vue_sorts_personnage. Inclut nom_personnalise, formule_magique, cercle, niveau_sort, zone/portee/duree choisies.';


--
-- Name: COLUMN vue_personnage_creation_complet.prieres; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vue_personnage_creation_complet.prieres IS 'Tableau JSONB issu de vue_prieres_personnage. Symétrique de sorts pour le système religieux.';


--
-- Name: COLUMN vue_personnage_creation_complet.objets_forge; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vue_personnage_creation_complet.objets_forge IS 'Tableau JSONB hydraté via personnage_objets_forge JOIN objets_forge (pas de vue intermédiaire à ce jour).';


--
-- Name: COLUMN vue_personnage_creation_complet.objets_joaillerie; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vue_personnage_creation_complet.objets_joaillerie IS 'Tableau JSONB hydraté via personnage_objets_joaillerie JOIN objets_joaillerie (pas de vue intermédiaire à ce jour).';


--
-- Name: COLUMN vue_personnage_creation_complet.cercles_acquis; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vue_personnage_creation_complet.cercles_acquis IS 'Tableau JSONB issu de vue_cercles_disponibles : [{cercle, niveau_max_sorts}].';


--
-- Name: COLUMN vue_personnage_creation_complet.domaines_acquis; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vue_personnage_creation_complet.domaines_acquis IS 'Tableau JSONB issu de vue_domaines_disponibles : [{domaine, niveau_max_prieres}].';


--
-- Name: COLUMN vue_personnage_creation_complet.quotas_artisanat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vue_personnage_creation_complet.quotas_artisanat IS 'Objet JSONB issu de vue_artisanat_quotas (sans personnage_id) : niveaux d''artisanat + quotas totaux + utilisations courantes pour alchimie/forge/joaillerie/runes.';


--
-- Name: vue_personnages_admin; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_personnages_admin WITH (security_invoker='true') AS
 SELECT p.id,
    p.nom,
    COALESCE(pr.nom_affichage, pr.email, 'Joueur inconnu'::text) AS joueur_nom,
    COALESCE(r.nom, 'Race inconnue'::text) AS race_nom,
    COALESCE(c.nom, 'Classe inconnue'::text) AS classe_nom,
    COALESCE(p.niveau, 1) AS niveau,
    p.est_actif,
    p.etape_creation,
    p.created_at
   FROM (((public.personnages p
     LEFT JOIN public.profiles pr ON ((pr.id = p.joueur_id)))
     LEFT JOIN public.races r ON ((r.id = p.race_id)))
     LEFT JOIN public.classes c ON ((c.id = p.classe_id)))
  WHERE public.est_animateur_ou_admin();


--
-- Name: vue_personnages_joueur; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_personnages_joueur WITH (security_invoker='true') AS
 SELECT p.id,
    p.joueur_id,
    p.nom,
    p.niveau,
    p.xp_total,
    p.xp_depense,
    p.etape_creation,
    p.est_actif,
    p.created_at,
    COALESCE(r.nom, 'Race inconnue'::text) AS race_nom,
    COALESCE(c.nom, 'Classe inconnue'::text) AS classe_nom
   FROM ((public.personnages p
     LEFT JOIN public.races r ON ((r.id = p.race_id)))
     LEFT JOIN public.classes c ON ((c.id = p.classe_id)))
  WHERE (p.est_actif = true);


--
-- Name: vue_prochain_evenement; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_prochain_evenement AS
SELECT
    NULL::uuid AS id,
    NULL::text AS titre,
    NULL::text AS description,
    NULL::timestamp without time zone AS date_evenement,
    NULL::timestamp with time zone AS date_fin,
    NULL::text AS lieu,
    NULL::integer AS xp_recompense,
    NULL::integer AS max_participants,
    NULL::text AS type_evenement,
    NULL::boolean AS est_publie,
    NULL::uuid AS created_by,
    NULL::bigint AS nb_inscrits,
    NULL::bigint AS places_restantes;


--
-- Name: vue_stats_admin; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_stats_admin WITH (security_invoker='true') AS
 SELECT ( SELECT count(*) AS count
           FROM public.profiles
          WHERE (profiles.role = 'joueur'::text)) AS nb_joueurs,
    ( SELECT count(*) AS count
           FROM public.personnages
          WHERE ((personnages.est_actif = true) AND (personnages.est_mort = false))) AS nb_personnages_actifs,
    ( SELECT count(*) AS count
           FROM public.inscriptions_evenements
          WHERE (inscriptions_evenements.statut = 'en_attente'::text)) AS nb_presences_attente,
    ( SELECT count(*) AS count
           FROM public.personnage_competences
          WHERE (personnage_competences.statut_maitre = 'en_attente'::text)) AS nb_competences_attente,
    ( SELECT evenements.titre
           FROM public.evenements
          WHERE ((evenements.est_publie = true) AND (evenements.date_evenement > now()))
          ORDER BY evenements.date_evenement
         LIMIT 1) AS prochain_evenement_titre,
    ( SELECT evenements.date_evenement
           FROM public.evenements
          WHERE ((evenements.est_publie = true) AND (evenements.date_evenement > now()))
          ORDER BY evenements.date_evenement
         LIMIT 1) AS prochain_evenement_date
   FROM ( SELECT 1 AS "?column?"
          WHERE public.est_animateur_ou_admin()) garde;


--
-- Name: vue_tableau_de_bord; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_tableau_de_bord AS
 SELECT p.id,
    p.joueur_id,
    p.nom,
    p.niveau,
    p.xp_total,
    p.xp_depense,
    p.est_mort,
    p.est_actif,
    p.date_creation,
    r.nom AS race_nom,
    c1.nom AS classe_nom,
    c2.nom AS classe_secondaire_nom,
    pr.email AS joueur_email
   FROM ((((public.personnages p
     LEFT JOIN public.races r ON ((p.race_id = r.id)))
     LEFT JOIN public.classes c1 ON ((p.classe_id = c1.id)))
     LEFT JOIN public.classes c2 ON ((p.classe_secondaire_id = c2.id)))
     LEFT JOIN public.profiles pr ON ((p.joueur_id = pr.id)));


--
-- Name: vue_traits_par_race; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_traits_par_race WITH (security_invoker='true') AS
 SELECT rt.id AS race_trait_id,
    rt.race_id,
    rt.trait_id,
    rt.sous_type,
    r.nom AS race_nom,
    tr.nom AS trait_nom,
    tr.description AS trait_description,
    tr.cout_xp,
    tr.est_actif
   FROM ((public.race_traits rt
     JOIN public.races r ON ((r.id = rt.race_id)))
     JOIN public.traits_raciaux tr ON ((tr.id = rt.trait_id)))
  WHERE (tr.est_actif = true)
  ORDER BY r.nom, rt.sous_type, tr.nom;


--
-- Name: vue_verrou_competences; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_verrou_competences WITH (security_invoker='true') AS
 SELECT p.id AS personnage_id,
    COALESCE(bool_or((c.nom = 'Assemblage de Runes'::text)), false) AS runes_verrouillees,
    COALESCE(bool_or((c.nom = 'Développement Spirituel'::text)), false) AS dev_spirituel_verrouille,
    COALESCE(bool_or((c.nom = 'Développement Spirituel Supérieur'::text)), false) AS dev_spirituel_sup_verrouille,
    COALESCE(bool_or((c.nom = 'Canalisation'::text)), false) AS canalisation_verrouillee
   FROM ((public.personnages p
     LEFT JOIN public.personnage_competences pc ON ((pc.personnage_id = p.id)))
     LEFT JOIN public.competences c ON (((c.id = pc.competence_id) AND (c.verrouillage_croise = true))))
  GROUP BY p.id;


--
-- Name: vue_xp_personnage; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vue_xp_personnage WITH (security_invoker='true') AS
 SELECT p.id,
    p.nom,
    p.joueur_id,
    p.xp_total,
    p.xp_depense,
    (p.xp_total - p.xp_depense) AS xp_disponible,
    p.niveau,
    p.pv_max,
    p.ps_max,
    p.est_actif,
    p.est_mort,
    p.est_verrouille,
    p.etape_creation,
    p.gn_completes,
    p.mini_gn_completes,
    p.ouvertures_terrain,
    r.nom AS race_nom,
    r.nom_latin AS race_latin,
    c.nom AS classe_nom,
    c.pv_depart,
    c.ps_depart,
    rel.nom AS religion_nom,
    fc.nom AS famille_nom,
    pr.nom_affichage AS joueur_nom
   FROM (((((public.personnages p
     LEFT JOIN public.races r ON ((p.race_id = r.id)))
     LEFT JOIN public.classes c ON ((p.classe_id = c.id)))
     LEFT JOIN public.religions rel ON ((p.religion_id = rel.id)))
     LEFT JOIN public.familles_criminelles fc ON ((p.famille_criminelle_id = fc.id)))
     LEFT JOIN public.profiles pr ON ((p.joueur_id = pr.id)));


--
-- Name: assemblages_runes assemblages_runes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assemblages_runes
    ADD CONSTRAINT assemblages_runes_pkey PRIMARY KEY (id);


--
-- Name: bestiaire bestiaire_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bestiaire
    ADD CONSTRAINT bestiaire_pkey PRIMARY KEY (id);


--
-- Name: cartes_accueil cartes_accueil_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cartes_accueil
    ADD CONSTRAINT cartes_accueil_pkey PRIMARY KEY (id);


--
-- Name: categories_creatures categories_creatures_nom_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories_creatures
    ADD CONSTRAINT categories_creatures_nom_key UNIQUE (nom);


--
-- Name: categories_creatures categories_creatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories_creatures
    ADD CONSTRAINT categories_creatures_pkey PRIMARY KEY (id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: competences competences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competences
    ADD CONSTRAINT competences_pkey PRIMARY KEY (id);


--
-- Name: config_jeu config_jeu_cle_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_jeu
    ADD CONSTRAINT config_jeu_cle_key UNIQUE (cle);


--
-- Name: config_jeu config_jeu_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.config_jeu
    ADD CONSTRAINT config_jeu_pkey PRIMARY KEY (id);


--
-- Name: effets_combat effets_combat_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.effets_combat
    ADD CONSTRAINT effets_combat_pkey PRIMARY KEY (id);


--
-- Name: evenements evenements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evenements
    ADD CONSTRAINT evenements_pkey PRIMARY KEY (id);


--
-- Name: familles_criminelles familles_criminelles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.familles_criminelles
    ADD CONSTRAINT familles_criminelles_pkey PRIMARY KEY (id);


--
-- Name: historique_xp historique_xp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_xp
    ADD CONSTRAINT historique_xp_pkey PRIMARY KEY (id);


--
-- Name: ingredients_alchimiques ingredients_alchimiques_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients_alchimiques
    ADD CONSTRAINT ingredients_alchimiques_pkey PRIMARY KEY (id);


--
-- Name: inscriptions_evenements inscriptions_evenements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscriptions_evenements
    ADD CONSTRAINT inscriptions_evenements_pkey PRIMARY KEY (id);


--
-- Name: langues langues_nom_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.langues
    ADD CONSTRAINT langues_nom_key UNIQUE (nom);


--
-- Name: langues langues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.langues
    ADD CONSTRAINT langues_pkey PRIMARY KEY (id);


--
-- Name: lore lore_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lore
    ADD CONSTRAINT lore_pkey PRIMARY KEY (id);


--
-- Name: menu_navigation menu_navigation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_navigation
    ADD CONSTRAINT menu_navigation_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: objets_forge objets_forge_nom_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objets_forge
    ADD CONSTRAINT objets_forge_nom_unique UNIQUE (nom);


--
-- Name: objets_forge objets_forge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objets_forge
    ADD CONSTRAINT objets_forge_pkey PRIMARY KEY (id);


--
-- Name: objets_joaillerie objets_joaillerie_nom_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objets_joaillerie
    ADD CONSTRAINT objets_joaillerie_nom_unique UNIQUE (nom);


--
-- Name: objets_joaillerie objets_joaillerie_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objets_joaillerie
    ADD CONSTRAINT objets_joaillerie_pkey PRIMARY KEY (id);


--
-- Name: parametres_jeu parametres_jeu_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parametres_jeu
    ADD CONSTRAINT parametres_jeu_pkey PRIMARY KEY (id);


--
-- Name: personnage_assemblages personnage_assemblages_personnage_id_assemblage_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_assemblages
    ADD CONSTRAINT personnage_assemblages_personnage_id_assemblage_id_key UNIQUE (personnage_id, assemblage_id);


--
-- Name: personnage_assemblages personnage_assemblages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_assemblages
    ADD CONSTRAINT personnage_assemblages_pkey PRIMARY KEY (id);


--
-- Name: personnage_competences personnage_competences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_competences
    ADD CONSTRAINT personnage_competences_pkey PRIMARY KEY (id);


--
-- Name: personnage_objets_forge personnage_objets_forge_personnage_id_objet_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_objets_forge
    ADD CONSTRAINT personnage_objets_forge_personnage_id_objet_id_key UNIQUE (personnage_id, objet_id);


--
-- Name: personnage_objets_forge personnage_objets_forge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_objets_forge
    ADD CONSTRAINT personnage_objets_forge_pkey PRIMARY KEY (id);


--
-- Name: personnage_objets_joaillerie personnage_objets_joaillerie_personnage_id_objet_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_objets_joaillerie
    ADD CONSTRAINT personnage_objets_joaillerie_personnage_id_objet_id_key UNIQUE (personnage_id, objet_id);


--
-- Name: personnage_objets_joaillerie personnage_objets_joaillerie_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_objets_joaillerie
    ADD CONSTRAINT personnage_objets_joaillerie_pkey PRIMARY KEY (id);


--
-- Name: personnage_prieres personnage_prieres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_prieres
    ADD CONSTRAINT personnage_prieres_pkey PRIMARY KEY (id);


--
-- Name: personnage_races_demandes personnage_races_demandes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_races_demandes
    ADD CONSTRAINT personnage_races_demandes_pkey PRIMARY KEY (id);


--
-- Name: personnage_recettes personnage_recettes_personnage_id_recette_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_recettes
    ADD CONSTRAINT personnage_recettes_personnage_id_recette_id_key UNIQUE (personnage_id, recette_id);


--
-- Name: personnage_recettes personnage_recettes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_recettes
    ADD CONSTRAINT personnage_recettes_pkey PRIMARY KEY (id);


--
-- Name: personnage_sorts personnage_sorts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_sorts
    ADD CONSTRAINT personnage_sorts_pkey PRIMARY KEY (id);


--
-- Name: personnages personnages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnages
    ADD CONSTRAINT personnages_pkey PRIMARY KEY (id);


--
-- Name: pieges pièges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pieges
    ADD CONSTRAINT "pièges_pkey" PRIMARY KEY (id);


--
-- Name: prieres prieres_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prieres
    ADD CONSTRAINT prieres_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: race_traits race_traits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_traits
    ADD CONSTRAINT race_traits_pkey PRIMARY KEY (id);


--
-- Name: race_traits race_traits_race_id_trait_id_sous_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_traits
    ADD CONSTRAINT race_traits_race_id_trait_id_sous_type_key UNIQUE (race_id, trait_id, sous_type);


--
-- Name: races races_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.races
    ADD CONSTRAINT races_pkey PRIMARY KEY (id);


--
-- Name: recettes_alchimie recettes_alchimie_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recettes_alchimie
    ADD CONSTRAINT recettes_alchimie_pkey PRIMARY KEY (id);


--
-- Name: religions religions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.religions
    ADD CONSTRAINT religions_pkey PRIMARY KEY (id);


--
-- Name: reparations_forge reparations_forge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reparations_forge
    ADD CONSTRAINT reparations_forge_pkey PRIMARY KEY (id);


--
-- Name: sections_encyclopedie sections_encyclopedie_cle_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections_encyclopedie
    ADD CONSTRAINT sections_encyclopedie_cle_key UNIQUE (cle);


--
-- Name: sections_encyclopedie sections_encyclopedie_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections_encyclopedie
    ADD CONSTRAINT sections_encyclopedie_pkey PRIMARY KEY (id);


--
-- Name: sections_encyclopedie sections_encyclopedie_url_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections_encyclopedie
    ADD CONSTRAINT sections_encyclopedie_url_key_key UNIQUE (url_key);


--
-- Name: sections_regles sections_regles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections_regles
    ADD CONSTRAINT sections_regles_pkey PRIMARY KEY (id);


--
-- Name: sorts sorts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sorts
    ADD CONSTRAINT sorts_pkey PRIMARY KEY (id);


--
-- Name: traits_raciaux traits_raciaux_nom_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.traits_raciaux
    ADD CONSTRAINT traits_raciaux_nom_key UNIQUE (nom);


--
-- Name: traits_raciaux traits_raciaux_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.traits_raciaux
    ADD CONSTRAINT traits_raciaux_pkey PRIMARY KEY (id);


--
-- Name: personnage_races_demandes un_demande_par_personnage; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_races_demandes
    ADD CONSTRAINT un_demande_par_personnage UNIQUE (personnage_id);


--
-- Name: inscriptions_evenements unique_inscription_personnage; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscriptions_evenements
    ADD CONSTRAINT unique_inscription_personnage UNIQUE (evenement_id, personnage_id);


--
-- Name: bestiaire_recherche_tsv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bestiaire_recherche_tsv_idx ON public.bestiaire USING gin (recherche_tsv);


--
-- Name: competences_recherche_tsv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX competences_recherche_tsv_idx ON public.competences USING gin (recherche_tsv);


--
-- Name: idx_bestiaire_categorie; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bestiaire_categorie ON public.bestiaire USING btree (categorie);


--
-- Name: idx_competences_categorie; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competences_categorie ON public.competences USING btree (categorie);


--
-- Name: idx_competences_est_actif; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_competences_est_actif ON public.competences USING btree (est_actif);


--
-- Name: idx_evenements_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evenements_date ON public.evenements USING btree (date_evenement);


--
-- Name: idx_evenements_publie; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evenements_publie ON public.evenements USING btree (est_publie);


--
-- Name: idx_historique_xp_personnage_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_historique_xp_personnage_id_created_at ON public.historique_xp USING btree (personnage_id, created_at DESC);


--
-- Name: idx_historique_xp_type_mouvement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_historique_xp_type_mouvement ON public.historique_xp USING btree (type_mouvement);


--
-- Name: idx_ie_evenement_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ie_evenement_id ON public.inscriptions_evenements USING btree (evenement_id);


--
-- Name: idx_ie_joueur_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ie_joueur_id ON public.inscriptions_evenements USING btree (joueur_id);


--
-- Name: idx_ie_personnage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ie_personnage_id ON public.inscriptions_evenements USING btree (personnage_id);


--
-- Name: idx_ie_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ie_statut ON public.inscriptions_evenements USING btree (statut);


--
-- Name: idx_lore_categorie; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lore_categorie ON public.lore USING btree (categorie, ordre);


--
-- Name: idx_lore_recherche_tsv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lore_recherche_tsv ON public.lore USING gin (recherche_tsv);


--
-- Name: idx_notif_lu; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_lu ON public.notifications USING btree (lu);


--
-- Name: idx_notif_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_pa_personnage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pa_personnage_id ON public.personnage_assemblages USING btree (personnage_id);


--
-- Name: idx_pc_competence_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pc_competence_id ON public.personnage_competences USING btree (competence_id);


--
-- Name: idx_pc_personnage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pc_personnage_id ON public.personnage_competences USING btree (personnage_id);


--
-- Name: idx_personnages_classe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnages_classe_id ON public.personnages USING btree (classe_id);


--
-- Name: idx_personnages_est_actif; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnages_est_actif ON public.personnages USING btree (est_actif);


--
-- Name: idx_personnages_est_mort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnages_est_mort ON public.personnages USING btree (est_mort);


--
-- Name: idx_personnages_joueur_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnages_joueur_id ON public.personnages USING btree (joueur_id);


--
-- Name: idx_personnages_race_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personnages_race_id ON public.personnages USING btree (race_id);


--
-- Name: idx_pieges_actif; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pieges_actif ON public.pieges USING btree (est_actif);


--
-- Name: idx_pieges_niveau; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pieges_niveau ON public.pieges USING btree (niveau);


--
-- Name: idx_pieges_nom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pieges_nom ON public.pieges USING btree (nom);


--
-- Name: idx_pp_personnage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pp_personnage_id ON public.personnage_prieres USING btree (personnage_id);


--
-- Name: idx_pr_personnage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pr_personnage_id ON public.personnage_recettes USING btree (personnage_id);


--
-- Name: idx_prd_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prd_created_at ON public.personnage_races_demandes USING btree (created_at DESC);


--
-- Name: idx_prd_personnage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prd_personnage_id ON public.personnage_races_demandes USING btree (personnage_id);


--
-- Name: idx_prd_race_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prd_race_id ON public.personnage_races_demandes USING btree (race_id);


--
-- Name: idx_prd_statut; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prd_statut ON public.personnage_races_demandes USING btree (statut);


--
-- Name: idx_prd_statut_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prd_statut_created ON public.personnage_races_demandes USING btree (statut, created_at DESC);


--
-- Name: idx_ps_personnage_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ps_personnage_id ON public.personnage_sorts USING btree (personnage_id);


--
-- Name: idx_reparations_actif; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reparations_actif ON public.reparations_forge USING btree (est_actif);


--
-- Name: idx_reparations_categorie; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reparations_categorie ON public.reparations_forge USING btree (categorie);


--
-- Name: idx_sections_regles_categorie; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sections_regles_categorie ON public.sections_regles USING btree (categorie, ordre);


--
-- Name: prieres_recherche_tsv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prieres_recherche_tsv_idx ON public.prieres USING gin (recherche_tsv);


--
-- Name: religions_recherche_tsv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX religions_recherche_tsv_idx ON public.religions USING gin (recherche_tsv);


--
-- Name: sections_regles_recherche_tsv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sections_regles_recherche_tsv_idx ON public.sections_regles USING gin (recherche_tsv);


--
-- Name: sorts_recherche_tsv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sorts_recherche_tsv_idx ON public.sorts USING gin (recherche_tsv);


--
-- Name: vue_prochain_evenement _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.vue_prochain_evenement WITH (security_invoker='true') AS
 SELECT e.id,
    e.titre,
    e.description,
    e.date_evenement,
    e.date_fin,
    e.lieu,
    e.xp_recompense,
    e.max_participants,
    e.type_evenement,
    e.est_publie,
    e.created_by,
    count(i.id) FILTER (WHERE (i.statut <> 'annule'::text)) AS nb_inscrits,
        CASE
            WHEN (e.max_participants IS NULL) THEN NULL::bigint
            ELSE (e.max_participants - count(i.id) FILTER (WHERE (i.statut <> 'annule'::text)))
        END AS places_restantes
   FROM (public.evenements e
     LEFT JOIN public.inscriptions_evenements i ON ((i.evenement_id = e.id)))
  WHERE ((e.est_publie = true) AND (e.date_evenement > now()))
  GROUP BY e.id
  ORDER BY e.date_evenement
 LIMIT 1;


--
-- Name: profiles proteger_profile_role_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER proteger_profile_role_trigger BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.proteger_profile_role();


--
-- Name: bestiaire set_updated_at_bestiaire; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_bestiaire BEFORE UPDATE ON public.bestiaire FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: cartes_accueil set_updated_at_cartes_accueil; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cartes_accueil BEFORE UPDATE ON public.cartes_accueil FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: categories_creatures set_updated_at_categories_creatures; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_categories_creatures BEFORE UPDATE ON public.categories_creatures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: langues set_updated_at_langues; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_langues BEFORE UPDATE ON public.langues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: lore set_updated_at_lore; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_lore BEFORE UPDATE ON public.lore FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: menu_navigation set_updated_at_menu_navigation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_menu_navigation BEFORE UPDATE ON public.menu_navigation FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sections_encyclopedie set_updated_at_sections_encyclopedie; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_sections_encyclopedie BEFORE UPDATE ON public.sections_encyclopedie FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: sections_regles set_updated_at_sections_regles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_sections_regles BEFORE UPDATE ON public.sections_regles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: inscriptions_evenements trg_check_race_approuvee_inscription; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_check_race_approuvee_inscription BEFORE INSERT ON public.inscriptions_evenements FOR EACH ROW EXECUTE FUNCTION public.verifier_race_approuvee_avant_inscription();


--
-- Name: personnages trg_cleanup_demande_race; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cleanup_demande_race AFTER UPDATE OF race_id ON public.personnages FOR EACH ROW EXECUTE FUNCTION public.cleanup_demande_si_race_change();


--
-- Name: evenements trg_evenements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_evenements_updated_at BEFORE UPDATE ON public.evenements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: parametres_jeu trg_parametres_jeu_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_parametres_jeu_updated_at BEFORE UPDATE ON public.parametres_jeu FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: personnage_races_demandes trg_personnage_races_demandes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_personnage_races_demandes_updated_at BEFORE UPDATE ON public.personnage_races_demandes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: personnages trg_personnages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_personnages_updated_at BEFORE UPDATE ON public.personnages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: personnages trg_recalculer_ps_max_classe; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_recalculer_ps_max_classe AFTER UPDATE OF classe_id ON public.personnages FOR EACH ROW WHEN ((new.classe_id IS DISTINCT FROM old.classe_id)) EXECUTE FUNCTION public.trg_recalculer_ps_max_sur_classe();


--
-- Name: personnage_competences trg_recalculer_ps_max_competences; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_recalculer_ps_max_competences AFTER INSERT OR DELETE ON public.personnage_competences FOR EACH ROW EXECUTE FUNCTION public.trg_recalculer_ps_max_sur_competence();


--
-- Name: personnages trg_set_xp_initial; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_xp_initial BEFORE INSERT OR UPDATE OF race_id ON public.personnages FOR EACH ROW EXECUTE FUNCTION public.set_xp_initial_on_race_change();


--
-- Name: historique_xp trg_sync_xp_personnage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_xp_personnage AFTER INSERT OR DELETE OR UPDATE ON public.historique_xp FOR EACH ROW EXECUTE FUNCTION public.sync_xp_personnage();


--
-- Name: personnage_competences trg_verifier_verrous_competences; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_verifier_verrous_competences BEFORE INSERT OR UPDATE OF competence_id ON public.personnage_competences FOR EACH ROW EXECUTE FUNCTION public.verifier_verrous_competences();


--
-- Name: evenements evenements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evenements
    ADD CONSTRAINT evenements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: historique_xp historique_xp_acteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_xp
    ADD CONSTRAINT historique_xp_acteur_id_fkey FOREIGN KEY (acteur_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: historique_xp historique_xp_assemblage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_xp
    ADD CONSTRAINT historique_xp_assemblage_id_fkey FOREIGN KEY (assemblage_id) REFERENCES public.assemblages_runes(id) ON DELETE SET NULL;


--
-- Name: historique_xp historique_xp_competence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_xp
    ADD CONSTRAINT historique_xp_competence_id_fkey FOREIGN KEY (competence_id) REFERENCES public.competences(id) ON DELETE SET NULL;


--
-- Name: historique_xp historique_xp_evenement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_xp
    ADD CONSTRAINT historique_xp_evenement_id_fkey FOREIGN KEY (evenement_id) REFERENCES public.evenements(id) ON DELETE SET NULL;


--
-- Name: historique_xp historique_xp_inscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_xp
    ADD CONSTRAINT historique_xp_inscription_id_fkey FOREIGN KEY (inscription_id) REFERENCES public.inscriptions_evenements(id) ON DELETE SET NULL;


--
-- Name: historique_xp historique_xp_objet_forge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_xp
    ADD CONSTRAINT historique_xp_objet_forge_id_fkey FOREIGN KEY (objet_forge_id) REFERENCES public.objets_forge(id) ON DELETE SET NULL;


--
-- Name: historique_xp historique_xp_objet_joaillerie_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_xp
    ADD CONSTRAINT historique_xp_objet_joaillerie_id_fkey FOREIGN KEY (objet_joaillerie_id) REFERENCES public.objets_joaillerie(id) ON DELETE SET NULL;


--
-- Name: historique_xp historique_xp_personnage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_xp
    ADD CONSTRAINT historique_xp_personnage_id_fkey FOREIGN KEY (personnage_id) REFERENCES public.personnages(id) ON DELETE CASCADE;


--
-- Name: historique_xp historique_xp_personnage_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_xp
    ADD CONSTRAINT historique_xp_personnage_source_id_fkey FOREIGN KEY (personnage_source_id) REFERENCES public.personnages(id) ON DELETE SET NULL;


--
-- Name: historique_xp historique_xp_priere_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_xp
    ADD CONSTRAINT historique_xp_priere_id_fkey FOREIGN KEY (priere_id) REFERENCES public.prieres(id) ON DELETE SET NULL;


--
-- Name: historique_xp historique_xp_recette_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_xp
    ADD CONSTRAINT historique_xp_recette_id_fkey FOREIGN KEY (recette_id) REFERENCES public.recettes_alchimie(id) ON DELETE SET NULL;


--
-- Name: historique_xp historique_xp_sort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_xp
    ADD CONSTRAINT historique_xp_sort_id_fkey FOREIGN KEY (sort_id) REFERENCES public.sorts(id) ON DELETE SET NULL;


--
-- Name: historique_xp historique_xp_trait_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historique_xp
    ADD CONSTRAINT historique_xp_trait_id_fkey FOREIGN KEY (trait_id) REFERENCES public.traits_raciaux(id) ON DELETE SET NULL;


--
-- Name: inscriptions_evenements inscriptions_evenements_evenement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscriptions_evenements
    ADD CONSTRAINT inscriptions_evenements_evenement_id_fkey FOREIGN KEY (evenement_id) REFERENCES public.evenements(id);


--
-- Name: inscriptions_evenements inscriptions_evenements_joueur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscriptions_evenements
    ADD CONSTRAINT inscriptions_evenements_joueur_id_fkey FOREIGN KEY (joueur_id) REFERENCES public.profiles(id);


--
-- Name: inscriptions_evenements inscriptions_evenements_personnage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscriptions_evenements
    ADD CONSTRAINT inscriptions_evenements_personnage_id_fkey FOREIGN KEY (personnage_id) REFERENCES public.personnages(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: personnage_assemblages personnage_assemblages_assemblage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_assemblages
    ADD CONSTRAINT personnage_assemblages_assemblage_id_fkey FOREIGN KEY (assemblage_id) REFERENCES public.assemblages_runes(id);


--
-- Name: personnage_assemblages personnage_assemblages_personnage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_assemblages
    ADD CONSTRAINT personnage_assemblages_personnage_id_fkey FOREIGN KEY (personnage_id) REFERENCES public.personnages(id) ON DELETE CASCADE;


--
-- Name: personnage_competences personnage_competences_competence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_competences
    ADD CONSTRAINT personnage_competences_competence_id_fkey FOREIGN KEY (competence_id) REFERENCES public.competences(id);


--
-- Name: personnage_competences personnage_competences_personnage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_competences
    ADD CONSTRAINT personnage_competences_personnage_id_fkey FOREIGN KEY (personnage_id) REFERENCES public.personnages(id) ON DELETE CASCADE;


--
-- Name: personnage_objets_forge personnage_objets_forge_objet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_objets_forge
    ADD CONSTRAINT personnage_objets_forge_objet_id_fkey FOREIGN KEY (objet_id) REFERENCES public.objets_forge(id);


--
-- Name: personnage_objets_forge personnage_objets_forge_personnage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_objets_forge
    ADD CONSTRAINT personnage_objets_forge_personnage_id_fkey FOREIGN KEY (personnage_id) REFERENCES public.personnages(id) ON DELETE CASCADE;


--
-- Name: personnage_objets_joaillerie personnage_objets_joaillerie_objet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_objets_joaillerie
    ADD CONSTRAINT personnage_objets_joaillerie_objet_id_fkey FOREIGN KEY (objet_id) REFERENCES public.objets_joaillerie(id);


--
-- Name: personnage_objets_joaillerie personnage_objets_joaillerie_personnage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_objets_joaillerie
    ADD CONSTRAINT personnage_objets_joaillerie_personnage_id_fkey FOREIGN KEY (personnage_id) REFERENCES public.personnages(id) ON DELETE CASCADE;


--
-- Name: personnage_prieres personnage_prieres_personnage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_prieres
    ADD CONSTRAINT personnage_prieres_personnage_id_fkey FOREIGN KEY (personnage_id) REFERENCES public.personnages(id) ON DELETE CASCADE;


--
-- Name: personnage_prieres personnage_prieres_priere_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_prieres
    ADD CONSTRAINT personnage_prieres_priere_id_fkey FOREIGN KEY (priere_id) REFERENCES public.prieres(id);


--
-- Name: personnage_races_demandes personnage_races_demandes_approuve_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_races_demandes
    ADD CONSTRAINT personnage_races_demandes_approuve_par_fkey FOREIGN KEY (approuve_par) REFERENCES public.profiles(id);


--
-- Name: personnage_races_demandes personnage_races_demandes_personnage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_races_demandes
    ADD CONSTRAINT personnage_races_demandes_personnage_id_fkey FOREIGN KEY (personnage_id) REFERENCES public.personnages(id) ON DELETE CASCADE;


--
-- Name: personnage_races_demandes personnage_races_demandes_race_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_races_demandes
    ADD CONSTRAINT personnage_races_demandes_race_id_fkey FOREIGN KEY (race_id) REFERENCES public.races(id) ON DELETE RESTRICT;


--
-- Name: personnage_recettes personnage_recettes_personnage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_recettes
    ADD CONSTRAINT personnage_recettes_personnage_id_fkey FOREIGN KEY (personnage_id) REFERENCES public.personnages(id) ON DELETE CASCADE;


--
-- Name: personnage_recettes personnage_recettes_recette_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_recettes
    ADD CONSTRAINT personnage_recettes_recette_id_fkey FOREIGN KEY (recette_id) REFERENCES public.recettes_alchimie(id);


--
-- Name: personnage_sorts personnage_sorts_personnage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_sorts
    ADD CONSTRAINT personnage_sorts_personnage_id_fkey FOREIGN KEY (personnage_id) REFERENCES public.personnages(id) ON DELETE CASCADE;


--
-- Name: personnage_sorts personnage_sorts_sort_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnage_sorts
    ADD CONSTRAINT personnage_sorts_sort_id_fkey FOREIGN KEY (sort_id) REFERENCES public.sorts(id);


--
-- Name: personnages personnages_classe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnages
    ADD CONSTRAINT personnages_classe_id_fkey FOREIGN KEY (classe_id) REFERENCES public.classes(id);


--
-- Name: personnages personnages_classe_secondaire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnages
    ADD CONSTRAINT personnages_classe_secondaire_id_fkey FOREIGN KEY (classe_secondaire_id) REFERENCES public.classes(id);


--
-- Name: personnages personnages_famille_criminelle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnages
    ADD CONSTRAINT personnages_famille_criminelle_id_fkey FOREIGN KEY (famille_criminelle_id) REFERENCES public.familles_criminelles(id);


--
-- Name: personnages personnages_joueur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnages
    ADD CONSTRAINT personnages_joueur_id_fkey FOREIGN KEY (joueur_id) REFERENCES public.profiles(id);


--
-- Name: personnages personnages_race_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnages
    ADD CONSTRAINT personnages_race_id_fkey FOREIGN KEY (race_id) REFERENCES public.races(id);


--
-- Name: personnages personnages_religion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnages
    ADD CONSTRAINT personnages_religion_id_fkey FOREIGN KEY (religion_id) REFERENCES public.religions(id);


--
-- Name: prieres prieres_religion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prieres
    ADD CONSTRAINT prieres_religion_id_fkey FOREIGN KEY (religion_id) REFERENCES public.religions(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);


--
-- Name: race_traits race_traits_race_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_traits
    ADD CONSTRAINT race_traits_race_id_fkey FOREIGN KEY (race_id) REFERENCES public.races(id) ON DELETE CASCADE;


--
-- Name: race_traits race_traits_trait_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.race_traits
    ADD CONSTRAINT race_traits_trait_id_fkey FOREIGN KEY (trait_id) REFERENCES public.traits_raciaux(id) ON DELETE CASCADE;


--
-- Name: personnage_assemblages Accès assemblages personnage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Accès assemblages personnage" ON public.personnage_assemblages TO authenticated USING (((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.personnages
  WHERE ((personnages.id = personnage_assemblages.personnage_id) AND (personnages.joueur_id = auth.uid())))) OR public.est_animateur_ou_admin()))) WITH CHECK (((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.personnages
  WHERE ((personnages.id = personnage_assemblages.personnage_id) AND (personnages.joueur_id = auth.uid())))) OR public.est_animateur_ou_admin())));


--
-- Name: personnage_competences Accès compétences personnage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Accès compétences personnage" ON public.personnage_competences TO authenticated USING (((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.personnages
  WHERE ((personnages.id = personnage_competences.personnage_id) AND (personnages.joueur_id = auth.uid())))) OR public.est_animateur_ou_admin()))) WITH CHECK (((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.personnages
  WHERE ((personnages.id = personnage_competences.personnage_id) AND (personnages.joueur_id = auth.uid())))) OR public.est_animateur_ou_admin())));


--
-- Name: personnage_objets_forge Accès objets forge personnage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Accès objets forge personnage" ON public.personnage_objets_forge TO authenticated USING (((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.personnages
  WHERE ((personnages.id = personnage_objets_forge.personnage_id) AND (personnages.joueur_id = auth.uid())))) OR public.est_animateur_ou_admin()))) WITH CHECK (((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.personnages
  WHERE ((personnages.id = personnage_objets_forge.personnage_id) AND (personnages.joueur_id = auth.uid())))) OR public.est_animateur_ou_admin())));


--
-- Name: personnage_objets_joaillerie Accès objets joaillerie personnage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Accès objets joaillerie personnage" ON public.personnage_objets_joaillerie TO authenticated USING (((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.personnages
  WHERE ((personnages.id = personnage_objets_joaillerie.personnage_id) AND (personnages.joueur_id = auth.uid())))) OR public.est_animateur_ou_admin()))) WITH CHECK (((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.personnages
  WHERE ((personnages.id = personnage_objets_joaillerie.personnage_id) AND (personnages.joueur_id = auth.uid())))) OR public.est_animateur_ou_admin())));


--
-- Name: personnage_prieres Accès prières personnage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Accès prières personnage" ON public.personnage_prieres TO authenticated USING (((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.personnages
  WHERE ((personnages.id = personnage_prieres.personnage_id) AND (personnages.joueur_id = auth.uid())))) OR public.est_animateur_ou_admin()))) WITH CHECK (((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.personnages
  WHERE ((personnages.id = personnage_prieres.personnage_id) AND (personnages.joueur_id = auth.uid())))) OR public.est_animateur_ou_admin())));


--
-- Name: personnage_recettes Accès recettes personnage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Accès recettes personnage" ON public.personnage_recettes TO authenticated USING (((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.personnages
  WHERE ((personnages.id = personnage_recettes.personnage_id) AND (personnages.joueur_id = auth.uid())))) OR public.est_animateur_ou_admin()))) WITH CHECK (((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.personnages
  WHERE ((personnages.id = personnage_recettes.personnage_id) AND (personnages.joueur_id = auth.uid())))) OR public.est_animateur_ou_admin())));


--
-- Name: personnage_sorts Accès sorts personnage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Accès sorts personnage" ON public.personnage_sorts TO authenticated USING (((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.personnages
  WHERE ((personnages.id = personnage_sorts.personnage_id) AND (personnages.joueur_id = auth.uid())))) OR public.est_animateur_ou_admin()))) WITH CHECK (((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.personnages
  WHERE ((personnages.id = personnage_sorts.personnage_id) AND (personnages.joueur_id = auth.uid())))) OR public.est_animateur_ou_admin())));


--
-- Name: personnage_races_demandes Creation demandes races; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creation demandes races" ON public.personnage_races_demandes FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.personnages
  WHERE ((personnages.id = personnage_races_demandes.personnage_id) AND (personnages.joueur_id = auth.uid())))) OR public.est_animateur_ou_admin())));


--
-- Name: inscriptions_evenements Création inscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Création inscriptions" ON public.inscriptions_evenements FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND ((joueur_id = auth.uid()) OR public.est_animateur_ou_admin())));


--
-- Name: notifications Création notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Création notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR public.est_animateur_ou_admin())));


--
-- Name: personnages Création personnages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Création personnages" ON public.personnages FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND ((joueur_id = auth.uid()) OR public.est_animateur_ou_admin())));


--
-- Name: profiles Création profil sécurisée; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Création profil sécurisée" ON public.profiles FOR INSERT TO authenticated WITH CHECK (((auth.uid() = id) AND (COALESCE(role, 'joueur'::text) = 'joueur'::text)));


--
-- Name: assemblages_runes Gestion assemblages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion assemblages" ON public.assemblages_runes USING (public.est_animateur_ou_admin());


--
-- Name: classes Gestion classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion classes" ON public.classes USING (public.est_animateur_ou_admin());


--
-- Name: competences Gestion compétences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion compétences" ON public.competences USING (public.est_animateur_ou_admin());


--
-- Name: config_jeu Gestion config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion config" ON public.config_jeu USING (public.est_animateur_ou_admin());


--
-- Name: effets_combat Gestion effets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion effets" ON public.effets_combat USING (public.est_animateur_ou_admin());


--
-- Name: familles_criminelles Gestion familles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion familles" ON public.familles_criminelles USING (public.est_animateur_ou_admin());


--
-- Name: ingredients_alchimiques Gestion ingredients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion ingredients" ON public.ingredients_alchimiques USING (public.est_animateur_ou_admin());


--
-- Name: objets_forge Gestion objets forge; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion objets forge" ON public.objets_forge USING (public.est_animateur_ou_admin());


--
-- Name: objets_joaillerie Gestion objets joaillerie; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion objets joaillerie" ON public.objets_joaillerie USING (public.est_animateur_ou_admin());


--
-- Name: prieres Gestion prières; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion prières" ON public.prieres USING (public.est_animateur_ou_admin());


--
-- Name: race_traits Gestion race_traits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion race_traits" ON public.race_traits USING (public.est_animateur_ou_admin());


--
-- Name: races Gestion races; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion races" ON public.races USING (public.est_animateur_ou_admin());


--
-- Name: recettes_alchimie Gestion recettes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion recettes" ON public.recettes_alchimie USING (public.est_animateur_ou_admin());


--
-- Name: religions Gestion religions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion religions" ON public.religions USING (public.est_animateur_ou_admin());


--
-- Name: sorts Gestion sorts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion sorts" ON public.sorts USING (public.est_animateur_ou_admin());


--
-- Name: traits_raciaux Gestion traits_raciaux; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion traits_raciaux" ON public.traits_raciaux USING (public.est_animateur_ou_admin());


--
-- Name: evenements Gestion événements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion événements" ON public.evenements USING (public.est_animateur_ou_admin());


--
-- Name: assemblages_runes Lecture assemblages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture assemblages" ON public.assemblages_runes FOR SELECT USING (true);


--
-- Name: classes Lecture classes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture classes" ON public.classes FOR SELECT USING (true);


--
-- Name: competences Lecture compétences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture compétences" ON public.competences FOR SELECT USING (true);


--
-- Name: config_jeu Lecture config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture config" ON public.config_jeu FOR SELECT USING (true);


--
-- Name: personnage_races_demandes Lecture demandes races; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture demandes races" ON public.personnage_races_demandes FOR SELECT TO authenticated USING (((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM public.personnages
  WHERE ((personnages.id = personnage_races_demandes.personnage_id) AND (personnages.joueur_id = auth.uid())))) OR public.est_animateur_ou_admin())));


--
-- Name: effets_combat Lecture effets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture effets" ON public.effets_combat FOR SELECT USING (true);


--
-- Name: familles_criminelles Lecture familles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture familles" ON public.familles_criminelles FOR SELECT USING (true);


--
-- Name: ingredients_alchimiques Lecture ingredients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture ingredients" ON public.ingredients_alchimiques FOR SELECT USING (true);


--
-- Name: inscriptions_evenements Lecture inscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture inscriptions" ON public.inscriptions_evenements FOR SELECT TO authenticated USING (((auth.uid() IS NOT NULL) AND ((joueur_id = auth.uid()) OR public.est_animateur_ou_admin())));


--
-- Name: notifications Lecture notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture notifications" ON public.notifications FOR SELECT TO authenticated USING (((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR public.est_animateur_ou_admin())));


--
-- Name: objets_forge Lecture objets forge; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture objets forge" ON public.objets_forge FOR SELECT USING (true);


--
-- Name: objets_joaillerie Lecture objets joaillerie; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture objets joaillerie" ON public.objets_joaillerie FOR SELECT USING (true);


--
-- Name: personnages Lecture personnages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture personnages" ON public.personnages FOR SELECT TO authenticated USING (((auth.uid() IS NOT NULL) AND ((joueur_id = auth.uid()) OR public.est_animateur_ou_admin())));


--
-- Name: prieres Lecture prières; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture prières" ON public.prieres FOR SELECT USING (true);


--
-- Name: profiles Lecture profil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture profil" ON public.profiles FOR SELECT TO authenticated USING (((auth.uid() IS NOT NULL) AND ((auth.uid() = id) OR public.est_animateur_ou_admin())));


--
-- Name: pieges Lecture publique pièges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture publique pièges" ON public.pieges FOR SELECT USING (true);


--
-- Name: reparations_forge Lecture publique reparations_forge; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture publique reparations_forge" ON public.reparations_forge FOR SELECT USING (true);


--
-- Name: race_traits Lecture race_traits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture race_traits" ON public.race_traits FOR SELECT USING (true);


--
-- Name: races Lecture races; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture races" ON public.races FOR SELECT USING (true);


--
-- Name: recettes_alchimie Lecture recettes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture recettes" ON public.recettes_alchimie FOR SELECT USING (true);


--
-- Name: religions Lecture religions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture religions" ON public.religions FOR SELECT USING (true);


--
-- Name: sorts Lecture sorts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture sorts" ON public.sorts FOR SELECT USING (true);


--
-- Name: traits_raciaux Lecture traits_raciaux; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture traits_raciaux" ON public.traits_raciaux FOR SELECT USING (true);


--
-- Name: evenements Lecture événements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture événements" ON public.evenements FOR SELECT USING (((est_publie = true) OR public.est_animateur_ou_admin()));


--
-- Name: personnage_races_demandes Modification demandes races; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modification demandes races" ON public.personnage_races_demandes FOR UPDATE TO authenticated USING (public.est_animateur_ou_admin()) WITH CHECK (public.est_animateur_ou_admin());


--
-- Name: inscriptions_evenements Modification inscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modification inscriptions" ON public.inscriptions_evenements FOR UPDATE TO authenticated USING (((auth.uid() IS NOT NULL) AND ((joueur_id = auth.uid()) OR public.est_animateur_ou_admin()))) WITH CHECK (((auth.uid() IS NOT NULL) AND ((joueur_id = auth.uid()) OR public.est_animateur_ou_admin())));


--
-- Name: notifications Modification notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modification notifications" ON public.notifications FOR UPDATE TO authenticated USING (((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR public.est_animateur_ou_admin()))) WITH CHECK (((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR public.est_animateur_ou_admin())));


--
-- Name: personnages Modification personnages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modification personnages" ON public.personnages FOR UPDATE TO authenticated USING (((auth.uid() IS NOT NULL) AND ((joueur_id = auth.uid()) OR public.est_animateur_ou_admin()))) WITH CHECK (((auth.uid() IS NOT NULL) AND ((joueur_id = auth.uid()) OR public.est_animateur_ou_admin())));


--
-- Name: profiles Modification profil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modification profil" ON public.profiles FOR UPDATE TO authenticated USING (((auth.uid() IS NOT NULL) AND ((auth.uid() = id) OR public.est_animateur_ou_admin()))) WITH CHECK (((auth.uid() IS NOT NULL) AND (((auth.uid() = id) AND (role = public.role_du_profil(auth.uid()))) OR public.est_animateur_ou_admin())));


--
-- Name: personnage_races_demandes Suppression demandes races; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppression demandes races" ON public.personnage_races_demandes FOR DELETE TO authenticated USING (public.est_animateur_ou_admin());


--
-- Name: inscriptions_evenements Suppression inscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppression inscriptions" ON public.inscriptions_evenements FOR DELETE TO authenticated USING (((auth.uid() IS NOT NULL) AND (public.est_animateur_ou_admin() OR (joueur_id = auth.uid()))));


--
-- Name: notifications Suppression notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppression notifications" ON public.notifications FOR DELETE TO authenticated USING (((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR public.est_animateur_ou_admin())));


--
-- Name: personnages Suppression personnages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppression personnages" ON public.personnages FOR DELETE TO authenticated USING (((auth.uid() IS NOT NULL) AND public.est_animateur_ou_admin()));


--
-- Name: assemblages_runes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assemblages_runes ENABLE ROW LEVEL SECURITY;

--
-- Name: bestiaire; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bestiaire ENABLE ROW LEVEL SECURITY;

--
-- Name: bestiaire bestiaire_ecriture_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bestiaire_ecriture_admin ON public.bestiaire USING (public.est_animateur_ou_admin());


--
-- Name: bestiaire bestiaire_lecture_publique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bestiaire_lecture_publique ON public.bestiaire FOR SELECT USING ((est_actif = true));


--
-- Name: cartes_accueil; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cartes_accueil ENABLE ROW LEVEL SECURITY;

--
-- Name: cartes_accueil cartes_accueil_ecriture_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cartes_accueil_ecriture_admin ON public.cartes_accueil USING (public.est_animateur_ou_admin());


--
-- Name: cartes_accueil cartes_accueil_lecture_publique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cartes_accueil_lecture_publique ON public.cartes_accueil FOR SELECT USING ((est_actif = true));


--
-- Name: categories_creatures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories_creatures ENABLE ROW LEVEL SECURITY;

--
-- Name: categories_creatures categories_creatures_ecriture_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_creatures_ecriture_admin ON public.categories_creatures USING (public.est_animateur_ou_admin());


--
-- Name: categories_creatures categories_creatures_lecture_publique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_creatures_lecture_publique ON public.categories_creatures FOR SELECT USING ((est_actif = true));


--
-- Name: classes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

--
-- Name: competences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.competences ENABLE ROW LEVEL SECURITY;

--
-- Name: config_jeu; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.config_jeu ENABLE ROW LEVEL SECURITY;

--
-- Name: effets_combat; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.effets_combat ENABLE ROW LEVEL SECURITY;

--
-- Name: evenements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.evenements ENABLE ROW LEVEL SECURITY;

--
-- Name: familles_criminelles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.familles_criminelles ENABLE ROW LEVEL SECURITY;

--
-- Name: historique_xp; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.historique_xp ENABLE ROW LEVEL SECURITY;

--
-- Name: historique_xp historique_xp_select_proprietaire_ou_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY historique_xp_select_proprietaire_ou_admin ON public.historique_xp FOR SELECT USING ((public.est_animateur_ou_admin() OR (EXISTS ( SELECT 1
   FROM public.personnages p
  WHERE ((p.id = historique_xp.personnage_id) AND (p.joueur_id = auth.uid()))))));


--
-- Name: ingredients_alchimiques; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ingredients_alchimiques ENABLE ROW LEVEL SECURITY;

--
-- Name: inscriptions_evenements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inscriptions_evenements ENABLE ROW LEVEL SECURITY;

--
-- Name: langues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.langues ENABLE ROW LEVEL SECURITY;

--
-- Name: langues langues_ecriture_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY langues_ecriture_admin ON public.langues USING (public.est_animateur_ou_admin());


--
-- Name: langues langues_lecture_publique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY langues_lecture_publique ON public.langues FOR SELECT USING ((est_actif = true));


--
-- Name: lore; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lore ENABLE ROW LEVEL SECURITY;

--
-- Name: lore lore_ecriture_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lore_ecriture_admin ON public.lore USING (public.est_animateur_ou_admin());


--
-- Name: lore lore_lecture_publique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lore_lecture_publique ON public.lore FOR SELECT USING ((est_actif = true));


--
-- Name: menu_navigation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_navigation ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_navigation menu_navigation_ecriture_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_navigation_ecriture_admin ON public.menu_navigation USING (public.est_animateur_ou_admin());


--
-- Name: menu_navigation menu_navigation_lecture_publique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_navigation_lecture_publique ON public.menu_navigation FOR SELECT USING ((est_actif = true));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: objets_forge; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.objets_forge ENABLE ROW LEVEL SECURITY;

--
-- Name: objets_joaillerie; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.objets_joaillerie ENABLE ROW LEVEL SECURITY;

--
-- Name: parametres_jeu; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parametres_jeu ENABLE ROW LEVEL SECURITY;

--
-- Name: parametres_jeu parametres_jeu_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parametres_jeu_admin_delete ON public.parametres_jeu FOR DELETE TO authenticated USING (public.est_animateur_ou_admin());


--
-- Name: parametres_jeu parametres_jeu_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parametres_jeu_admin_insert ON public.parametres_jeu FOR INSERT TO authenticated WITH CHECK (public.est_animateur_ou_admin());


--
-- Name: parametres_jeu parametres_jeu_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parametres_jeu_admin_update ON public.parametres_jeu FOR UPDATE TO authenticated USING (public.est_animateur_ou_admin()) WITH CHECK (public.est_animateur_ou_admin());


--
-- Name: parametres_jeu parametres_jeu_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parametres_jeu_select_all ON public.parametres_jeu FOR SELECT USING (true);


--
-- Name: personnage_assemblages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personnage_assemblages ENABLE ROW LEVEL SECURITY;

--
-- Name: personnage_competences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personnage_competences ENABLE ROW LEVEL SECURITY;

--
-- Name: personnage_objets_forge; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personnage_objets_forge ENABLE ROW LEVEL SECURITY;

--
-- Name: personnage_objets_joaillerie; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personnage_objets_joaillerie ENABLE ROW LEVEL SECURITY;

--
-- Name: personnage_prieres; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personnage_prieres ENABLE ROW LEVEL SECURITY;

--
-- Name: personnage_races_demandes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personnage_races_demandes ENABLE ROW LEVEL SECURITY;

--
-- Name: personnage_recettes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personnage_recettes ENABLE ROW LEVEL SECURITY;

--
-- Name: personnage_sorts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personnage_sorts ENABLE ROW LEVEL SECURITY;

--
-- Name: personnages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personnages ENABLE ROW LEVEL SECURITY;

--
-- Name: pieges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pieges ENABLE ROW LEVEL SECURITY;

--
-- Name: prieres; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prieres ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: race_traits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.race_traits ENABLE ROW LEVEL SECURITY;

--
-- Name: races; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.races ENABLE ROW LEVEL SECURITY;

--
-- Name: recettes_alchimie; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recettes_alchimie ENABLE ROW LEVEL SECURITY;

--
-- Name: religions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.religions ENABLE ROW LEVEL SECURITY;

--
-- Name: reparations_forge; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reparations_forge ENABLE ROW LEVEL SECURITY;

--
-- Name: sections_encyclopedie; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sections_encyclopedie ENABLE ROW LEVEL SECURITY;

--
-- Name: sections_encyclopedie sections_encyclopedie_ecriture_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sections_encyclopedie_ecriture_admin ON public.sections_encyclopedie USING (public.est_animateur_ou_admin());


--
-- Name: sections_encyclopedie sections_encyclopedie_lecture_publique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sections_encyclopedie_lecture_publique ON public.sections_encyclopedie FOR SELECT USING ((est_actif = true));


--
-- Name: sections_regles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sections_regles ENABLE ROW LEVEL SECURITY;

--
-- Name: sections_regles sections_regles_ecriture_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sections_regles_ecriture_admin ON public.sections_regles USING (public.est_animateur_ou_admin());


--
-- Name: sections_regles sections_regles_lecture_publique; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sections_regles_lecture_publique ON public.sections_regles FOR SELECT USING ((est_actif = true));


--
-- Name: sorts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sorts ENABLE ROW LEVEL SECURITY;

--
-- Name: traits_raciaux; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.traits_raciaux ENABLE ROW LEVEL SECURITY;

--
-- Name: pieges Écriture admin pièges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Écriture admin pièges" ON public.pieges USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'animateur'::text]))))));


--
-- Name: reparations_forge Écriture admin reparations_forge; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Écriture admin reparations_forge" ON public.reparations_forge USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'animateur'::text]))))));


--
-- PostgreSQL database dump complete
--


