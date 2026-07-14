-- RESYNC-VERBATIM-4 — Lot D3 (b) : sections_regles (s330)
-- 2 coquilles (A1, A2) + 9 ajouts arbitrés par Fred (B1, B2, B3, B4, B7, B8, B9, B10, B11)
-- vs manuel corrigé 2026-06-18. Idempotente : chaque UPDATE est gardé par une ancre LIKE épuisable.

-- A1 · artisanat/40 : « Minage » → « Mineur » (nom exact de la compétence, manuel l.8881)
UPDATE sections_regles
SET contenu = replace(contenu,
  $a$Herbalisme, Minage, Dépeçage$a$,
  $a$Herbalisme, Mineur, Dépeçage$a$)
  , updated_at = now()
WHERE categorie = 'artisanat' AND ordre = 40
  AND contenu LIKE '%Herbalisme, Minage, Dépeçage%';

-- A2 · artisanat/100 : « du langage nain » → « du langage nain et du nain ancien » (manuel l.9803)
UPDATE sections_regles
SET contenu = replace(contenu,
  $a$Les runes sont tirées du langage nain. Une combinaison$a$,
  $a$Les runes sont tirées du langage nain et du nain ancien. Une combinaison$a$)
  , updated_at = now()
WHERE categorie = 'artisanat' AND ordre = 100
  AND contenu LIKE '%du langage nain. Une combinaison%';

-- B1 · combat/10 : exception à l'acte héroïque (potion / sort de soin sur soi)
UPDATE sections_regles
SET contenu = replace(contenu,
  $a$lui fait automatiquement perdre son dernier PV.$a$,
  $a$lui fait automatiquement perdre son dernier PV. Prendre une potion ou se lancer un sort de soin ne déclenche pas l'acte héroïque.$a$)
  , updated_at = now()
WHERE categorie = 'combat' AND ordre = 10
  AND contenu LIKE '%lui fait automatiquement perdre son dernier PV.%'
  AND contenu NOT LIKE '%ne déclenche pas l''acte héroïque%';

-- B10 · combat/10 : propriétés des métaux hors règle de cumul
UPDATE sections_regles
SET contenu = replace(contenu,
  $a$Deux effets de même source ne se cumulent pas.$a$,
  $a$Deux effets de même source ne se cumulent pas. Les propriétés des métaux ne sont pas incluses dans ce règlement (voir artisanat).$a$)
  , updated_at = now()
WHERE categorie = 'combat' AND ordre = 10
  AND contenu LIKE '%Deux effets de même source ne se cumulent pas.%'
  AND contenu NOT LIKE '%propriétés des métaux%';

-- B2 · combat/70 : seule exception de guérison pendant le coup de grâce
UPDATE sections_regles
SET contenu = replace(contenu,
  $a$sans pouvoir recevoir de guérison.$a$,
  $a$sans pouvoir recevoir de guérison — seul un sort de rappel à la vie peut être utilisé.$a$)
  , updated_at = now()
WHERE categorie = 'combat' AND ordre = 70
  AND contenu LIKE '%sans pouvoir recevoir de guérison.%'
  AND contenu NOT LIKE '%rappel à la vie%';

-- B3 · combat/40 : condition de port du torse pour les accessoires
UPDATE sections_regles
SET contenu = replace(contenu,
  $a$- Armure de plaques + deux accessoires$a$,
  $a$- Pour bénéficier des points d'armure des accessoires, le torse de l'armure doit absolument être porté.

- Armure de plaques + deux accessoires$a$)
  , updated_at = now()
WHERE categorie = 'combat' AND ordre = 40
  AND contenu LIKE '%- Armure de plaques + deux accessoires%'
  AND contenu NOT LIKE '%doit absolument être porté%';

-- B4 · objets_enjeu/60 : pas de limite au nombre de compétences de niveau 3
UPDATE sections_regles
SET contenu = replace(contenu,
  $a$possédant déjà ce troisième niveau.$a$,
  $a$possédant déjà ce troisième niveau. Il n'y a pas de limite au nombre de compétences de niveau 3.$a$)
  , updated_at = now()
WHERE categorie = 'objets_enjeu' AND ordre = 60
  AND contenu LIKE '%possédant déjà ce troisième niveau.%'
  AND contenu NOT LIKE '%pas de limite au nombre%';

-- B7 · artisanat/80 : temps des renforcements (manuel : 5/10/15 min · 5 min/PA · 15 min)
UPDATE sections_regles
SET contenu = replace(replace(replace(contenu,
  $a$Résiste à 1 destruction. Coût :$a$,
  $a$Résiste à 1 destruction. Temps : 5/10/15 min selon la taille (+5 min rare). Coût :$a$),
  $a$Double le nombre de combats. Coût :$a$,
  $a$Double le nombre de combats. Temps : 5 min par point d'armure. Coût :$a$),
  $a$+1 point d'armure. Coût :$a$,
  $a$+1 point d'armure. Temps : 15 minutes. Coût :$a$)
  , updated_at = now()
WHERE categorie = 'artisanat' AND ordre = 80
  AND contenu NOT LIKE '%Temps :%';

-- B9 · artisanat/20 : détail des cartes d'expédition (harmonisation avec les métaux)
UPDATE sections_regles
SET contenu = replace(contenu,
  $a$Résultat remis au GN suivant.$a$,
  $a$Résultat remis au GN suivant (cartes d'expédition : 2 à 7 doses + possibilité d'achat supplémentaire).$a$)
  , updated_at = now()
WHERE categorie = 'artisanat' AND ordre = 20
  AND contenu LIKE '%Résultat remis au GN suivant.%'
  AND contenu NOT LIKE '%2 à 7 doses%';

-- B8a · artisanat/10 : prospection minière (Mineur 3, manuel l.8740+)
UPDATE sections_regles
SET contenu = contenu || $a$

**Prospection minière (Mineur 3) :** Le personnage peut renoncer à sa récolte habituelle pour investir temps, ressources et écus dans la recherche de nouvelles mines. Chaque carte de prospection représente un emplacement potentiel. Une mine découverte devient la propriété du mineur (acte de propriété remis) et peut être conservée ou cédée à un autre personnage possédant Mineur 3. Chaque mine permet d'exploiter un minerai précis pour une durée limitée, jusqu'à épuisement du filon.$a$
  , updated_at = now()
WHERE categorie = 'artisanat' AND ordre = 10
  AND contenu NOT LIKE '%Prospection minière%';

-- B8b · artisanat/20 : prospection botanique (Herbalisme 3, manuel l.8821+)
UPDATE sections_regles
SET contenu = contenu || $a$

**Prospection botanique (Herbalisme 3) :** Le personnage peut renoncer à sa récolte habituelle pour investir temps, ressources et écus dans la recherche de nouveaux bosquets. Chaque carte de prospection représente un emplacement potentiel. Un bosquet découvert devient la propriété de l'herboriste (acte de propriété remis) et peut être conservé ou cédé à un autre personnage possédant Herbalisme 3. Chaque bosquet permet d'exploiter une herbe précise pour une durée limitée, jusqu'à épuisement des herbes.$a$
  , updated_at = now()
WHERE categorie = 'artisanat' AND ordre = 20
  AND contenu NOT LIKE '%Prospection botanique%';

-- B11 · artisanat/105 : ingrédients en gras = éléments de jeu
UPDATE sections_regles
SET contenu = replace(contenu,
  $a$- Les ingrédients marqués **===** (lignes doubles) sont détruits après la création.$a$,
  $a$- Les ingrédients marqués **===** (lignes doubles) sont détruits après la création.
- Les ingrédients écrits **en gras** sont des éléments de jeu et doivent être procurés en jeu.$a$)
  , updated_at = now()
WHERE categorie = 'artisanat' AND ordre = 105
  AND contenu LIKE '%sont détruits après la création.%'
  AND contenu NOT LIKE '%en gras%';
