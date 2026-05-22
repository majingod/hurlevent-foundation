-- ============================================================================
-- HOTFIX Sprint 5.5c : aligne vue_personnage_etat + 2 RPC sur "Connaissances
-- des Créatures" (suite à la régression introduite par PR #120)
-- ============================================================================
--
-- Contexte : la migration 20260522012006 (Sprint 5.5b) a renommé "Connaissance
-- des Créatures" en "Connaissances des Créatures" dans la table competences,
-- mais 3 objets PL/pgSQL référencent encore ce nom par littéral :
--
--  1. vue_personnage_etat : 2 occurrences dans le calcul de
--     a_connaissance_creatures_1 et a_connaissance_creatures_2. Ces flags
--     retournaient toujours false → l'achat de Dépeçage était bloqué pour
--     tous les persos.
--
--  2. peut_acheter_competence : 6 occurrences (2 jointures + 4 messages).
--     Les 2 jointures sur c3.nom et c4.nom bloquaient également la
--     correspondance catégorie de créature ↔ Dépeçage.
--
--  3. verifier_prerequis_competences : 2 occurrences (messages d'erreur).
--     Cosmétique uniquement, mais corrigé pour cohérence.
--
-- Approche : on récupère la définition courante des 2 fonctions via
-- pg_get_functiondef, on remplace l'ancien nom par le nouveau, puis on
-- exécute dynamiquement. Évite la re-saisie manuelle de ~150 lignes par
-- fonction (qui multiplierait les risques d'erreur).
--
-- Idempotence : rejouer la migration sur une base déjà à jour est un no-op
-- (replace() ne trouve plus l'ancien nom et CREATE OR REPLACE est idempotent).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) vue_personnage_etat : régénération avec le nouveau nom
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.vue_personnage_etat
WITH (security_invoker = true) AS
SELECT p.id AS personnage_id,
    p.joueur_id,
    COALESCE(p.xp_total, 0) - COALESCE(p.xp_depense, 0) AS xp_disponible,
    p.niveau,
    COALESCE(max(
        CASE
            WHEN c.nom = 'Alchimie'::text THEN pc.niveau_acquis
            ELSE NULL::integer
        END), 0) AS niveau_alchimie,
    COALESCE(max(
        CASE
            WHEN c.nom = 'Forge'::text THEN pc.niveau_acquis
            ELSE NULL::integer
        END), 0) AS niveau_forge,
    COALESCE(max(
        CASE
            WHEN c.nom = 'Joaillerie'::text THEN pc.niveau_acquis
            ELSE NULL::integer
        END), 0) AS niveau_joaillerie,
    COALESCE(max(
        CASE
            WHEN c.nom = 'Assemblage de Runes'::text THEN pc.niveau_acquis
            ELSE NULL::integer
        END), 0) AS niveau_runes,
    COALESCE(max(
        CASE
            WHEN c.nom = 'Acquisition de Cercle'::text THEN pc.niveau_acquis
            ELSE NULL::integer
        END), 0) AS niveau_cercle,
    COALESCE(max(
        CASE
            WHEN c.nom = 'Acquisition de Domaine'::text THEN pc.niveau_acquis
            ELSE NULL::integer
        END), 0) AS niveau_domaine,
    COALESCE(bool_or(c.nom = 'Connaissances des Religions'::text AND pc.niveau_acquis >= 1), false) AS a_connaissance_religions,
    COALESCE(bool_or(c.nom = 'Premiers Soins'::text AND pc.niveau_acquis >= 1), false) AS a_premiers_soins,
    COALESCE(bool_or(c.nom = 'Connaissances des Créatures'::text AND pc.niveau_acquis >= 1), false) AS a_connaissance_creatures_1,
    COALESCE(bool_or(c.nom = 'Connaissances des Créatures'::text AND pc.niveau_acquis >= 2), false) AS a_connaissance_creatures_2
FROM personnages p
LEFT JOIN personnage_competences pc ON pc.personnage_id = p.id
LEFT JOIN competences c ON c.id = pc.competence_id
GROUP BY p.id, p.joueur_id, p.xp_total, p.xp_depense, p.niveau;

-- ----------------------------------------------------------------------------
-- 2) peut_acheter_competence + verifier_prerequis_competences :
--    REPLACE dynamique de l'ancien nom par le nouveau
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  v_def text;
BEGIN
  v_def := pg_get_functiondef('public.peut_acheter_competence(uuid, uuid, integer, text)'::regprocedure);
  v_def := replace(v_def, 'Connaissance des Créatures', 'Connaissances des Créatures');
  EXECUTE v_def;

  v_def := pg_get_functiondef('public.verifier_prerequis_competences(uuid)'::regprocedure);
  v_def := replace(v_def, 'Connaissance des Créatures', 'Connaissances des Créatures');
  EXECUTE v_def;
END $$;
