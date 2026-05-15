CREATE OR REPLACE FUNCTION public.avancer_etape(
  p_personnage_id uuid,
  p_etape_courante integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;
