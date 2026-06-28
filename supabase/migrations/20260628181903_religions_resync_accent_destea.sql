-- s289 — Religions : resync cosmétique Destea -> Destéa (accent manquant, hérité import pré-18-juin)
-- Idempotent : 'Destéa' ne contient pas le substring 'Destea' (é != e) -> jamais de double-accent.
-- recherche_tsv est une colonne générée STORED -> régénération automatique.

UPDATE public.religions SET description_longue = replace(description_longue,'Destea','Destéa') WHERE description_longue ~ 'Destea';

UPDATE public.religions SET lore_fiche = replace(lore_fiche,'Destea','Destéa') WHERE lore_fiche ~ 'Destea';

UPDATE public.religions SET lore_manuel = replace(lore_manuel,'Destea','Destéa') WHERE lore_manuel ~ 'Destea';

UPDATE public.religions SET rituels_fiche = (
  SELECT array_agg(replace(e,'Destea','Destéa') ORDER BY ord)
  FROM unnest(rituels_fiche) WITH ORDINALITY AS t(e,ord)
) WHERE array_to_string(rituels_fiche,' ') ~ 'Destea';

UPDATE public.religions SET rituels_manuel = (
  SELECT array_agg(replace(e,'Destea','Destéa') ORDER BY ord)
  FROM unnest(rituels_manuel) WITH ORDINALITY AS t(e,ord)
) WHERE array_to_string(rituels_manuel,' ') ~ 'Destea';
