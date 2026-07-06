UPDATE fiches_schemas
SET champs_v2 = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'cle' = 'prerequis'
      THEN elem
           || jsonb_build_object('source', 'col:prerequis_labels')
           || jsonb_build_object('relation', jsonb_build_object('forme', 'par_niveau', 'denormalise', 'label'))
      ELSE elem
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(champs_v2) WITH ORDINALITY AS t(elem, ord)
)
WHERE categorie = 'competences';
