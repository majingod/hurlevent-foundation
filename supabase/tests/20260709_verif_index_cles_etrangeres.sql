-- ============================================================================
-- Vérification : plus aucune clé étrangère sans index couvrant.
-- ============================================================================
--
-- À exécuter APRÈS la migration 20260709115531_perf_index_cles_etrangeres.sql :
--   psql "$DATABASE_URL" -f supabase/tests/20260709_verif_index_cles_etrangeres.sql
--
-- Déterministe, sans écriture. Lève une exception si une FK reste non indexée ;
-- affiche « OK — … » sinon.
-- ============================================================================

DO $$
DECLARE
  v_manquantes int;
  v_liste text;
BEGIN
  WITH fk AS (
    SELECT c.conrelid, c.conkey, c.conname
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.contype = 'f' AND n.nspname = 'public'
      AND array_length(c.conkey, 1) = 1
  )
  SELECT count(*),
         string_agg(fk.conname, ', ')
    INTO v_manquantes, v_liste
  FROM fk
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = fk.conrelid
      AND (i.indkey::int2[])[0:0] = fk.conkey::int2[]
  );

  IF v_manquantes <> 0 THEN
    RAISE EXCEPTION 'ECHEC : % clé(s) étrangère(s) encore sans index : %', v_manquantes, v_liste;
  END IF;

  RAISE NOTICE 'OK — toutes les clés étrangères sont désormais indexées.';
END $$;
