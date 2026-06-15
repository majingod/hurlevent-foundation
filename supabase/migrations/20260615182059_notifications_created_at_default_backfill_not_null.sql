-- Fiabilise notifications.created_at (était NULL partout, sans default, type sans fuseau)
-- 1. Aligner le type sur updated_at (timestamptz). Colonne actuellement NULL → USING sans effet.
ALTER TABLE public.notifications
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- 2. Default pour tous les futurs inserts
ALTER TABLE public.notifications
  ALTER COLUMN created_at SET DEFAULT now();

-- 3. Backfill depuis updated_at (toujours rempli) — idempotent
UPDATE public.notifications
  SET created_at = updated_at
  WHERE created_at IS NULL;

-- 4. Garantir l'invariant pour le tri par date
ALTER TABLE public.notifications
  ALTER COLUMN created_at SET NOT NULL;
