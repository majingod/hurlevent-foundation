-- ============================================================================
-- HOTFIX Sprint 5.5e : cascade desacheter_competence par choix_achat
--                     pour les multiple_avec_choix_par_niveau
-- ============================================================================
--
-- Bug détecté en prod (session 21) après PR #122 :
-- Quand on désache un achat de type multiple_avec_choix_par_niveau (par
-- exemple Connaissances Criminelles niveau 2 famille X, ou Connaissances
-- des Créatures niveau 1 catégorie X), la cascade actuelle supprime TOUS
-- les achats ayant niveau_acquis >= N pour cette compétence, sans filtrer
-- sur choix_achat. Donc les niveaux 2 d'autres familles ou catégories
-- sont également annulés à tort.
--
-- Comportement attendu :
--  - Si la ligne désachée a un choix_achat défini → cascade UNIQUEMENT
--    sur les achats de même choix_achat (même niveau ou supérieur).
--  - Si la ligne désachée a choix_achat = NULL (cas Connaissances
--    Criminelles niveau 1 = savoir général) → cascade sur tout (logique
--    actuelle conservée : annuler le savoir général annule aussi tout
--    achat spécifique).
--  - Pour simple / unique_avec_choix : cascade par niveau inchangée.
--
-- Bug ancien, pas une régression du Sprint 5.5. La détection a été faite
-- pour la première fois après PR #122 (fix Connaissances Criminelles)
-- car le scénario "plusieurs familles niveau 2" est désormais utilisé.
--
-- Approche : pg_get_functiondef + 2 replace() chirurgicaux + EXECUTE
-- dynamique. Plus sûr que la re-saisie manuelle de la fonction complète
-- (160 lignes).
--
-- Idempotence : rejouer la migration sur une base déjà à jour est un
-- no-op (replace ne trouve plus le motif d'origine).
-- ============================================================================

DO $$
DECLARE
  v_def text;
BEGIN
  v_def := pg_get_functiondef('public.desacheter_competence(uuid)'::regprocedure);

  -- 1) Filtre dans la boucle FOR (utilisée pour calculer v_lignes_supprimees)
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

  -- 2) Même filtre dans le DELETE principal
  v_def := replace(v_def,
    'DELETE FROM personnage_competences
      WHERE personnage_id = v_pc.personnage_id
        AND competence_id = v_pc.competence_id
        AND niveau_acquis >= v_pc.niveau_acquis;',
    'DELETE FROM personnage_competences
      WHERE personnage_id = v_pc.personnage_id
        AND competence_id = v_pc.competence_id
        AND niveau_acquis >= v_pc.niveau_acquis
        AND (
          v_comp.type_achat <> ''multiple_avec_choix_par_niveau''
          OR v_pc.choix_achat IS NULL
          OR choix_achat = v_pc.choix_achat
        );'
  );

  EXECUTE v_def;
END $$;
