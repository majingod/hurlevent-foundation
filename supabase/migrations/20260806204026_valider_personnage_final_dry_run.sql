-- s379 · [CERCLES-SECS-VRAIS-JOUEURS] · decision 51 — volet FINALISATION.
--
-- valider_personnage_final agrege DEJA les avertissements des etapes 1 a 10,
-- mais il VERROUILLE la fiche avant de les rendre : le joueur les lit quand
-- c'est trop tard. On lui ajoute p_dry_run, sur le patron deja en place sur
-- desacheter_competence(uuid, p_dry_run boolean) — une seule fonction, un
-- parametre a defaut, JAMAIS une surcharge (PostgREST refuse l'ambiguite).
--
-- p_dry_run = true : ne verrouille rien, ne journalise rien, rend exactement
-- les memes erreurs et avertissements. C'est ce qui alimente la fenetre de
-- confirmation de l'etape 10.
--
-- Le DEFAULT false protege les telephones qui servent encore l'ancien bundle :
-- ils appellent avec un seul argument, le comportement est inchange.
--
-- ACL mesuree AVANT (proacl) : {postgres=X, service_role=X, authenticated=X}
-- — ni PUBLIC ni anon. DROP + CREATE remet a PUBLIC : on la re-pose a
-- l'identique juste apres.
-- REPLI : rejouer ce fichier avec le corps d'avant (DROP de la version a deux
-- arguments, CREATE de celle a un seul) ; aucun appelant SQL, seul le front
-- l'appelle.

DROP FUNCTION IF EXISTS public.valider_personnage_final(uuid);

CREATE FUNCTION public.valider_personnage_final(p_personnage_id uuid, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
    RETURN jsonb_build_object('valide', false, 'est_verrouille', false, 'dry_run', p_dry_run,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb);
  END IF;
  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('valide', false, 'est_verrouille', v_perso.est_verrouille, 'dry_run', p_dry_run,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_autorise','message','Vous n''êtes pas autorisé à finaliser ce personnage')),
      'avertissements', '[]'::jsonb);
  END IF;
  IF v_perso.est_verrouille = true THEN
    RETURN jsonb_build_object('valide', false, 'est_verrouille', true, 'dry_run', p_dry_run,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_deja_verrouille','message','Ce personnage est déjà verrouillé')),
      'avertissements', '[]'::jsonb);
  END IF;
  FOR v_etape IN 1..10 LOOP
    v_resultat := public.valider_etape(p_personnage_id, v_etape);
    IF (v_resultat->>'valide')::boolean = false THEN
      v_toutes_valides := false;
    END IF;
    v_erreurs := v_erreurs || COALESCE(v_resultat->'erreurs', '[]'::jsonb);
    v_avertissements := v_avertissements || COALESCE(v_resultat->'avertissements', '[]'::jsonb);
  END LOOP;
  IF v_toutes_valides THEN
    IF p_dry_run THEN
      RETURN jsonb_build_object('valide', true, 'est_verrouille', false, 'dry_run', true,
        'erreurs', '[]'::jsonb, 'avertissements', v_avertissements);
    END IF;
    UPDATE public.personnages SET est_verrouille = true, est_finalise = true, etape_creation = 11 WHERE id = p_personnage_id;
    PERFORM public.log_audit('personnage', p_personnage_id, 'valider_personnage_final', '{}'::jsonb);
    RETURN jsonb_build_object('valide', true, 'est_verrouille', true, 'dry_run', false,
      'erreurs', '[]'::jsonb, 'avertissements', v_avertissements);
  END IF;
  RETURN jsonb_build_object('valide', false, 'est_verrouille', false, 'dry_run', p_dry_run,
    'erreurs', v_erreurs, 'avertissements', v_avertissements);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.valider_personnage_final(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valider_personnage_final(uuid, boolean) TO authenticated, service_role;
