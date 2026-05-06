-- Notifications : accès uniquement authentifié
DROP POLICY IF EXISTS "Création notifications" ON public.notifications;
DROP POLICY IF EXISTS "Lecture notifications" ON public.notifications;
DROP POLICY IF EXISTS "Modification notifications" ON public.notifications;
DROP POLICY IF EXISTS "Suppression notifications" ON public.notifications;

CREATE POLICY "Création notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND ((user_id = auth.uid()) OR public.est_animateur_ou_admin()));

CREATE POLICY "Lecture notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND ((user_id = auth.uid()) OR public.est_animateur_ou_admin()));

CREATE POLICY "Modification notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND ((user_id = auth.uid()) OR public.est_animateur_ou_admin()))
WITH CHECK (auth.uid() IS NOT NULL AND ((user_id = auth.uid()) OR public.est_animateur_ou_admin()));

CREATE POLICY "Suppression notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL AND ((user_id = auth.uid()) OR public.est_animateur_ou_admin()));

-- Personnages : accès uniquement authentifié
DROP POLICY IF EXISTS "Création personnages" ON public.personnages;
DROP POLICY IF EXISTS "Lecture personnages" ON public.personnages;
DROP POLICY IF EXISTS "Modification personnages" ON public.personnages;
DROP POLICY IF EXISTS "Suppression personnages" ON public.personnages;

CREATE POLICY "Création personnages"
ON public.personnages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND ((joueur_id = auth.uid()) OR public.est_animateur_ou_admin()));

CREATE POLICY "Lecture personnages"
ON public.personnages
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND ((joueur_id = auth.uid()) OR public.est_animateur_ou_admin()));

CREATE POLICY "Modification personnages"
ON public.personnages
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND ((joueur_id = auth.uid()) OR public.est_animateur_ou_admin()))
WITH CHECK (auth.uid() IS NOT NULL AND ((joueur_id = auth.uid()) OR public.est_animateur_ou_admin()));

CREATE POLICY "Suppression personnages"
ON public.personnages
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL AND public.est_animateur_ou_admin());

-- Inscriptions : accès uniquement authentifié
DROP POLICY IF EXISTS "Création inscriptions" ON public.inscriptions_evenements;
DROP POLICY IF EXISTS "Lecture inscriptions" ON public.inscriptions_evenements;
DROP POLICY IF EXISTS "Modification inscriptions" ON public.inscriptions_evenements;
DROP POLICY IF EXISTS "Suppression inscriptions" ON public.inscriptions_evenements;

CREATE POLICY "Création inscriptions"
ON public.inscriptions_evenements
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND ((joueur_id = auth.uid()) OR public.est_animateur_ou_admin()));

CREATE POLICY "Lecture inscriptions"
ON public.inscriptions_evenements
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND ((joueur_id = auth.uid()) OR public.est_animateur_ou_admin()));

CREATE POLICY "Modification inscriptions"
ON public.inscriptions_evenements
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND ((joueur_id = auth.uid()) OR public.est_animateur_ou_admin()))
WITH CHECK (auth.uid() IS NOT NULL AND ((joueur_id = auth.uid()) OR public.est_animateur_ou_admin()));

CREATE POLICY "Suppression inscriptions"
ON public.inscriptions_evenements
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL AND (public.est_animateur_ou_admin() OR (joueur_id = auth.uid())));

-- Tables liées aux personnages : accès uniquement authentifié
DROP POLICY IF EXISTS "Accès assemblages personnage" ON public.personnage_assemblages;
DROP POLICY IF EXISTS "Accès compétences personnage" ON public.personnage_competences;
DROP POLICY IF EXISTS "Accès objets forge personnage" ON public.personnage_objets_forge;
DROP POLICY IF EXISTS "Accès objets joaillerie personnage" ON public.personnage_objets_joaillerie;
DROP POLICY IF EXISTS "Accès prières personnage" ON public.personnage_prieres;
DROP POLICY IF EXISTS "Accès recettes personnage" ON public.personnage_recettes;
DROP POLICY IF EXISTS "Accès sorts personnage" ON public.personnage_sorts;

CREATE POLICY "Accès assemblages personnage"
ON public.personnage_assemblages
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND ((EXISTS (SELECT 1 FROM public.personnages WHERE personnages.id = personnage_assemblages.personnage_id AND personnages.joueur_id = auth.uid())) OR public.est_animateur_ou_admin()))
WITH CHECK (auth.uid() IS NOT NULL AND ((EXISTS (SELECT 1 FROM public.personnages WHERE personnages.id = personnage_assemblages.personnage_id AND personnages.joueur_id = auth.uid())) OR public.est_animateur_ou_admin()));

CREATE POLICY "Accès compétences personnage"
ON public.personnage_competences
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND ((EXISTS (SELECT 1 FROM public.personnages WHERE personnages.id = personnage_competences.personnage_id AND personnages.joueur_id = auth.uid())) OR public.est_animateur_ou_admin()))
WITH CHECK (auth.uid() IS NOT NULL AND ((EXISTS (SELECT 1 FROM public.personnages WHERE personnages.id = personnage_competences.personnage_id AND personnages.joueur_id = auth.uid())) OR public.est_animateur_ou_admin()));

CREATE POLICY "Accès objets forge personnage"
ON public.personnage_objets_forge
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND ((EXISTS (SELECT 1 FROM public.personnages WHERE personnages.id = personnage_objets_forge.personnage_id AND personnages.joueur_id = auth.uid())) OR public.est_animateur_ou_admin()))
WITH CHECK (auth.uid() IS NOT NULL AND ((EXISTS (SELECT 1 FROM public.personnages WHERE personnages.id = personnage_objets_forge.personnage_id AND personnages.joueur_id = auth.uid())) OR public.est_animateur_ou_admin()));

CREATE POLICY "Accès objets joaillerie personnage"
ON public.personnage_objets_joaillerie
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND ((EXISTS (SELECT 1 FROM public.personnages WHERE personnages.id = personnage_objets_joaillerie.personnage_id AND personnages.joueur_id = auth.uid())) OR public.est_animateur_ou_admin()))
WITH CHECK (auth.uid() IS NOT NULL AND ((EXISTS (SELECT 1 FROM public.personnages WHERE personnages.id = personnage_objets_joaillerie.personnage_id AND personnages.joueur_id = auth.uid())) OR public.est_animateur_ou_admin()));

CREATE POLICY "Accès prières personnage"
ON public.personnage_prieres
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND ((EXISTS (SELECT 1 FROM public.personnages WHERE personnages.id = personnage_prieres.personnage_id AND personnages.joueur_id = auth.uid())) OR public.est_animateur_ou_admin()))
WITH CHECK (auth.uid() IS NOT NULL AND ((EXISTS (SELECT 1 FROM public.personnages WHERE personnages.id = personnage_prieres.personnage_id AND personnages.joueur_id = auth.uid())) OR public.est_animateur_ou_admin()));

CREATE POLICY "Accès recettes personnage"
ON public.personnage_recettes
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND ((EXISTS (SELECT 1 FROM public.personnages WHERE personnages.id = personnage_recettes.personnage_id AND personnages.joueur_id = auth.uid())) OR public.est_animateur_ou_admin()))
WITH CHECK (auth.uid() IS NOT NULL AND ((EXISTS (SELECT 1 FROM public.personnages WHERE personnages.id = personnage_recettes.personnage_id AND personnages.joueur_id = auth.uid())) OR public.est_animateur_ou_admin()));

CREATE POLICY "Accès sorts personnage"
ON public.personnage_sorts
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL AND ((EXISTS (SELECT 1 FROM public.personnages WHERE personnages.id = personnage_sorts.personnage_id AND personnages.joueur_id = auth.uid())) OR public.est_animateur_ou_admin()))
WITH CHECK (auth.uid() IS NOT NULL AND ((EXISTS (SELECT 1 FROM public.personnages WHERE personnages.id = personnage_sorts.personnage_id AND personnages.joueur_id = auth.uid())) OR public.est_animateur_ou_admin()));