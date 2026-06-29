-- s289 — Bestiaire : abrégés (resume_condense) + toggle « Texte du manuel » (2 portes).
-- EXPAND : ADD COLUMN IF NOT EXISTS. description = intégral inchangé. Régime 1 phrase.

-- 1) EXPAND
ALTER TABLE public.bestiaire ADD COLUMN IF NOT EXISTS resume_condense text;

-- 2) SEED des 6 abrégés
UPDATE public.bestiaire AS b SET resume_condense = v.abr
FROM (VALUES
  ('Blême',                              $a$Mort-vivant conscient et intelligent qui conserve toutes les capacités de son vivant (sorts, points de spiritualité, runes) — le seul mort-vivant capable d'activer des runes.$a$),
  ('Goule',                              $a$Mort-vivant rapide et rusé qui combat avec ses compétences d'armes du vivant, mais a perdu sorts, runes et potions.$a$),
  ('Règles générales des morts-vivants', $a$Ne subissent qu'1 dégât par coup (sauf sorts à dégâts et coups bénis) et peuvent dévorer un cadavre 10 secondes pour regagner 3 PV.$a$),
  ('Spectre',                            $a$Fantôme intangible et pleinement conscient qui use de ses sorts du vivant ; seules les armes ou sorts à dégâts magiques l'atteignent.$a$),
  ('Squelette',                          $a$Mort-vivant lent qui garde ses compétences d'armes mais aucun sort ni habileté, incapable de courir ou de parler.$a$),
  ('Zombie',                             $a$Mort-vivant très lent, dénué de toute capacité du vivant, obéissant à des ordres simples et incapable de s'exprimer.$a$)
) AS v(nom, abr)
WHERE b.nom = v.nom;

-- 3) PORTE 1 — schéma : Description -> texte + toggle swap (le reste inchangé)
UPDATE public.fiches_schemas
SET champs_v2 = $json$[
  {"cle":"categorie","type":"mecanique","label":"Catégorie","source":"col:categorie"},
  {"cle":"pv","type":"mecanique","label":"Points de vie","source":"col:pv_formule"},
  {"cle":"description","type":"texte","titre":"Description","toggle":"swap","c":{"source":"col:resume_condense"},"v":{"source":"col:description"}},
  {"cle":"capacites","type":"mecanique","titre":"Capacités spéciales","render":"section","source":"col:capacites_speciales","encadre":true},
  {"cle":"immunites","type":"mecanique","titre":"Immunités","render":"section","source":"col:immunites"}
]$json$::jsonb
WHERE categorie = 'bestiaire';

-- 4) PORTE 2 — liste : carte.mode aucun -> swap (active le bouton)
UPDATE public.fiches_listes
SET carte = jsonb_set(carte, '{mode}', '"swap"'::jsonb)
WHERE categorie = 'bestiaire';
