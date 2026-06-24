-- Abrégés (resume_condense) du domaine Guerre — 15 prières (FICHES Phase 3, étape 2, s272)
-- Idempotent : UPDATE ancré nom+domaine. Source = description (audit C6 clos s271).

UPDATE prieres SET resume_condense = $abr$Confère à la/les cibles des points d'armure temporaires (non récupérables une fois perdus, cumulés à une armure physique existante) : 1 au niv. 1, puis 2/3/4/5 aux niv. 5/10/11/20.$abr$ WHERE nom = 'Armure' AND domaine = 'Guerre';

UPDATE prieres SET resume_condense = $abr$Permet au lanceur de continuer à combattre alors qu'il est aveuglé (et de garder les yeux ouverts dans ce cas) ; chaque niveau acquis au-delà du niv. 1 prolonge gratuitement la durée d'une minute.$abr$ WHERE nom = 'Combat Aveugle' AND domaine = 'Guerre';

UPDATE prieres SET resume_condense = $abr$Immunise la/les cibles contre les nouveaux poisons reçus pendant la durée (sans annuler ceux déjà actifs) : mineurs au niv. 1, intermédiaires au niv. 6, majeurs au niv. 11 (hors mortel), et au niv. 20 contre le coup de grâce du poison mortel (la cible tombe alors simplement comateuse à 0 point de vie).$abr$ WHERE nom = 'Immunité au Poison' AND domaine = 'Guerre';

UPDATE prieres SET resume_condense = $abr$Supprime chez la/les cibles la douleur des blessures (sans réduire les dégâts ni les états subis) : au niv. 1 elles ignorent les effets liés à la douleur ; au niv. 6 elles sont insensibles à la compétence Torture pendant la durée (qui reprend aussitôt si le sort se termine en pleine séance) ; au niv. 11 les sorts de douleur doivent dépasser le niveau du sort — effets cumulatifs à niveau suffisant.$abr$ WHERE nom = 'Insensibilité à la douleur' AND domaine = 'Guerre';

UPDATE prieres SET resume_condense = $abr$Ralentit la/les cibles à la moitié de leur vitesse : réduites à une marche lente, leurs coups n'infligent plus de dégâts et leur voix devient incompréhensible.$abr$ WHERE nom = 'Lenteur' AND domaine = 'Guerre';

UPDATE prieres SET resume_condense = $abr$Frappe la/les cibles d'un effet de peur : incapables d'attaquer ou de viser le lanceur, elles peuvent encore se défendre mais doivent fuir jusqu'à le perdre de vue (un guerrier double son niveau pour résister à la peur).$abr$ WHERE nom = 'Présence intimidante' AND domaine = 'Guerre';

UPDATE prieres SET resume_condense = $abr$Permet à la/les cibles d'encaisser sans dégâts un certain nombre de coups d'armes conventionnelles non magiques — 1 au niv. 1, puis 2/3/4/5 aux niv. 5/10/15/20 (les coups assommants comptent pour un coup normal) ; bloque aussi la prochaine attaque sournoise mais épuise alors toutes les protections restantes.$abr$ WHERE nom = 'Protection contre les Armes Conventionnelles' AND domaine = 'Guerre';

UPDATE prieres SET resume_condense = $abr$Contraint la/les cibles à tout faire pour blesser le lanceur, l'effet cessant dès qu'une cible l'a fait saigner.$abr$ WHERE nom = 'Provocation' AND domaine = 'Guerre';

UPDATE prieres SET resume_condense = $abr$Immunise le lanceur contre une attaque de surprise (annoncer « Annule »), le sort prenant alors fin — sauf au niv. 20 où il persiste jusqu'à sa durée : il bloque les pièges au niv. 1, l'Égorgement et l'Assommement au niv. 6, le Brise-Cou au niv. 11, puis le Backstab et le Backstab à distance au niv. 16.$abr$ WHERE nom = 'Sens aiguisé' AND domaine = 'Guerre';

UPDATE prieres SET resume_condense = $abr$Enchante autant d'armes que de cibles : elles frappent magique au niv. 6, deviennent indestructibles au niv. 10, puis insensibles aux autres sorts au niv. 15 ; au niv. 20, le lanceur peut au choix enchanter normalement ou rendre magiques (mais toujours destructibles) les armes de tous ceux dans un rayon de 10 pieds.$abr$ WHERE nom = 'Arme Magique' AND domaine = 'Guerre';

UPDATE prieres SET resume_condense = $abr$Confère à la/les cibles des points d'armure temporaires (non récupérables) — 2 au niv. 6, puis 3/4/5 aux niv. 10/11/20 — et, tant qu'ils durent, l'immunité aux effets de peur de niveau inférieur ; chaque niveau acquis au-delà du niv. 6 prolonge gratuitement la durée d'une minute.$abr$ WHERE nom = 'Fureur Divine' AND domaine = 'Guerre';

UPDATE prieres SET resume_condense = $abr$Permet au lanceur de prendre à sa place les dégâts destinés à la cible qu'il garde en vue (son armure absorbant avant ses points de vie, comme d'habitude) ; chaque niveau acquis au-delà du niv. 6 prolonge gratuitement la durée d'une minute.$abr$ WHERE nom = 'Gardien Dévot' AND domaine = 'Guerre';

UPDATE prieres SET resume_condense = $abr$Permet à la/les cibles de manier des armes à deux mains sans en avoir la compétence ; au niv. 11, elles ne peuvent plus être désarmées.$abr$ WHERE nom = 'Poigne de fer' AND domaine = 'Guerre';

UPDATE prieres SET resume_condense = $abr$Dresse autour du lanceur un dôme que les personnages de niveau n'excédant pas celui du sort ne peuvent franchir à moins de 10 pieds (sauf ceux qu'il laisse passer) ; il prend fin si le lanceur se déplace et n'arrête ni les projectiles ni les sorts.$abr$ WHERE nom = 'Sanctuaire' AND domaine = 'Guerre';

UPDATE prieres SET resume_condense = $abr$Empêche la cible de recevoir tout sort à effet bénéfique de niveau inférieur au Châtiment du Traître pendant la durée, sans retirer ceux déjà actifs sur elle.$abr$ WHERE nom = 'Châtiment du Traître' AND domaine = 'Guerre';
