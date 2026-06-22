-- RAISON-BLOCAGE-PURGE (s259)
-- Ajoute p_raison (obligatoire, min 5 car. apres btrim -> RAISON_REQUISE) aux 6 RPC
-- blocage/purge (compte/profil/personnage). La raison est journalisee dans
-- journal_audit.details.raison (aucune migration de schema) et exposee par
-- vue_journal_staff.raison. Le deblocage ne prend PAS de raison.
-- A2 : DROP des anciennes signatures (uuid) avant CREATE OR REPLACE (uuid,text).

DROP FUNCTION IF EXISTS public.bloquer_compte(uuid);
DROP FUNCTION IF EXISTS public.bloquer_profil(uuid);
DROP FUNCTION IF EXISTS public.bloquer_personnage(uuid);
DROP FUNCTION IF EXISTS public.purger_compte(uuid);
DROP FUNCTION IF EXISTS public.purger_profil(uuid);
DROP FUNCTION IF EXISTS public.purger_personnage(uuid);

-- ── bloquer_compte (retour standard) ──
CREATE OR REPLACE FUNCTION public.bloquer_compte(p_compte_id uuid, p_raison text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_compte RECORD; v_nb_profils int := 0; v_nb_persos int := 0;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Accès refusé')),
      'avertissements', '[]'::jsonb, 'donnees', null);
  END IF;
  IF COALESCE(length(btrim(p_raison)), 0) < 5 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','RAISON_REQUISE','message','Une raison d''au moins 5 caractères est requise.')),
      'avertissements', '[]'::jsonb, 'donnees', null);
  END IF;
  SELECT id, COALESCE(nom_affichage, username, email, 'Compte') AS libelle
    INTO v_compte FROM public.profiles WHERE id = p_compte_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','INTROUVABLE','message','Compte introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', null);
  END IF;
  UPDATE public.personnages SET est_actif = false
   WHERE joueur_id IN (SELECT id FROM public.profils_joueur WHERE compte_id = p_compte_id) AND est_actif = true;
  GET DIAGNOSTICS v_nb_persos = ROW_COUNT;
  UPDATE public.profils_joueur SET est_actif = false WHERE compte_id = p_compte_id AND est_actif = true;
  GET DIAGNOSTICS v_nb_profils = ROW_COUNT;
  UPDATE public.profiles SET is_active = false WHERE id = p_compte_id;
  UPDATE auth.users SET banned_until = '2999-12-31 23:59:59+00'::timestamptz WHERE id = p_compte_id;
  PERFORM public.log_audit('compte', p_compte_id, 'bloquer',
    jsonb_build_object('libelle', v_compte.libelle, 'nb_profils', v_nb_profils, 'nb_persos', v_nb_persos, 'raison', btrim(p_raison)));
  RETURN jsonb_build_object('succes', true, 'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('compte_id', p_compte_id, 'nb_profils', v_nb_profils, 'nb_persos', v_nb_persos));
END;
$function$;

-- ── bloquer_profil (retour standard) ──
CREATE OR REPLACE FUNCTION public.bloquer_profil(p_profil_id uuid, p_raison text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_profil RECORD; v_nb_persos int := 0;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Accès refusé')),
      'avertissements', '[]'::jsonb, 'donnees', null);
  END IF;
  IF COALESCE(length(btrim(p_raison)), 0) < 5 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','RAISON_REQUISE','message','Une raison d''au moins 5 caractères est requise.')),
      'avertissements', '[]'::jsonb, 'donnees', null);
  END IF;
  SELECT id, nom, compte_id INTO v_profil FROM public.profils_joueur WHERE id = p_profil_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','INTROUVABLE','message','Profil introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', null);
  END IF;
  UPDATE public.personnages SET est_actif = false WHERE joueur_id = p_profil_id AND est_actif = true;
  GET DIAGNOSTICS v_nb_persos = ROW_COUNT;
  UPDATE public.profils_joueur SET est_actif = false WHERE id = p_profil_id;
  PERFORM public.log_audit('profil', p_profil_id, 'bloquer',
    jsonb_build_object('nom', v_profil.nom, 'nb_persos', v_nb_persos, 'raison', btrim(p_raison)));
  RETURN jsonb_build_object('succes', true, 'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('profil_id', p_profil_id, 'nb_persos', v_nb_persos));
END;
$function$;

-- ── bloquer_personnage (retour NON standard {succes,raison}) ──
CREATE OR REPLACE FUNCTION public.bloquer_personnage(p_personnage_id uuid, p_raison text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_personnage RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé'); END IF;
  IF COALESCE(length(btrim(p_raison)), 0) < 5 THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Une raison d''au moins 5 caractères est requise.');
  END IF;
  SELECT id, nom, joueur_id INTO v_personnage FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable'); END IF;
  UPDATE public.personnages SET est_actif = false WHERE id = p_personnage_id;
  PERFORM public.creer_notification(
    p_message := format('Votre personnage « %s » a été bloqué par le staff.', COALESCE(v_personnage.nom, 'Sans nom')),
    p_profil_id := v_personnage.joueur_id);
  PERFORM public.log_audit('personnage', p_personnage_id, 'bloquer',
    jsonb_build_object('nom', COALESCE(v_personnage.nom, 'Sans nom'), 'raison', btrim(p_raison)));
  RETURN jsonb_build_object('succes', true);
END;
$function$;

-- ── purger_compte (retour standard) ──
CREATE OR REPLACE FUNCTION public.purger_compte(p_compte_id uuid, p_raison text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_compte record; v_nb_profils int; v_nb_persos int; v_nb_events int;
BEGIN
  IF NOT est_admin() THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Reserve aux administrateurs.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF COALESCE(length(btrim(p_raison)), 0) < 5 THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','RAISON_REQUISE','message','Une raison d''au moins 5 caractères est requise.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  SELECT id, is_active, nom_affichage INTO v_compte FROM profiles WHERE id = p_compte_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','INTROUVABLE','message','Compte introuvable.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF v_compte.is_active IS NOT FALSE THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','NON_BLOQUE','message','Le compte doit etre bloque avant purge.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  SELECT count(*) INTO v_nb_profils FROM profils_joueur WHERE compte_id = p_compte_id;
  SELECT count(*) INTO v_nb_persos FROM personnages p JOIN profils_joueur pj ON pj.id=p.joueur_id WHERE pj.compte_id=p_compte_id;
  SELECT count(*) INTO v_nb_events FROM evenements WHERE created_by = p_compte_id;
  PERFORM _purger_compte_interne(p_compte_id);
  PERFORM log_audit('compte', p_compte_id, 'purger',
    jsonb_build_object('nom', v_compte.nom_affichage, 'nb_profils', v_nb_profils,
                       'nb_persos', v_nb_persos, 'nb_events_detaches', v_nb_events, 'raison', btrim(p_raison)));
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('nb_profils', v_nb_profils, 'nb_persos', v_nb_persos,
                                  'nb_events_detaches', v_nb_events, 'login_conserve', true));
END;
$function$;

-- ── purger_profil (retour standard) ──
CREATE OR REPLACE FUNCTION public.purger_profil(p_profil_id uuid, p_raison text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_profil record; v_nb_persos int;
BEGIN
  IF NOT est_admin() THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Reserve aux administrateurs.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF COALESCE(length(btrim(p_raison)), 0) < 5 THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','RAISON_REQUISE','message','Une raison d''au moins 5 caractères est requise.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  SELECT id, nom, est_actif INTO v_profil FROM profils_joueur WHERE id = p_profil_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','INTROUVABLE','message','Profil introuvable.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF v_profil.est_actif IS NOT FALSE THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','NON_BLOQUE','message','Le profil doit etre bloque avant purge.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  SELECT count(*) INTO v_nb_persos FROM personnages WHERE joueur_id = p_profil_id;
  PERFORM _purger_profil_interne(p_profil_id);
  PERFORM log_audit('profil', p_profil_id, 'purger',
    jsonb_build_object('nom', v_profil.nom, 'nb_persos', v_nb_persos, 'raison', btrim(p_raison)));
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('nom', v_profil.nom, 'nb_persos', v_nb_persos));
END;
$function$;

-- ── purger_personnage (retour standard) ──
CREATE OR REPLACE FUNCTION public.purger_personnage(p_personnage_id uuid, p_raison text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_perso record;
BEGIN
  IF NOT est_admin() THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Reserve aux administrateurs.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF COALESCE(length(btrim(p_raison)), 0) < 5 THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','RAISON_REQUISE','message','Une raison d''au moins 5 caractères est requise.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  SELECT id, nom, est_actif INTO v_perso FROM personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','INTROUVABLE','message','Personnage introuvable.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF v_perso.est_actif IS NOT FALSE THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','NON_BLOQUE','message','Le personnage doit etre bloque avant purge.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  PERFORM _purger_personnage_interne(p_personnage_id);
  PERFORM log_audit('personnage', p_personnage_id, 'purger',
    jsonb_build_object('nom', COALESCE(v_perso.nom,'Sans nom'), 'raison', btrim(p_raison)));
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('nom', COALESCE(v_perso.nom,'Sans nom')));
END;
$function$;

-- ── vue_journal_staff : + colonne raison (details->>'raison') en fin ──
CREATE OR REPLACE VIEW public.vue_journal_staff AS
 SELECT j.id, j.acteur_id, j.acteur_role, j.cible_type, j.cible_id, j.action, j.details, j.created_at,
    nom_profil_principal(j.acteur_id) AS acteur_nom,
    CASE j.cible_type
        WHEN 'personnage'::text THEN COALESCE((SELECT p.nom FROM personnages p WHERE p.id = j.cible_id), j.details ->> 'nom'::text, j.details ->> 'libelle'::text)
        WHEN 'profil'::text THEN COALESCE((SELECT pj.nom FROM profils_joueur pj WHERE pj.id = j.cible_id), j.details ->> 'nom'::text, j.details ->> 'libelle'::text)
        WHEN 'banque'::text THEN COALESCE((SELECT pj.nom FROM profils_joueur pj WHERE pj.id = j.cible_id), j.details ->> 'nom'::text, j.details ->> 'libelle'::text)
        WHEN 'compte'::text THEN COALESCE((SELECT pr.nom_affichage FROM profiles pr WHERE pr.id = j.cible_id), j.details ->> 'nom'::text, j.details ->> 'libelle'::text)
        ELSE NULL::text
    END AS cible_nom,
    (j.details ->> 'raison'::text) AS raison
   FROM journal_audit j
  WHERE j.acteur_role <> 'proprietaire'::text;
