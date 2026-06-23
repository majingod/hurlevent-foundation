-- COMPTES MULTI-PROFILS — PR1 : couche profil
-- profiles = COMPTE (id=auth.uid()) · profils_joueur = JOUEUR (compte_id->profiles.id)
-- joueur_id (perso/banque/inscriptions) -> profils_joueur.id
-- Profil principal réutilise l'uuid du compte => aucun UPDATE des joueur_id.

-- 1. Table
CREATE TABLE IF NOT EXISTS public.profils_joueur (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compte_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nom           text NOT NULL,
  avatar_url    text,
  est_principal boolean NOT NULL DEFAULT false,
  cree_le       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profils_joueur_compte ON public.profils_joueur(compte_id);

-- 2. RLS : un compte gère ses profils
ALTER TABLE public.profils_joueur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profils_joueur_select ON public.profils_joueur;
CREATE POLICY profils_joueur_select ON public.profils_joueur FOR SELECT
  USING (auth.uid() IS NOT NULL AND (compte_id = auth.uid() OR est_animateur_ou_admin()));

DROP POLICY IF EXISTS profils_joueur_insert ON public.profils_joueur;
CREATE POLICY profils_joueur_insert ON public.profils_joueur FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND compte_id = auth.uid());

DROP POLICY IF EXISTS profils_joueur_update ON public.profils_joueur;
CREATE POLICY profils_joueur_update ON public.profils_joueur FOR UPDATE
  USING (auth.uid() IS NOT NULL AND (compte_id = auth.uid() OR est_animateur_ou_admin()));

DROP POLICY IF EXISTS profils_joueur_delete ON public.profils_joueur;
CREATE POLICY profils_joueur_delete ON public.profils_joueur FOR DELETE
  USING (auth.uid() IS NOT NULL AND compte_id = auth.uid() AND est_principal = false);

-- 3. Migration : 1 profil principal par compte (réutilise l'uuid)
INSERT INTO public.profils_joueur (id, compte_id, nom, avatar_url, est_principal)
SELECT p.id, p.id,
       COALESCE(NULLIF(p.nom_affichage,''), NULLIF(p.username,''), split_part(p.email,'@',1)),
       p.avatar_url, true
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.profils_joueur pj WHERE pj.id = p.id);

-- 4. Repointage FK joueur_id -> profils_joueur(id)
ALTER TABLE public.personnages            DROP CONSTRAINT IF EXISTS personnages_joueur_id_fkey;
ALTER TABLE public.personnages            ADD  CONSTRAINT personnages_joueur_id_fkey
  FOREIGN KEY (joueur_id) REFERENCES public.profils_joueur(id);
ALTER TABLE public.banque_xp_mouvements   DROP CONSTRAINT IF EXISTS banque_xp_mouvements_joueur_id_fkey;
ALTER TABLE public.banque_xp_mouvements   ADD  CONSTRAINT banque_xp_mouvements_joueur_id_fkey
  FOREIGN KEY (joueur_id) REFERENCES public.profils_joueur(id);
ALTER TABLE public.inscriptions_evenements DROP CONSTRAINT IF EXISTS inscriptions_evenements_joueur_id_fkey;
ALTER TABLE public.inscriptions_evenements ADD  CONSTRAINT inscriptions_evenements_joueur_id_fkey
  FOREIGN KEY (joueur_id) REFERENCES public.profils_joueur(id);
