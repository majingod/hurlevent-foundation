-- Lot 1 (s255) : 5 liens footer — pages publiques (/apropos, /faq, /confidentialite)
-- + liens externes (page officielle du GN, Discord).
-- Idempotent : insertion par ligne uniquement si l'URL n'existe pas déjà.
INSERT INTO public.menu_navigation
  (libelle, url, ordre, afficher_navbar, afficher_footer, est_actif, roles_autorises, section)
SELECT v.libelle, v.url, v.ordre, false, true, true, NULL, NULL
FROM (VALUES
  ('À propos',              '/apropos',                          10),
  ('FAQ',                   '/faq',                              11),
  ('Confidentialité',       '/confidentialite',                  12),
  ('Page officielle du GN', 'https://gnhurlevent.my.canva.site', 13),
  ('Discord',               'https://discord.gg/phRws4sKn',      14)
) AS v(libelle, url, ordre)
WHERE NOT EXISTS (
  SELECT 1 FROM public.menu_navigation m WHERE m.url = v.url
);
