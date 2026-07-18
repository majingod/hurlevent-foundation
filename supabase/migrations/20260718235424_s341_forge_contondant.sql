-- s341 — [FORGE-CONTONDANT] : exemples d'armes contondantes (courte et longue)
--
-- Manuel corrigé 2026 :
--   Assommer 1 s'utilise « à l'aide d'une arme longue contondante » (80-110 cm)
--   Assommer 2 s'utilise « à l'aide d'une arme courte contondante » (45 cm ou moins)
-- Or objets_forge n'offrait AUCUN exemple contondant pour ces deux tailles :
--   Arme courte : dague · poignard · couteau · main-gauche
--   Arme longue : épée longue · bâtarde · sabre · hache d'armes
-- => un joueur achetant Assommer ne savait pas quelle arme apporter.
--
-- Noms d'armes validés par Fred (s341). Aucun changement de règle, aucun coût XP touché.
-- Idempotent : valeur cible littérale, rejouable à froid sans effet de bord.

UPDATE public.objets_forge
   SET exemples = 'dague · poignard · couteau · main-gauche · matraque · gourdin'
 WHERE type = 'arme'
   AND nom  = 'Arme courte';

UPDATE public.objets_forge
   SET exemples = 'épée longue · bâtarde · sabre · hache d''armes · masse d''armes · marteau de guerre'
 WHERE type = 'arme'
   AND nom  = 'Arme longue';
