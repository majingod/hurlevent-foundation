-- Abrégés (resume_condense) du domaine Chaos — 16 prières (FICHES Phase 3, étape 2, s272)
-- Idempotent : UPDATE ancré nom+domaine. Source = description (audit C6 clos s271).

UPDATE prieres SET resume_condense = $abr$Altère la perception que la/les cibles ont du lanceur : un ennemi peut devenir ami (cesse toute agression, sans sacrifier sa vie pour lui), un allié devenir méfiant ou hostile, un neutre basculant au choix du lanceur (un nouvel ennemi ne l'aime pas mais n'ira jamais jusqu'à le tuer) ; prend fin dès que le lanceur se montre physiquement agressif envers une cible.$abr$ WHERE nom = 'Ami/Ennemi' AND domaine = 'Chaos';

UPDATE prieres SET resume_condense = $abr$Immunise la/les cibles ou objets contre les sorts de divination de niveau égal ou inférieur à celui de l'anti-détection ; à chaque sort de Connaissance/divination (« Shatur ») ainsi annulé, annoncer « Annule ».$abr$ WHERE nom = 'Anti-Détection' AND domaine = 'Chaos';

UPDATE prieres SET resume_condense = $abr$Force la/les cibles à tout faire pour s'emparer d'un objet visible désigné par le lanceur (de la ruse jusqu'au meurtre selon leur caractère) puis à vouloir le garder toute la durée ; elles restent conscientes et gardent leurs souvenirs, et l'effet cesse sur une cible qui tombe inconsciente.$abr$ WHERE nom = 'Avidité' AND domaine = 'Chaos';

UPDATE prieres SET resume_condense = $abr$Force la/les cibles à ignorer un objet visible désigné par le lanceur : même en fouillant son porteur, elles ne le « voient » pas et le jugent sans importance.$abr$ WHERE nom = 'Dissimulation d''Objet' AND domaine = 'Chaos';

UPDATE prieres SET resume_condense = $abr$Prend la/les cibles d'un rire incontrôlable (peinent à se défendre, incapables d'attaquer ou de lancer un sort) ; au niv. 11, la cible reçoit en plus l'effet « aveuglé ».$abr$ WHERE nom = 'Fou Rire Incessant' AND domaine = 'Chaos';

UPDATE prieres SET resume_condense = $abr$Modifie les traits d'apparence de la cible (à rendre physiquement en-jeu) assez pour qu'elle évite d'être reconnue, sans permettre d'imiter fidèlement un autre personnage.$abr$ WHERE nom = 'Modification d''Apparence' AND domaine = 'Chaos';

UPDATE prieres SET resume_condense = $abr$Pousse la/les cibles à voir tout personnage comme un ennemi mortel et à l'attaquer aussitôt ; un sort de calme de niveau supérieur y met fin automatiquement, et l'effet cesse sur une cible qui tombe inconsciente.$abr$ WHERE nom = 'Rageur Fou' AND domaine = 'Chaos';

UPDATE prieres SET resume_condense = $abr$Inflige à la/les cibles l'effet « folie » (à annoncer) : perceptions altérées, environnement qui se déforme, murmures inexistants et difficulté à distinguer le réel de l'illusion.$abr$ WHERE nom = 'Toucher de la folie' AND domaine = 'Chaos';

UPDATE prieres SET resume_condense = $abr$Fait oublier à la cible, selon le niveau choisi à l'achat : au niv. 1, ses formules et prières (tout sort lancé sans grimoire/texte religieux est annulé, PS dépensés quand même) ; au niv. 6, tous les noms propres (personnes, lieux, organisations) ; au niv. 11, un moment précis des 30 dernières minutes désigné par le lanceur (qui revient intégralement à la fin) ; au niv. 20, un élément vécu de façon permanente — les oublis permanents pouvant être contrés par une hypnose de haut niveau.$abr$ WHERE nom = 'Trou de mémoire' AND domaine = 'Chaos';

UPDATE prieres SET resume_condense = $abr$Rend la/les cibles incapables de se taire : elles doivent parler, chanter ou marmonner à voix audible (contenu libre) sans jamais rester muettes ; fin si la cible tombe inconsciente ou comateuse, ou est réduite au silence par un sort de niveau égal ou supérieur.$abr$ WHERE nom = 'Bavardage Compulsif' AND domaine = 'Chaos';

UPDATE prieres SET resume_condense = $abr$Crée un rayon qui annule tout sort du domaine de l'Ordre et tout effet de vérité de niveau inférieur à celui du sort ; chaque niveau acquis au-delà du niv. 6 agrandit gratuitement le rayon maximal d'un pied (taille bonus non comptée dans le calcul du sort).$abr$ WHERE nom = 'Confusion de la Loi' AND domaine = 'Chaos';

UPDATE prieres SET resume_condense = $abr$Frappe la/les cibles de maladresse : elles ne peuvent plus utiliser les compétences de Dépeçage, Joaillerie, Forge, Rune, Alchimie, Rituel, Crochetage, Création et désarmement de pièges, Premiers Soins et Chirurgie, et doivent jouer la gaucherie, tout en pouvant encore se battre et lancer sorts et prières.$abr$ WHERE nom = 'Maladresse' AND domaine = 'Chaos';

UPDATE prieres SET resume_condense = $abr$Rend la/les cibles incapables de dire la vérité, à l'oral comme à l'écrit, et les immunise contre tout effet de niveau inférieur les forçant à dire la vérité.$abr$ WHERE nom = 'Mensonge' AND domaine = 'Chaos';

UPDATE prieres SET resume_condense = $abr$Rend inutilisables toutes les compétences d'arme de la/les cibles tant que le sort est actif.$abr$ WHERE nom = 'Perte de compétence d''arme' AND domaine = 'Chaos';

UPDATE prieres SET resume_condense = $abr$Si le niveau de la cible n'excède pas celui du sort, altère ses perceptions mystiques : tout sort de divination ou du domaine de la Connaissance qu'elle lance lui fournit des informations erronées ou trompeuses.$abr$ WHERE nom = 'Brouillage du Chaos' AND domaine = 'Chaos';

UPDATE prieres SET resume_condense = $abr$Déstabilise la magie de la/les cibles : chaque sort qu'elles lancent coûte 1 point de spiritualité de plus (sans gain d'effet, de portée ni de durée) ; au niv. 20, ce surcoût passe à 2 points.$abr$ WHERE nom = 'Complication magique' AND domaine = 'Chaos';
