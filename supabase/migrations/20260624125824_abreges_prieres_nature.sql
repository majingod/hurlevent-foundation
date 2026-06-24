-- Abrégés (resume_condense) du domaine Nature — 17 prières (FICHES Phase 3, étape 2, s272)
-- Idempotent : UPDATE ancré nom+domaine. Source = description (audit C6 clos s271).

UPDATE prieres SET resume_condense = $abr$Confère au lanceur des points d'armure temporaires (non récupérables une fois perdus), à condition qu'il ne porte pas d'armure physique : 1 au niv. 1, puis 2/3/4/5/6 aux niv. 5/6/10/11/20.$abr$ WHERE nom = 'Armure de Bois' AND domaine = 'Nature';

UPDATE prieres SET resume_condense = $abr$Enchante autant de petits fruits que le niveau le permet, chacun rendant 1 point de vie lorsqu'il est mangé (les fruits non consommés perdent leur effet à l'expiration) ; chaque niveau acquis au-delà du niv. 1 ajoute gratuitement un fruit.$abr$ WHERE nom = 'Baies de Guérison' AND domaine = 'Nature';

UPDATE prieres SET resume_condense = $abr$Enchante un bâton travaillé d'au moins quatre pieds (canne, bâton de marche… ni simple branche ni baguette) qui, tant qu'il est porté, confère une résistance aux sorts de niveau inférieur au sien ; il prend fin au premier sort bloqué.$abr$ WHERE nom = 'Bâton de Protection' AND domaine = 'Nature';

UPDATE prieres SET resume_condense = $abr$Enchante autant de cocottes de pin que le niveau le permet, chacune infligeant 1 dégât magique lorsqu'elle est lancée sur une cible ; chaque niveau acquis au-delà du niv. 1 ajoute gratuitement une cocotte.$abr$ WHERE nom = 'Cocotte Magique' AND domaine = 'Nature';

UPDATE prieres SET resume_condense = $abr$Permet au lanceur d'invoquer une entité de la nature au type annoncé (dont la nature détermine l'efficacité selon le niveau) et de lui poser une question à laquelle elle répond par oui, non ou indécis ; chaque niveau acquis au-delà du niv. 1 ajoute une question.$abr$ WHERE nom = 'Communion avec la Nature' AND domaine = 'Nature';

UPDATE prieres SET resume_condense = $abr$Immobilise la/les cibles sous des lianes indestructibles (ni coupées ni brûlées), que seule la fin du sort ou une dissipation de la magie libère ; en version à rayon, chaque niveau acquis au-delà du niv. 1 agrandit gratuitement le rayon d'un pied.$abr$ WHERE nom = 'Enchevêtrement' AND domaine = 'Nature';

UPDATE prieres SET resume_condense = $abr$Empêche la/les cibles d'approcher les bois à moins de 3 pieds, les contraignant à rester sur les chemins et dans les constructions pour la durée du sort.$abr$ WHERE nom = 'Ennemi de la Nature' AND domaine = 'Nature';

UPDATE prieres SET resume_condense = $abr$Ensevelit magiquement un corps mort dans la terre en une minute, sans pour autant empêcher qu'il soit déterré, relevé en zombie ou pillé.$abr$ WHERE nom = 'Enterrement magique' AND domaine = 'Nature';

UPDATE prieres SET resume_condense = $abr$Abat sur la/les cibles une nuée d'insectes harcelante qui les prive de toute action offensive : elles ne peuvent que chasser les insectes, se défendre ou reculer.$abr$ WHERE nom = 'Essaim Vorace' AND domaine = 'Nature';

UPDATE prieres SET resume_condense = $abr$Fait que le lanceur ne laisse plus aucune trace (seul un personnage doté de Pistage ou Flair affûté de niveau au moins égal au sort peut les retrouver) ; il gagne 1 cible supplémentaire gratuite au niv. 5, 2 au niv. 11, et au niv. 20 le sort couvre un rayon de 25 pieds autour de lui n'affectant que les personnes voulues.$abr$ WHERE nom = 'Passage sans Trace' AND domaine = 'Nature';

UPDATE prieres SET resume_condense = $abr$Confère au lanceur le trait racial « Flair affûté » pour la durée, partageable en meute aux niveaux supérieurs : 1 cible supplémentaire gratuite au niv. 5, 2 au niv. 6, 4 au niv. 11, et au niv. 20 un rayon de 25 pieds autour de lui n'affectant que les personnes voulues.$abr$ WHERE nom = 'Traque Bestiale' AND domaine = 'Nature';

UPDATE prieres SET resume_condense = $abr$Soumet une créature monstrueuse vivante à l'autorité du lanceur : elle tente d'obéir à ses ordres selon ses capacités, sans jamais se mettre volontairement en danger ni poser d'acte menant directement à sa mort.$abr$ WHERE nom = 'Envoûtement de Créature' AND domaine = 'Nature';

UPDATE prieres SET resume_condense = $abr$Confère au lanceur l'un des traits raciaux des Chimérides (Affinité animale, Charognard, Flair affûté ou Instinct de survie) en échange d'un comportement plus sauvage et instinctif ; le port d'un masque, d'un élément visuel animal ou de maquillage est obligatoire toute la durée.$abr$ WHERE nom = 'Esprit animal' AND domaine = 'Nature';

UPDATE prieres SET resume_condense = $abr$Crée autour du lanceur une zone dont l'odeur, insoutenable, empêche quiconque d'approcher.$abr$ WHERE nom = 'Odeur Infecte' AND domaine = 'Nature';

UPDATE prieres SET resume_condense = $abr$Quand une cible tombe à 0 point de vie pendant la durée, la met automatiquement en régénération au sol (1 point de vie par minute durant 5 minutes) et lui rend conscience au bout de 5 minutes au lieu de 10 — toujours sans souvenir ; l'effet se réactive à chaque nouvelle chute à 0 tant que le sort dure, mais ne fonctionne qu'à l'extérieur, le corps devant toucher la terre.$abr$ WHERE nom = 'Sang de la Terre' AND domaine = 'Nature';

UPDATE prieres SET resume_condense = $abr$Marque une cible comme ennemie de la Nature : tous les sorts à effet du domaine de la Nature qui la visent directement gagnent un niveau effectif majoré (+1 au niv. 11, +2 au niv. 15, +3 au niv. 20, sans jamais dépasser le niveau 20) — bonus que le lanceur applique lui-même et signale à ses alliés du domaine ; ne peut viser le lanceur lui-même.$abr$ WHERE nom = 'Marque de la menace' AND domaine = 'Nature';

UPDATE prieres SET resume_condense = $abr$Trace au sol un cercle protecteur immobile : tant que le lanceur y reste, ses alliés présents dans la zone voient bloqué tout sort ou effet de nécromancie de niveau n'excédant pas le Serment, et ne sont pas touchés par les sorts de zone du domaine de la Nature lancés par le prêtre ; les effets cessent pour qui entre dans une construction, et le sort prend fin si le lanceur quitte la zone.$abr$ WHERE nom = 'Serment de la terre Mère' AND domaine = 'Nature';
