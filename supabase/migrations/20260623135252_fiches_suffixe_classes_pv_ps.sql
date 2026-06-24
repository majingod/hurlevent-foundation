-- FICHES : suffixe d'unité sur le schéma classe (pv_depart → « PV », ps_depart → « PS »).
-- Cohérence avec traits (« XP ») et races (« XP »). Préserve le schéma exact + ajoute suffixe.
-- Idempotent : UPDATE de champs = valeur fixe complète.
UPDATE fiches_schemas
SET champs = $json$[
  {"c":{"source":"col:resume_condense","densite":"E"},"v":{"source":"col:description","densite":"D"},"cle":"lore","type":"texte","label":"Description"},
  {"cle":"pv_depart","type":"mecanique","icone":"❤️","label":"Points de Vie de départ","source":"col:pv_depart","densite":"E","suffixe":"PV"},
  {"cle":"ps_depart","type":"mecanique","icone":"✨","label":"Points de Spiritualité de départ","source":"col:ps_depart","densite":"E","suffixe":"PS"},
  {"cle":"competences_gratuites","type":"mecanique","label":"Compétences gratuites","render":"liste_competences","source":"col:competences_gratuites","densite":"E"}
]$json$::jsonb,
    mis_a_jour = now()
WHERE categorie = 'classe';
