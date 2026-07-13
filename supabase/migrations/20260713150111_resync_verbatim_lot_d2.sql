-- RESYNC-VERBATIM Lot D2 (s328) : races, bestiaire, pièges, lore (Torekh)
-- 13 corrections validées par Fred (rapport A/B/C s328). Idempotent : re-run = 0 lignes.
-- Source de vérité : Manuel corrigé 2026-06-18. Convention s47 : coquilles du manuel non répliquées.

-- === RACES (exigences_costume) ===
UPDATE races SET exigences_costume = replace(exigences_costume, $hv$en toutes météo$hv$, $hv$en toute météo$hv$)
WHERE nom = 'Chiméride' AND exigences_costume LIKE $hv$%en toutes météo%$hv$;

UPDATE races SET exigences_costume = exigences_costume || '.'
WHERE nom = 'Demi-Orc' AND exigences_costume LIKE $hv$%masque approprié$hv$ AND exigences_costume NOT LIKE $hv$%approprié.$hv$;

UPDATE races SET exigences_costume = exigences_costume || '.'
WHERE nom = 'Gobelin' AND exigences_costume LIKE $hv$%masque approprié$hv$ AND exigences_costume NOT LIKE $hv$%approprié.$hv$;

-- === BESTIAIRE (habilité -> habileté, classe s294) ===
UPDATE bestiaire SET description = replace(description, $hv$habilité connue$hv$, $hv$habileté connue$hv$)
WHERE nom IN ('Zombie','Squelette','Goule') AND description LIKE $hv$%habilité connue%$hv$;

UPDATE bestiaire SET capacites_speciales = replace(capacites_speciales, $hv$habilités connues$hv$, $hv$habiletés connues$hv$)
WHERE nom = 'Blême' AND capacites_speciales LIKE $hv$%habilités connues%$hv$;

-- === BESTIAIRE (Spectre : clause manuel manquante, B1 validé) ===
UPDATE bestiaire SET description = replace(description,
  $hv$équivaut au niveau du sort lancé.$hv$,
  $hv$équivaut au niveau du sort lancé et contrevient à la règle d'intangibilité.$hv$)
WHERE nom = 'Spectre' AND description LIKE $hv$%équivaut au niveau du sort lancé.$hv$ AND description NOT LIKE $hv$%contrevient%$hv$;

-- === PIÈGES (construction niveau 1) ===
UPDATE pieges SET construction = replace(construction, $hv$gougeon$hv$, $hv$goujon$hv$)
WHERE nom = 'Fléchette cachée' AND niveau = 1 AND construction LIKE $hv$%gougeon%$hv$;

UPDATE pieges SET construction = replace(construction, $hv$catalysant à potion$hv$, $hv$catalyseur à potion$hv$)
WHERE nom = 'Piège aveuglant' AND niveau = 1 AND construction LIKE $hv$%catalysant à potion%$hv$;

-- B2 validé : fiole d'encre noire = réutilisable (---) comme au manuel
UPDATE pieges SET construction = replace(construction,
  $hv$Contenant (===) : 1 fiole d'encre noire$hv$,
  $hv$Contenant (---) : 1 fiole d'encre noire$hv$)
WHERE nom = 'Piège aveuglant' AND niveau = 1 AND construction LIKE $hv$%Contenant (===) : 1 fiole d'encre noire%$hv$;

-- === LORE (Royaume de Torekh) ===
UPDATE lore SET description = replace(description, $hv$Montclair-petit-cloue$hv$, $hv$Montclair-du-Petit-Cloue$hv$)
WHERE nom = 'Royaume de Torekh' AND description LIKE $hv$%Montclair-petit-cloue%$hv$;

UPDATE lore SET description = replace(description, $hv$Culte des Héros et Héroïnes$hv$, $hv$Culte des Héros et des héroïnes$hv$)
WHERE nom = 'Royaume de Torekh' AND description LIKE $hv$%Culte des Héros et Héroïnes%$hv$;
