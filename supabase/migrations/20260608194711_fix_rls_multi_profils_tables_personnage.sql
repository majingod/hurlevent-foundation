-- Fix RLS multi-profils : les tables enfant de personnages utilisaient encore
-- `personnages.joueur_id = auth.uid()`, faux pour un profil secondaire
-- (joueur_id = profils_joueur.id != auth.uid() = compte). On passe à
-- compte_voit_joueur(joueur_id), helper qui autorise tous les profils du compte.
-- Les écritures (RPC SECURITY DEFINER) passaient déjà ; seules les LECTURES
-- directes étaient bloquées => achats invisibles dans le wizard.
-- ALTER POLICY : ne touche ni aux commandes ni aux rôles, seulement aux expressions.

ALTER POLICY "historique_xp_select_proprietaire_ou_admin" ON public.historique_xp
  USING (est_animateur_ou_admin() OR EXISTS (SELECT 1 FROM personnages p WHERE p.id = historique_xp.personnage_id AND compte_voit_joueur(p.joueur_id)));

ALTER POLICY "Accès assemblages personnage" ON public.personnage_assemblages
  USING (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_assemblages.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()))
  WITH CHECK (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_assemblages.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()));

ALTER POLICY "Accès compétences personnage" ON public.personnage_competences
  USING (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_competences.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()))
  WITH CHECK (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_competences.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()));

ALTER POLICY "Accès objets forge personnage" ON public.personnage_objets_forge
  USING (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_objets_forge.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()))
  WITH CHECK (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_objets_forge.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()));

ALTER POLICY "Accès objets joaillerie personnage" ON public.personnage_objets_joaillerie
  USING (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_objets_joaillerie.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()))
  WITH CHECK (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_objets_joaillerie.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()));

ALTER POLICY "Accès pieges personnage" ON public.personnage_pieges
  USING (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_pieges.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()))
  WITH CHECK (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_pieges.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()));

ALTER POLICY "Accès prières personnage" ON public.personnage_prieres
  USING (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_prieres.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()))
  WITH CHECK (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_prieres.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()));

ALTER POLICY "Accès recettes personnage" ON public.personnage_recettes
  USING (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_recettes.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()))
  WITH CHECK (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_recettes.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()));

ALTER POLICY "Accès sorts personnage" ON public.personnage_sorts
  USING (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_sorts.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()))
  WITH CHECK (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_sorts.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()));

ALTER POLICY "Lecture demandes races" ON public.personnage_races_demandes
  USING (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_races_demandes.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()));

ALTER POLICY "Creation demandes races" ON public.personnage_races_demandes
  WITH CHECK (auth.uid() IS NOT NULL AND (EXISTS (SELECT 1 FROM personnages WHERE personnages.id = personnage_races_demandes.personnage_id AND compte_voit_joueur(personnages.joueur_id)) OR est_animateur_ou_admin()));
