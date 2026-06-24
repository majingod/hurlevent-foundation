-- Abrégés (resume_condense) du domaine Éléments — 15 prières (FICHES Phase 3, étape 2, s272)
-- Idempotent : UPDATE ancré nom+domaine. Source = description (audit C6 clos s271).

UPDATE prieres SET resume_condense = $abr$Inflige à la/les cibles des dégâts de foudre, de 1 au niv. 1 à 8 au niv. 20.$abr$ WHERE nom = 'Appel de la Foudre' AND domaine = 'Éléments';

UPDATE prieres SET resume_condense = $abr$Entoure la/les cibles d'un bouclier qui absorbe, pour un seul élément au choix par cible (feu, glace, foudre ou acide), un nombre de dégâts égal à la moitié du niveau du sort arrondie à l'unité supérieure ; le bouclier disparaît dès ses points épuisés (l'excédent de dégâts passe alors à la cible) ou à l'expiration, et une cible ne peut en porter qu'un à la fois.$abr$ WHERE nom = 'Bouclier Élémentaire' AND domaine = 'Éléments';

UPDATE prieres SET resume_condense = $abr$Inflige à la/les cibles des dégâts de feu béni, de 1 au niv. 1 à 6 au niv. 20, doublés contre les morts-vivants.$abr$ WHERE nom = 'Colonne de Feu Sacré' AND domaine = 'Éléments';

UPDATE prieres SET resume_condense = $abr$Entoure la cible d'une bulle d'air qui bloque les projectiles physiques (flèches, carreaux, armes de lancer — annoncer « Annule » en pointant du doigt, chaque projectile comptant pour une charge) : 1 projectile au niv. 1, puis 2/3/4/5/6 aux niv. 3/9/12/15/18, et tous les projectiles au niv. 20.$abr$ WHERE nom = 'Globe d''Air' AND domaine = 'Éléments';

UPDATE prieres SET resume_condense = $abr$Permet à la/les cibles d'encaisser sans dégâts un certain nombre de coups d'armes conventionnelles non magiques — 1 au niv. 1, puis 2/3/4/5 aux niv. 5/6/11/20 (les coups assommants comptent pour un coup normal) ; bloque aussi la prochaine attaque sournoise mais épuise alors toutes les protections restantes, et rend immunisé à la pétrification de niveau inférieur (annoncer « résiste »).$abr$ WHERE nom = 'Peau de Pierre' AND domaine = 'Éléments';

UPDATE prieres SET resume_condense = $abr$Pétrifie la/les cibles — immobilisées, incapables de bouger, d'être déplacées ou de parler, mais conservant la vue, l'ouïe et l'odorat et insensibles aux blessures — ou les dépétrifie si le sort de pétrification d'origine est de niveau inférieur.$abr$ WHERE nom = 'Pétrification/Dépétrification' AND domaine = 'Éléments';

UPDATE prieres SET resume_condense = $abr$Enchante autant d'armes que de cibles, chacune gagnant l'habileté « Repoussement 5 pieds » (projection vers l'arrière) un certain nombre de fois — 1 au niv. 1, puis 2/3/4/5 aux niv. 5/10/15/20 ; chaque niveau prolonge gratuitement la durée d'une minute.$abr$ WHERE nom = 'Tornade Martiale' AND domaine = 'Éléments';

UPDATE prieres SET resume_condense = $abr$Rend un objet impossible à soulever : automatiquement s'il n'est pas porté, sinon le niveau du sort s'oppose à celui du porteur ; au niv. 11, le sort vise un second objet gratuit, et au niv. 20 le lanceur peut soulever les objets qu'il affecte.$abr$ WHERE nom = 'Augmentation du poids' AND domaine = 'Éléments';

UPDATE prieres SET resume_condense = $abr$Crée autour de la cible un bouclier qui réduit les dégâts du premier effet élémentaire reçu (feu, glace, foudre ou acide) puis se verrouille sur cet élément jusqu'à la fin : réduction de 3 au niv. 6, 4 au niv. 10, 5 au niv. 12, 6 au niv. 15 et 8 au niv. 20.$abr$ WHERE nom = 'Bouclier Adaptatif' AND domaine = 'Éléments';

UPDATE prieres SET resume_condense = $abr$Charge le lanceur d'une énergie incendiaire qui, s'il tombe à 0 point de vie (autrement que volontairement) durant la durée, explose une seule fois en dégâts de feu autour de lui sans le toucher : 2 dégâts sur 5 pieds au niv. 6, puis 3/10, 4/15 et 5/20 (dégâts/rayon en pieds) aux niv. 10, 15 et 20.$abr$ WHERE nom = 'Brasier Vengeur' AND domaine = 'Éléments';

UPDATE prieres SET resume_condense = $abr$Plonge les cibles dans une chaleur ou un froid extrême (à jouer comme un air à 40 ou −40 °C), les empêchant de se concentrer.$abr$ WHERE nom = 'Changement de Température' AND domaine = 'Éléments';

UPDATE prieres SET resume_condense = $abr$Donne à la/les cibles la sensation de se noyer : à terre et suffocantes, incapables de parler, d'attaquer, d'incanter ou d'utiliser des compétences, et seulement capables de se déplacer lentement jusqu'à la fin du sort.$abr$ WHERE nom = 'Noyade' AND domaine = 'Éléments';

UPDATE prieres SET resume_condense = $abr$Dissipe sur la cible tous les sorts élémentaires à effet bénéfique de niveau inférieur ou égal (cercles de l'air, du feu, de l'eau, de la terre ou des éléments du mage, et domaine des éléments du prêtre), sans toucher les effets non élémentaires.$abr$ WHERE nom = 'Rupture élémentaire' AND domaine = 'Éléments';

UPDATE prieres SET resume_condense = $abr$Enflamme la/les cibles : chacune doit aussitôt consacrer une action claire à s'éteindre, sous peine de perdre la moitié de ses points de vie totaux (armure comprise) ; une même cible ne peut être touchée qu'une fois par combat.$abr$ WHERE nom = 'Brasero' AND domaine = 'Éléments';

UPDATE prieres SET resume_condense = $abr$Frappe toutes les cibles d'un rayon de dégâts d'un seul élément au choix (feu, glace, foudre ou acide), de 4 au niv. 11 à 10 au niv. 20 ; relancé dans les 20 secondes sur la même zone avec un élément différent, son coût en spiritualité baisse de 1 (minimum 1).$abr$ WHERE nom = 'Déchaînement Élémentaire' AND domaine = 'Éléments';
