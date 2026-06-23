-- s208 LOT 3 : DROP de 6 vues mortes CONFIRMÉES
-- Critères (triple preuve négative) : 0 ref code front (grep exhaustif repo) + 0 ref DB
--   (vue/fonction/policy) + 0 appel API PostgREST dans pg_stat_statements.
-- NB : 6 AUTRES vues de l'audit s207 (personnage_creation_complet, tableau_de_bord,
--   inscriptions_resumees, xp_personnage, joueurs_complete, evenements_admin) ont été
--   GELÉES : elles reçoivent des appels API réels d'origine hors-front (client externe
--   ou résidu d'un front antérieur) → chantier dette dédié avant tout DROP.
-- DROP sans CASCADE (RESTRICT) : volontaire, échouerait si une dépendance existait.

DROP VIEW IF EXISTS public.vue_admin_joueurs;
DROP VIEW IF EXISTS public.vue_competences_maitre_attente;
DROP VIEW IF EXISTS public.vue_demandes_races_complet;
DROP VIEW IF EXISTS public.vue_joueurs_maitres;
DROP VIEW IF EXISTS public.vue_journal_proprietaire;
DROP VIEW IF EXISTS public.vue_verrou_competences;

-- ============================================================================
-- RÉVERSIBILITÉ — définitions au moment du DROP (décommenter pour recréer) :
-- ----------------------------------------------------------------------------
-- CREATE OR REPLACE VIEW public.vue_admin_joueurs AS
--  SELECT pr.id AS joueur_id, pr.username, pr.email, pr.nom_affichage, pr.role,
--    pr.is_active, pr.created_at AS compte_cree_le,
--    count(p.id) FILTER (WHERE p.est_actif = true AND p.est_mort = false) AS nb_personnages_actifs,
--    count(p.id) FILTER (WHERE p.est_mort = true) AS nb_personnages_morts,
--    count(p.id) FILTER (WHERE p.est_actif = false) AS nb_personnages_archives,
--    count(p.id) AS nb_personnages_total,
--    (SELECT p2.nom FROM personnages p2 WHERE p2.joueur_id = pr.id AND p2.est_actif = true
--       AND p2.est_mort = false ORDER BY p2.created_at DESC NULLS LAST LIMIT 1) AS personnage_actif_principal
--  FROM profiles pr LEFT JOIN personnages p ON p.joueur_id = pr.id
--  GROUP BY pr.id, pr.username, pr.email, pr.nom_affichage, pr.role, pr.is_active, pr.created_at
--  ORDER BY pr.nom_affichage;
-- ----------------------------------------------------------------------------
-- CREATE OR REPLACE VIEW public.vue_competences_maitre_attente AS
--  SELECT pc.id, pc.niveau_acquis, pc.nom_maitre, pc.statut_maitre, pc.xp_depense, pc.personnage_id,
--    c.nom AS competence_nom, c.description AS competence_description, p.nom AS personnage_nom,
--    p.niveau AS personnage_niveau, pj.nom AS joueur_nom, pj.id AS joueur_id
--  FROM personnage_competences pc JOIN competences c ON pc.competence_id = c.id
--    JOIN personnages p ON pc.personnage_id = p.id JOIN profils_joueur pj ON p.joueur_id = pj.id
--  WHERE pc.appris_via_maitre = true ORDER BY pc.statut_maitre, pj.nom;
-- ----------------------------------------------------------------------------
-- CREATE OR REPLACE VIEW public.vue_demandes_races_complet AS
--  SELECT prd.id, prd.personnage_id, p.nom AS personnage_nom, p.niveau AS personnage_niveau,
--    p.joueur_id, pj.nom AS joueur_nom, compte.email AS joueur_email, r.id AS race_id,
--    r.nom AS race_nom, r.nom_latin AS race_nom_latin, prd.background, prd.statut, prd.raison_refus,
--    prd.approuve_par, approuveur.nom_affichage AS approuve_par_nom, prd.created_at AS date_demande,
--    prd.date_approbation
--  FROM personnage_races_demandes prd JOIN personnages p ON p.id = prd.personnage_id
--    JOIN profils_joueur pj ON pj.id = p.joueur_id JOIN profiles compte ON compte.id = pj.compte_id
--    JOIN races r ON r.id = prd.race_id LEFT JOIN profiles approuveur ON approuveur.id = prd.approuve_par
--  ORDER BY prd.created_at DESC;
-- ----------------------------------------------------------------------------
-- CREATE OR REPLACE VIEW public.vue_joueurs_maitres AS
--  SELECT DISTINCT pj.id AS joueur_id, pj.nom AS joueur_nom, p.id AS personnage_id,
--    p.nom AS personnage_nom, r.nom AS race, c.nom AS classe, p.niveau, p.xp_total
--  FROM personnage_competences pc JOIN personnages p ON pc.personnage_id = p.id
--    JOIN profils_joueur pj ON p.joueur_id = pj.id JOIN races r ON p.race_id = r.id
--    JOIN classes c ON p.classe_id = c.id
--  WHERE pc.niveau_acquis = 3 AND pc.statut_maitre = ANY (ARRAY['non_requis','approuve'])
--    AND p.est_actif = true AND p.est_mort = false ORDER BY pj.nom;
-- ----------------------------------------------------------------------------
-- CREATE OR REPLACE VIEW public.vue_journal_proprietaire AS  -- security_invoker=true
--  SELECT id, acteur_id, acteur_role, cible_type, cible_id, action, details, created_at
--  FROM journal_audit WHERE acteur_role = 'proprietaire';
-- ALTER VIEW public.vue_journal_proprietaire SET (security_invoker = true);
-- ----------------------------------------------------------------------------
-- CREATE OR REPLACE VIEW public.vue_verrou_competences AS  -- security_invoker=true
--  SELECT p.id AS personnage_id,
--    COALESCE(bool_or(c.nom = 'Assemblage de Runes'), false) AS runes_verrouillees,
--    COALESCE(bool_or(c.nom = 'Développement Spirituel'), false) AS dev_spirituel_verrouille,
--    COALESCE(bool_or(c.nom = 'Développement Spirituel Supérieur'), false) AS dev_spirituel_sup_verrouille,
--    COALESCE(bool_or(c.nom = 'Canalisation'), false) AS canalisation_verrouillee
--  FROM personnages p LEFT JOIN personnage_competences pc ON pc.personnage_id = p.id
--    LEFT JOIN competences c ON c.id = pc.competence_id AND c.verrouillage_croise = true
--  GROUP BY p.id;
-- ALTER VIEW public.vue_verrou_competences SET (security_invoker = true);
-- ============================================================================
