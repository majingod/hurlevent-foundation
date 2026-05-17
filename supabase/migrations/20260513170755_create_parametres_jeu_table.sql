-- ============================================================================
-- Migration 6 — Création de la table parametres_jeu
--
-- Centralise les infos générales du GN (nom, liens réseaux sociaux, textes
-- d'instructions, etc.) pour éviter les hard-codes dans le frontend.
--
-- 1 seule ligne attendue pour Hurlevent. Multi-tenant futur : ajout d'une
-- colonne gn_id ou réutilisation pour d'autres GN (Terras Mortis, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.parametres_jeu (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_gn                    text NOT NULL DEFAULT 'Hurlevent',
  description_gn            text,
  lien_facebook             text,
  lien_discord              text,
  lien_instagram            text,
  lien_site_web             text,
  email_contact             text,
  texte_envoi_photos_race   text,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

-- Trigger updated_at (réutilise la fonction set_updated_at existante)
DROP TRIGGER IF EXISTS trg_parametres_jeu_updated_at ON public.parametres_jeu;
CREATE TRIGGER trg_parametres_jeu_updated_at
BEFORE UPDATE ON public.parametres_jeu
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.parametres_jeu ENABLE ROW LEVEL SECURITY;

-- SELECT ouvert (liens publics — visibles à tous, y compris anon)
DROP POLICY IF EXISTS "parametres_jeu_select_all" ON public.parametres_jeu;
CREATE POLICY "parametres_jeu_select_all" ON public.parametres_jeu
FOR SELECT
USING (true);

-- INSERT/UPDATE/DELETE réservés aux admins/animateurs
DROP POLICY IF EXISTS "parametres_jeu_admin_insert" ON public.parametres_jeu;
CREATE POLICY "parametres_jeu_admin_insert" ON public.parametres_jeu
FOR INSERT TO authenticated
WITH CHECK (public.est_animateur_ou_admin());

DROP POLICY IF EXISTS "parametres_jeu_admin_update" ON public.parametres_jeu;
CREATE POLICY "parametres_jeu_admin_update" ON public.parametres_jeu
FOR UPDATE TO authenticated
USING (public.est_animateur_ou_admin())
WITH CHECK (public.est_animateur_ou_admin());

DROP POLICY IF EXISTS "parametres_jeu_admin_delete" ON public.parametres_jeu;
CREATE POLICY "parametres_jeu_admin_delete" ON public.parametres_jeu
FOR DELETE TO authenticated
USING (public.est_animateur_ou_admin());

-- Seed Hurlevent (1 seule ligne attendue à terme)
INSERT INTO public.parametres_jeu (
  nom_gn,
  description_gn,
  lien_facebook,
  lien_discord,
  texte_envoi_photos_race
)
SELECT 
  'Hurlevent',
  'GN médiéval-fantastique dans l''univers de Destéa (Québec).',
  'https://www.facebook.com/share/1Fp3zwcXAW/',
  'https://discord.gg/trydU3Efg',
  'Envoie tes photos de costume et maquillage à l''équipe d''animation via Facebook ou Discord, en mentionnant ton nom de joueur et le nom de ton personnage. Les photos doivent montrer ton apparence complète en jeu.'
WHERE NOT EXISTS (SELECT 1 FROM public.parametres_jeu WHERE nom_gn = 'Hurlevent');
