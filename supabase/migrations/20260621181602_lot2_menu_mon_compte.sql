-- Lot 2 SUPPRESSION-INTÉGRÉE : entrée de menu « Mon compte » (section « Mon espace »).
-- Appliquée APRÈS déploiement de la route /compte (gotcha A27 : pas de lien mort).
-- Idempotent : WHERE NOT EXISTS sur l'url (pas de contrainte unique sur menu_navigation.url).
INSERT INTO menu_navigation (libelle, url, ordre, section, roles_autorises, afficher_navbar, afficher_footer, est_actif)
SELECT
  'Mon compte',
  '/compte',
  9,
  'mon_espace',
  (SELECT roles_autorises FROM menu_navigation WHERE url = '/tableau-de-bord'),
  true,
  false,
  true
WHERE NOT EXISTS (SELECT 1 FROM menu_navigation WHERE url = '/compte');
