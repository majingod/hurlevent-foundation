-- Phase 1a — Fiches condensées : structure + seed du schéma pilote (classe)
-- Additif, non-breaking. Aucune vue touchée, aucun DROP.

-- 1) Colonnes porteuses de fiches sur les 11 tables
ALTER TABLE races             ADD COLUMN IF NOT EXISTS resume_condense text, ADD COLUMN IF NOT EXISTS fiche_condensee jsonb;
ALTER TABLE classes           ADD COLUMN IF NOT EXISTS resume_condense text, ADD COLUMN IF NOT EXISTS fiche_condensee jsonb;
ALTER TABLE competences       ADD COLUMN IF NOT EXISTS resume_condense text, ADD COLUMN IF NOT EXISTS fiche_condensee jsonb;
ALTER TABLE sorts             ADD COLUMN IF NOT EXISTS resume_condense text, ADD COLUMN IF NOT EXISTS fiche_condensee jsonb;
ALTER TABLE prieres           ADD COLUMN IF NOT EXISTS resume_condense text, ADD COLUMN IF NOT EXISTS fiche_condensee jsonb;
ALTER TABLE traits_raciaux    ADD COLUMN IF NOT EXISTS resume_condense text, ADD COLUMN IF NOT EXISTS fiche_condensee jsonb;
ALTER TABLE assemblages_runes ADD COLUMN IF NOT EXISTS resume_condense text, ADD COLUMN IF NOT EXISTS fiche_condensee jsonb;
ALTER TABLE recettes_alchimie ADD COLUMN IF NOT EXISTS resume_condense text, ADD COLUMN IF NOT EXISTS fiche_condensee jsonb;
ALTER TABLE pieges            ADD COLUMN IF NOT EXISTS resume_condense text, ADD COLUMN IF NOT EXISTS fiche_condensee jsonb;
ALTER TABLE objets_forge      ADD COLUMN IF NOT EXISTS resume_condense text, ADD COLUMN IF NOT EXISTS fiche_condensee jsonb;
ALTER TABLE objets_joaillerie ADD COLUMN IF NOT EXISTS resume_condense text, ADD COLUMN IF NOT EXISTS fiche_condensee jsonb;

-- 2) Table de schémas (1 ligne par catégorie) — version machine des BLOCS FORMAT
CREATE TABLE IF NOT EXISTS fiches_schemas (
  categorie   text PRIMARY KEY,
  champs      jsonb NOT NULL,
  mis_a_jour  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fiches_schemas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiches_schemas_lecture_publique ON fiches_schemas;
CREATE POLICY fiches_schemas_lecture_publique ON fiches_schemas
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS fiches_schemas_ecriture_admin ON fiches_schemas;
CREATE POLICY fiches_schemas_ecriture_admin ON fiches_schemas
  FOR ALL TO public USING (est_animateur_ou_admin());

-- 3) Seed du schéma PILOTE : classe
INSERT INTO fiches_schemas (categorie, champs) VALUES
('classe', '[
  {"cle":"pv_depart","label":"Points de vie de départ","densite":"E","verbatim_bound":false},
  {"cle":"ps_depart","label":"Points de spiritualité de départ","densite":"E","verbatim_bound":false},
  {"cle":"competences_gratuites","label":"Compétences gratuites reçues","densite":"E","verbatim_bound":false},
  {"cle":"acces_competences","label":"Accès aux compétences (multiclassage)","densite":"R","verbatim_bound":false},
  {"cle":"archetypes","label":"Archétypes / concepts","densite":"D","verbatim_bound":false},
  {"cle":"notes","label":"Notes","densite":"D","verbatim_bound":false}
]'::jsonb)
ON CONFLICT (categorie) DO NOTHING;
