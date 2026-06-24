-- Schéma d'affichage de la catégorie « sorts » pour FicheMoteur (FICHES Phase 3, étape 3, s270).
-- Idempotent : upsert sur la PK `categorie`. Aucune donnée de personnage touchée (config d'affichage encyclopédie).
-- lore = texte basculé (c=abrégé / v=intégral) ; le reste = mécaniques (jamais touchées par le toggle).
INSERT INTO fiches_schemas (categorie, champs)
VALUES (
  'sorts',
  $champs$[
    {"cle":"lore","type":"texte","label":"Description","c":{"source":"col:resume_condense"},"v":{"source":"col:description"}},
    {"cle":"niveau","type":"mecanique","icone":"📈","label":"Niveau d'apprentissage","source":"col:niveau"},
    {"cle":"type_sort","type":"mecanique","icone":"✴️","label":"Type","source":"col:type_sort"},
    {"cle":"zone_effet","type":"mecanique","icone":"🎯","label":"Cibles / zone","source":"col:zone_effet"},
    {"cle":"portee","type":"mecanique","icone":"📏","label":"Portée","source":"col:portee"},
    {"cle":"duree","type":"mecanique","icone":"⏳","label":"Durée","source":"col:duree"},
    {"cle":"cout_xp_base","type":"mecanique","icone":"🎓","label":"Coût","source":"col:cout_xp_base","suffixe":"XP"}
  ]$champs$::jsonb
)
ON CONFLICT (categorie) DO UPDATE SET champs = EXCLUDED.champs, mis_a_jour = now();
