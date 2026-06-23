-- Dépeçage niveau 2 : MAJ verbatim conforme au manuel à jour (décision Fred s218).
-- L'ancien N2 ("famille exacte / sans cette connaissance précise") est remplacé par
-- le texte parallèle au N1 (gating Connaissances des Créatures 2 + "pas deux fois la
-- même ressource" + état du corps). Label normalisé "Connaissances des Créatures 2"
-- (convention base, comme N1) au lieu de l'ancien "Créatures II". Court réaligné sur N1.
-- Idempotent : UPDATE déterministe, gardé sur (id, niveau index 1 == niveau 2).
UPDATE competences
SET niveaux = jsonb_set(
  jsonb_set(
    niveaux,
    '{1,description}',
    to_jsonb($txt$Le personnage possède les connaissances nécessaires pour récolter efficacement les ressources naturelles des créatures qu'il chasse. En jouant un rôleplay approprié pendant au moins 30 secondes sur une créature tuée, il doit informer le PNJ incarnant la créature qu'il utilise la compétence Dépeçage 2 et préciser la ressource qu'il souhaite récolter. Si la créature peut fournir cette ressource, le PNJ la remet au joueur. Avec Dépeçage 2, le personnage ne peut récolter que les composantes provenant des familles de créatures pour lesquelles il possède la compétence Connaissances des Créatures 2. Il est impossible de récolter une ressource issue d'une famille non connue ou d'un niveau de connaissance supérieur. Il n'est pas possible de récolter deux fois la même ressource sur une même créature. L'état du corps influence également la récolte : une créature brûlée ou lourdement endommagée peut rendre certaines composantes inutilisables (exemple : une fourrure brûlée ne peut pas être récupérée).$txt$::text)
  ),
  '{1,description_courte}',
  to_jsonb($c$Récolte des ressources sur les créatures dont tu possèdes Connaissances des Créatures 2. L'état du corps peut rendre des composantes inutilisables.$c$::text)
)
WHERE id = '82159693-1e88-4a8d-9dca-e6dcc25a4a42'
  AND niveaux->1->>'niveau' = '2';
