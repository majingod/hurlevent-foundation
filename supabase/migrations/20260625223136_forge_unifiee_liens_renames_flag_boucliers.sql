-- A. Aligner les noms de réparation sur les objets
UPDATE reparations_forge SET nom_affichage='Arme courte'  WHERE nom_affichage='Arme légère (≤45 cm)';
UPDATE reparations_forge SET nom_affichage='Arme moyenne' WHERE nom_affichage='Arme moyenne (45–80 cm)';
UPDATE reparations_forge SET nom_affichage='Arme longue'  WHERE nom_affichage='Arme longue (80–110 cm)';
UPDATE reparations_forge SET nom_affichage='Arme lourde'  WHERE nom_affichage='Arme lourde (110–160 cm)';

-- B. Reconnecter les boucliers à leur réparation
UPDATE objets_forge SET reparation_id=(SELECT id FROM reparations_forge WHERE nom_affichage='Petit bouclier')           WHERE nom='Petit bouclier';
UPDATE objets_forge SET reparation_id=(SELECT id FROM reparations_forge WHERE nom_affichage='Grand bouclier / Pavois') WHERE nom='Grand bouclier / Pavois';

-- C. Délier Arme de jet (pointait par erreur vers Projectile)
UPDATE objets_forge SET reparation_id=NULL WHERE nom='Arme de jet';

-- D. Renommer l'objet (aligne avec artisanat.ts + manuel)
UPDATE objets_forge SET nom='Arme d''hast et bâton' WHERE nom='Arme d''hast';

-- E. Marquer les matériaux de réparation des boucliers « à préciser » (non destructif)
ALTER TABLE reparations_forge ADD COLUMN IF NOT EXISTS materiaux_a_preciser boolean NOT NULL DEFAULT false;
UPDATE reparations_forge SET materiaux_a_preciser=true
 WHERE nom_affichage IN ('Petit bouclier','Bouclier moyen','Grand bouclier / Pavois');
