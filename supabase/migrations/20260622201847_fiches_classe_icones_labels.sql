-- FICHES-CONDENSÉES Phase 3 (préparatif) : ajoute `icone` aux champs mécaniques
-- PV/PS du schéma `classe` et passe leurs labels en casse « terme de jeu ».
-- Idempotent (UPDATE déterministe d'une ligne de seed). Aucune lecture front en prod à ce stade.
UPDATE fiches_schemas
SET champs = '[
  {"cle":"lore","type":"texte","label":"Description","c":{"source":"col:resume_condense","densite":"E"},"v":{"source":"col:description","densite":"D"}},
  {"cle":"pv_depart","type":"mecanique","label":"Points de Vie de départ","icone":"❤️","source":"col:pv_depart","densite":"E"},
  {"cle":"ps_depart","type":"mecanique","label":"Points de Spiritualité de départ","icone":"✨","source":"col:ps_depart","densite":"E"},
  {"cle":"competences_gratuites","type":"mecanique","label":"Compétences gratuites","render":"liste_competences","source":"col:competences_gratuites","densite":"E"}
]'::jsonb,
    mis_a_jour = now()
WHERE categorie = 'classe';
