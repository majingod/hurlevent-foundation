-- Phase 5.4b : Alignement display prereq de Grande Messe avec le moteur d'achat
--
-- Découverte session 20 : pour la compétence "Grande Messe" (categorie='pretre'),
-- la colonne `prerequis_competences` (jsonb structuré, vérifié par peut_acheter_competence)
-- impose déjà "Connaissances des Religions" niveau 1 pour les 3 niveaux. Mais le champ
-- display `niveaux[i].prerequis` (texte affiché aux joueurs dans le frontend) affichait
-- encore "Religion" pour le niveau 1, créant une incohérence DB-interne entre ce qui est
-- displayé et ce qui est effectivement vérifié.
--
-- Décision Fred (session 20) : aligner le texte display sur le moteur, sur les 3 niveaux.
-- Écart assumé vs Manuel des règles 2026 édition 6 mai (qui dit "Prérequis : Religion"
-- pour les 3 niveaux) — sera corrigé édition suivante du manuel.
--
-- Idempotence : filtre `niveaux->0->>'prerequis' = 'Religion'` → 2e exécution = no-op.

UPDATE competences
   SET niveaux = jsonb_set(
                   jsonb_set(
                     jsonb_set(niveaux, '{0,prerequis}', '"Connaissances des Religions"'),
                     '{1,prerequis}', '"Connaissances des Religions, Grande Messe 1"'),
                   '{2,prerequis}', '"Connaissances des Religions, Grande Messe 2"')
 WHERE nom = 'Grande Messe'
   AND niveaux->0->>'prerequis' = 'Religion';
