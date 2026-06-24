-- Abrégés (resume_condense) du domaine Nécromancie — 15 prières (FICHES Phase 3, étape 2, s272)
-- Idempotent : UPDATE ancré nom+domaine. Source = description (audit C6 clos s271).

UPDATE prieres SET resume_condense = $abr$Relève en morts-vivants sous le contrôle du lanceur la/les cibles mortes ou comateuses (le joueur fournit les masques) : zombies au niv. 1, + squelettes au niv. 6, + goules au niv. 11, + blêmes et spectres au niv. 16 ; à la fin du sort ou à 0 point de vie, une cible qui était comateuse tombe inconsciente puis s'éveille après une minute sans souvenir.$abr$ WHERE nom = 'Animation des morts' AND domaine = 'Nécromancie';

UPDATE prieres SET resume_condense = $abr$Dote la/les cibles d'un bouclier qui annule un nombre de dégâts de vol de vie (drainlife) égal à la moitié du niveau du sort arrondie à l'unité supérieure, jusqu'à l'expiration du sort.$abr$ WHERE nom = 'Bouclier Contre la Mort' AND domaine = 'Nécromancie';

UPDATE prieres SET resume_condense = $abr$Permet d'interroger à voix haute un personnage mort (non comateux) ayant au moins gardé sa tête, hors de tout combat impliquant le lanceur ou la cible : 1 question au niv. 1, jusqu'à 5 au niv. 20, après quoi le corps retombe inanimé.$abr$ WHERE nom = 'Communication avec les Cadavres' AND domaine = 'Nécromancie';

UPDATE prieres SET resume_condense = $abr$Permet au lanceur de dialoguer pleinement avec un fantôme annoncé (qui ne peut mentir), à condition de tenir un objet lui ayant appartenu, son niveau déterminant l'efficacité ; nécessite la présence d'un animateur.$abr$ WHERE nom = 'Contact avec les Anciens' AND domaine = 'Nécromancie';

UPDATE prieres SET resume_condense = $abr$Inflige à la/les cibles mortes-vivantes un nombre de dégâts magiques égal au niveau du sort.$abr$ WHERE nom = 'Destruction des Morts-Vivants' AND domaine = 'Nécromancie';

UPDATE prieres SET resume_condense = $abr$Rend à la/les cibles mortes-vivantes 1 point de vie par niveau du sort, sans blesser les vivants.$abr$ WHERE nom = 'Guérison des Morts-Vivants' AND domaine = 'Nécromancie';

UPDATE prieres SET resume_condense = $abr$Donne à la/les cibles l'apparence de la mort (plus de signes vitaux, inspections médicales faussées, mais sans les empêcher d'agir) : simple apparence au niv. 1, puis trompe « Diagnostic 1 » au niv. 6, « Diagnostic 1 et 2 » au niv. 11, et « Diagnostic 1, 2 et 3 » au niv. 20.$abr$ WHERE nom = 'Masque Funèbre' AND domaine = 'Nécromancie';

UPDATE prieres SET resume_condense = $abr$Donne à la/les cibles l'apparence de la vie (signes vitaux et corps semblant entier) : simple apparence au niv. 1, puis trompe « Diagnostic 1 » au niv. 6, « Diagnostic 1 et 2 » au niv. 11, et « Diagnostic 1, 2 et 3 » au niv. 20.$abr$ WHERE nom = 'Simulacre de vie' AND domaine = 'Nécromancie';

UPDATE prieres SET resume_condense = $abr$Soumet la/les cibles mortes-vivantes au contrôle total du lanceur, qui obéissent à la lettre même au péril de leur intégrité ; pour ravir une cible déjà sous Animation des morts ou Contrôle, le sort doit égaler ou dépasser le niveau de l'effet en place.$abr$ WHERE nom = 'Contrôle des Morts-Vivants' AND domaine = 'Nécromancie';

UPDATE prieres SET resume_condense = $abr$Inflige à la cible des dégâts dont le lanceur récupère l'équivalent en points de vie (sans dépasser son maximum) : 1 au niv. 6, 2 au niv. 10, 3 au niv. 15, 4 au niv. 20 — où il peut en plus transférer les points gagnés, et une part des siens à sa guise, à une cible consentante à 5 pieds.$abr$ WHERE nom = 'Drain de vie' AND domaine = 'Nécromancie';

UPDATE prieres SET resume_condense = $abr$Immobilise la/les cibles mortes-vivantes (qui voient et entendent encore mais ne peuvent plus parler) jusqu'à ce qu'elles subissent des dégâts, ce qui dissipe l'effet.$abr$ WHERE nom = 'Paralysie de Morts-Vivants' AND domaine = 'Nécromancie';

UPDATE prieres SET resume_condense = $abr$Empêche tout mort-vivant de niveau inférieur au sort — alliés compris — d'approcher le lanceur à moins de 5 pieds.$abr$ WHERE nom = 'Répulsion des morts-vivants' AND domaine = 'Nécromancie';

UPDATE prieres SET resume_condense = $abr$Emprisonne l'âme d'un personnage mort (non comateux) dans une pierre d'âme en-jeu, à condition que le sort égale ou dépasse le niveau de ce personnage ; briser la pierre libère l'âme.$abr$ WHERE nom = 'Capture d''Âmes' AND domaine = 'Nécromancie';

UPDATE prieres SET resume_condense = $abr$Crée un cercle fixe d'énergie négative qui, à chaque entrée puis une fois par minute, blesse les créatures vivantes (sauf le lanceur) et régénère les morts-vivants : 1 dégât / +1 PV au niv. 11, 2/+2 au niv. 15, 3/+3 au niv. 18, 4/+5 au niv. 20 ; les effets cessent dès qu'on quitte la zone et cette régénération ne se cumule pas avec une autre.$abr$ WHERE nom = 'Puits de Putréfaction' AND domaine = 'Nécromancie';

UPDATE prieres SET resume_condense = $abr$Ramène à la vie (à 1 point de vie) un personnage mort, si le sort égale ou dépasse son niveau et que sa mort n'est pas trop ancienne — la durée choisie fixant le délai admis depuis le décès ; sans effet sur les inconscients ou comateux.$abr$ WHERE nom = 'Retour à la Vie' AND domaine = 'Nécromancie';
