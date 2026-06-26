-- Pièges v5 : magnitude (valeur chiffrée variable → colonne tableau) + effet_generique (phrase d'effet sans le chiffre/durée, pour l'encyclopédie). N'altère PAS effets (wizard/fiche/imprimable en dépendent).
ALTER TABLE public.pieges ADD COLUMN IF NOT EXISTS magnitude text;
ALTER TABLE public.pieges ADD COLUMN IF NOT EXISTS magnitude_label text;
ALTER TABLE public.pieges ADD COLUMN IF NOT EXISTS effet_generique text;

-- magnitude / magnitude_label : 3 pièges chiffrés, par niveau
UPDATE public.pieges SET magnitude_label='Dégâts', magnitude='4'  WHERE nom='Fléchette cachée' AND niveau=1;
UPDATE public.pieges SET magnitude_label='Dégâts', magnitude='7'  WHERE nom='Fléchette cachée' AND niveau=2;
UPDATE public.pieges SET magnitude_label='Dégâts', magnitude='10' WHERE nom='Fléchette cachée' AND niveau=3;

UPDATE public.pieges SET magnitude_label='Dégâts', magnitude='3'  WHERE nom='Fumée toxique' AND niveau=1;
UPDATE public.pieges SET magnitude_label='Dégâts', magnitude='4'  WHERE nom='Fumée toxique' AND niveau=2;
UPDATE public.pieges SET magnitude_label='Dégâts', magnitude='5'  WHERE nom='Fumée toxique' AND niveau=3;

UPDATE public.pieges SET magnitude_label='Réduction', magnitude='-3 niveaux' WHERE nom='Piège d''hébêtement' AND niveau=1;
UPDATE public.pieges SET magnitude_label='Réduction', magnitude='-5 niveaux' WHERE nom='Piège d''hébêtement' AND niveau=2;
UPDATE public.pieges SET magnitude_label='Réduction', magnitude='-6 niveaux' WHERE nom='Piège d''hébêtement' AND niveau=3;

-- effet_generique : 4 pièges à effet variable (même phrase sur les 3 niveaux). NULL ailleurs → le composant retombe sur effets.
UPDATE public.pieges SET effet_generique='Produit des dégâts à la cible du piège.'                                  WHERE nom='Fléchette cachée';
UPDATE public.pieges SET effet_generique='Tout individu dans le rayon du piège reçoit des dégâts ignorant l''armure.' WHERE nom='Fumée toxique';
UPDATE public.pieges SET effet_generique='La cible du piège voit son niveau de résistance au sort réduit.'           WHERE nom='Piège d''hébêtement';
UPDATE public.pieges SET effet_generique='Empêche la cible d''utiliser la main ayant activé le piège.'               WHERE nom='Piège brise-doigts';
