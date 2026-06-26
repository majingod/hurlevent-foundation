-- Pièges : rayon structuré en colonne (remplace le parse de cible côté encyclopédie). cible reste intacte (consommée par wizard/fiche/imprimable).
ALTER TABLE public.pieges ADD COLUMN IF NOT EXISTS rayon integer;

UPDATE public.pieges SET rayon=3 WHERE nom='Confusion sanguine' AND niveau=1;
UPDATE public.pieges SET rayon=4 WHERE nom='Confusion sanguine' AND niveau=2;
UPDATE public.pieges SET rayon=6 WHERE nom='Confusion sanguine' AND niveau=3;

UPDATE public.pieges SET rayon=3 WHERE nom='Fumée toxique' AND niveau=1;
UPDATE public.pieges SET rayon=4 WHERE nom='Fumée toxique' AND niveau=2;
UPDATE public.pieges SET rayon=6 WHERE nom='Fumée toxique' AND niveau=3;
