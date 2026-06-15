-- Le trigger de recalcul ne se déclenchait pas sur niveau_correction → le niveau restait stale.
-- On ajoute niveau_correction à la liste UPDATE OF.
CREATE OR REPLACE TRIGGER trg_recalculer_xp_complet
  BEFORE INSERT OR UPDATE OF race_id, gn_completes, mini_gn_completes, ouvertures_terrain, niveau_correction
  ON public.personnages
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculer_xp_complet_trigger();
