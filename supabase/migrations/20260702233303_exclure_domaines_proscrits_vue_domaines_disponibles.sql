-- Les domaines proscrits par la religion ne doivent jamais être « disponibles ».
-- Le manuel : « les domaines proscrits ne peuvent être achetés ».
-- Cette vue est la source de vérité consommée par acheter_priere / modifier_priere /
-- valider_etape_7 et l'étape 7 : en excluant les proscrits ici, on comble le trou
-- serveur (achat de prières d'un domaine proscrit acquis) en un seul point.
CREATE OR REPLACE VIEW public.vue_domaines_disponibles AS
SELECT pc.personnage_id,
       pc.choix_achat AS domaine,
       CASE max(pc.niveau_acquis)
           WHEN 1 THEN 5
           WHEN 2 THEN 10
           WHEN 3 THEN 20
           ELSE NULL::integer
       END AS niveau_max_prieres
FROM personnage_competences pc
JOIN competences c ON pc.competence_id = c.id
JOIN personnages p ON p.id = pc.personnage_id
LEFT JOIN religions r ON r.id = p.religion_id
WHERE c.nom = 'Acquisition de Domaine'
  AND pc.choix_achat IS NOT NULL
  AND (r.domaines_proscrits IS NULL OR NOT (pc.choix_achat = ANY (r.domaines_proscrits)))
GROUP BY pc.personnage_id, pc.choix_achat;
