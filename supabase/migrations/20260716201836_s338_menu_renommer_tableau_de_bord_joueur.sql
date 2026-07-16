-- s338 [UX-PLATEFORME] Friction 3 : renommer le libellé du tableau JOUEUR
-- « Tableau de bord » -> « Mes personnages » (lève la confusion avec le tableau admin).
-- Idempotent : la 2e exécution ne matche plus (libellé déjà changé).
UPDATE menu_navigation
SET libelle = 'Mes personnages'
WHERE url = '/tableau-de-bord' AND libelle = 'Tableau de bord';