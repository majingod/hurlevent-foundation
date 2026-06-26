-- Marquer explicitement les objets qui NE se réparent PAS (seul Arc / Arbalète aujourd'hui).
-- Les objets sans réparation liée NI marqués non_reparable seront affichés « à préciser Animation ».
ALTER TABLE objets_forge ADD COLUMN IF NOT EXISTS non_reparable boolean NOT NULL DEFAULT false;
UPDATE objets_forge SET non_reparable=true WHERE nom='Arc / Arbalète';
