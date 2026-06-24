-- Abrégés (resume_condense) du cercle de l'Altération — 10 sorts (FICHES Phase 3, s269)
-- Idempotent : UPDATE ancré sur nom + cercle (rejouable à froid → même état). Champs resume_condense vides au départ = ajf�t pur, aucun intégral (description) touché.

UPDATE sorts SET resume_condense = $abr$Confère à chaque cible un trait racial d'une race jouable choisie (costume requis) en remplaçant le trait choisi à la création — sauf un trait permis par toutes les races ; un trait 1/cycle ne se réactive pas en relançant et le trait obtenu est définitif ; niv. 6 : la cible parle la langue de cette race ; niv. 11 : deux traits raciaux (costume d'une seule des deux races) et lançable sans bonus sur une cible non consentante (devient un sort à effet) ; niv. 20 : sur une seule race et des cibles consentantes non contraintes, le changement devient permanent (perte de tous les traits de l'ancienne race, XP non récupérable, l'humain perd ses 20 XP), instantané et sans aura, race à déclarer à l'organisation au préalable.$abr$
WHERE nom = 'Altération du Corps' AND cercle = 'Altération';

UPDATE sorts SET resume_condense = $abr$Rend intangible le ou les objets visés (y compris portés ou contenus), qui ne peuvent plus être saisis sauf par un personnage lui-même intangible — un objet non tenu est affecté d'office, sinon le niveau du sort s'oppose à celui du porteur, et une armure ainsi rendue intangible ne donne plus ses points d'armure ; niv. 11 : atteint les objets magiques de niveau 3 ou moins ; niv. 20 : atteint les artéfacts.$abr$
WHERE nom = 'État Instable' AND cercle = 'Altération';

UPDATE sorts SET resume_condense = $abr$Rend l'objet visé si fragile qu'il est dåtruit dès qu'il subit ou bloque le moindre dégât — affecté d'office s'il n'est pas porté, sinon le niveau du sort s'oppose à celui du porteur, et un objet magique résiste automatiquement sauf au niveau 20 ; matériaux atteints selon le niveau : verre, céramique et gemmes (niv. 1), bois (niv. 6), métaux (niv. 10), puis tout objet magique ou non sauf les artéfacts, destruction automatique (niv. 20).$abr$
WHERE nom = 'Fragilité' AND cercle = 'Altération';

UPDATE sorts SET resume_condense = $abr$Rend la ou les cibles intangibles tel un fantôme — visibles mais intouchables, corps et équipement porté traversant le monde matériel sans pouvoir y interagir : impossible d'attaquer, se défendre ou incanter contre une cible tangible, seules la magie pure ou les armes frappant magiques les atteignent ; un objet lâché reste intangible jusqu'à la fin, et deux personnages intangibles peuvent en revanche interagir et se battre normalement entre eux ; +1 min gratuite par niveau au-delà de 6.$abr$
WHERE nom = 'Intangibilité' AND cercle = 'Altération';

UPDATE sorts SET resume_condense = $abr$Ralentit la ou les cibles à 50 % de leur vitesse : aucun coup porté ne fait de dégâts, le déplacement ne dépasse pas une lente marche et la voix devient incompréhensible.$abr$
WHERE nom = 'Lenteur' AND cercle = 'Altération';

UPDATE sorts SET resume_condense = $abr$Rend l'objet visé impossible à soulever — affecté d'office s'il n'est pas porté, sinon le niveau du sort s'oppose à celui du porteur ; niv. 11 : une cible gratuite supplémentaire (deux objets) ; niv. 20 : le lanceur échappe à son propre effet et peut soulever les objets affectés.$abr$
WHERE nom = 'Augmentation du poids' AND cercle = 'Altération';

UPDATE sorts SET resume_condense = $abr$Fait croire à la cible qu'elle est un animal choisi par le lanceur : elle en adopte le comportement mais pas l'apparence et ne peut utiliser aucune compétence ni équipement pour la durée, tout en gardant le souvenir de l'épisode à la fin.$abr$
WHERE nom = 'Demi-morphisme' AND cercle = 'Altération';

UPDATE sorts SET resume_condense = $abr$Rend le ou les objets visés indestructibles et immunisés aux effets nuisants à leur qualitê, protégeant contre destruction et fragilité sauf face à un sort de niveau supérieur à celui de l'indestructibilité ; +1 min gratuite par niveau au-delà de 6.$abr$
WHERE nom = 'Indestructibilité' AND cercle = 'Altération';

UPDATE sorts SET resume_condense = $abr$Immobilise la ou les cibles pour la durée : la vue et l'oué restent, mais elles ne peuvent plus parler, et tout dégât subi dissipe l'effet.$abr$
WHERE nom = 'Paralysie' AND cercle = 'Altération';

UPDATE sorts SET resume_condense = $abr$Frappe la ou les cibles d'un vieillissement accéléré : privées de toute force physique, elles ne peuvent plus se battre, ni lancer de sort ou maintenir une concentration magique, et doivent jouer une grande fatigue aux déplacements lents et incertains ; niv. 20 : sur une cible consentante de son plein gré et non contrainte, le vieillissement devient instantané, permanent et irréversible.$abr$
WHERE nom = 'Vieillissement' AND cercle = 'Altération';
