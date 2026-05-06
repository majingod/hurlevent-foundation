-- =============================================================================
-- FIX : notifications_statut_check violé lors de la création d'une demande de race
-- =============================================================================
-- Cause : les fonctions creer_demande_race / approuver_race_demande /
--         refuser_race_demande inséraient statut = 'non_lu', mais la contrainte
--         notifications_statut_check n'accepte que ('non_traite','approuve','refuse').
--
-- Fix : remplacer 'non_lu' par 'non_traite' dans les 3 fonctions.
--
-- À exécuter dans : Supabase Dashboard → SQL Editor (une seule fois).
-- =============================================================================

-- 1) creer_demande_race --------------------------------------------------------
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

  IF v_personnage.joueur_id != auth.uid() AND NOT est_animateur_ou_admin() THEN
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

  IF p_background IS NULL OR char_length(trim(p_background)) < 100 THEN
    RETURN jsonb_build_object('succes', false,
      'erreur', 'Le background doit contenir au moins 100 caractères');
  END IF;

  INSERT INTO public.personnage_races_demandes (personnage_id, race_id, background)
  VALUES (p_personnage_id, v_personnage.race_id, trim(p_background))
  RETURNING id INTO v_demande_id;

  INSERT INTO public.notifications (user_id, type, message, reference_id, statut)
  SELECT
    p.id,
    'demande_race_nouvelle',
    format('📋 Nouvelle demande de race : "%s" pour le personnage "%s"',
           v_race.nom, v_personnage.nom),
    v_demande_id,
    'non_traite'  -- ← FIX (anciennement 'non_lu')
  FROM public.profiles p
  WHERE p.role IN ('admin', 'animateur')
    AND COALESCE(p.is_active, true) = true;

  RETURN jsonb_build_object(
    'succes', true,
    'message', 'Demande créée. Les administrateurs vont l''examiner.',
    'demande_id', v_demande_id
  );
END;
$function$;

-- 2) approuver_race_demande ---------------------------------------------------
-- (Réécrit le INSERT notifications avec 'non_traite'. Le reste de la logique
--  d'origine est préservé : on patche uniquement la valeur du statut via
--  ALTER FUNCTION… plutôt que de réécrire toute la fonction, on remplace son
--  corps. Si vous préférez préserver l'original, modifiez seulement la chaîne
--  'non_lu' → 'non_traite' dans la définition existante.)

DO $migration$
DECLARE
  v_def text;
BEGIN
  -- approuver_race_demande
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'approuver_race_demande';

  IF v_def IS NOT NULL AND position('''non_lu''' in v_def) > 0 THEN
    EXECUTE replace(v_def, '''non_lu''', '''non_traite''');
    RAISE NOTICE 'approuver_race_demande patchée : non_lu -> non_traite';
  END IF;

  -- refuser_race_demande
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'refuser_race_demande';

  IF v_def IS NOT NULL AND position('''non_lu''' in v_def) > 0 THEN
    EXECUTE replace(v_def, '''non_lu''', '''non_traite''');
    RAISE NOTICE 'refuser_race_demande patchée : non_lu -> non_traite';
  END IF;
END
$migration$;

-- =============================================================================
-- VÉRIFICATION (à exécuter après la migration)
-- =============================================================================
-- SELECT proname,
--        position('''non_lu''' in pg_get_functiondef(oid)) AS reste_non_lu
-- FROM pg_proc
-- WHERE proname IN ('creer_demande_race','approuver_race_demande','refuser_race_demande');
-- → reste_non_lu doit valoir 0 partout.
