-- Retire le markdown gras ** parasite des descriptions de niveaux (affiché brut en encyclo, absent du manuel).
-- Idempotent : ne cible que les lignes contenant '**' ; relancer = 0 ligne.
UPDATE competences
SET niveaux = replace(niveaux::text, '**', '')::jsonb
WHERE niveaux::text LIKE '%**%';
