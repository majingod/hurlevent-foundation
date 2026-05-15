-- Migration 30 : fix demarrer_creation_personnage
--
-- Items résolus de hurlevent_dette_technique.md :
--   #13 : la détection brouillon ne filtrait pas etape_creation, donc un
--         personnage finalisé non verrouillé (cas pré-lancement) bloquait
--         la création d'un nouveau perso comme s'il s'agissait d'un brouillon.
--   #14 : le payload de retour brouillon_existant ne contenait que
--         personnage_id, jamais etape_creation. Le wizard V2 repartait
--         visuellement à l'étape 1 au lieu de la dernière étape sauvegardée.
--
-- Le frontend V2 (PersonnageNouveauV2.tsx) lit déjà
-- payload.donnees?.etape_creation avec un fallback à 1 — aucune modification
-- frontend nécessaire.

CREATE OR REPLACE FUNCTION public.demarrer_creation_personnage()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
