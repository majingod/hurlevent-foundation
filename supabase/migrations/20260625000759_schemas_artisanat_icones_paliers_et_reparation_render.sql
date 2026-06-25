-- s279 — Ajoute l'icône (🔩/💎) à chaque palier forge/joaillerie
-- + convertit le schéma `reparation` (champs plats → render `paliers`).
-- Idempotent : UPDATE complet du tableau `champs`. assemblages inchangé.

UPDATE fiches_schemas SET champs = $j$[
  {"cle":"lore","type":"texte","label":"Description","c":{"source":"col:description"},"v":{"source":"col:description"}},
  {"cle":"fabrication","type":"mecanique","render":"paliers","label":"Fabrication","paliers":[
    {"tier":"Métaux communs","verrou":"Forge 1","icone":"🔩","temps":"col:temps_fabrication_minutes","recette":"col:materiaux_communs"},
    {"tier":"Métaux rares","verrou":"Forge 2","icone":"💎","temps":"col:temps_fabrication_minutes","recette":"col:materiaux_rares"}
  ]}
]$j$::jsonb, mis_a_jour=now() WHERE categorie='forge';

UPDATE fiches_schemas SET champs = $j$[
  {"cle":"lore","type":"texte","label":"Description","c":{"source":"col:description"},"v":{"source":"col:description"}},
  {"cle":"effet","type":"mecanique","icone":"✨","label":"Effet","source":"col:effet"},
  {"cle":"fabrication","type":"mecanique","render":"paliers","label":"Fabrication","paliers":[
    {"tier":"Métaux communs","verrou":"Joaillerie 1","icone":"🔩","temps":"col:temps_fabrication_minutes","recette":"col:materiaux_communs"},
    {"tier":"Métaux rares","verrou":"Joaillerie 2","icone":"💎","temps":"col:temps_rare_minutes","recette":"col:materiaux_rares"}
  ]}
]$j$::jsonb, mis_a_jour=now() WHERE categorie='joaillerie';

UPDATE fiches_schemas SET champs = $j$[
  {"cle":"reparation","type":"mecanique","render":"paliers","label":"Réparation","paliers":[
    {"tier":"Métaux communs","verrou":"Forge 1","icone":"🔩","temps":"col:temps_minutes","recette":"col:materiaux"},
    {"tier":"Métaux rares","verrou":"Forge 2","icone":"💎","temps":"col:temps_rare_minutes","recette":"col:materiaux_rares"}
  ]},
  {"cle":"notes","type":"texte","label":"Notes","c":{"source":"col:notes"},"v":{"source":"col:notes"}}
]$j$::jsonb, mis_a_jour=now() WHERE categorie='reparation';
