-- Schémas FICHES artisanat (4) alignés sur la forme du schéma `sorts`.
-- Catégories PAS encore au moteur → cet apply n'affecte AUCUNE surface live (pas de fenêtre brute C8).
-- Render artisanat : chips (runes) · paliers (recettes commun/rare) · bloc_maitrise (maîtrise niv 3).
-- Idempotent : upsert par categorie.

INSERT INTO fiches_schemas (categorie, champs) VALUES
('forge', $j$[
  {"cle":"lore","type":"texte","label":"Description","c":{"source":"col:description"},"v":{"source":"col:description"}},
  {"cle":"fabrication","type":"mecanique","render":"paliers","label":"Fabrication","paliers":[
    {"tier":"Métaux communs","verrou":"Forge 1","temps":"col:temps_fabrication_minutes","recette":"col:materiaux_communs"},
    {"tier":"Métaux rares","verrou":"Forge 2","temps":"col:temps_fabrication_minutes","recette":"col:materiaux_rares"}
  ]}
]$j$::jsonb),
('joaillerie', $j$[
  {"cle":"lore","type":"texte","label":"Description","c":{"source":"col:description"},"v":{"source":"col:description"}},
  {"cle":"effet","type":"mecanique","icone":"✨","label":"Effet","source":"col:effet"},
  {"cle":"fabrication","type":"mecanique","render":"paliers","label":"Fabrication","paliers":[
    {"tier":"Métaux communs","verrou":"Joaillerie 1","temps":"col:temps_fabrication_minutes","recette":"col:materiaux_communs"},
    {"tier":"Métaux rares","verrou":"Joaillerie 2","temps":"col:temps_rare_minutes","recette":"col:materiaux_rares"}
  ]}
]$j$::jsonb),
('assemblages', $j$[
  {"cle":"lore","type":"texte","label":"Description","c":{"source":"col:resume_condense"},"v":{"source":"col:texte_manuel"}},
  {"cle":"runes","type":"mecanique","render":"chips","label":"Runes requises","source":"col:runes_requises"},
  {"cle":"cible","type":"mecanique","icone":"🎯","label":"Cible","source":"col:cible"},
  {"cle":"duree","type":"mecanique","icone":"⏳","label":"Durée","source":"col:duree"},
  {"cle":"cout_xp","type":"mecanique","icone":"📜","label":"Apprentissage","source":"col:cout_xp","suffixe":"XP"},
  {"cle":"cout_ps","type":"mecanique","icone":"✨","label":"Activation","source":"col:cout_ps","suffixe":"PS"},
  {"cle":"maitrise","type":"mecanique","render":"bloc_maitrise","label":"Maîtrise","badge":"Niveau 3","source":"col:effet_maitrise","source_cout":"col:cout_ps_maitrise","suffixe_cout":"PS"}
]$j$::jsonb),
('reparation', $j$[
  {"cle":"temps_commun","type":"mecanique","icone":"⏱️","label":"Temps (commun)","source":"col:temps_minutes","suffixe":"min"},
  {"cle":"temps_rare","type":"mecanique","icone":"⏱️","label":"Temps (rare)","source":"col:temps_rare_minutes","suffixe":"min"},
  {"cle":"mat_communs","type":"mecanique","icone":"🔩","label":"Matériaux communs","source":"col:materiaux"},
  {"cle":"mat_rares","type":"mecanique","icone":"💎","label":"Matériaux rares","source":"col:materiaux_rares"},
  {"cle":"notes","type":"texte","label":"Notes","c":{"source":"col:notes"},"v":{"source":"col:notes"}}
]$j$::jsonb)
ON CONFLICT (categorie) DO UPDATE
  SET champs = EXCLUDED.champs, mis_a_jour = now();
