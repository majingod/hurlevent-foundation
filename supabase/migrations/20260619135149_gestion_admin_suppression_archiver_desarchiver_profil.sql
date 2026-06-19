CREATE OR REPLACE FUNCTION public.archiver_profil(p_profil_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profil RECORD;
  v_nb_persos int := 0;
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

  UPDATE public.personnages SET est_actif = false
   WHERE joueur_id = p_profil_id AND est_actif = true;
  GET DIAGNOSTICS v_nb_persos = ROW_COUNT;

  UPDATE public.profils_joueur SET est_actif = false WHERE id = p_profil_id;

  PERFORM public.log_audit('profil', p_profil_id, 'archiver',
    jsonb_build_object('nom', v_profil.nom, 'nb_persos', v_nb_persos));

  RETURN jsonb_build_object('succes', true, 'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('profil_id', p_profil_id, 'nb_persos', v_nb_persos));
END;
$$;

CREATE OR REPLACE FUNCTION public.desarchiver_profil(p_profil_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profil RECORD;
  v_nb_persos int := 0;
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

  UPDATE public.personnages SET est_actif = true
   WHERE joueur_id = p_profil_id AND est_actif = false;
  GET DIAGNOSTICS v_nb_persos = ROW_COUNT;

  UPDATE public.profils_joueur SET est_actif = true WHERE id = p_profil_id;

  PERFORM public.log_audit('profil', p_profil_id, 'desarchiver',
    jsonb_build_object('nom', v_profil.nom, 'nb_persos', v_nb_persos));

  RETURN jsonb_build_object('succes', true, 'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('profil_id', p_profil_id, 'nb_persos', v_nb_persos));
END;
$$;
