-- s395 · Les réparations de forge : les boucliers se mesurent par la TAILLE,
-- et les accessoires d'armure deviennent réparables.
--
-- Source : apport de contenu de Fred (2026-08-11), confirmé et destiné à faire foi.
-- Le manuel indexait la réparation d'un bouclier sur ses points d'armure
-- (« 1 pépite métal + fer / PA »), ce qui était infigeable : la migration
-- 20260625223136 avait posé materiaux_a_preciser = true sur les 3 boucliers
-- pour marquer la question ouverte. Elle se ferme ici, par la taille.
--
-- Les 6 accessoires d'armure (type = 'accessoire') sont réparables et n'avaient
-- AUCUNE ligne de réparation : un joueur cherchant à réparer ses brassards ne
-- trouvait rien. Le manuel les nomme « Accessoire d'armure » (section armures).
--
-- ⛔ HORS PÉRIMÈTRE, décision de Fred : « Arme de jet » reste déliée (la migration
-- 20260625223136 l'a déliée EXPRÈS, le lien vers « Projectile » était une erreur),
-- et « Arme d'hast et bâton » reste orpheline faute de chiffres au manuel.
-- ⛔ AUCUN renommage : « Arme courte » reste « Arme courte » (20260625223136 aligne
-- les noms de réparation sur ceux des objets — décision de Fred, fidélité au manuel).
--
-- REPLI, DEUX gestes (la FK objets_forge_reparation_id_fkey est en NO ACTION) :
--   UPDATE public.objets_forge SET reparation_id = NULL WHERE type = 'accessoire';
--   DELETE FROM public.reparations_forge WHERE nom_affichage = 'Accessoire d''armure';
--   UPDATE public.reparations_forge SET materiaux = '1 pépite métal + 1 pépite fer',
--     materiaux_rares = '1 pépite orichalcum', materiaux_a_preciser = true
--     WHERE categorie = 'bouclier';
-- Idempotente.

UPDATE public.reparations_forge SET
  materiaux       = '2 pépites métal + 2 pépites fer',
  materiaux_rares = '2 pépites orichalcum'
WHERE nom_affichage = 'Bouclier moyen';

UPDATE public.reparations_forge SET
  materiaux       = '3 pépites métal + 3 pépites fer',
  materiaux_rares = '3 pépites orichalcum'
WHERE nom_affichage = 'Grand bouclier / Pavois';

-- Le petit bouclier portait déjà les bonnes valeurs : seul son drapeau tombe.
UPDATE public.reparations_forge SET materiaux_a_preciser = false
WHERE categorie = 'bouclier' AND materiaux_a_preciser;

INSERT INTO public.reparations_forge
  (categorie, nom_affichage, temps_minutes, temps_rare_minutes,
   materiaux, materiaux_rares, materiaux_a_preciser, est_actif)
SELECT 'armure', 'Accessoire d''armure', 5, 20,
       '1 pépite métal + 1 pépite fer', '1 pépite orichalcum', false, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.reparations_forge WHERE nom_affichage = 'Accessoire d''armure');

UPDATE public.objets_forge o SET reparation_id = r.id
FROM public.reparations_forge r
WHERE r.nom_affichage = 'Accessoire d''armure'
  AND o.type = 'accessoire'
  AND o.non_reparable = false
  AND o.reparation_id IS DISTINCT FROM r.id;
