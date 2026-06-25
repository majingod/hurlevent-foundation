-- Fix s280 : réactiver Petit bouclier + Grand bouclier / Pavois (gardés inactifs par erreur au merge phase 1). Idempotent.
UPDATE public.objets_forge SET est_actif = true
 WHERE type = 'bouclier' AND nom IN ('Petit bouclier', 'Grand bouclier / Pavois');
