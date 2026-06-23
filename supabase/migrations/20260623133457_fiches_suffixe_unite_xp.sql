-- FICHES : suffixe d'unité sur les champs mécaniques numériques nus (lève l'ambiguïté « 10 »/« 60 »).
-- Le moteur apprend `suffixe` (extension additive front). Ici on l'ajoute aux 2 schémas concernés.
-- Idempotent : UPDATE de champs = valeur fixe complète.

-- trait_racial : coût → « XP »
UPDATE fiches_schemas
SET champs = $json$[
  {"cle":"cout","type":"mecanique","icone":"🎓","label":"Coût","source":"col:cout_xp","suffixe":"XP"},
  {"cle":"effet","type":"texte","label":"Effet","c":{"source":"col:resume_condense"},"v":{"source":"col:texte_manuel"}}
]$json$::jsonb,
    mis_a_jour = now()
WHERE categorie = 'trait_racial';

-- race : xp_depart → « XP » (esperance_vie laissée telle quelle = texte déjà unité)
UPDATE fiches_schemas
SET champs = $json$[
  {"cle":"lore","type":"texte","label":"Description","c":{"source":"col:resume_condense"},"v":{"source":"col:description"}},
  {"cle":"xp_depart","type":"mecanique","icone":"✨","label":"XP de départ","source":"col:xp_depart","suffixe":"XP"},
  {"cle":"esperance_vie","type":"mecanique","icone":"🕰️","label":"Espérance de vie","source":"col:esperance_vie"},
  {"cle":"nb_traits_raciaux","type":"mecanique","icone":"🎁","label":"Trait racial offert","source":"col:nb_traits_raciaux"},
  {"cle":"traits_permis","type":"mecanique","label":"Traits raciaux permis","render":"liste_traits","source":"col:traits_permis"},
  {"cle":"exigences_costume","type":"texte","titre":"Exigences de costume","c":{"source":"col:exigences_costume"},"v":{"source":"col:exigences_costume"}}
]$json$::jsonb,
    mis_a_jour = now()
WHERE categorie = 'race';
