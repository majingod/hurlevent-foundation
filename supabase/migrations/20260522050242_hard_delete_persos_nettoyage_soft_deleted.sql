-- Migration session 22 : nettoyage des personnages soft-deleted
-- Contexte : avant cette migration, le bouton "Supprimer" du tableau de bord
-- faisait un UPDATE est_actif=false (soft delete trompeur).
-- Décision session 22 : basculer en hard delete (cf. PR associée).
-- Cette migration nettoie l'historique des 28 fantômes accumulés.
--
-- Idempotente : si rejouée, ne supprime rien (les soft-deleted seront déjà
-- partis et le frontend ne crée plus de soft-deleted après le merge de la PR).
--
-- Cascade vérifiée :
--   - 10 FK vers personnages.id en ON DELETE CASCADE
--   - 1 FK (inscriptions_evenements.personnage_id) en NO ACTION
--     non-problématique : 0 inscription en base actuellement

DELETE FROM personnages WHERE est_actif = false;
