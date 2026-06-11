-- CANALISATION-DOUBLON (s159) : la description niveau 2 de Canalisation (mage)
-- contenait une phrase dupliquée héritée d'une coquille du Manuel 2026
-- (« …et pour recharger un objet magique en point de spiritualité » ×2).
-- Décision Fred s159 : dédoublonner en DB (aucun impact règles).
-- Idempotent : replace() ne modifie rien si le doublon est absent.
UPDATE competences
SET niveaux = (
  SELECT jsonb_agg(
    CASE WHEN (n->>'niveau')::int = 2
      THEN jsonb_set(n, '{description}', to_jsonb(
        replace(n->>'description',
          'et pour recharger un objet magique en point de spiritualité et pour recharger un objet magique en point de spiritualité',
          'et pour recharger un objet magique en point de spiritualité')))
      ELSE n END
    ORDER BY (n->>'niveau')::int)
  FROM jsonb_array_elements(niveaux) n
)
WHERE id = '4c28af19-09f6-47b3-b2e5-3e78805b4dc9';
