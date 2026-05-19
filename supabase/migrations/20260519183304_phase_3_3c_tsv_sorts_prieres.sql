-- Phase 3.3c : étendre la recherche encyclopédie aux tables sorts et prieres
-- Pattern : colonne generated tsvector + index GIN
-- (réplique du pattern Migration 39 pour bestiaire/religions/competences)

-- sorts : nom (A), cercle (B), type_sort (B), description (C)
ALTER TABLE sorts ADD COLUMN IF NOT EXISTS recherche_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(nom, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(cercle, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(type_sort, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(description, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS sorts_recherche_tsv_idx
  ON sorts USING GIN (recherche_tsv);

-- prieres : nom (A), domaine (B), type_priere (B), description (C)
ALTER TABLE prieres ADD COLUMN IF NOT EXISTS recherche_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(nom, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(domaine, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(type_priere, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(description, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS prieres_recherche_tsv_idx
  ON prieres USING GIN (recherche_tsv);
