-- Ajoute l'entrée de menu publique « Téléchargements » (page /telechargements).
-- Idempotent : SET en valeurs absolues (pas de +1) + INSERT gardé par NOT EXISTS.
UPDATE menu_navigation SET ordre = 6, updated_at = now() WHERE url = '/tableau-de-bord';
UPDATE menu_navigation SET ordre = 7, updated_at = now() WHERE url = '/administration/dashboard';

INSERT INTO menu_navigation (libelle, url, roles_autorises, afficher_navbar, afficher_footer, ordre, est_actif)
SELECT 'Téléchargements', '/telechargements', NULL, true, false, 5, true
WHERE NOT EXISTS (SELECT 1 FROM menu_navigation WHERE url = '/telechargements');
