-- PR4 (bonus) — RLS-ROLES-INCOHERENCE
-- Uniformise 2 policies du périmètre multi-profils de TO public -> TO authenticated.
-- Recréation à l'identique : seul le role cible change. Idempotent.

DROP POLICY IF EXISTS "banque_xp_select_proprietaire_ou_admin" ON public.banque_xp_mouvements;
CREATE POLICY "banque_xp_select_proprietaire_ou_admin"
  ON public.banque_xp_mouvements
  FOR SELECT
  TO authenticated
  USING ((auth.uid() IS NOT NULL) AND (compte_voit_joueur(joueur_id) OR est_animateur_ou_admin()));

DROP POLICY IF EXISTS "Suppression personnages" ON public.personnages;
CREATE POLICY "Suppression personnages"
  ON public.personnages
  FOR DELETE
  TO authenticated
  USING ((auth.uid() IS NOT NULL) AND (compte_voit_joueur(joueur_id) OR est_animateur_ou_admin()));
