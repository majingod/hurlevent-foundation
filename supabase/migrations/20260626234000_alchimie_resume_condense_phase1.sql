-- Phase 1 EXPAND : abrégés des 40 recettes d'alchimie (resume_condense)
-- Idempotent, rejouable à froid. Zéro impact live (le front lit encore description).

-- 1) Promotion : abrégé = description pour les 40 recettes
UPDATE public.recettes_alchimie
SET resume_condense = description;

-- 2) ① Potion de peau d'écorce : ajoute la nuance feu (non bloqué, +1 dégât)
UPDATE public.recettes_alchimie
SET resume_condense = $abr$Résiste à 1 attaque non magique ; le feu n'est pas bloqué et inflige +1 dégât.$abr$
WHERE id = 'ce222cb6-3405-4be1-92d4-16fcc3e3eb6e';

-- 3) ② Potion de souffle draconique : précise la zone (toutes les cibles, devant)
UPDATE public.recettes_alchimie
SET resume_condense = $abr$Dans les 15 min, 4 dégâts de feu à toutes les cibles à 10 pieds devant ; subit 2 dégâts.$abr$
WHERE id = '7d1dccda-01f9-422f-af60-b59e82f6742d';
