-- Phase 3.3b : étendre la recherche encyclopédie aux tables bestiaire, religions, competences
-- Pattern : colonne generated tsvector + index GIN (réplique du pattern lore Migration 37)

-- bestiaire : nom (A), categorie (B), description (C), immunites + capacites_speciales (D)
ALTER TABLE bestiaire ADD COLUMN IF NOT EXISTS recherche_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(nom, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(categorie, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('french', coalesce(immunites, '')), 'D') ||
    setweight(to_tsvector('french', coalesce(capacites_speciales, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS bestiaire_recherche_tsv_idx
  ON bestiaire USING GIN (recherche_tsv);

-- religions : nom (A), dirigeant (B), description + description_longue (C), pouvoir_symbole (D)
ALTER TABLE religions ADD COLUMN IF NOT EXISTS recherche_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(nom, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(dirigeant, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('french', coalesce(description_longue, '')), 'C') ||
    setweight(to_tsvector('french', coalesce(pouvoir_symbole, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS religions_recherche_tsv_idx
  ON religions USING GIN (recherche_tsv);

-- competences : nom (A), categorie (B), description (C)
ALTER TABLE competences ADD COLUMN IF NOT EXISTS recherche_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(nom, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(categorie, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(description, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS competences_recherche_tsv_idx
  ON competences USING GIN (recherche_tsv);
