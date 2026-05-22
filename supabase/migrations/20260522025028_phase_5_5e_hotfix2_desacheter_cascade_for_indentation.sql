-- ============================================================================
-- HOTFIX Sprint 5.5e (suite) : finit le filtre choix_achat dans la boucle FOR
-- ============================================================================
--
-- La migration 20260522024830 a corrigé le DELETE principal mais a raté le
-- bloc FOR (utilisé pour calculer v_lignes_supprimees et v_xp_total_rembourse)
-- à cause d'une différence d'indentation : le DELETE utilise 8 espaces avant
-- AND, mais le FOR utilise 10 espaces (plus profondément niché).
--
-- Conséquence du bug intermédiaire (entre les 2 migrations) :
--  - Le DELETE était correct (seul l'achat ciblé + ses dépendants même choix
--    supprimés) → bug fonctionnel résolu.
--  - MAIS v_xp_total_rembourse était calculé sur la portée trop large (sans
--    filtre choix_achat), donc le remboursement XP était surestimé.
--  - Pas de cas réel constaté en prod (la session 21 a appliqué les deux
--    migrations de suite sans interruption).
--
-- Cette migration aligne le filtre choix_achat sur le bloc FOR.
-- Idempotence : rejouer = no-op (replace ne trouve plus le motif d'origine).
-- ============================================================================

DO $$
DECLARE
  v_def text;
BEGIN
  v_def := pg_get_functiondef('public.desacheter_competence(uuid)'::regprocedure);

  v_def := replace(v_def,
    'WHERE personnage_id = v_pc.personnage_id
          AND competence_id = v_pc.competence_id
          AND niveau_acquis >= v_pc.niveau_acquis
        ORDER BY niveau_acquis DESC',
    'WHERE personnage_id = v_pc.personnage_id
          AND competence_id = v_pc.competence_id
          AND niveau_acquis >= v_pc.niveau_acquis
          AND (
            v_comp.type_achat <> ''multiple_avec_choix_par_niveau''
            OR v_pc.choix_achat IS NULL
            OR choix_achat = v_pc.choix_achat
          )
        ORDER BY niveau_acquis DESC'
  );

  EXECUTE v_def;
END $$;
