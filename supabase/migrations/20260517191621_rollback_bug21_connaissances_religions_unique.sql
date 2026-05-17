-- ============================================================
-- Rollback Bug #21 — Connaissances des Religions reste en 1 achat
-- ============================================================
-- Décision métier (confirmée session 7) : la règle actuelle est en
-- réalité "1 seul achat" avec religion forcée pour les croyants. Le
-- Manuel des règles 2026 est obsolète sur ce point.
--
-- On annule la bascule type_achat 'unique_avec_choix' → 'multiple_langue'
-- effectuée dans la migration 20260517182730.
--
-- IMPORTANT : on CONSERVE volontairement les 2 messages d'erreur
-- génériquées dans la branche multiple_langue de peut_acheter_competence
-- (ils restent valides pour Langue supplémentaire / Décryptage qui
-- utilisent toujours ce type_achat).
-- ============================================================

UPDATE competences
SET type_achat = 'unique_avec_choix'
WHERE nom = 'Connaissances des Religions'
  AND type_achat = 'multiple_langue';
