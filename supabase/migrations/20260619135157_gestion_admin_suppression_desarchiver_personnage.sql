CREATE OR REPLACE FUNCTION public.desarchiver_personnage(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_personnage RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
  END IF;

  SELECT id, nom, joueur_id INTO v_personnage FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable');
  END IF;

  UPDATE public.personnages SET est_actif = true WHERE id = p_personnage_id;

  PERFORM public.creer_notification(
    p_message := format('Votre personnage « %s » a été réactivé.', COALESCE(v_personnage.nom, 'Sans nom')),
    p_profil_id := v_personnage.joueur_id);

  PERFORM public.log_audit('personnage', p_personnage_id, 'desarchiver',
    jsonb_build_object('nom', COALESCE(v_personnage.nom, 'Sans nom')));

  RETURN jsonb_build_object('succes', true);
END;
$$;
