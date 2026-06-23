-- Footer Option B : le pied de page n'affiche que les pages d'information
-- (À propos, FAQ, Confidentialité) + les liens communauté externes (GN, Discord).
-- Les liens de navigation (Accueil, Règles, Événements) sont déjà dans la navbar
-- -> on les retire du footer pour éviter la redondance.
-- Idempotent : aucune ligne ne matche au 2e passage.
UPDATE public.menu_navigation
SET afficher_footer = false, updated_at = now()
WHERE url IN ('/', '/regles', '/evenements')
  AND afficher_footer = true;
