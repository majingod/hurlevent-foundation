-- Lot 1b-1 : migrer 6 RPC (schéma A) vers le helper public.creer_notification.
-- Neutre : la notif produite est identique à l'INSERT inline (dry-run end-to-end OK).
-- Seul change : l'INSERT inline -> PERFORM public.creer_notification(...).

CREATE OR REPLACE FUNCTION public.approuver_maitre_competence(p_personnage_competence_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_pc RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
  END IF;
  SELECT pc.id, pc.personnage_id, pc.statut_maitre, pc.niveau_acquis, p.joueur_id, c.nom AS competence_nom
  INTO v_pc
  FROM personnage_competences pc
  JOIN personnages p ON p.id = pc.personnage_id
  JOIN competences c ON c.id = pc.competence_id
  WHERE pc.id = p_personnage_competence_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes', false, 'raison', 'Compétence introuvable'); END IF;
  IF v_pc.statut_maitre <> 'en_attente' THEN
    RETURN jsonb_build_object('succes', false, 'raison', format('Statut actuel : %s (attendu : en_attente)', v_pc.statut_maitre));
  END IF;
  UPDATE personnage_competences SET statut_maitre = 'approuve' WHERE id = p_personnage_competence_id;
  PERFORM public.creer_notification(
    p_message := format('Votre maître a été approuvé pour %s niveau %s.', v_pc.competence_nom, v_pc.niveau_acquis),
    p_profil_id := v_pc.joueur_id);
  RETURN jsonb_build_object('succes', true, 'competence', v_pc.competence_nom);
END;
$function$;

CREATE OR REPLACE FUNCTION public.refuser_maitre_competence(p_personnage_competence_id uuid, p_raison text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_pc RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé'); END IF;
  SELECT pc.id, pc.personnage_id, pc.statut_maitre, pc.niveau_acquis, p.joueur_id, c.nom AS competence_nom
  INTO v_pc
  FROM personnage_competences pc
  JOIN personnages p ON p.id = pc.personnage_id
  JOIN competences c ON c.id = pc.competence_id
  WHERE pc.id = p_personnage_competence_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes', false, 'raison', 'Compétence introuvable'); END IF;
  IF v_pc.statut_maitre <> 'en_attente' THEN
    RETURN jsonb_build_object('succes', false, 'raison', format('Statut actuel : %s (attendu : en_attente)', v_pc.statut_maitre));
  END IF;
  UPDATE personnage_competences SET statut_maitre = 'refuse' WHERE id = p_personnage_competence_id;
  PERFORM public.creer_notification(
    p_message := format('Votre maître a été refusé pour %s niveau %s.%s',
      v_pc.competence_nom, v_pc.niveau_acquis,
      CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0 THEN ' Raison : ' || p_raison ELSE '' END),
    p_profil_id := v_pc.joueur_id);
  RETURN jsonb_build_object('succes', true, 'competence', v_pc.competence_nom);
END;
$function$;

CREATE OR REPLACE FUNCTION public.archiver_personnage(p_personnage_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_personnage RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé'); END IF;
  SELECT id, nom, joueur_id INTO v_personnage FROM personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable'); END IF;
  UPDATE personnages SET est_actif = false WHERE id = p_personnage_id;
  PERFORM public.creer_notification(
    p_message := format('Votre personnage « %s » a été archivé.', COALESCE(v_personnage.nom, 'Sans nom')),
    p_profil_id := v_personnage.joueur_id);
  RETURN jsonb_build_object('succes', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.verrouiller_personnage(p_personnage_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_personnage RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé'); END IF;
  SELECT id, nom, joueur_id, est_verrouille INTO v_personnage FROM personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable'); END IF;
  UPDATE personnages SET est_verrouille = true WHERE id = p_personnage_id;
  PERFORM public.creer_notification(
    p_message := format('Votre personnage « %s » a été verrouillé par l''équipe d''animation.', COALESCE(v_personnage.nom, 'Sans nom')),
    p_profil_id := v_personnage.joueur_id);
  RETURN jsonb_build_object('succes', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.deverrouiller_personnage(p_personnage_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_personnage RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé'); END IF;
  SELECT id, nom, joueur_id, est_verrouille INTO v_personnage FROM personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable'); END IF;
  UPDATE personnages SET est_verrouille = false WHERE id = p_personnage_id;
  PERFORM public.creer_notification(
    p_message := format('Votre personnage « %s » a été déverrouillé.', COALESCE(v_personnage.nom, 'Sans nom')),
    p_profil_id := v_personnage.joueur_id);
  RETURN jsonb_build_object('succes', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.donner_xp_bonus(p_personnage_id uuid, p_montant integer, p_raison text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_personnage RECORD; v_description text;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé'); END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN RETURN jsonb_build_object('succes', false, 'raison', 'Montant invalide (doit être > 0)'); END IF;
  SELECT id, nom, joueur_id INTO v_personnage FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable'); END IF;
  v_description := CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0 THEN 'Bonus : ' || trim(p_raison) ELSE 'Bonus XP attribué par un animateur/admin' END;
  INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, acteur_id)
  VALUES (p_personnage_id, 'gain_bonus', p_montant, v_description, auth.uid());
  PERFORM public.creer_notification(
    p_message := format('Vous avez reçu %s XP bonus pour « %s ».%s',
      p_montant, COALESCE(v_personnage.nom, 'Sans nom'),
      CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0 THEN ' ' || p_raison ELSE '' END),
    p_profil_id := v_personnage.joueur_id,
    p_reference_id := p_personnage_id);
  RETURN jsonb_build_object('succes', true, 'xp_ajoute', p_montant);
END;
$function$;
