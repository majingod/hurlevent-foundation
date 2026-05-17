-- Fix data : renommer la clé "cout" en "cout_xp" dans competences.niveaux
-- Affecte 10 compétences (9 guerrier + 1 generale) où l'ancienne clé "cout" était utilisée
-- Idempotent : ne touche que les lignes qui ont "cout" sans "cout_xp"

UPDATE competences
SET niveaux = (
  SELECT jsonb_agg(
    CASE
      WHEN (elem ? 'cout') AND NOT (elem ? 'cout_xp')
        THEN (elem - 'cout') || jsonb_build_object('cout_xp', elem->'cout')
      ELSE elem
    END
    ORDER BY (elem->>'niveau')::integer
  )
  FROM jsonb_array_elements(niveaux) elem
)
WHERE est_actif = true
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(niveaux) elem
    WHERE (elem ? 'cout') AND NOT (elem ? 'cout_xp')
  );
