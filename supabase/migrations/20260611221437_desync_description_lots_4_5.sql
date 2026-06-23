-- DESYNC-DESCRIPTION-LOTS-4-5 (s167)
-- Aligne la colonne legacy `description` (ToggleManuel) des 12 sorts
-- dont les fixes verbatim s166 n'avaient corrigé que description_tronc + paliers.
-- Idempotent : replace() no-op si chaîne absente ; SET final idempotent.

UPDATE sorts SET description = replace(description,
$x$Le lanceur de sort s'immunise contre les attaques basées sur la surprise. Lorsqu'il sera affligé d'une de ses attaques, il devra annoncer "Annule". De plus, il reçoit toujours la moitié des dégâts provenant des pièges pour la durée du sort.$x$,
$x$Les cibles du sort s'immunisent contre les attaques basées sur la surprise. Lorsqu'elles seront affligées d'une de ces attaques, elles devront annoncer "Annule". De plus, elles reçoivent toujours la moitié des dégâts provenant des pièges pour la durée du sort.$x$)
WHERE nom = 'Sens aiguisé';

UPDATE sorts SET description = replace(description,
$x$le lanceur du sort utilise son niveau de personnage doublé$x$,
$x$la cible utilise son niveau de personnage doublé$x$)
WHERE nom = 'Sens aiguisé';

UPDATE sorts SET description = replace(description,
$x$mais qu'elles peuvent$x$, $x$mais elles peuvent$x$)
WHERE nom = 'Arme Magique';

UPDATE sorts SET description = replace(description,
$x$même s'ils n'ont pas$x$, $x$même si elles n'ont pas$x$)
WHERE nom = 'Poigne de fer';

UPDATE sorts SET description = replace(description,
$x$Peut cacher les aura des artéfacts.$x$, $x$Peut cacher les auras des artefacts.$x$)
WHERE nom = 'Aura indétectable';

UPDATE sorts SET description = replace(replace(description,
$x$Permets de remplacer$x$, $x$Permet de remplacer$x$),
$x$mots de pouvoir nécessaire aux formules$x$, $x$mots de pouvoir nécessaires aux formules$x$)
WHERE nom = 'Incantation Fourbe';

UPDATE sorts SET description = replace(description,
$x$semblent entiers$x$, $x$semblent entières$x$)
WHERE nom = 'Simulacre de vie';

UPDATE sorts SET description = replace(description,
$x$La maladie est transférable au toucher. La maladie se transmet$x$,
$x$La maladie se transmet$x$)
WHERE nom = 'Pestilence';

UPDATE sorts SET description = replace(description,
$x$points de spiritualité supplémentaire.$x$, $x$points de spiritualité supplémentaires.$x$)
WHERE nom = 'Saignée Mystique';

UPDATE sorts SET description = replace(description,
$x$contrecoup; une malédiction$x$, $x$contrecoup : une malédiction$x$)
WHERE nom = 'L''Entente du Néant';

UPDATE sorts SET description = replace(description,
$x$l'aveuglement subit$x$, $x$l'aveuglement subi$x$)
WHERE nom = 'Ténèbres';

UPDATE sorts SET description = replace(replace(description,
$x$dégâts magiques à chacun,$x$, $x$dégâts magiques à chacune,$x$),
$x$8 dégâts de magique$x$, $x$8 dégâts magiques$x$)
WHERE nom = 'Explosion arcanique';

UPDATE sorts SET description =
$x$Le lanceur du sort transfère immédiatement une partie de son énergie magique à une cible vivante.

La quantité transférée varie selon le niveau du sort. Un sort de plus haut niveau permet de transférer plus efficacement son énergie. Le coût d'un sort en points de spiritualité représente l'énergie totale investie par le lanceur. Toutefois, seule une partie de cette énergie est réellement transférée à la cible. Exemple : au niveau 6, le sort coûte 5 points de spiritualité. Parmi ceux-ci, 2 points sont transférés à la cible.

La cible qui reçoit cette énergie spirituelle ne peut pas dépasser son maximum normal de spiritualité. Si elle reçoit plus que son maximum, les points excédentaires sont perdus.

Si ce sort est utilisé dans le cadre de la création ou de l'activation d'un objet magique/parchemin, le créateur paie le coût de spiritualité pour lancer le sort. La quantité de spiritualité fournie par l'objet à la cible est alors puisée dans la réserve de points de spiritualité de l'utilisateur de l'objet au moment de son utilisation afin d'être transférée à la cible.

Niveau 6 : Transfert de 2 points de spiritualité.
Niveau 8 : Transfert de 3 points de spiritualité.
Niveau 10 : Transfert de 4 points de spiritualité.
Niveau 12 : Transfert de 5 points de spiritualité.
Niveau 14 : Transfert de 6 points de spiritualité.
Niveau 16 : Transfert de 7 points de spiritualité.
Niveau 18 : Transfert de 8 points de spiritualité.
Niveau 20 : Transfert de 10 points de spiritualité.$x$
WHERE nom = 'Inspiration spirituel';
