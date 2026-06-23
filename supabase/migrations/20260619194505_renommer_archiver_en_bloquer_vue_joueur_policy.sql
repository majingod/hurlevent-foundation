-- Renommage terminologie « Bloqué » : archiver_* -> bloquer_*, desarchiver_* -> debloquer_*
-- + vue_personnages_joueur (bloqués visibles, etat='bloque') + policy DELETE durcie.

-- ── COMPTE ──
DROP FUNCTION IF EXISTS public.archiver_compte(uuid);
CREATE OR REPLACE FUNCTION public.bloquer_compte(p_compte_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_compte RECORD; v_nb_profils int := 0; v_nb_persos int := 0;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Accès refusé')),
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
    jsonb_build_object('libelle', v_compte.libelle, 'nb_profils', v_nb_profils, 'nb_persos', v_nb_persos));
  RETURN jsonb_build_object('succes', true, 'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('compte_id', p_compte_id, 'nb_profils', v_nb_profils, 'nb_persos', v_nb_persos));
END;
$function$;

DROP FUNCTION IF EXISTS public.desarchiver_compte(uuid);
CREATE OR REPLACE FUNCTION public.debloquer_compte(p_compte_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_compte RECORD; v_nb_profils int := 0; v_nb_persos int := 0;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Accès refusé')),
      'avertissements', '[]'::jsonb, 'donnees', null);
  END IF;
  SELECT id, COALESCE(nom_affichage, username, email, 'Compte') AS libelle
    INTO v_compte FROM public.profiles WHERE id = p_compte_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','INTROUVABLE','message','Compte introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', null);
  END IF;
  UPDATE public.personnages SET est_actif = true
   WHERE joueur_id IN (SELECT id FROM public.profils_joueur WHERE compte_id = p_compte_id) AND est_actif = false;
  GET DIAGNOSTICS v_nb_persos = ROW_COUNT;
  UPDATE public.profils_joueur SET est_actif = true WHERE compte_id = p_compte_id AND est_actif = false;
  GET DIAGNOSTICS v_nb_profils = ROW_COUNT;
  UPDATE public.profiles SET is_active = true WHERE id = p_compte_id;
  UPDATE auth.users SET banned_until = NULL WHERE id = p_compte_id;
  PERFORM public.log_audit('compte', p_compte_id, 'debloquer',
    jsonb_build_object('libelle', v_compte.libelle, 'nb_profils', v_nb_profils, 'nb_persos', v_nb_persos));
  RETURN jsonb_build_object('succes', true, 'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('compte_id', p_compte_id, 'nb_profils', v_nb_profils, 'nb_persos', v_nb_persos));
END;
$function$;

-- ── PROFIL ──
DROP FUNCTION IF EXISTS public.archiver_profil(uuid);
CREATE OR REPLACE FUNCTION public.bloquer_profil(p_profil_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_profil RECORD; v_nb_persos int := 0;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Accès refusé')),
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
    jsonb_build_object('nom', v_profil.nom, 'nb_persos', v_nb_persos));
  RETURN jsonb_build_object('succes', true, 'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('profil_id', p_profil_id, 'nb_persos', v_nb_persos));
END;
$function$;

DROP FUNCTION IF EXISTS public.desarchiver_profil(uuid);
CREATE OR REPLACE FUNCTION public.debloquer_profil(p_profil_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_profil RECORD; v_nb_persos int := 0;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Accès refusé')),
      'avertissements', '[]'::jsonb, 'donnees', null);
  END IF;
  SELECT id, nom INTO v_profil FROM public.profils_joueur WHERE id = p_profil_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','INTROUVABLE','message','Profil introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', null);
  END IF;
  UPDATE public.personnages SET est_actif = true WHERE joueur_id = p_profil_id AND est_actif = false;
  GET DIAGNOSTICS v_nb_persos = ROW_COUNT;
  UPDATE public.profils_joueur SET est_actif = true WHERE id = p_profil_id;
  PERFORM public.log_audit('profil', p_profil_id, 'debloquer',
    jsonb_build_object('nom', v_profil.nom, 'nb_persos', v_nb_persos));
  RETURN jsonb_build_object('succes', true, 'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('profil_id', p_profil_id, 'nb_persos', v_nb_persos));
END;
$function$;

-- ── PERSONNAGE ──
DROP FUNCTION IF EXISTS public.archiver_personnage(uuid);
CREATE OR REPLACE FUNCTION public.bloquer_personnage(p_personnage_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_personnage RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé'); END IF;
  SELECT id, nom, joueur_id INTO v_personnage FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable'); END IF;
  UPDATE public.personnages SET est_actif = false WHERE id = p_personnage_id;
  PERFORM public.creer_notification(
    p_message := format('Votre personnage « %s » a été bloqué par le staff.', COALESCE(v_personnage.nom, 'Sans nom')),
    p_profil_id := v_personnage.joueur_id);
  PERFORM public.log_audit('personnage', p_personnage_id, 'bloquer',
    jsonb_build_object('nom', COALESCE(v_personnage.nom, 'Sans nom')));
  RETURN jsonb_build_object('succes', true);
END;
$function$;

DROP FUNCTION IF EXISTS public.desarchiver_personnage(uuid);
CREATE OR REPLACE FUNCTION public.debloquer_personnage(p_personnage_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_personnage RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé'); END IF;
  SELECT id, nom, joueur_id INTO v_personnage FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable'); END IF;
  UPDATE public.personnages SET est_actif = true WHERE id = p_personnage_id;
  PERFORM public.creer_notification(
    p_message := format('Votre personnage « %s » a été débloqué.', COALESCE(v_personnage.nom, 'Sans nom')),
    p_profil_id := v_personnage.joueur_id);
  PERFORM public.log_audit('personnage', p_personnage_id, 'debloquer',
    jsonb_build_object('nom', COALESCE(v_personnage.nom, 'Sans nom')));
  RETURN jsonb_build_object('succes', true);
END;
$function$;

-- ── VUE : bloqués visibles + etat='bloque' ──
CREATE OR REPLACE VIEW public.vue_personnages_joueur AS
 SELECT p.id, p.joueur_id, p.nom, p.niveau, p.xp_total, p.xp_depense, p.etape_creation,
    p.est_actif, p.created_at,
    COALESCE(r.nom, 'Race inconnue'::text) AS race_nom,
    COALESCE(c.nom, 'Classe inconnue'::text) AS classe_nom,
    p.est_finalise,
    COALESCE(p.gn_completes, 0) AS gn_completes,
    COALESCE(p.mini_gn_completes, 0) AS mini_gn_completes,
    COALESCE(p.ouvertures_terrain, 0) AS ouvertures_terrain,
    CASE WHEN NOT p.est_actif THEN 'bloque' ELSE ee.j ->> 'etat'::text END AS etat,
    ee.j ->> 'evenement_inscrit_titre'::text AS evenement_inscrit_titre,
    (ee.j ->> 'evenement_inscrit_date'::text)::timestamp with time zone AS evenement_inscrit_date,
    (ee.j ->> 'dans_fenetre_gel'::text)::boolean AS dans_fenetre_gel
   FROM personnages p
     LEFT JOIN races r ON r.id = p.race_id
     LEFT JOIN classes c ON c.id = p.classe_id
     LEFT JOIN LATERAL (SELECT etat_edition_personnage(p.id) AS j) ee ON true;

-- ── POLICY DELETE durcie : un joueur ne supprime qu'un perso actif ──
DROP POLICY IF EXISTS "Suppression personnages" ON public.personnages;
CREATE POLICY "Suppression personnages" ON public.personnages FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND ((compte_voit_joueur(joueur_id) AND est_actif = true) OR est_animateur_ou_admin())
  );
