-- perf: envelopper auth.uid() dans un sous-select (InitPlan) sur les 33 policies
-- flaggees auth_rls_initplan. Semantique STRICTEMENT identique : auth.uid() renvoie
-- la meme valeur pour toutes les lignes d'une requete ; l'evaluer une fois (InitPlan)
-- au lieu d'une fois par ligne = meme resultat, moins de calcul.
-- Seul auth.uid() est wrappe. compte_voit_joueur(colonne) (per-row, dependant de la
-- ligne) et les helpers zero-arg (est_admin/est_animateur_ou_admin) restent inchanges.
-- Genere mecaniquement depuis pg_policies (format + replace).

ALTER POLICY banque_xp_select_proprietaire_ou_admin ON public.banque_xp_mouvements
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND (compte_voit_joueur(joueur_id) OR est_animateur_ou_admin())));

ALTER POLICY "Création inscriptions" ON public.inscriptions_evenements
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND (compte_voit_joueur(joueur_id) OR est_animateur_ou_admin())));

ALTER POLICY "Lecture inscriptions" ON public.inscriptions_evenements
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND (compte_voit_joueur(joueur_id) OR est_animateur_ou_admin())));

ALTER POLICY "Modification inscriptions" ON public.inscriptions_evenements
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND (compte_voit_joueur(joueur_id) OR est_animateur_ou_admin())))
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND (compte_voit_joueur(joueur_id) OR est_animateur_ou_admin())));

ALTER POLICY "Suppression inscriptions" ON public.inscriptions_evenements
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND (compte_voit_joueur(joueur_id) OR est_animateur_ou_admin())));

ALTER POLICY journal_audit_select_proprietaire ON public.journal_audit
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND (cible_type = 'personnage'::text) AND (EXISTS ( SELECT 1
   FROM personnages p
  WHERE ((p.id = journal_audit.cible_id) AND compte_voit_joueur(p.joueur_id))))));

ALTER POLICY "Création notifications" ON public.notifications
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND ((user_id = ( SELECT auth.uid() )) OR est_animateur_ou_admin())));

ALTER POLICY "Lecture notifications" ON public.notifications
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((user_id = ( SELECT auth.uid() )) OR est_animateur_ou_admin())));

ALTER POLICY "Modification notifications" ON public.notifications
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((user_id = ( SELECT auth.uid() )) OR est_animateur_ou_admin())))
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND ((user_id = ( SELECT auth.uid() )) OR est_animateur_ou_admin())));

ALTER POLICY "Suppression notifications" ON public.notifications
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((user_id = ( SELECT auth.uid() )) OR est_animateur_ou_admin())));

ALTER POLICY "Accès assemblages personnage" ON public.personnage_assemblages
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_assemblages.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())))
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_assemblages.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())));

ALTER POLICY "Accès compétences personnage" ON public.personnage_competences
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_competences.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())))
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_competences.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())));

ALTER POLICY "Accès objets forge personnage" ON public.personnage_objets_forge
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_objets_forge.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())))
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_objets_forge.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())));

ALTER POLICY "Accès objets joaillerie personnage" ON public.personnage_objets_joaillerie
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_objets_joaillerie.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())))
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_objets_joaillerie.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())));

ALTER POLICY "Accès pieges personnage" ON public.personnage_pieges
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_pieges.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())))
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_pieges.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())));

ALTER POLICY "Accès prières personnage" ON public.personnage_prieres
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_prieres.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())))
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_prieres.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())));

ALTER POLICY "Creation demandes races" ON public.personnage_races_demandes
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_races_demandes.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())));

ALTER POLICY "Lecture demandes races" ON public.personnage_races_demandes
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_races_demandes.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())));

ALTER POLICY "Accès recettes personnage" ON public.personnage_recettes
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_recettes.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())))
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_recettes.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())));

ALTER POLICY "Accès sorts personnage" ON public.personnage_sorts
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_sorts.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())))
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND ((EXISTS ( SELECT 1
   FROM personnages
  WHERE ((personnages.id = personnage_sorts.personnage_id) AND compte_voit_joueur(personnages.joueur_id)))) OR est_animateur_ou_admin())));

ALTER POLICY "Création personnages" ON public.personnages
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND (compte_voit_joueur(joueur_id) OR est_animateur_ou_admin())));

ALTER POLICY "Lecture personnages" ON public.personnages
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND (compte_voit_joueur(joueur_id) OR est_animateur_ou_admin())));

ALTER POLICY "Modification personnages" ON public.personnages
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND (compte_voit_joueur(joueur_id) OR est_animateur_ou_admin())))
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND (compte_voit_joueur(joueur_id) OR est_animateur_ou_admin())));

ALTER POLICY "Suppression personnages" ON public.personnages
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((compte_voit_joueur(joueur_id) AND (est_actif = true)) OR est_animateur_ou_admin())));

ALTER POLICY "Écriture admin pièges" ON public.pieges
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() )) AND (profiles.role = ANY (ARRAY['admin'::text, 'animateur'::text]))))));

ALTER POLICY "Création profil sécurisée" ON public.profiles
  WITH CHECK (((( SELECT auth.uid() ) = id) AND (COALESCE(role, 'joueur'::text) = 'joueur'::text)));

ALTER POLICY "Lecture profil" ON public.profiles
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((( SELECT auth.uid() ) = id) OR est_animateur_ou_admin())));

ALTER POLICY "Modification profil" ON public.profiles
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((( SELECT auth.uid() ) = id) OR est_admin())))
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND (((( SELECT auth.uid() ) = id) AND (role = role_du_profil(( SELECT auth.uid() )))) OR est_admin())));

ALTER POLICY profils_joueur_delete ON public.profils_joueur
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND (compte_id = ( SELECT auth.uid() )) AND (est_principal = false)));

ALTER POLICY profils_joueur_insert ON public.profils_joueur
  WITH CHECK (((( SELECT auth.uid() ) IS NOT NULL) AND (compte_id = ( SELECT auth.uid() ))));

ALTER POLICY profils_joueur_select ON public.profils_joueur
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((compte_id = ( SELECT auth.uid() )) OR est_animateur_ou_admin())));

ALTER POLICY profils_joueur_update ON public.profils_joueur
  USING (((( SELECT auth.uid() ) IS NOT NULL) AND ((compte_id = ( SELECT auth.uid() )) OR est_animateur_ou_admin())));

ALTER POLICY "Écriture admin reparations_forge" ON public.reparations_forge
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() )) AND (profiles.role = ANY (ARRAY['admin'::text, 'animateur'::text]))))));
