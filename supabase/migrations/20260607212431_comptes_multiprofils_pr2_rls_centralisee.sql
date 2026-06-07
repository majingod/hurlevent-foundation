-- PR2 — RLS centralisée (chantier COMPTES-MULTI-PROFILS)
-- Helpers d'appartenance compte->profils + bascule des 9 policies
-- joueur_id = auth.uid()  ->  compte_voit_joueur(joueur_id)
-- Comportement inchangé tant qu'un compte n'a qu'1 profil (cas actuel 7/7).

CREATE OR REPLACE FUNCTION public.profils_du_compte(c uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT id FROM public.profils_joueur WHERE compte_id = c;
$fn$;

CREATE OR REPLACE FUNCTION public.compte_voit_joueur(p_joueur_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT p_joueur_id IN (SELECT public.profils_du_compte(auth.uid()));
$fn$;

-- personnages
DROP POLICY IF EXISTS "Lecture personnages" ON public.personnages;
CREATE POLICY "Lecture personnages" ON public.personnages FOR SELECT TO authenticated
  USING ((auth.uid() IS NOT NULL) AND (public.compte_voit_joueur(joueur_id) OR est_animateur_ou_admin()));

DROP POLICY IF EXISTS "Création personnages" ON public.personnages;
CREATE POLICY "Création personnages" ON public.personnages FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() IS NOT NULL) AND (public.compte_voit_joueur(joueur_id) OR est_animateur_ou_admin()));

DROP POLICY IF EXISTS "Modification personnages" ON public.personnages;
CREATE POLICY "Modification personnages" ON public.personnages FOR UPDATE TO authenticated
  USING ((auth.uid() IS NOT NULL) AND (public.compte_voit_joueur(joueur_id) OR est_animateur_ou_admin()))
  WITH CHECK ((auth.uid() IS NOT NULL) AND (public.compte_voit_joueur(joueur_id) OR est_animateur_ou_admin()));

DROP POLICY IF EXISTS "Suppression personnages" ON public.personnages;
CREATE POLICY "Suppression personnages" ON public.personnages FOR DELETE TO public
  USING ((auth.uid() IS NOT NULL) AND (public.compte_voit_joueur(joueur_id) OR est_animateur_ou_admin()));

-- banque_xp_mouvements
DROP POLICY IF EXISTS "banque_xp_select_proprietaire_ou_admin" ON public.banque_xp_mouvements;
CREATE POLICY "banque_xp_select_proprietaire_ou_admin" ON public.banque_xp_mouvements FOR SELECT TO public
  USING ((auth.uid() IS NOT NULL) AND (public.compte_voit_joueur(joueur_id) OR est_animateur_ou_admin()));

-- inscriptions_evenements
DROP POLICY IF EXISTS "Lecture inscriptions" ON public.inscriptions_evenements;
CREATE POLICY "Lecture inscriptions" ON public.inscriptions_evenements FOR SELECT TO authenticated
  USING ((auth.uid() IS NOT NULL) AND (public.compte_voit_joueur(joueur_id) OR est_animateur_ou_admin()));

DROP POLICY IF EXISTS "Création inscriptions" ON public.inscriptions_evenements;
CREATE POLICY "Création inscriptions" ON public.inscriptions_evenements FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() IS NOT NULL) AND (public.compte_voit_joueur(joueur_id) OR est_animateur_ou_admin()));

DROP POLICY IF EXISTS "Modification inscriptions" ON public.inscriptions_evenements;
CREATE POLICY "Modification inscriptions" ON public.inscriptions_evenements FOR UPDATE TO authenticated
  USING ((auth.uid() IS NOT NULL) AND (public.compte_voit_joueur(joueur_id) OR est_animateur_ou_admin()))
  WITH CHECK ((auth.uid() IS NOT NULL) AND (public.compte_voit_joueur(joueur_id) OR est_animateur_ou_admin()));

DROP POLICY IF EXISTS "Suppression inscriptions" ON public.inscriptions_evenements;
CREATE POLICY "Suppression inscriptions" ON public.inscriptions_evenements FOR DELETE TO authenticated
  USING ((auth.uid() IS NOT NULL) AND (public.compte_voit_joueur(joueur_id) OR est_animateur_ou_admin()));
