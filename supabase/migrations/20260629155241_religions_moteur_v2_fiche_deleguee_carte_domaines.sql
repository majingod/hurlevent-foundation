-- Religions — Moteur V2 (PR3a)
-- Fiche déléguée à ReligionDetails (render:"religion") + domaines en V3 sur la carte.
-- N'affecte QUE le moteur v2 / admin v2 : le LIVE religions lit la table custom, pas champs_v2.
-- Idempotent : UPDATE vers valeurs fixes, rejouable à froid.

UPDATE fiches_schemas
SET champs_v2 = '[
  { "cle": "religion", "type": "mecanique", "render": "religion" }
]'::jsonb
WHERE categorie = 'religions';

UPDATE fiches_listes
SET carte = jsonb_build_object(
  'mode', 'aucun',
  'titre', 'nom',
  'sousTitre', 'description',
  'metaLignes', jsonb_build_array(
    jsonb_build_object('label', 'Domaines de prédilection', 'source', 'domaines_principaux', 'couleur', 'vert'),
    jsonb_build_object('label', 'Domaines proscrits',        'source', 'domaines_proscrits',  'couleur', 'rouge')
  )
)
WHERE categorie = 'religions';
