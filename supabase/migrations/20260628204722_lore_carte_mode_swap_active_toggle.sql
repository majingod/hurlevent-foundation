-- s289 — Lore : active le bouton abrégé/intégral en passant carte.mode aucun -> swap.
-- Le schéma fiches_schemas était déjà en toggle:swap ; il manquait fiches_listes.carte.mode
-- (gate du bouton dans EncyclopedieV2 : caché si carte.mode = 'aucun'). Idempotent.
UPDATE public.fiches_listes
SET carte = jsonb_set(carte, '{mode}', '"swap"'::jsonb)
WHERE categorie = 'lore';
