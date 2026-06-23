-- Pilote classe — schéma unifié (source col/json, paire c/v, modèle (a))
-- + seed des 4 resume_condense. Idempotent (UPDATE par PK / id).

-- 1) Schéma classe : modèle unifié, pointeur source, acces_competences retiré
UPDATE fiches_schemas
SET champs = '[
  {"cle":"lore","label":"Description","type":"texte",
   "c":{"source":"col:resume_condense","densite":"E"},
   "v":{"source":"col:description","densite":"D"}},
  {"cle":"pv_depart","label":"Points de vie de départ","type":"mecanique",
   "source":"col:pv_depart","densite":"E"},
  {"cle":"ps_depart","label":"Points de spiritualité de départ","type":"mecanique",
   "source":"col:ps_depart","densite":"E"},
  {"cle":"competences_gratuites","label":"Compétences gratuites","type":"mecanique",
   "source":"col:competences_gratuites","densite":"E","render":"liste_competences"}
]'::jsonb,
    mis_a_jour = now()
WHERE categorie = 'classe';

-- 2) Seed des 4 resume_condense (condensés fidèles du verbatim, ≤20 mots)
UPDATE classes SET resume_condense = 'Spécialiste des armes, il repousse ses limites corporelles et excelle au combat.'        WHERE id = '5c3d5d53-ef2e-4f12-8ff9-dbb6196d4a86';
UPDATE classes SET resume_condense = 'Maître des arts profanes, il puise dans les énergies du monde par l''étude des arcanes.' WHERE id = '528ff121-a173-4b0b-823e-209534152eac';
UPDATE classes SET resume_condense = 'Par sa foi et sa dévotion à un dieu, il sonde le monde visible et l''invisible.'        WHERE id = '15d72f5c-00d7-41a9-bbd7-0ee18676c2fe';
UPDATE classes SET resume_condense = 'Maître de la surprise et des foules : filouterie, meurtre et commerce.'                  WHERE id = '3593c1fc-362b-4b9f-9c38-313f1b6df29c';
