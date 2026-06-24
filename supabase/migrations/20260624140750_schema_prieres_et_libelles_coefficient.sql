-- FICHES Phase 3 : créer le schéma `prieres` + corriger les libellés du schéma `sorts`.
-- Libellés alignés sur le manuel corrigé (Niveau minimal · Type de cible · Distance max. · Durée max. · Coefficient).
-- `cout_xp_base` = COEFFICIENT multiplicateur (X0.5..X2), PAS un coût XP → format:"coefficient" (rendu ×1.5), suffixe XP retiré.
-- Idempotent : ON CONFLICT (categorie) DO UPDATE.

INSERT INTO public.fiches_schemas (categorie, champs, mis_a_jour) VALUES
('sorts', $champs$[
  {"cle":"lore","type":"texte","label":"Description","c":{"source":"col:resume_condense"},"v":{"source":"col:description"}},
  {"cle":"niveau","type":"mecanique","icone":"📈","label":"Niveau minimal","source":"col:niveau"},
  {"cle":"type_sort","type":"mecanique","icone":"✴️","label":"Type","source":"col:type_sort"},
  {"cle":"zone_effet","type":"mecanique","icone":"🎯","label":"Type de cible","source":"col:zone_effet"},
  {"cle":"portee","type":"mecanique","icone":"📏","label":"Distance max.","source":"col:portee"},
  {"cle":"duree","type":"mecanique","icone":"⏳","label":"Durée max.","source":"col:duree"},
  {"cle":"cout_xp_base","type":"mecanique","icone":"✖️","label":"Coefficient","source":"col:cout_xp_base","format":"coefficient"}
]$champs$::jsonb, now()),
('prieres', $champs$[
  {"cle":"lore","type":"texte","label":"Description","c":{"source":"col:resume_condense"},"v":{"source":"col:description"}},
  {"cle":"niveau","type":"mecanique","icone":"📈","label":"Niveau minimal","source":"col:niveau"},
  {"cle":"type_priere","type":"mecanique","icone":"✴️","label":"Type","source":"col:type_priere"},
  {"cle":"zone_effet","type":"mecanique","icone":"🎯","label":"Type de cible","source":"col:zone_effet"},
  {"cle":"portee","type":"mecanique","icone":"📏","label":"Distance max.","source":"col:portee"},
  {"cle":"duree","type":"mecanique","icone":"⏳","label":"Durée max.","source":"col:duree"},
  {"cle":"cout_xp_base","type":"mecanique","icone":"✖️","label":"Coefficient","source":"col:cout_xp_base","format":"coefficient"}
]$champs$::jsonb, now())
ON CONFLICT (categorie) DO UPDATE
  SET champs = EXCLUDED.champs, mis_a_jour = now();
