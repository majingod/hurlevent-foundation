-- Abreges FICHES-CONDENSEES pour les pieges (s282). 1 abrege par TYPE,
-- applique aux 3 niveaux (effet constant ; seuls les chiffres scalent).
-- Procedure rigoureuse 5 roles : reduction sans perte, terminologie au mot pres.

UPDATE pieges SET resume_condense = $r$Fait tomber la cible à 2 PV ; pas de guérison sans antidote.$r$ WHERE nom = 'Aiguille empoisonnée';
UPDATE pieges SET resume_condense = $r$Plonge les cibles en rage : elles attaquent tout ce qui les entoure.$r$ WHERE nom = 'Confusion sanguine';
UPDATE pieges SET resume_condense = $r$Inflige des dégâts directs à la cible.$r$ WHERE nom = 'Fléchette cachée';
UPDATE pieges SET resume_condense = $r$Inflige des dégâts qui ignorent l'armure.$r$ WHERE nom = 'Fumée toxique';
UPDATE pieges SET resume_condense = $r$Aveugle la cible.$r$ WHERE nom = 'Piège aveuglant';
UPDATE pieges SET resume_condense = $r$Rend inutilisable la main qui a déclenché le piège.$r$ WHERE nom = 'Piège brise-doigts';
UPDATE pieges SET resume_condense = $r$Abaisse la résistance aux sorts de la cible.$r$ WHERE nom = 'Piège d''hébêtement';
UPDATE pieges SET resume_condense = $r$Prive la cible de la parole.$r$ WHERE nom = 'Piège de mutisme';
UPDATE pieges SET resume_condense = $r$Paralyse la cible.$r$ WHERE nom = 'Piège immobilisant';
