-- 15 abrégés assemblages : resume_condense = effet de BASE seul (maîtrise exclue).
-- Source = texte_manuel, 5 rôles éditoriaux, sans-perte. Idempotent (ancré sur nom).
UPDATE assemblages_runes a SET resume_condense = v.txt
FROM (VALUES
  ('Assemblage de barrière magique', $a$Confère à la cible +2 niveaux de résistance aux sorts.$a$),
  ('Assemblage de durabilité', $a$Rend la cible indestructible.$a$),
  ('Assemblage de liberté', $a$Protège la cible contre les effets de paralysie et d'enchevêtrement.$a$),
  ('Assemblage de préservation', $a$Annule le prochain coup de grâce subi puis prend fin ; le porteur reste alors inconscient 10 minutes et inguérissable, même par magie.$a$),
  ('Assemblage de productivité', $a$Réduit de moitié les temps de production, de réparation et de renforcement du forgeron qui manie l'objet enchanté.$a$),
  ('Assemblage de protection contre les éléments', $a$Accorde 1 de réduction de dégâts contre le feu, la glace, l'acide, l'électricité et le vent.$a$),
  ('Assemblage de protection du mal', $a$Accorde +2 pour résister aux sorts de magie noire (Nothogh) et de nécromancie (Thork), et 1 de résistance à leurs dégâts (drain-life, énergie négative).$a$),
  ('Assemblage de régénération', $a$La cible récupère 1 point de vie supplémentaire à chaque guérison reçue.$a$),
  ('Assemblage de repos en paix', $a$Empêche la cible d'être transformée en mort-vivant (ne protège pas contre la possession).$a$),
  ('Assemblage de résilience', $a$Octroie 1 point de vie temporaire, guérissable normalement tant que l'effet dure.$a$),
  ('Assemblage de rigidité', $a$Ajoute 1 point d'armure à l'armure ciblée (réparable normalement, perdu à la fin de l'effet).$a$),
  ('Assemblage de santé', $a$Protège contre un poison ou une maladie de niveau mineur ou intermédiaire, puis se dissipe après avoir résisté.$a$),
  ('Assemblage de vision pure', $a$Révèle l'aura magique des objets touchés (simple détection, comme un sort à effet de niveau égal au joueur) et accorde +2 de résistance aux sorts d'illusion (Guerben).$a$),
  ('Assemblage du bâtisseur', $a$Augmente de 1 le nombre de combats maximal de l'armure ; à la fin, sa prochaine réparation coûte 2 pépites de plus par matériau.$a$),
  ('Assemblage du passage', $a$Rend la cible intangible en la faisant passer dans le plan éthéré.$a$)
) AS v(nom, txt)
WHERE a.nom = v.nom AND a.resume_condense IS DISTINCT FROM v.txt;
