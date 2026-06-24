-- Resync verbatim races : corrections cosmétiques DB -> manuel corrigé 2026.
-- Idempotent : REPLACE de l'ancienne phrase vers la corrigée ; re-jouable sans effet.
-- Aucune mécanique modifiée (f—tes/grammaire uniquement).

-- LORE (colonne description)
UPDATE races SET description = replace(description,
  'tout s les partis impliquées', 'toutes les parties impliquées')
  WHERE nom = 'Humain';

UPDATE races SET description = replace(description,
  'demis-elfes', 'demi-elfes')
  WHERE nom = 'Demi-Elfe';

UPDATE races SET description =
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(description,
    'à travers ses terres impitoyables', 'à travers ces terres impitoyables'),
    'cendre et leur potions', 'cendre et leurs potions'),
    'Les orcs habitants les terres', 'Les orcs habitant les terres'),
    'militaires cruel sans pitié', 'militaires cruels sans pitié'),
    'celles de tout les autres peuples', 'celles de tous les autres peuples'),
    'avec leur nouvelles inventions', 'avec leurs nouvelles inventions'),
    'le plus grand soins', 'le plus grand soin')
  WHERE nom = 'Gobelin';

UPDATE races SET description =
  replace(
  replace(description,
    'qui en ressort en dite de porter', 'qui en ressort est dite porter'),
    'à chaque bijoux ou arme', 'à chaque bijou ou arme')
  WHERE nom = 'Myrvalk';

UPDATE races SET description = replace(description,
  'se sont renfermer au plus profond', 'se sont renfermés au plus profond')
  WHERE nom = 'Haut-Elfe';

-- COSTUME (colonne exigences_costume)
UPDATE races SET exigences_costume = replace(exigences_costume,
  'mauve foncé et de porter des oreilles', 'mauve foncé et porter des oreilles')
  WHERE nom = 'Drow';

UPDATE races SET exigences_costume = replace(exigences_costume,
  'des tâches de naissance', 'des taches de naissance')
  WHERE nom = 'Myrvalk';
