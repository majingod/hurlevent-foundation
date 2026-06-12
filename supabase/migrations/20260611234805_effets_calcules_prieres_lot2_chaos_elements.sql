-- EFFETS-CALCULÉS — lot prières 2 : Chaos (16) + Éléments (15)
-- + 12 fixes verbatim (Manuel = canon) + 4 courtes nettoyées + 2 libellés normalisés
-- Session 168. Idempotent (replace() no-op si déjà appliqué).

-- ============ A. effet_instance — CHAOS (16) ============
UPDATE prieres SET effet_instance = $t${"template":"Modifie l'attitude des cibles envers le lanceur : un ennemi devient ami, un ami devient hostile, une cible neutre bascule au choix du lanceur. L'ami cesse toute agression ; l'ennemi n'ira pas jusqu'à tuer. Fin immédiate si le lanceur agresse une cible affectée."}$t$::jsonb WHERE domaine='Chaos' AND nom='Ami/Ennemi' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Immunise cibles ou objets contre les sorts de divination de **niveau inférieur ou égal à {niveau}**. Sort annulé → annoncer « Annule »."}$t$::jsonb WHERE domaine='Chaos' AND nom='Anti-Détection' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Les cibles font tout pour s'emparer d'un objet visible désigné (jusqu'à tuer selon leur caractère) et le garder. Elles restent conscientes ; fin si inconscientes."}$t$::jsonb WHERE domaine='Chaos' AND nom='Avidité' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Les cibles ignorent un objet visible désigné : même en fouillant, il leur est invisible et sans importance."}$t$::jsonb WHERE domaine='Chaos' AND nom='Dissimulation d''Objet' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"La cible rit de façon incontrôlable : incapable d'attaquer ou d'incanter, se défend difficilement. {palier}"}$t$::jsonb WHERE domaine='Chaos' AND nom='Fou Rire Incessant' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Modifie les traits de la cible pour éviter d'être reconnue (pas d'imitation fidèle). Le joueur applique les changements physiques en jeu."}$t$::jsonb WHERE domaine='Chaos' AND nom='Modification d''Apparence' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"La cible voit tout le monde comme un ennemi et attaque sans distinction. Annulé par un sort de calme de **niveau supérieur à {niveau}** ; fin si la cible tombe inconsciente."}$t$::jsonb WHERE domaine='Chaos' AND nom='Rageur Fou' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Inflige l'effet « folie », annoncé à la cible : perceptions déformées, murmures imaginaires, difficulté à distinguer le réel de l'illusion."}$t$::jsonb WHERE domaine='Chaos' AND nom='Toucher de la folie' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Fait oublier (effet au choix parmi les niveaux atteints). **{palier}**"}$t$::jsonb WHERE domaine='Chaos' AND nom='Trou de mémoire' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Les cibles ne peuvent plus se taire (parler, chanter ou marmonner sans cesse). Fin si inconscientes, comateuses ou réduites au silence par un sort de **niveau supérieur ou égal à {niveau}**."}$t$::jsonb WHERE domaine='Chaos' AND nom='Bavardage Compulsif' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Le rayon annule tout sort du domaine de l'Ordre et tout effet de vérité de **niveau inférieur à {niveau}**."}$t$::jsonb WHERE domaine='Chaos' AND nom='Confusion de la Loi' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Les cibles perdent leur coordination : Dépeçage, Joaillerie, Forge, Rune, Alchimie, Rituel, Crochetage, Création et désarmement de pièges, Premiers Soins et Chirurgie inutilisables. Combat, sorts et prières restent possibles."}$t$::jsonb WHERE domaine='Chaos' AND nom='Maladresse' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"La cible ne peut plus dire la vérité (oral et écrit) et résiste aux effets de vérité de **niveau inférieur à {niveau}**."}$t$::jsonb WHERE domaine='Chaos' AND nom='Mensonge' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"TOUTES les compétences d'arme de la cible sont inutilisables."}$t$::jsonb WHERE domaine='Chaos' AND nom='Perte de compétence d''arme' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Affecte une cible de **niveau inférieur ou égal à {niveau}** : ses sorts de divination ou du domaine de la Connaissance renvoient des informations erronées ou trompeuses."}$t$::jsonb WHERE domaine='Chaos' AND nom='Brouillage du Chaos' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Chaque sort lancé par la cible coûte 1 point de spiritualité supplémentaire, sans bonus d'effet. {palier}"}$t$::jsonb WHERE domaine='Chaos' AND nom='Complication magique' AND est_actif;

-- ============ B. effet_instance — ÉLÉMENTS (15) ============
UPDATE prieres SET effet_instance = $t${"template":"Inflige **{palier}**"}$t$::jsonb WHERE domaine='Éléments' AND nom='Appel de la Foudre' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Bouclier absorbant **{n} dégât{s:n}** de l'élément choisi par cible (feu, glace, foudre ou acide). L'excédent passe ; un seul bouclier à la fois.","vars":{"n":{"div":2,"arrondi":"sup"}}}$t$::jsonb WHERE domaine='Éléments' AND nom='Bouclier Élémentaire' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Inflige **{palier}** Les morts-vivants subissent le double."}$t$::jsonb WHERE domaine='Éléments' AND nom='Colonne de Feu Sacré' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Bulle anti-projectiles physiques (flèches, carreaux, armes de lancer). **{palier}** Bloquer → pointer du doigt et dire « Annule »."}$t$::jsonb WHERE domaine='Éléments' AND nom='Globe d''Air' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"**{palier}** Une attaque sournoise est bloquée mais consomme toutes les protections restantes ; les coups assommants comptent. Immunise à la pétrification de **niveau inférieur à {niveau}**."}$t$::jsonb WHERE domaine='Éléments' AND nom='Peau de Pierre' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Pétrifie les cibles : immobiles, muettes, impossibles à blesser ; elles perçoivent encore. Dépétrifie si le sort en place est de **niveau inférieur à {niveau}**."}$t$::jsonb WHERE domaine='Éléments' AND nom='Pétrification/Dépétrification' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Confère « Repoussement 5 pieds » à une arme par cible : **{palier}** La personne est projetée vers l'arrière uniquement."}$t$::jsonb WHERE domaine='Éléments' AND nom='Tornade Martiale' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"L'objet ciblé ne peut plus être soulevé (objet porté : le niveau du sort s'oppose à celui du porteur).{paliers}","paliers_mode":"cumule"}$t$::jsonb WHERE domaine='Éléments' AND nom='Augmentation du poids' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Premier effet élémentaire reçu (feu, glace, foudre ou acide) : **{palier}** Puis le bouclier ne protège plus que contre cet élément."}$t$::jsonb WHERE domaine='Éléments' AND nom='Bouclier Adaptatif' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Si le lanceur tombe à 0 PV : explosion de **{palier}** Une seule fois par lancement ; pas si 0 PV volontaire ; le lanceur est épargné."}$t$::jsonb WHERE domaine='Éléments' AND nom='Brasier Vengeur' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Les cibles subissent une chaleur ou un froid extrême (jouer 40 °C ou −40 °C) : impossible de se concentrer."}$t$::jsonb WHERE domaine='Éléments' AND nom='Changement de Température' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Chaque cible suffoque : à genoux ou au sol, incapable de parler, d'incanter, d'attaquer ou d'utiliser des compétences. Déplacement lent possible."}$t$::jsonb WHERE domaine='Éléments' AND nom='Noyade' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Dissipe sur la cible tous les sorts bénéfiques élémentaires de **niveau inférieur ou égal à {niveau}** (cercles air/feu/eau/terre et domaine des Éléments). Les effets non élémentaires sont épargnés."}$t$::jsonb WHERE domaine='Éléments' AND nom='Rupture élémentaire' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Inflige l'état Enflammé : la cible doit consacrer une action à s'éteindre, sinon perd 50 % de ses PV totaux (armure incluse). Une fois par combat par cible."}$t$::jsonb WHERE domaine='Éléments' AND nom='Brasero' AND est_actif;
UPDATE prieres SET effet_instance = $t${"template":"Élément au choix (feu, glace, foudre ou acide), sur toute la zone : **{palier}** Relancer en moins de 20 s avec un autre élément réduit le coût de 1 PS (min. 1)."}$t$::jsonb WHERE domaine='Éléments' AND nom='Déchaînement Élémentaire' AND est_actif;

-- ============ C. Fixes verbatim (Manuel = canon) ============
UPDATE prieres SET description = replace(description, $t$cancellé$t$, $t$annulé$t$) WHERE domaine='Chaos' AND nom='Anti-Détection' AND est_actif;
UPDATE prieres SET description = replace(description, $t$dans leur mains$t$, $t$dans leurs mains$t$) WHERE domaine='Chaos' AND nom='Avidité' AND est_actif;
UPDATE prieres SET description = replace(replace(description, $t$il parle que$t$, $t$elle parle que$t$), $t$il écrit$t$, $t$elle écrit$t$) WHERE domaine='Chaos' AND nom='Mensonge' AND est_actif;
UPDATE prieres SET description = replace(replace(description, $t$de les attaquer comme$t$, $t$de l'attaquer comme$t$), $t$ils en voulaient à leur vie$t$, $t$il en voulait à leur vie$t$) WHERE domaine='Chaos' AND nom='Rageur Fou' AND est_actif;
UPDATE prieres SET description = replace(replace(replace(description, $t$il est touchée$t$, $t$elle est touchée$t$), $t$entendre des murmures$t$, $t$entend des murmures$t$), $t$éprouver de la difficulté$t$, $t$éprouve de la difficulté$t$) WHERE domaine='Chaos' AND nom='Toucher de la folie' AND est_actif;
UPDATE prieres SET
  description = replace(replace(description, $t$ou moment de sa vie$t$, $t$ou des moments de sa vie$t$), $t$celui oubli les noms$t$, $t$celui d'oubli des noms$t$),
  description_tronc = replace(replace(description_tronc, $t$ou moment de sa vie$t$, $t$ou des moments de sa vie$t$), $t$celui oubli les noms$t$, $t$celui d'oubli des noms$t$)
WHERE domaine='Chaos' AND nom='Trou de mémoire' AND est_actif;
UPDATE prieres SET
  description = replace(description, $t$supplémentaire au lieu de 1$t$, $t$supplémentaires au lieu de 1$t$),
  paliers = replace(paliers::text, $t$supplémentaire au lieu de 1$t$, $t$supplémentaires au lieu de 1$t$)::jsonb
WHERE domaine='Chaos' AND nom='Complication magique' AND est_actif;
UPDATE prieres SET description = replace(replace(replace(description, $t$arrondie$t$, $t$arrondi$t$), $t$excédentaire de dégâts$t$, $t$excédent de dégâts$t$), $t$automatiquement si des points$t$, $t$automatiquement même si des points$t$) WHERE domaine='Éléments' AND nom='Bouclier Élémentaire' AND est_actif;
UPDATE prieres SET
  description = replace(description, $t$projectiles peuvent être$t$, $t$projectiles peut être$t$),
  description_tronc = replace(description_tronc, $t$projectiles peuvent être$t$, $t$projectiles peut être$t$)
WHERE domaine='Éléments' AND nom='Globe d''Air' AND est_actif;
UPDATE prieres SET
  description = replace(replace(description, $t$déjà recouvert de pierre$t$, $t$déjà recouvertes de pierre$t$), $t$sauf si ils sont$t$, $t$sauf s'ils sont$t$),
  description_tronc = replace(replace(description_tronc, $t$déjà recouvert de pierre$t$, $t$déjà recouvertes de pierre$t$), $t$sauf si ils sont$t$, $t$sauf s'ils sont$t$)
WHERE domaine='Éléments' AND nom='Peau de Pierre' AND est_actif;
UPDATE prieres SET description = replace(description, $t$Celle-ci doit tomber$t$, $t$Chaque cible doit tomber$t$) WHERE domaine='Éléments' AND nom='Noyade' AND est_actif;
UPDATE prieres SET
  description = replace(description, $t$électricité$t$, $t$foudre$t$),
  description_tronc = replace(description_tronc, $t$électricité$t$, $t$foudre$t$)
WHERE domaine='Éléments' AND nom='Déchaînement Élémentaire' AND est_actif;

-- ============ D. Courtes « Niv. » nettoyées (4) ============
UPDATE prieres SET description_courte = $t$La cible rit de façon incontrôlable : ne peut ni attaquer ni lancer de sort, se défend mal. À haut niveau, elle est aussi aveuglée.$t$ WHERE domaine='Chaos' AND nom='Fou Rire Incessant' AND est_actif;
UPDATE prieres SET description_courte = $t$Chaque sort lancé par la cible coûte +1 point de spiritualité (sans bonus d'effet). À haut niveau, +2.$t$ WHERE domaine='Chaos' AND nom='Complication magique' AND est_actif;
UPDATE prieres SET description_courte = $t$Bloque les projectiles physiques (flèches, carreaux, armes de lancer), en nombre croissant avec le niveau, jusqu'à tous. Bloquer → pointer + « Annule ».$t$ WHERE domaine='Éléments' AND nom='Globe d''Air' AND est_actif;
UPDATE prieres SET description_courte = $t$L'objet ciblé ne peut plus être soulevé (objet porté : niveau du sort vs porteur). À haut niveau, 2 objets, et le lanceur n'est pas affecté.$t$ WHERE domaine='Éléments' AND nom='Augmentation du poids' AND est_actif;

-- ============ E. Libellés paliers normalisés « Niveau X » → « Niv. X » (2) ============
UPDATE prieres SET paliers = replace(paliers::text, $t$"Niveau $t$, $t$"Niv. $t$)::jsonb WHERE domaine='Éléments' AND nom IN ('Tornade Martiale','Déchaînement Élémentaire') AND est_actif;
