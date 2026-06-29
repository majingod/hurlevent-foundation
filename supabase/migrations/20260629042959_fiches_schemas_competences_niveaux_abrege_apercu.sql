-- Porte moteur (schéma) : l'item du champ niveaux pointe son aperçu abrégé vers description_courte.
-- Le code ItemPeek lira cette clé pour afficher l'aperçu en mode replié. Sans le code, ignoré (pas de régression).
-- Idempotent : jsonb_set réécrit la même valeur.
UPDATE fiches_schemas
SET champs_v2 = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'cle' = 'niveaux'
      THEN jsonb_set(elem, '{item,abrege}', '"description_courte"'::jsonb)
      ELSE elem END
    ORDER BY ord
  )
  FROM jsonb_array_elements(champs_v2) WITH ORDINALITY AS t(elem, ord)
)
WHERE categorie = 'competences';
