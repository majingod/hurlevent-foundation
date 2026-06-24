-- Nav joueur : entrée « Cimetière » (option A, ordre 6) — réservée aux connectés.
-- Idempotent : UPDATE fixe des ordres absolus + INSERT gardé par NOT EXISTS.

-- 1. Décalage des entrées suivantes (ordres absolus, idempotents)
UPDATE public.menu_navigation SET ordre = 7, updated_at = now() WHERE url = '/tableau-de-bord';
UPDATE public.menu_navigation SET ordre = 8, updated_at = now() WHERE url = '/administration/dashboard';

-- 2. Insertion de l'entrée Cimetière (roles copiés de Tableau de bord pour garantir le type)
INSERT INTO public.menu_navigation (libelle, url, roles_autorises, afficher_navbar, afficher_footer, ordre, est_actif)
SELECT 'Cimetière',
       '/cimetiere',
       (SELECT roles_autorises FROM public.menu_navigation WHERE url = '/tableau-de-bord' LIMIT 1),
       true,
       false,
       6,
       true
WHERE NOT EXISTS (SELECT 1 FROM public.menu_navigation WHERE url = '/cimetiere');
