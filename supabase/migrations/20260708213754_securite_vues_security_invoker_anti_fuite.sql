-- ============================================================================
-- Sécurité : force security_invoker sur les 29 vues restées en SECURITY DEFINER
-- ============================================================================
--
-- CONTEXTE / FAILLE
-- Les advisors Supabase remontaient 29 vues en `SECURITY DEFINER` (erreur
-- `security_definer_view`). Une vue definer s'exécute avec les droits de son
-- créateur (postgres) et CONTOURNE donc le RLS de l'appelant. Ces 29 vues
-- étaient en plus accordées (GRANT SELECT) au rôle `anon`.
--
-- Conséquence vérifiée en prod : un visiteur NON connecté pouvait lire
-- l'intégralité des données de jeu privées, par ex :
--   - `vue_fiche_personnage`            -> 98 fiches complètes (historique,
--                                          ame_personnage, XP, race…)
--   - `vue_inscriptions_par_evenement`  -> 48 inscriptions (qui joue à quel GN)
--   - `vue_tableau_de_bord`             -> 98 lignes
-- alors que les tables de base (personnages, profiles, inscriptions…) étaient,
-- elles, correctement protégées par RLS (0 ligne pour anon).
--
-- CAUSE RACINE RÉCURRENTE
-- Chaque `CREATE OR REPLACE VIEW … AS …` SANS la clause
-- `WITH (security_invoker = true)` REMET l'option à zéro et refait retomber la
-- vue en definer (déjà observé le 22 juin sur vue_journal_staff, corrigé par
-- 20260707132512). Tant que les futures redéfinitions n'incluent pas la clause,
-- la faille peut réapparaître. Voir la note « suivi » en fin de fichier.
--
-- CORRECTIF
-- `ALTER VIEW … SET (security_invoker = on)` sur les 29 vues. On NE touche PAS
-- au corps des vues (aucun risque de régression de contenu) : seule l'option de
-- sécurité change. Les vues respecteront désormais le RLS de l'utilisateur qui
-- les interroge.
--
-- VALIDATION (transactions annulées sur la prod, avant écriture) :
--   - anon                : ne voit plus AUCUNE vue privée (fiche/inscriptions/
--                           tableau/admin = 0) ; les 4 vues publiques
--                           (prochain_evenement, evenements_publies,
--                           competences_encyclopedie, traits_par_race) +
--                           le cimetière (stèles `statut='approuvee'`)
--                           restent lisibles via le RLS public des tables.
--   - joueur (authentifié): voit ses propres fiche/persos/banque/XP.
--   - admin + mode staff  : revoit l'intégralité (98 fiches, 48 inscriptions,
--                           stats) — comportement inchangé.
--
-- NOTE COMPORTEMENTALE À CONFIRMER
-- Sous security_invoker, un joueur NON-staff ne peut plus lire par `id` la fiche
-- d'un AUTRE joueur (le RLS `personnages` limite à compte_voit_joueur OU staff).
-- C'était précisément une partie de la fuite. Si un écran « consulter la fiche
-- d'un autre joueur » destiné aux joueurs ordinaires existait, il faudra le
-- rebrancher sur une vue publique dédiée et filtrée (et non sur le mode definer).
--
-- Idempotent : rejouable sans effet de bord.
-- ============================================================================

-- ── Vues « fiche / personnage » (privées : propriétaire + staff) ────────────
ALTER VIEW public.vue_fiche_personnage            SET (security_invoker = on);
ALTER VIEW public.vue_personnage_etat             SET (security_invoker = on);
ALTER VIEW public.vue_personnage_creation_complet SET (security_invoker = on);
ALTER VIEW public.vue_personnages_joueur          SET (security_invoker = on);
ALTER VIEW public.vue_xp_personnage               SET (security_invoker = on);
ALTER VIEW public.vue_competences_personnage      SET (security_invoker = on);
ALTER VIEW public.vue_sorts_personnage            SET (security_invoker = on);
ALTER VIEW public.vue_prieres_personnage          SET (security_invoker = on);
ALTER VIEW public.vue_recettes_personnage         SET (security_invoker = on);
ALTER VIEW public.vue_assemblages_personnage      SET (security_invoker = on);
ALTER VIEW public.vue_artisanat_etat              SET (security_invoker = on);
ALTER VIEW public.vue_artisanat_quotas            SET (security_invoker = on);
ALTER VIEW public.vue_domaines_disponibles        SET (security_invoker = on);
ALTER VIEW public.vue_banque_joueur               SET (security_invoker = on);

-- ── Vues « inscriptions / tableau de bord » (privées : propriétaire + staff) ─
ALTER VIEW public.vue_inscriptions_par_evenement  SET (security_invoker = on);
ALTER VIEW public.vue_inscriptions_resumees       SET (security_invoker = on);
ALTER VIEW public.vue_tableau_de_bord             SET (security_invoker = on);

-- ── Vues « admin / staff » (gardées par le mode staff des RLS/helpers) ───────
ALTER VIEW public.vue_personnages_admin           SET (security_invoker = on);
ALTER VIEW public.vue_personnages_admin_complet   SET (security_invoker = on);
ALTER VIEW public.vue_stats_admin                 SET (security_invoker = on);
ALTER VIEW public.vue_evenements_admin            SET (security_invoker = on);
ALTER VIEW public.vue_competences_maitre_admin    SET (security_invoker = on);
ALTER VIEW public.vue_demandes_morts_attente      SET (security_invoker = on);
ALTER VIEW public.vue_demandes_races_attente      SET (security_invoker = on);

-- ── Vues « cimetière » (publique : stèles approuvées via RLS de `cimetiere`) ─
ALTER VIEW public.vue_cimetiere                    SET (security_invoker = on);

-- ── Vues « contenu public » (restent lisibles par anon via RLS des tables) ──
ALTER VIEW public.vue_prochain_evenement          SET (security_invoker = on);
ALTER VIEW public.vue_evenements_publies          SET (security_invoker = on);
ALTER VIEW public.vue_competences_encyclopedie    SET (security_invoker = on);
ALTER VIEW public.vue_traits_par_race             SET (security_invoker = on);

-- ============================================================================
-- SUIVI RECOMMANDÉ (hors périmètre de cette migration)
--  1. Garde CI : refuser tout `CREATE OR REPLACE VIEW public.…` qui n'inclut
--     pas `WITH (security_invoker = true)` (empêche la réapparition de la faille).
--  2. Fonction sensible `creer_notification_staff` : ajouter une garde de rôle.
--  3. `REVOKE EXECUTE … FROM anon` sur les fonctions métier non publiques.
-- ============================================================================
