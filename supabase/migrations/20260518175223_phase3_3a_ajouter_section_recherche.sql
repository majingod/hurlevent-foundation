INSERT INTO public.sections_encyclopedie (cle, label, icon_nom, url_key, ordre, est_actif)
SELECT 'recherche', 'Recherche', 'Search', 'recherche', 0, true
WHERE NOT EXISTS (SELECT 1 FROM public.sections_encyclopedie WHERE cle = 'recherche');
