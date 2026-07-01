-- Dépeçage : achat unique par niveau (retrait du choix par famille).
-- Les familles dépeçables suivent désormais Connaissances des Créatures.

-- 1) La compétence devient simple, sans choix de famille.
UPDATE competences
SET type_achat = 'simple', type_choix = NULL
WHERE id = '82159693-1e88-4a8d-9dca-e6dcc25a4a42'
  AND (type_achat <> 'simple' OR type_choix IS NOT NULL);

-- 2) Remboursement de l'XP des doublons (rang > 1 par perso/niveau).
--    Le trigger sync_xp_personnage resynchronise xp_depense automatiquement.
INSERT INTO historique_xp
  (personnage_id, type_mouvement, montant, description, competence_id, acteur_id)
SELECT personnage_id, 'remboursement', xp_depense,
       'Remboursement Dépeçage — correction : achat unique par niveau',
       '82159693-1e88-4a8d-9dca-e6dcc25a4a42'::uuid,
       '8e63a4a6-0577-48f2-b073-1ec85c9b3e00'::uuid
FROM (
  SELECT personnage_id, xp_depense,
         row_number() OVER (
           PARTITION BY personnage_id, niveau_acquis
           ORDER BY date_acquisition, id
         ) AS rn
  FROM personnage_competences
  WHERE competence_id = '82159693-1e88-4a8d-9dca-e6dcc25a4a42'
) t
WHERE rn > 1;

-- 3) Suppression des lignes doublons.
DELETE FROM personnage_competences pc
USING (
  SELECT id,
         row_number() OVER (
           PARTITION BY personnage_id, niveau_acquis
           ORDER BY date_acquisition, id
         ) AS rn
  FROM personnage_competences
  WHERE competence_id = '82159693-1e88-4a8d-9dca-e6dcc25a4a42'
) t
WHERE pc.id = t.id AND t.rn > 1;

-- 4) Les lignes Dépeçage conservées n'ont plus de famille.
UPDATE personnage_competences
SET choix_achat = NULL
WHERE competence_id = '82159693-1e88-4a8d-9dca-e6dcc25a4a42'
  AND choix_achat IS NOT NULL;
