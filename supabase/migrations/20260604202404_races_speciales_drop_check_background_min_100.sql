-- Retrait du minimum de 100 caracteres sur le background des demandes de race
-- speciale (Chimeride, Les Non-Races). Le background provient desormais de
-- personnages.historique, sans longueur minimale (Option B). Idempotent.
ALTER TABLE public.personnage_races_demandes
  DROP CONSTRAINT IF EXISTS personnage_races_demandes_background_check;
