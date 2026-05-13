-- ============================================================================
-- Migration 4 — Fix Bug C : xp_total non alimenté lors de l'assignation de race
--
-- Avant : sync_xp_personnage ne se déclenche que via historique_xp. Lors
-- de l'attribution d'une race à un perso (UPDATE personnages.race_id),
-- xp_total reste à 0, ce qui bloque les achats de traits raciaux à l'étape 3
-- (xp_disponible = 0 < 10).
--
-- Après :
--   - Fonction helper recalculer_xp_personnage(uuid) pour centraliser le calcul
--   - sync_xp_personnage refactorisée pour utiliser le helper (DRY)
--   - Nouveau trigger BEFORE INSERT/UPDATE OF race_id ON personnages qui
--     set NEW.xp_total = race.xp_depart + gains historique_xp
--   - Backfill des persos existants
-- ============================================================================

-- 1. Fonction helper réutilisable : calcule (xp_total, xp_depense) d'un perso
CREATE OR REPLACE FUNCTION public.recalculer_xp_personnage(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_xp_initial   integer;
  v_xp_gains     integer;
  v_xp_depenses  integer;
BEGIN
  SELECT COALESCE(r.xp_depart, 0)
    INTO v_xp_initial
  FROM personnages p
  LEFT JOIN races r ON r.id = p.race_id
  WHERE p.id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('xp_total', 0, 'xp_depense', 0);
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN montant > 0 THEN montant  ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN montant < 0 THEN -montant ELSE 0 END), 0)
    INTO v_xp_gains, v_xp_depenses
  FROM historique_xp
  WHERE personnage_id = p_personnage_id;

  RETURN jsonb_build_object(
    'xp_total',   v_xp_initial + v_xp_gains,
    'xp_depense', v_xp_depenses
  );
END;
$function$;

-- 2. Refactor de sync_xp_personnage pour utiliser le helper (DRY)
CREATE OR REPLACE FUNCTION public.sync_xp_personnage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_personnage_id uuid;
  v_calc          jsonb;
BEGIN
  v_personnage_id := COALESCE(NEW.personnage_id, OLD.personnage_id);

  PERFORM 1 FROM public.personnages WHERE id = v_personnage_id;
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_calc := public.recalculer_xp_personnage(v_personnage_id);

  IF (v_calc->>'xp_depense')::integer > (v_calc->>'xp_total')::integer THEN
    RAISE WARNING 'sync_xp_personnage: anomalie pour personnage % — xp_depense=% > xp_total=%',
      v_personnage_id, v_calc->>'xp_depense', v_calc->>'xp_total';
  END IF;

  UPDATE public.personnages
  SET xp_total   = (v_calc->>'xp_total')::integer,
      xp_depense = (v_calc->>'xp_depense')::integer
  WHERE id = v_personnage_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 3. Nouveau trigger : alimente xp_total à l'INSERT ou quand race_id change
CREATE OR REPLACE FUNCTION public.set_xp_initial_on_race_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_xp_depart    integer;
  v_xp_gains     integer;
  v_xp_depenses  integer;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.race_id IS NOT DISTINCT FROM NEW.race_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(r.xp_depart, 0)
    INTO v_xp_depart
  FROM races r
  WHERE r.id = NEW.race_id;

  v_xp_depart := COALESCE(v_xp_depart, 0);

  SELECT
    COALESCE(SUM(CASE WHEN montant > 0 THEN montant  ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN montant < 0 THEN -montant ELSE 0 END), 0)
    INTO v_xp_gains, v_xp_depenses
  FROM historique_xp
  WHERE personnage_id = NEW.id;

  NEW.xp_total   := v_xp_depart + v_xp_gains;
  NEW.xp_depense := v_xp_depenses;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_xp_initial ON public.personnages;
CREATE TRIGGER trg_set_xp_initial
BEFORE INSERT OR UPDATE OF race_id ON public.personnages
FOR EACH ROW
EXECUTE FUNCTION public.set_xp_initial_on_race_change();

-- 4. Backfill des persos existants
DO $$
DECLARE
  r record;
  v_calc jsonb;
BEGIN
  FOR r IN SELECT id FROM public.personnages LOOP
    v_calc := public.recalculer_xp_personnage(r.id);
    UPDATE public.personnages
    SET xp_total   = (v_calc->>'xp_total')::integer,
        xp_depense = (v_calc->>'xp_depense')::integer
    WHERE id = r.id;
  END LOOP;
END $$;
