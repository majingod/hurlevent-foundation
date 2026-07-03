-- Recherche globale 14 catégories (PR3b-5a) — index plein-texte sur les 8 tables manquantes.
-- Colonnes générées STORED (auto-maintenues) + index GIN. Idempotent (IF NOT EXISTS).

ALTER TABLE races ADD COLUMN IF NOT EXISTS recherche_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(nom,'')), 'A') ||
    setweight(to_tsvector('french', coalesce(description,'') || ' ' || coalesce(description_courte,'')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_races_recherche_tsv ON races USING gin(recherche_tsv);

ALTER TABLE traits_raciaux ADD COLUMN IF NOT EXISTS recherche_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(nom,'')), 'A') ||
    setweight(to_tsvector('french', coalesce(description,'')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_traits_raciaux_recherche_tsv ON traits_raciaux USING gin(recherche_tsv);

ALTER TABLE classes ADD COLUMN IF NOT EXISTS recherche_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(nom,'')), 'A') ||
    setweight(to_tsvector('french', coalesce(description,'')), 'B') ||
    setweight(to_tsvector('french', coalesce(role_combat,'')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_classes_recherche_tsv ON classes USING gin(recherche_tsv);

ALTER TABLE objets_forge ADD COLUMN IF NOT EXISTS recherche_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(nom,'')), 'A') ||
    setweight(to_tsvector('french', coalesce(description,'') || ' ' || coalesce(effet,'')), 'B') ||
    setweight(to_tsvector('french', coalesce(type,'')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_objets_forge_recherche_tsv ON objets_forge USING gin(recherche_tsv);

ALTER TABLE objets_joaillerie ADD COLUMN IF NOT EXISTS recherche_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(nom,'')), 'A') ||
    setweight(to_tsvector('french', coalesce(description,'') || ' ' || coalesce(effet,'')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_objets_joaillerie_recherche_tsv ON objets_joaillerie USING gin(recherche_tsv);

ALTER TABLE recettes_alchimie ADD COLUMN IF NOT EXISTS recherche_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(nom,'')), 'A') ||
    setweight(to_tsvector('french', coalesce(description,'') || ' ' || coalesce(effet,'')), 'B') ||
    setweight(to_tsvector('french', coalesce(formule,'')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_recettes_alchimie_recherche_tsv ON recettes_alchimie USING gin(recherche_tsv);

ALTER TABLE assemblages_runes ADD COLUMN IF NOT EXISTS recherche_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(nom,'')), 'A') ||
    setweight(to_tsvector('french', coalesce(description,'') || ' ' || coalesce(effet,'')), 'B') ||
    setweight(to_tsvector('french', coalesce(cible,'')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_assemblages_runes_recherche_tsv ON assemblages_runes USING gin(recherche_tsv);

ALTER TABLE pieges ADD COLUMN IF NOT EXISTS recherche_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(nom,'')), 'A') ||
    setweight(to_tsvector('french', coalesce(effets,'') || ' ' || coalesce(effet_generique,'')), 'B') ||
    setweight(to_tsvector('french', coalesce(type_piege,'') || ' ' || coalesce(cible,'')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_pieges_recherche_tsv ON pieges USING gin(recherche_tsv);
