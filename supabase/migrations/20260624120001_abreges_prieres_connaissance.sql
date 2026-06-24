-- Abrégés (resume_condense) du domaine Connaissance — 13 prières (FICHES Phase 3, étape 2, s272)
-- Idempotent : UPDATE ancré nom+domaine. Source = description (audit C6 clos s271).

UPDATE prieres SET resume_condense = $abr$Permet à la/les cibles d'utiliser le niveau de l'alerte du danger, plutôt que le leur, pour résister aux pièges.$abr$ WHERE nom = 'Alerte du Danger' AND domaine = 'Connaissance';

UPDATE prieres SET resume_condense = $abr$Révèle au lanceur la famille d'origine de la cible (Tombes, Rêves, Néant, Nature, Artificielle, etc.), ou une impression confuse si elle n'appartient à aucune famille connue — à condition que le niveau du sort égale ou dépasse celui de la créature.$abr$ WHERE nom = 'Détection de la famille' AND domaine = 'Connaissance';

UPDATE prieres SET resume_condense = $abr$Confirme seulement la présence ou l'absence d'une aura magique (sans nature, puissance ni effets) et démasque les fausses auras ; sur un objet porté, le niveau du sort doit égaler ou dépasser celui du porteur, et sur une aura masquée ou falsifiée, celui de l'effet de dissimulation.$abr$ WHERE nom = 'Détection de la magie' AND domaine = 'Connaissance';

UPDATE prieres SET resume_condense = $abr$Immunise la cible contre les sorts du cercle des Illusions moins puissants que le Discernement Divin ; à chaque sort d'Illusion (« Guerben ») ainsi annulé, annoncer « Annule ».$abr$ WHERE nom = 'Discernement Divin' AND domaine = 'Connaissance';

UPDATE prieres SET resume_condense = $abr$Rend la/les cibles capables de comprendre et parler les langues qui leur sont inconnues ; chaque niveau acquis au-delà du niv. 1 prolonge gratuitement la durée maximale d'une minute (durée bonus non comptée dans le calcul du sort).$abr$ WHERE nom = 'Don des Langues' AND domaine = 'Connaissance';

UPDATE prieres SET resume_condense = $abr$Protège un objet déplaçable désigné (taille max épée à deux mains / bouclier pavois) : nul ne peut le saisir ou le manipuler sans surpasser le niveau du sort ; un seul objet à la fois, qui doit porter un ruban jaune hors-jeu (fourni par le joueur) et rester en vue ou sur le lanceur — l'effet cesse aussitôt si l'objet le quitte ou perd son ruban, et ne protège pas contre la destruction ou la détérioration.$abr$ WHERE nom = 'Ange Gardien' AND domaine = 'Connaissance';

UPDATE prieres SET resume_condense = $abr$Permet au lanceur d'interroger une force supérieure, qui répond par oui, non ou indécis à un nombre de questions égal à la moitié du niveau du sort arrondie à l'unité supérieure ; nécessite la présence d'un animateur.$abr$ WHERE nom = 'Augure' AND domaine = 'Connaissance';

UPDATE prieres SET resume_condense = $abr$Retire à la/les cibles tous les effets magiques (sorts ou potions) de niveau inférieur à la Dissipation de la magie agissant sur elles ; sans effet sur les objets magiques.$abr$ WHERE nom = 'Dissipation de la magie' AND domaine = 'Connaissance';

UPDATE prieres SET resume_condense = $abr$Établit un lien passif avec la cible : si elle utilise la compétence Rêve durant la nuit qui suit l'incantation, le lanceur perçoit ce rêve sans pouvoir le modifier ni l'influencer ; le lanceur doit avertir un membre de l'organisation avant de dormir et ne peut entretenir qu'un seul lien à la fois.$abr$ WHERE nom = 'Interception des rêves' AND domaine = 'Connaissance';

UPDATE prieres SET resume_condense = $abr$Révèle si la/les cibles possèdent une âme et s'il s'agit bien de leur âme d'origine ; à partir du niv. 11, perçoit aussi l'origine générale d'une perte ou altération de l'âme (pacte, malédiction, possession, échange) sans les détails.$abr$ WHERE nom = 'Lecture de l''Âme' AND domaine = 'Connaissance';

UPDATE prieres SET resume_condense = $abr$Met en stase un membre amputé ou un organe de la cible, lui accordant 1 cycle de rattachement supplémentaire (portant le délai de greffe à 2 cycles maximum, au-delà desquels il est perdu) ; utilisable une seule fois par membre.$abr$ WHERE nom = 'Suspension de la chair' AND domaine = 'Connaissance';

UPDATE prieres SET resume_condense = $abr$Révèle les auras magiques actives sur la cible, identifiant les écoles et domaines des sorts en cours sans en connaître les effets, la durée restante ni le niveau.$abr$ WHERE nom = 'Vision de la magie' AND domaine = 'Connaissance';

UPDATE prieres SET resume_condense = $abr$Ouvre au lanceur — obligatoirement un fidèle reconnu, jamais via parchemin ni objet — un lien avec le prophète de sa religion, qui n'est jamais tenu de répondre, peut donner des réponses partielles, symboliques ou imagées, et peut exiger une contrepartie (promesse, action future…) : au niv. 11 une question simple ; au niv. 13 une longue question ; au niv. 17 deux longues questions ou deux courtes ; au niv. 20 une discussion (max 10 minutes), d'autant plus exigeante en contrepartie qu'elle se prolonge.$abr$ WHERE nom = 'Savoir du Prophète' AND domaine = 'Connaissance';
