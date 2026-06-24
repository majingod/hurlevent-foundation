-- Chantier MENU/HEADER/FOOTER (s251) — Taxo 2 : sections de navigation en DB + Cimetière public
-- Idempotent.

-- 1. Table de référence des sections
CREATE TABLE IF NOT EXISTS public.sections_menu (
  slug      text PRIMARY KEY,
  libelle   text NOT NULL,
  ordre     integer NOT NULL,
  est_staff boolean NOT NULL DEFAULT false
);

ALTER TABLE public.sections_menu ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sections_menu_lecture_publique ON public.sections_menu;
CREATE POLICY sections_menu_lecture_publique ON public.sections_menu
  FOR SELECT USING (true);

DROP POLICY IF EXISTS sections_menu_ecriture_admin ON public.sections_menu;
CREATE POLICY sections_menu_ecriture_admin ON public.sections_menu
  FOR ALL USING (est_animateur_ou_admin()) WITH CHECK (est_animateur_ou_admin());

-- 2. Seed des 4 sections (Taxo 2)
INSERT INTO public.sections_menu (slug, libelle, ordre, est_staff) VALUES
  ('decouvrir',  'Découvrir',  1, false),
  ('communaute', 'Communauté', 2, false),
  ('mon_espace', 'Mon espace', 3, false),
  ('animation',  'Animation',  4, true)
ON CONFLICT (slug) DO UPDATE
  SET libelle = EXCLUDED.libelle, ordre = EXCLUDED.ordre, est_staff = EXCLUDED.est_staff;

-- 3. Colonne section sur menu_navigation + FK
ALTER TABLE public.menu_navigation ADD COLUMN IF NOT EXISTS section text;

ALTER TABLE public.menu_navigation DROP CONSTRAINT IF EXISTS menu_navigation_section_fkey;
ALTER TABLE public.menu_navigation
  ADD CONSTRAINT menu_navigation_section_fkey
  FOREIGN KEY (section) REFERENCES public.sections_menu(slug)
  ON UPDATE CASCADE ON DELETE SET NULL;

-- 4. Backfill Taxo 2 (Accueil reste NULL → rendu en haut, hors section)
UPDATE public.menu_navigation SET section = 'decouvrir'  WHERE url IN ('/regles','/encyclopedie');
UPDATE public.menu_navigation SET section = 'communaute' WHERE url IN ('/evenements','/telechargements','/cimetiere');
UPDATE public.menu_navigation SET section = 'mon_espace' WHERE url = '/tableau-de-bord';
UPDATE public.menu_navigation SET section = 'animation'  WHERE url = '/administration/dashboard';

-- 5. Incohérence : aligner l'entrée Cimetière sur la page publique
UPDATE public.menu_navigation SET roles_autorises = NULL WHERE url = '/cimetiere';
