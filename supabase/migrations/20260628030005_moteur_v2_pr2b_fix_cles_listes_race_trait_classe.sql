-- PR2b fix : aligner les clés de fiches_listes sur les clés de schéma v1 (figées car LIVE).
-- race/trait_racial/classe sont singuliers dans fiches_schemas -> idem dans fiches_listes.
-- Idempotent : ne renomme que si la cible n'existe pas déjà.
UPDATE public.fiches_listes SET categorie = 'race'
  WHERE categorie = 'races' AND NOT EXISTS (SELECT 1 FROM public.fiches_listes WHERE categorie = 'race');
UPDATE public.fiches_listes SET categorie = 'trait_racial'
  WHERE categorie = 'traits' AND NOT EXISTS (SELECT 1 FROM public.fiches_listes WHERE categorie = 'trait_racial');
UPDATE public.fiches_listes SET categorie = 'classe'
  WHERE categorie = 'classes' AND NOT EXISTS (SELECT 1 FROM public.fiches_listes WHERE categorie = 'classe');
