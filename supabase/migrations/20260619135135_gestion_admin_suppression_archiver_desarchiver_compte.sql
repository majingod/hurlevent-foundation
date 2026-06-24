CREATE OR REPLACE FUNCTION public.archiver_compte(p_compte_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_compte RECORD;
  v_nb_profils int := 0;
  v_nb_persos  int := 0;
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
   WHERE joueur_id IN (SELECT id FROM public.profils_joueur WHERE compte_id = p_compte_id)
     AND est_actif = true;
  GET DIAGNOSTICS v_nb_persos = ROW_COUNT;

  UPDATE public.profils_joueur SET est_actif = false
   WHERE compte_id = p_compte_id AND est_actif = true;
  GET DIAGNOSTICS v_nb_profils = ROW_COUNT;

  UPDATE public.profiles SET is_active = false WHERE id = p_compte_id;

  UPDATE auth.users SET banned_until = '2999-12-31 23:59:59+00'::timestamptz
   WHERE id = p_compte_id;

  PERFORM public.log_audit('compte', p_compte_id, 'archiver',
    jsonb_build_object('libelle', v_compte.libelle, 'nb_profils', v_nb_profils, 'nb_persos', v_nb_persos));

  RETURN jsonb_build_object('succes', true, 'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('compte_id', p_compte_id, 'nb_profils', v_nb_profils, 'nb_persos', v_nb_persos));
END;
$$;

CREATE OR REPLACE FUNCTION public.desarchiver_compte(p_compte_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_compte RECORD;
  v_nb_profils int := 0;
  v_nb_persos  int := 0;
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
   WHERE joueur_id IN (SELECT id FROM public.profils_joueur WHERE compte_id = p_compte_id)
     AND est_actif = false;
  GET DIAGNOSTICS v_nb_persos = ROW_COUNT;

  UPDATE public.profils_joueur SET est_actif = true
   WHERE compte_id = p_compte_id AND est_actif = false;
  GET DIAGNOSTICS v_nb_profils = ROW_COUNT;

  UPDATE public.profiles SET is_active = true WHERE id = p_compte_id;

  UPDATE auth.users SET banned_until = NULL WHERE id = p_compte_id;

  PERFORM public.log_audit('compte', p_compte_id, 'desarchiver',
    jsonb_build_object('libelle', v_compte.libelle, 'nb_profils', v_nb_profils, 'nb_persos', v_nb_persos));

  RETURN jsonb_build_object('succes', true, 'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('compte_id', p_compte_id, 'nb_profils', v_nb_profils, 'nb_persos', v_nb_persos));
END;
$$;
