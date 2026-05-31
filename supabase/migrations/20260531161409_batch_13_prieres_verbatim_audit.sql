-- Batch 13 — Audit verbatim des prières (Manuel 2026)
-- 5 omissions : texte du manuel absent en base. Idempotent (garde NOT LIKE).

-- 1. Gardien Dévot — exemple de durée manquant dans le (*)
UPDATE public.prieres
SET description = description || ' (Ex. ce sort au niveau 7 dure 7 minutes, au niveau 8 dure 8 minutes, et ainsi de suite.)'
WHERE nom = 'Gardien Dévot' AND domaine = 'Guerre'
  AND description NOT LIKE '%(Ex. ce sort au niveau 7%';

-- 2. Fureur Divine — même exemple de durée manquant
UPDATE public.prieres
SET description = description || ' (Ex. ce sort au niveau 7 dure 7 minutes, au niveau 8 dure 8 minutes, et ainsi de suite.)'
WHERE nom = 'Fureur Divine' AND domaine = 'Guerre'
  AND description NOT LIKE '%(Ex. ce sort au niveau 7%';

-- 3. Trou de mémoire — exemple du choix d'effet manquant
UPDATE public.prieres
SET description = replace(description,
  'lancer sur votre cible.',
  'lancer sur votre cible. (Ex. : Si vous avez le sort niveau 7, vous pouvez choisir de faire l''effet oubli de formule niveau 7 ou celui oubli les noms niveau 7.)')
WHERE nom = 'Trou de mémoire' AND domaine = 'Chaos'
  AND description NOT LIKE '%oubli de formule niveau 7%';

-- 4. Brasier Vengeur — phrase d'intro des paliers manquante
UPDATE public.prieres
SET description = replace(description,
  'Niv. 6 : 2 dégâts de feu sur un rayon de 5 pieds.',
  E'Les dégâts et la zone d''effet dépendent du niveau du sort :\nNiv. 6 : 2 dégâts de feu sur un rayon de 5 pieds.')
WHERE nom = 'Brasier Vengeur' AND domaine = 'Éléments'
  AND description NOT LIKE '%dépendent du niveau du sort%';

-- 5. Déchaînement Élémentaire — phrase d'intro des paliers manquante
UPDATE public.prieres
SET description = replace(description,
  'Niveau 11 : 4 dégâts.',
  E'Dégâts selon le niveau du sort :\nNiveau 11 : 4 dégâts.')
WHERE nom = 'Déchaînement Élémentaire' AND domaine = 'Éléments'
  AND description NOT LIKE '%Dégâts selon le niveau du sort%';
