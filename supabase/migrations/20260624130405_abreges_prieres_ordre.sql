-- Abrégés (resume_condense) du domaine Ordre — 15 prières (FICHES Phase 3, étape 2, s272)
-- Idempotent : UPDATE ancré nom+domaine. Source = description (audit C6 clos s271).

UPDATE prieres SET resume_condense = $abr$Dresse une bulle de force invisible que ni les personnages, ni leurs attaques physiques, ni les sorts ne peuvent franchir (on peut s'y déplacer et communiquer au travers) ; un personnage ou un sort de niveau supérieur la perce et met fin au sort.$abr$ WHERE nom = 'Bulle d''emprisonnement' AND domaine = 'Ordre';

UPDATE prieres SET resume_condense = $abr$Apaise la/les cibles en supprimant toute colère et met fin aux effets « Berserk 1/2/3 », « Rageur Fou », « Antipathie » et « Avidité » ; sans lever le contrôle mental ou la suggestion, dont les ordres d'agressivité cessent toutefois d'opérer.$abr$ WHERE nom = 'Calme' AND domaine = 'Ordre';

UPDATE prieres SET resume_condense = $abr$Dissipe sur la/les cibles tous les effets des cercles de Charme et d'Illusion (« Guerben », « Veltel ») de niveau égal ou inférieur au sort.$abr$ WHERE nom = 'Délivrance des Envoûtements' AND domaine = 'Ordre';

UPDATE prieres SET resume_condense = $abr$Force la/les cibles à fixer leur attention sur le lanceur sans pouvoir s'en détourner, tant qu'il parle ou se montre théâtral en continu — l'effet cessant pour toutes s'il s'interrompt plus de 10 secondes, et pour une cible en particulier si elle subit des dégâts ou une interaction physique brusque.$abr$ WHERE nom = 'Discours captivant' AND domaine = 'Ordre';

UPDATE prieres SET resume_condense = $abr$Permet à la/les cibles d'utiliser le niveau du sort, plutôt que le leur, pour résister aux sorts de l'école de Charme (« Veltel »), sans lever les effets déjà actifs.$abr$ WHERE nom = 'Esprit Inviolable' AND domaine = 'Ordre';

UPDATE prieres SET resume_condense = $abr$Rend tangibles la/les cibles intangibles et les empêche de le redevenir pendant la durée du sort.$abr$ WHERE nom = 'Pieu Spirituel' AND domaine = 'Ordre';

UPDATE prieres SET resume_condense = $abr$Empêche la/les cibles de mentir volontairement pendant la durée, sans pour autant les obliger à parler.$abr$ WHERE nom = 'Vérité' AND domaine = 'Ordre';

UPDATE prieres SET resume_condense = $abr$Repousse ou neutralise les entités venues d'ailleurs si le sort égale ou dépasse leur niveau : au niv. 6, les morts-vivants tangibles tombent inconscients 5 minutes et les intangibles sont renvoyés dans leur corps d'origine ; dès le niv. 11, il détruit ou renvoie aussi les créatures d'autres plans (Néant, Cauchemars, Rêves…) selon leur nature.$abr$ WHERE nom = 'Bannissement' AND domaine = 'Ordre';

UPDATE prieres SET resume_condense = $abr$Dissipe sur la/les cibles tous les effets de malédiction de niveau égal ou inférieur au sort.$abr$ WHERE nom = 'Délivrance des Malédictions' AND domaine = 'Ordre';

UPDATE prieres SET resume_condense = $abr$Contraint la cible, incapable de mentir, à répondre à un nombre de questions croissant : 1 au niv. 6, puis 2/3/4/5 aux niv. 8/10/12/14, et 6 au niv. 20.$abr$ WHERE nom = 'Interrogatoire' AND domaine = 'Ordre';

UPDATE prieres SET resume_condense = $abr$Marque la cible d'un sceau qui lui interdit toute attaque, directe ou indirecte et même défensive, contre quiconque — à la seule exception des monstres non humanoïdes.$abr$ WHERE nom = 'Justice céleste' AND domaine = 'Ordre';

UPDATE prieres SET resume_condense = $abr$Immobilise la/les cibles (qui voient et entendent encore mais ne peuvent plus parler) jusqu'à ce qu'elles subissent des dégâts, ce qui dissipe l'effet.$abr$ WHERE nom = 'Paralysie' AND domaine = 'Ordre';

UPDATE prieres SET resume_condense = $abr$Transfère sur le lanceur l'affliction d'une cible — avec tous ses malus et conséquences, jusqu'à la mort, à lui de trouver ensuite un remède : tout poison au niv. 6, poison et maladie au niv. 11, poison, maladie et malédiction au niv. 16, et au niv. 20 le coup de grâce subi par la cible s'il est lancé dans les 2 minutes.$abr$ WHERE nom = 'Sacrifice de soi' AND domaine = 'Ordre';

UPDATE prieres SET resume_condense = $abr$Contraint la/les cibles à suivre à la lettre les instructions du lanceur, sauf celles qui les blesseraient ou les mèneraient à une mort imminente.$abr$ WHERE nom = 'Injonction' AND domaine = 'Ordre';

UPDATE prieres SET resume_condense = $abr$Empêche la/les cibles de lancer tout nouveau sort d'une école ou d'un domaine fixé au lancement (sans annuler les effets déjà actifs ni pouvoir changer la cible d'école par la suite).$abr$ WHERE nom = 'Verrou de la loi' AND domaine = 'Ordre';
