-- PR-C3 (s182) : ajoute description_courte (additif) aux paliers des 4 compétences
-- multiple_avec_choix_par_niveau. Le verbatim `description` est PRÉSERVÉ (lu par
-- l'Encyclopédie via construireVerbatim). Idempotent : le merge `||` réécrit la clé.
WITH courts(nom, niveau, courte) AS (
  VALUES
    ('Acquisition de Cercle', 1, 'Accès aux sorts niv. 1 à 5 d''un cercle au choix. Achetable plusieurs fois (un cercle de plus à chaque achat).'),
    ('Acquisition de Cercle', 2, 'Étend un cercle déjà pratiqué aux sorts niv. 6 à 10. −1 XP par sort de ce cercle déjà possédé.'),
    ('Acquisition de Cercle', 3, 'Étend un cercle déjà pratiqué aux sorts niv. 11 à 20. −1 XP par sort de ce cercle déjà possédé.'),
    ('Acquisition de Domaine', 1, 'Accès aux sorts niv. 1 à 5 d''un domaine au choix. Achetable plusieurs fois (un domaine de plus à chaque achat).'),
    ('Acquisition de Domaine', 2, 'Étend un domaine déjà pratiqué aux sorts niv. 6 à 10. −1 XP par sort de ce domaine déjà possédé.'),
    ('Acquisition de Domaine', 3, 'Étend un domaine déjà pratiqué aux sorts niv. 11 à 20. −1 XP par sort de ce domaine déjà possédé.'),
    ('Connaissances des Créatures', 1, 'Choisis une catégorie de créatures (parmi 12) : créatures communes + document de l''organisation. Achetable plusieurs fois.'),
    ('Connaissances des Créatures', 2, 'Approfondit une catégorie déjà choisie : créatures rares et entités d''exception.'),
    ('Dépeçage', 1, 'Récolte des ressources sur les créatures dont tu possèdes Connaissances des Créatures 1. L''état du corps peut rendre des composantes inutilisables.'),
    ('Dépeçage', 2, 'Récolte exigeant Connaissances des Créatures 2 sur la famille exacte de la créature.')
)
UPDATE competences c
SET niveaux = sub.new_niveaux
FROM (
  SELECT c2.id,
         jsonb_agg(
           n.elem || COALESCE(jsonb_build_object('description_courte', ct.courte), '{}'::jsonb)
           ORDER BY (n.elem->>'niveau')::int
         ) AS new_niveaux
  FROM competences c2
  JOIN jsonb_array_elements(c2.niveaux) WITH ORDINALITY AS n(elem, ord) ON true
  LEFT JOIN courts ct ON ct.nom = c2.nom AND ct.niveau = (n.elem->>'niveau')::int
  WHERE c2.nom IN ('Acquisition de Cercle','Acquisition de Domaine','Connaissances des Créatures','Dépeçage')
  GROUP BY c2.id
) sub
WHERE c.id = sub.id;
