-- Entrée de menu « Nouveautés » : footer (ligne interne) + section Communauté.
-- Une seule ligne sert les deux surfaces (afficher_footer + afficher_navbar).
-- ordre=15 : libre, place le lien en dernier dans chaque surface. Idempotent.
INSERT INTO public.menu_navigation
  (libelle, url, roles_autorises, afficher_navbar, afficher_footer, ordre, section, est_actif)
SELECT 'Nouveautés', '/mises-a-jour', NULL, true, true, 15, 'communaute', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.menu_navigation WHERE url = '/mises-a-jour'
);
