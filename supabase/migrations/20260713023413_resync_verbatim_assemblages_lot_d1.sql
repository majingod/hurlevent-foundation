-- [RESYNC-VERBATIM-2] Lot D1 — assemblages_runes.texte_manuel (s327)
-- 20 corrections verbatim vs manuel corrigé 2026-06-18. Idempotent (REPLACE ancré + garde LIKE).

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$il consume 5 points de spiritualités$hv$, $hv$il consume 5 points de spiritualité$hv$)
WHERE nom = $hv$Assemblage de barrière magique$hv$ AND texte_manuel LIKE '%' || $hv$il consume 5 points de spiritualités$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$7 points de spiritualités$hv$, $hv$7 points de spiritualité$hv$)
WHERE nom = $hv$Assemblage de barrière magique$hv$ AND texte_manuel LIKE '%' || $hv$7 points de spiritualités$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$7 points de spiritualités$hv$, $hv$7 points de spiritualité$hv$)
WHERE nom = $hv$Assemblage de durabilité$hv$ AND texte_manuel LIKE '%' || $hv$7 points de spiritualités$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$7 points de spiritualités$hv$, $hv$7 points de spiritualité$hv$)
WHERE nom = $hv$Assemblage de liberté$hv$ AND texte_manuel LIKE '%' || $hv$7 points de spiritualités$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$pour immunisé 4$hv$, $hv$pour immuniser 4$hv$)
WHERE nom = $hv$Assemblage de liberté$hv$ AND texte_manuel LIKE '%' || $hv$pour immunisé 4$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$zone de sanctuaire égal à$hv$, $hv$zone de sanctuaire égale à$hv$)
WHERE nom = $hv$Assemblage de préservation$hv$ AND texte_manuel LIKE '%' || $hv$zone de sanctuaire égal à$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$par accident tentant de renforcer des outils de forge il a plutôt eu$hv$, $hv$par accident : une tentative de renforcer des outils de forge a plutôt eu$hv$)
WHERE nom = $hv$Assemblage de productivité$hv$ AND texte_manuel LIKE '%' || $hv$par accident tentant de renforcer des outils de forge il a plutôt eu$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$9 points de spiritualités$hv$, $hv$9 points de spiritualité$hv$)
WHERE nom = $hv$Assemblage de protection contre les éléments$hv$ AND texte_manuel LIKE '%' || $hv$9 points de spiritualités$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$aussi un résistance$hv$, $hv$aussi une résistance$hv$)
WHERE nom = $hv$Assemblage de protection du mal$hv$ AND texte_manuel LIKE '%' || $hv$aussi un résistance$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$7 points de spiritualités$hv$, $hv$7 points de spiritualité$hv$)
WHERE nom = $hv$Assemblage de protection du mal$hv$ AND texte_manuel LIKE '%' || $hv$7 points de spiritualités$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$ainsi qu'un immunité$hv$, $hv$ainsi qu'une immunité$hv$)
WHERE nom = $hv$Assemblage de protection du mal$hv$ AND texte_manuel LIKE '%' || $hv$ainsi qu'un immunité$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$contre les sort à effet$hv$, $hv$contre les sorts à effet$hv$)
WHERE nom = $hv$Assemblage de protection du mal$hv$ AND texte_manuel LIKE '%' || $hv$contre les sort à effet$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$7 points de spiritualités$hv$, $hv$7 points de spiritualité$hv$)
WHERE nom = $hv$Assemblage de régénération$hv$ AND texte_manuel LIKE '%' || $hv$7 points de spiritualités$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$7 points de spiritualités$hv$, $hv$7 points de spiritualité$hv$)
WHERE nom = $hv$Assemblage de repos en paix$hv$ AND texte_manuel LIKE '%' || $hv$7 points de spiritualités$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$qui est protégé de toute possession$hv$, $hv$qui est protégée de toute possession$hv$)
WHERE nom = $hv$Assemblage de repos en paix$hv$ AND texte_manuel LIKE '%' || $hv$qui est protégé de toute possession$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$Les tentatives sont punis par un 3 dégâts bénie$hv$, $hv$Les tentatives sont punies par 3 dégâts bénis$hv$)
WHERE nom = $hv$Assemblage de repos en paix$hv$ AND texte_manuel LIKE '%' || $hv$Les tentatives sont punis par un 3 dégâts bénie$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$7 points de spiritualités$hv$, $hv$7 points de spiritualité$hv$)
WHERE nom = $hv$Assemblage de résilience$hv$ AND texte_manuel LIKE '%' || $hv$7 points de spiritualités$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$7 points de spiritualités$hv$, $hv$7 points de spiritualité$hv$)
WHERE nom = $hv$Assemblage de rigidité$hv$ AND texte_manuel LIKE '%' || $hv$7 points de spiritualités$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$7 points de spiritualités$hv$, $hv$7 points de spiritualité$hv$)
WHERE nom = $hv$Assemblage de santé$hv$ AND texte_manuel LIKE '%' || $hv$7 points de spiritualités$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$8 points de spiritualités$hv$, $hv$8 points de spiritualité$hv$)
WHERE nom = $hv$Assemblage du bâtisseur$hv$ AND texte_manuel LIKE '%' || $hv$8 points de spiritualités$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$ramenant son nombre de combat a 0$hv$, $hv$ramenant son nombre de combats a 0$hv$)
WHERE nom = $hv$Assemblage du bâtisseur$hv$ AND texte_manuel LIKE '%' || $hv$ramenant son nombre de combat a 0$hv$ || '%';

UPDATE assemblages_runes SET texte_manuel = replace(texte_manuel, $hv$7 points de spiritualités$hv$, $hv$7 points de spiritualité$hv$)
WHERE nom = $hv$Assemblage du passage$hv$ AND texte_manuel LIKE '%' || $hv$7 points de spiritualités$hv$ || '%';
