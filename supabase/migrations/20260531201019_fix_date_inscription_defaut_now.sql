-- date_inscription n'avait aucun défaut : restait NULL à l'inscription (oubli, session 56).
-- date_confirmation (posée par changer_statut_inscription) n'est pas concernée.
ALTER TABLE public.inscriptions_evenements
  ALTER COLUMN date_inscription SET DEFAULT now();

-- Backfill des lignes existantes sans date_inscription (proxy : updated_at).
UPDATE public.inscriptions_evenements
   SET date_inscription = COALESCE(date_inscription, updated_at)
 WHERE date_inscription IS NULL;
