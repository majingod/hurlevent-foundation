-- Permettre au joueur de supprimer ses propres personnages (finalises, verrouilles ou brouillons).
-- Aligne la policy DELETE sur les policies INSERT/SELECT/UPDATE de la table.
-- L'integrite des evenements reste protegee par la FK inscriptions_evenements (ON DELETE NO ACTION) :
-- un personnage inscrit a un evenement ne peut etre supprime par personne tant qu'il est inscrit.
DROP POLICY IF EXISTS "Suppression personnages" ON public.personnages;

CREATE POLICY "Suppression personnages"
  ON public.personnages
  FOR DELETE
  USING (
    (auth.uid() IS NOT NULL)
    AND ((joueur_id = auth.uid()) OR est_animateur_ou_admin())
  );
