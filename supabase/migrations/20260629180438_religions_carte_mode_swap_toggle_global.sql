-- Religions — Moteur V2 (PR3a, version B)
-- Active le toggle global Abrégé/Intégral sur religions (carte.mode = swap).
-- Le manuel (verbatim) suit alors le mode global au lieu d'un bouton interne.
-- Idempotent : jsonb_set vers valeur fixe, rejouable à froid.

UPDATE fiches_listes
SET carte = jsonb_set(carte, '{mode}', '"swap"')
WHERE categorie = 'religions';
