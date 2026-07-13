-- [RESYNC-VERBATIM-2] Lot D1 — recettes_alchimie.description_verbatim (s327)
-- 11 corrections verbatim vs manuel corrigé 2026-06-18. Idempotent (REPLACE ancré + garde LIKE).

UPDATE recettes_alchimie SET description_verbatim = replace(description_verbatim, $hv$valeur minimale de 1 écus$hv$, $hv$valeur minimale de 1 écu$hv$)
WHERE nom = $hv$Encre d'Activation Runique$hv$ AND description_verbatim LIKE '%' || $hv$valeur minimale de 1 écus$hv$ || '%';

UPDATE recettes_alchimie SET description_verbatim = replace(description_verbatim, $hv$Cette encre permet d’activer un assemblage de runes qui peut être activer par l’encre dépend de la valeur de la pépite ou de la gemme utilisée : Chaque tranche de 1 écus de valeur équivaut à 1 activation. L’encre peut être utilisée$hv$, $hv$Cette encre permet d’activer un assemblage de runes. Le nombre d’activations fourni par l’encre dépend de la valeur de la pépite ou de la gemme utilisée : Chaque tranche de 1 écu de valeur équivaut à 1 activation.
• Pierre de 1 écu - 1 activation
• Pierre de 2 écus - 2 activations
• Pierre de 3 écus - 3 activations
• etc…
L’encre peut être utilisée$hv$)
WHERE nom = $hv$Encre d'Activation Runique$hv$ AND description_verbatim LIKE '%' || $hv$Cette encre permet d’activer un assemblage de runes qui peut être activer par l’encre dépend de la valeur de la pépite ou de la gemme utilisée : Chaque tranche de 1 écus de valeur équivaut à 1 activation. L’encre peut être utilisée$hv$ || '%';

UPDATE recettes_alchimie SET description_verbatim = replace(description_verbatim, $hv$ou de ce défendre$hv$, $hv$ou de se défendre$hv$)
WHERE nom = $hv$Poison de douleur$hv$ AND description_verbatim LIKE '%' || $hv$ou de ce défendre$hv$ || '%';

UPDATE recettes_alchimie SET description_verbatim = replace(description_verbatim, $hv$avec un sort et il tombe$hv$, $hv$avec un sort et elle tombe$hv$)
WHERE nom = $hv$Poison hallucinogène (intermédiaire)$hv$ AND description_verbatim LIKE '%' || $hv$avec un sort et il tombe$hv$ || '%';

UPDATE recettes_alchimie SET description_verbatim = replace(description_verbatim, $hv$1 Catalysant à poison$hv$, $hv$1 Catalyseur à poison$hv$)
WHERE nom = $hv$Poison hallucinogène (majeur)$hv$ AND description_verbatim LIKE '%' || $hv$1 Catalysant à poison$hv$ || '%';

UPDATE recettes_alchimie SET description_verbatim = replace(description_verbatim, $hv$son incorporation au finale$hv$, $hv$son incorporation finale$hv$)
WHERE nom = $hv$Potion de peau d'écorce$hv$ AND description_verbatim LIKE '%' || $hv$son incorporation au finale$hv$ || '%';

UPDATE recettes_alchimie SET description_verbatim = replace(description_verbatim, $hv$Le Verda doit être brassée$hv$, $hv$La solution doit être brassée$hv$)
WHERE nom = $hv$Potion de peau de marbre$hv$ AND description_verbatim LIKE '%' || $hv$Le Verda doit être brassée$hv$ || '%';

UPDATE recettes_alchimie SET description_verbatim = replace(description_verbatim, $hv$des coups réguliers et protège$hv$, $hv$des coups réguliers protège$hv$)
WHERE nom = $hv$Potion de peau de pierre$hv$ AND description_verbatim LIKE '%' || $hv$des coups réguliers et protège$hv$ || '%';

UPDATE recettes_alchimie SET description_verbatim = replace(description_verbatim, $hv$mélangé 30 seconde avec$hv$, $hv$mélangé 30 secondes avec$hv$)
WHERE nom = $hv$Potion de regain spirituel$hv$ AND description_verbatim LIKE '%' || $hv$mélangé 30 seconde avec$hv$ || '%';

UPDATE recettes_alchimie SET description_verbatim = replace(description_verbatim, $hv$réveillé de l'inconscient.$hv$, $hv$réveillé de l'inconscience.$hv$)
WHERE nom = $hv$Potion de régénération$hv$ AND description_verbatim LIKE '%' || $hv$réveillé de l'inconscient.$hv$ || '%';

UPDATE recettes_alchimie SET description_verbatim = replace(description_verbatim, $hv$Le Palos est brièvement réchauffé avant de l’ajouter au final.$hv$, $hv$Le Palos est activé par un souffle volontaire avant l’ajout final.$hv$)
WHERE nom = $hv$Remède curatif$hv$ AND description_verbatim LIKE '%' || $hv$Le Palos est brièvement réchauffé avant de l’ajouter au final.$hv$ || '%';
