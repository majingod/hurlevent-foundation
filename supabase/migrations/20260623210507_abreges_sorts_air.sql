-- FICHES Phase 3 (s268) : abrégés (resume_condense) du cercle de l'Air — 10 sorts.
-- Réduction SANS perte depuis le manuel corrigé. Idempotent (UPDATE ancré nom+cercle).

UPDATE sorts SET resume_condense = $ab$La cible suffoque : à genoux ou au sol, elle ne peut ni parler, ni incanter, ni attaquer, ni utiliser de compétences pour la durée du sort — seul un déplacement lent reste possible.$ab$
WHERE nom = 'Asphyxie' AND cercle = 'Air';

UPDATE sorts SET resume_condense = $ab$Confère à la ou les cibles un bouclier absorbant un nombre de dégâts de foudre égal à la moitié du niveau du sort (arrondi à l'unité supérieure).$ab$
WHERE nom = 'Bouclier de Vent' AND cercle = 'Air';

UPDATE sorts SET resume_condense = $ab$Repousse la cible au sol, dans le sens opposé au lanceur, sur une distance égale à la moitié du niveau du sort +3 pieds (annoncer « Repoussé » et la distance).$ab$
WHERE nom = 'Bourrasque' AND cercle = 'Air';

UPDATE sorts SET resume_condense = $ab$Transforme les cibles en brume intangible (corps et équipement) : elles franchissent le monde matériel sans courir mais ne manipulent rien et ne peuvent attaquer, se défendre ni incanter ; seules la magie pure ou les armes frappant magiques les atteignent ; en rayon, sortir de la zone anuule le sort, un objet lâché reste intangible, et deux intangibles ne peuvent s'affronter ; +1 min gratuite par niveau au-delà de 6.$ab$
WHERE nom = 'Forme de Brume' AND cercle = 'Air';

UPDATE sorts SET resume_condense = $ab$Bloque les projectiles physiques (flèches, carreaux, armes de lancer) en pointant et disant « Annule », chaque projectile comptant pour une charge ; le nombre bloqué croît avec le niveau, de 1 (niv. 1) à 6 (niv. 18), puis tous au niveau 20.$ab$
WHERE nom = 'Globe d''Air' AND cercle = 'Air';

UPDATE sorts SET resume_condense = $ab$Toute personne dans le rayon tombe inconsciente 5 minutes, sans pouvoir être réveillée en la bougeant ou en lui parlant ; seuls une dissipation de la magie ou des dégâts brisent l'effet avant la fin.$ab$
WHERE nom = 'Nuage de Mort' AND cercle = 'Air';

UPDATE sorts SET resume_condense = $ab$Inflige des dégâts de foudre croissant avec le niveau : 1 au niveau 1, jusqu'à 8 au niveau 20.$ab$
WHERE nom = 'Rayon Électrique' AND cercle = 'Air';

UPDATE sorts SET resume_condense = $ab$Frappe toutes les cibles d'une zone visible, alliés compris, de dégâts de foudre selon le niveau (3 au niv. 6 → 7 au niv. 18) ; au niveau 20, les alliés ne sont plus touchés.$ab$
WHERE nom = 'Tempête de Foudre' AND cercle = 'Air';

UPDATE sorts SET resume_condense = $ab$Enchante un nombre d'armes égal aux cibles : chacune peut annoncer « Repoussement 5 pieds » (projection arriere) un nombre de fois croissant selon le niveau, de 1 (niv. 1) à 5 (niv. 20) ; chaque niveau ajoute gratuitement 1 minute de durée.$ab$
WHERE nom = 'Tornade Martiale' AND cercle = 'Air';

UPDATE sorts SET resume_condense = $ab$Au toucher, inflige des dégâts de foudre selon le niveau : 4 (niv. 6), 5 (niv. 10) ; aux niveaux 15 et 20, soit deux cibles à 4/5 dégâts chacune, soit une seule à 07/10.$ab$
WHERE nom = 'Toucher Foudroyant' AND cercle = 'Air';
