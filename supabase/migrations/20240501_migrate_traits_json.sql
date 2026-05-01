-- Migration des traits raciaux du format Legacy vers le Nouveau Format
-- Action 2 : Renommer 'id' -> 'trait_id' et 'gratuit' -> 'est_gratuit' dans le JSONB

UPDATE personnages
SET traits_raciaux_choisis = (
    SELECT jsonb_agg(
        jsonb_build_object(
            'trait_id', COALESCE(elem->>'trait_id', elem->>'id'),
            'est_gratuit', COALESCE((elem->>'est_gratuit')::boolean, (elem->>'gratuit')::boolean),
            'xp_depense', COALESCE((elem->>'xp_depense')::int, 0)
        )
    )
    FROM jsonb_array_elements(traits_raciaux_choisis) AS elem
)
WHERE traits_raciaux_choisis IS NOT NULL 
  AND jsonb_array_length(traits_raciaux_choisis) > 0;

-- Commentaire de vérification :
-- SELECT id, traits_raciaux_choisis FROM personnages LIMIT 5;
