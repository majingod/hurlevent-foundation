-- Corrections verbatim manuel des descriptions de pièges (Sprint pièges, PR-1 data).
-- Option B : le texte `effets` contient la description nue ; le « Effet de niveau N »
-- vit dans la colonne `niveau_effet` (déjà peuplée pour 7 familles).
-- + Décision game-design : Fléchette cachée et Fumée toxique = dégâts bruts imparables
--   → niveau_effet = 20 (le manuel ne leur donne pas de niveau d'effet).
-- Idempotent : UPDATE ciblés par nom + niveau, ré-exécutables sans effet de bord.

-- Confusion sanguine : formulation verbatim manuel (accord « elle » corrigé, micro-correction validée)
UPDATE pieges SET effets = 'Toute personne se trouvant dans le rayon du piège est lancée dans une rage et attaque quiconque se trouve autour d''elle.'
WHERE nom = 'Confusion sanguine' AND niveau IN (1,2,3) AND est_actif = true;

-- Fumée toxique : ajout du point final sur cible (verbatim manuel)
UPDATE pieges SET cible = 'Rayon de 3 pieds autour de la carte du piège.' WHERE nom='Fumée toxique' AND niveau=1 AND est_actif=true;
UPDATE pieges SET cible = 'Rayon de 4 pieds autour de la carte du piège.' WHERE nom='Fumée toxique' AND niveau=2 AND est_actif=true;
UPDATE pieges SET cible = 'Rayon de 6 pieds autour de la carte du piège.' WHERE nom='Fumée toxique' AND niveau=3 AND est_actif=true;

-- Piège brise-doigts : ajout de la durée dans l'effet (verbatim manuel ; « Effet de niveau » retiré → vit dans niveau_effet)
UPDATE pieges SET effets = 'Empêche la cible d''utiliser la main ayant activé le piège pendant 30 secondes.' WHERE nom='Piège brise-doigts' AND niveau=1 AND est_actif=true;
UPDATE pieges SET effets = 'Empêche la cible d''utiliser la main ayant activé le piège pendant 10 minutes.' WHERE nom='Piège brise-doigts' AND niveau=2 AND est_actif=true;
UPDATE pieges SET effets = 'Empêche la cible d''utiliser la main ayant activé le piège pendant 30 minutes.' WHERE nom='Piège brise-doigts' AND niveau=3 AND est_actif=true;

-- Piège d'hébêtement : verbatim manuel (« du piège », « au sort »)
UPDATE pieges SET effets = 'La cible du piège voit son niveau de résistance au sort réduit de 3 niveaux.' WHERE nom='Piège d''hébêtement' AND niveau=1 AND est_actif=true;
UPDATE pieges SET effets = 'La cible du piège voit son niveau de résistance au sort réduit de 5 niveaux.' WHERE nom='Piège d''hébêtement' AND niveau=2 AND est_actif=true;
UPDATE pieges SET effets = 'La cible du piège voit son niveau de résistance au sort réduit de 6 niveaux.' WHERE nom='Piège d''hébêtement' AND niveau=3 AND est_actif=true;

-- Décision game-design Fred : Fléchette cachée + Fumée toxique = dégâts bruts imparables → niveau_effet = 20
UPDATE pieges SET niveau_effet = 20 WHERE nom IN ('Fléchette cachée','Fumée toxique') AND niveau IN (1,2,3) AND est_actif = true;
