-- Abrégés resume_condense pour les 21 compétences générales (1 phrase, depuis manuel corrigé).
-- Idempotent : UPDATE par (categorie, nom). Cible categorie='generale' pour ne jamais toucher un homonyme d'une autre classe.
UPDATE competences c
SET resume_condense = v.abrege
FROM (VALUES
 ('Connaissances Criminelles', $a$Donne une connaissance du milieu criminel régional, puis un contact dans une famille, et enfin l'intégration complète à une organisation criminelle.$a$),
 ('Connaissances des Créatures', $a$Permet d'étudier une catégorie de créatures au choix (achetable plusieurs fois) pour les identifier en jeu, le niveau 2 débloquant les créatures rares de la catégorie.$a$),
 ('Connaissances des Gemmes Communes', $a$Permet d'identifier les gemmes communes et d'en connaître les propriétés.$a$),
 ('Connaissances des Gemmes Rares', $a$Permet d'identifier les gemmes rares et d'en connaître les propriétés.$a$),
 ('Connaissances des Herbes Communes', $a$Permet de connaître les propriétés, la maturité et l'abondance des herbes alchimiques communes.$a$),
 ('Connaissances des Herbes Rares', $a$Permet de connaître les propriétés, la maturité et l'abondance des herbes alchimiques rares.$a$),
 ('Connaissances des Métaux Communs', $a$Permet d'identifier les métaux et alliages communs (pépites, lingots) et d'en connaître les propriétés.$a$),
 ('Connaissances des Métaux Rares', $a$Permet d'identifier les métaux et alliages rares et légendaires et d'en connaître les propriétés.$a$),
 ('Connaissances des Religions', $a$Donne la connaissance complète d'une religion au choix (mœurs, rites, dogmes, domaines), achetable plusieurs fois pour d'autres religions mais sans cumuler d'appartenance.$a$),
 ('Connaissances des Runes', $a$Permet de connaître, reconnaître et tracer les runes qui canalisent l'énergie magique des rituels et objets.$a$),
 ('Connaissances Héraldique', $a$Permet de connaître les maisons nobles des Badlands, leurs emblèmes et habitudes, ainsi que l'étiquette de cour.$a$),
 ('Dépeçage', $a$Permet de récolter des ressources sur les créatures tuées dont on possède la Connaissance des Créatures correspondante, l'état du corps pouvant rendre certaines composantes inutilisables.$a$),
 ('Estimation', $a$Permet d'estimer la valeur des monnaies et des objets, des biens communs jusqu'aux trésors rares, magiques et légendaires selon le niveau.$a$),
 ('Frénésie magique', $a$Permet à un lanceur à court d'essence de convertir ses points de vie en spiritualité (1 pour 1), ces dégâts ne se soignant que magiquement ou au repos.$a$),
 ('Herbalisme', $a$Permet de récolter des herbes communes au début de chaque événement (davantage selon le niveau) et d'accéder aux expéditions d'herbes rares.$a$),
 ('Hypnose', $a$Permet d'hypnotiser une cible pour la faire répondre avec sincérité, les niveaux supérieurs débloquant les souvenirs oubliés puis l'hypnose sur une cible non consentante.$a$),
 ('Langue supplémentaire', $a$Permet de parler une langue supplémentaire au choix (achetable plusieurs fois), la lecture et l'écriture exigeant en plus Linguistique et Mathématique.$a$),
 ('Linguistique et Mathématique', $a$Représente l'instruction de base permettant de lire, écrire le commun et manier les nombres et les calculs.$a$),
 ('Méditation', $a$Permet de récupérer de la spiritualité ou des points de vie par tranches de 15 minutes de calme, le rendement augmentant avec le niveau.$a$),
 ('Mineur', $a$Permet de récolter des métaux communs au début de chaque événement (davantage selon le niveau) et d'accéder aux expéditions de métaux rares.$a$),
 ('Revenu', $a$Procure 10 écus au début de chaque événement, représentant un travail effectué entre les jeux.$a$)
) AS v(nom, abrege)
WHERE c.categorie='generale' AND c.nom = v.nom;
