-- s289 — Forge : abrégés = duplicatas de l'intégral (choix Fred, comme joaillerie s288)
--        + resync Arme longue 80-100 -> 80-110 cm (canon manuel corrigé, confirmé Fred s289)
-- Idempotent : replace no-op si déjà 80-110 ; copie rejouable.

-- 1) Resync canon : Arme longue
UPDATE public.objets_forge
SET description = replace(description, '80-100', '80-110')
WHERE nom = 'Arme longue';

-- 2) Abrégés forge = duplicatas (régime mémoire #20 : verbatim déjà <=1 phrase)
UPDATE public.objets_forge
SET resume_condense = description;
