-- s334 : [LOI25] 2 liens footer — pages légales (/conditions-utilisation, /mentions-legales).
-- Patron s255 (20260621143153). Idempotent : insertion par ligne uniquement si l'URL n'existe pas déjà.
-- Aucune ligne existante modifiée (Nouveautés ordre 15 conservé) : les deux liens prennent 16 et 17.
INSERT INTO public.menu_navigation
  (libelle, url, ordre, afficher_navbar, afficher_footer, est_actif, roles_autorises, section)
SELECT v.libelle, v.url, v.ordre, false, true, true, NULL, NULL
FROM (VALUES
  ('Conditions d''utilisation', '/conditions-utilisation', 16),
  ('Mentions légales',         '/mentions-legales',       17)
) AS v(libelle, url, ordre)
WHERE NOT EXISTS (
  SELECT 1 FROM public.menu_navigation m WHERE m.url = v.url
);
