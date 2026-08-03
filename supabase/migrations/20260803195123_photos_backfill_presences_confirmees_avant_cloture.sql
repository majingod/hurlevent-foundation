-- s373 — Décision Fred : la photo de composition se prend à la CONFIRMATION de présence.
-- Rattrapage : photographier toute présence déjà confirmée dont la récompense n'est pas
-- versée, sur un événement non clôturé — dont les 32 du « 3e Gn Régulier 2026 », gelées
-- depuis le GN, donc photographiées telles que jouées. À appliquer AVANT le dégel
-- (20260803_*degel*), pour que la photo précède toute modification possible.
-- Idempotente (NOT EXISTS) et rejouable à froid (0 ligne si rien à rattraper).
INSERT INTO public.personnage_compo_photos (personnage_id, evenement_id, inscription_id, compo, acteur_id)
SELECT i.personnage_id, i.evenement_id, i.id,
       public.capturer_compo_personnage(i.personnage_id), NULL
FROM public.inscriptions_evenements i
JOIN public.evenements e ON e.id = i.evenement_id
WHERE i.statut = 'present'
  AND COALESCE(i.recompense_distribuee, false) = false
  AND i.personnage_id IS NOT NULL
  AND e.est_termine = false
  AND NOT EXISTS (SELECT 1 FROM public.personnage_compo_photos pcp WHERE pcp.inscription_id = i.id);
