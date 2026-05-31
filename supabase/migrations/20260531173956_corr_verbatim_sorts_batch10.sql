-- Tâche A (session 72) : correction verbatim de 5 descriptions de sorts (Batch 10).
-- Ajoute les phrases/exemples manquants ET conserve les corrections de fautes déjà
-- faites par l'app (convention s47). Idempotent : chaque UPDATE est gardé.

-- 1. Altération du Corps : ajouter l'exemple "Poigne Ardente"
UPDATE sorts
SET description = replace(description,
  E'avez choisi un.\n\nNiv. 6 :',
  E'avez choisi un. Ex. Si vous choisissez Poigne Ardente en devenant Demi-Elfe, relancer le sort sur vous ne permet pas de changer de trait racial pour tout l''événement.\n\nNiv. 6 :')
WHERE nom = 'Altération du Corps' AND cercle = 'Altération'
  AND description NOT LIKE '%Poigne Ardente%';

-- 2. Bouclier de Vent : restaurer le texte complet du manuel (remplaçait une version condensée avec "=")
UPDATE sorts
SET description = 'La ou les cibles du sort reçoivent un bouclier énergétique capable d''absorber un nombre de dégâts de foudre équivalent à la moitié du niveau du sort arrondi à l''unité supérieure. Lorsque la durée du sort est atteinte, le sort prend fin automatiquement et le bouclier disparaît.'
WHERE nom = 'Bouclier de Vent' AND cercle = 'Air'
  AND description LIKE '%dégâts de foudre =%';

-- 3. Brasier Vengeur : ajouter la phrase d'intro des paliers
UPDATE sorts
SET description = replace(description,
  E'propre explosion.\n\nNiv. 6 :',
  E'propre explosion.\n\nLes dégâts et la zone d''effet dépendent du niveau du sort :\nNiv. 6 :')
WHERE nom = 'Brasier Vengeur' AND cercle = 'Feu'
  AND description NOT LIKE '%dépendent du niveau du sort%';

-- 4. Inspiration spirituel : ajouter l'exemple de transfert
UPDATE sorts
SET description = replace(description,
  E'à la cible.\n\nLa cible qui reçoit',
  E'à la cible. Exemple : au niveau 6, le sort coûte 5 points de spiritualité. Parmi ceux-ci, 2 points sont transférés à la cible.\n\nLa cible qui reçoit')
WHERE nom = 'Inspiration spirituel' AND cercle = 'Magie Pure'
  AND description NOT LIKE '%Exemple : au niveau 6%';

-- 5. Pluie acide : ajouter la phrase d'intro des paliers (conserve les corrections chair/Détruit/armures)
UPDATE sorts
SET description = replace(description,
  E'ce bonus.\n\nNiv. 11 :',
  E'ce bonus.\n\nDégâts selon le niveau du sort :\nNiv. 11 :')
WHERE nom = 'Pluie acide' AND cercle = 'Terre'
  AND description NOT LIKE '%Dégâts selon le niveau du sort%';
