-- Lot 1c — centralisation notifs : schéma B (compte-wide) + schéma C (fan-out staff)
-- Refactor NEUTRE : remplace les blocs INSERT inline par les helpers communs.
-- B (changer_role_compte) : creer_notification(..., p_compte_id) sans p_profil_id.
-- C (creer_demande_race) : creer_notification_staff(...) au lieu du fan-out manuel.
-- Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.changer_role_compte(p_compte_id uuid, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ancien text;
  v_nom    text;
BEGIN
  IF NOT public.est_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','acces_refuse','message','Action réservée aux administrateurs.')),
      'avertissements','[]'::jsonb,'donnees',NULL);
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('joueur','animateur','admin') THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','role_invalide','message','Rôle invalide (joueur, animateur ou admin).','champ','role')),
      'avertissements','[]'::jsonb,'donnees',NULL);
  END IF;

  SELECT role, COALESCE(nom_affichage, email) INTO v_ancien, v_nom
  FROM public.profiles WHERE id = p_compte_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','compte_introuvable','message','Compte introuvable.')),
      'avertissements','[]'::jsonb,'donnees',NULL);
  END IF;

  IF v_ancien = p_role THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','role_inchange','message','Le compte a déjà ce rôle.')),
      'avertissements','[]'::jsonb,'donnees',NULL);
  END IF;

  UPDATE public.profiles SET role = p_role WHERE id = p_compte_id;

  PERFORM public.log_audit('compte', p_compte_id, 'changement_role',
    jsonb_build_object('ancien', v_ancien, 'nouveau', p_role, 'nom', v_nom));

  PERFORM public.creer_notification(
    p_message  := format('Votre rôle est passé de %s à %s.', v_ancien, p_role),
    p_compte_id := p_compte_id);

  RETURN jsonb_build_object('succes', true, 'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('compte_id', p_compte_id, 'ancien', v_ancien, 'nouveau', p_role));
END;
$function$;

CREATE OR REPLACE FUNCTION public.creer_demande_race(p_personnage_id uuid, p_background text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_personnage RECORD;
  v_race RECORD;
  v_demande_id uuid;
BEGIN
  SELECT * INTO v_personnage FROM public.personnages WHERE id = p_personnage_id;
  IF v_personnage IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Personnage introuvable');
  END IF;

  IF NOT public.peut_editer_personnage(v_personnage.joueur_id) THEN
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

  -- Plus de longueur minimale : background issu de l historique (peut etre vide -> NULL)
  INSERT INTO public.personnage_races_demandes (personnage_id, race_id, background)
  VALUES (p_personnage_id, v_personnage.race_id, NULLIF(trim(COALESCE(p_background, '')), ''))
  RETURNING id INTO v_demande_id;

  PERFORM public.creer_notification_staff(
    p_message      := format('📋 Nouvelle demande de race : "%s" pour le personnage "%s"',
                             v_race.nom, v_personnage.nom),
    p_type         := 'demande_race_nouvelle',
    p_reference_id := v_demande_id);

  PERFORM public.log_audit('personnage', p_personnage_id, 'creer_demande_race', jsonb_build_object('race_id', v_personnage.race_id, 'demande_id', v_demande_id));
  RETURN jsonb_build_object(
    'succes', true,
    'message', 'Demande créée. Les administrateurs vont l''examiner.',
    'demande_id', v_demande_id
  );
END;
$function$;
