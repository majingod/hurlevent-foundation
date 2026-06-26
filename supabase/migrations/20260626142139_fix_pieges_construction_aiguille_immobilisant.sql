-- Audit s282 : la base avait inverse/duplique les recettes de construction.
-- Aiguille empoisonnee portait la recette de l'Immobilisant ; l'Immobilisant
-- portait un doublon de Confusion sanguine. Source : manuel corrige, section
-- "Construction des pieges". Confusion sanguine reste inchangee.

UPDATE pieges
SET construction = $c$Construction : 10 min (ou 7 écu)
Armement (---) : aiguille d'au moins 3 pouces (ou 6 écu)
Préparation (===) : 1 dose de Manille (ou 11 écu)
Quincaillerie (---) : 2 petits ressorts (ou 7 écu)
Déclencheur (---) : 1 petit crochet de fer (ou 2 écu)$c$
WHERE nom = 'Aiguille empoisonnée' AND niveau = 1;

UPDATE pieges
SET construction = $c$Construction : 15 min (ou 9 écu)
Récipient (---) : 2 bourses en cuir (ou 10 écu)
Déclencheur (---) : 4 pieds de ficelle (ou 1 écu)
Armement (===) : 1 dose de Poulfis (ou 11 écu)
Préparation (---) : 1 bol (ou 1 écu)
Potentiel (---) : 3 pincées de gros sel (ou 1 écu)$c$
WHERE nom = 'Piège immobilisant' AND niveau = 1;
