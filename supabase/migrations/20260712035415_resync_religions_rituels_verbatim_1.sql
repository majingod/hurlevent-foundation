-- Resync verbatim religions — lot 2/3 : rituels_manuel (Asbeth, Sol-gon, Zenlia, Mergar, Acarthas, Sorelf, Ren).
-- Manuel corrigé 2026-06-18 = source de vérité. Idempotent : REPLACE ancrés par élément + garde EXISTS.

-- Culte des Ombres d'Asbeth (2 corrections)
UPDATE religions SET rituels_manuel = (
  SELECT array_agg(replace(replace(e,
      $a$s'incarne dans ces adeptes$a$,
      $a$s'incarne dans ses adeptes$a$),
      $a$il faut qu'il honore Asbeth de leur peur$a$,
      $a$il faut qu'ils honorent Asbeth de leur peur$a$) ORDER BY ord)
  FROM unnest(rituels_manuel) WITH ORDINALITY t(e, ord))
WHERE nom = 'Culte des Ombres d''Asbeth'
  AND EXISTS (SELECT 1 FROM unnest(rituels_manuel) e WHERE e LIKE $a$%s'incarne dans ces adeptes%$a$);

-- L'Ordre de la Connaissance de Sol-gon (2 corrections)
UPDATE religions SET rituels_manuel = (
  SELECT array_agg(replace(replace(e,
      $a$digne d'être scribes de Solgon$a$,
      $a$digne d'être scribe de Solgon$a$),
      $a$un niveau de connaissance importante$a$,
      $a$un niveau de connaissance important$a$) ORDER BY ord)
  FROM unnest(rituels_manuel) WITH ORDINALITY t(e, ord))
WHERE nom = 'L''Ordre de la Connaissance de Sol-gon'
  AND EXISTS (SELECT 1 FROM unnest(rituels_manuel) e WHERE e LIKE $a$%digne d'être scribes de Solgon%$a$);

-- La Compagnie de Zenlia (1 correction)
UPDATE religions SET rituels_manuel = (
  SELECT array_agg(replace(e,
      $a$aucune allégeances politiques$a$,
      $a$aucune allégeance politique$a$) ORDER BY ord)
  FROM unnest(rituels_manuel) WITH ORDINALITY t(e, ord))
WHERE nom = 'La Compagnie de Zenlia'
  AND EXISTS (SELECT 1 FROM unnest(rituels_manuel) e WHERE e LIKE $a$%aucune allégeances politiques%$a$);

-- Les Chevaliers Gris de Mergar (1 correction)
UPDATE religions SET rituels_manuel = (
  SELECT array_agg(replace(e,
      $a$créatures surnaturelles dotées d$a$,
      $a$créatures surnaturelles dotée d$a$) ORDER BY ord)
  FROM unnest(rituels_manuel) WITH ORDINALITY t(e, ord))
WHERE nom = 'Les Chevaliers Gris de Mergar'
  AND EXISTS (SELECT 1 FROM unnest(rituels_manuel) e WHERE e LIKE $a$%créatures surnaturelles dotées d%$a$);

-- Les Ecclésias d'Acarthas (3 corrections)
UPDATE religions SET rituels_manuel = (
  SELECT array_agg(replace(replace(replace(e,
      $a$la veille de grande bataille$a$,
      $a$la veille de grandes batailles$a$),
      $a$bénissent leur guerrier en leur brûlant$a$,
      $a$bénissent leurs guerriers en leur brûlant$a$),
      $a$sans quoi, il ne mérite que la mort$a$,
      $a$sans quoi, ils ne méritent que la mort$a$) ORDER BY ord)
  FROM unnest(rituels_manuel) WITH ORDINALITY t(e, ord))
WHERE nom = 'Les Ecclésias d''Acarthas'
  AND EXISTS (SELECT 1 FROM unnest(rituels_manuel) e WHERE e LIKE $a$%la veille de grande bataille%$a$);

-- Les Justicares de Sorelf (7 corrections)
UPDATE religions SET rituels_manuel = (
  SELECT array_agg(replace(replace(replace(replace(replace(replace(replace(e,
      $a$les faits et soit à$a$,
      $a$les faits et sois à$a$),
      $a$un Justicares$a$,
      $a$un Justicare$a$),
      $a$commettre aucuns crimes$a$,
      $a$commettre aucun crime$a$),
      $a$associée avec$a$,
      $a$associés avec$a$),
      $a$les portes paroles de la Justice$a$,
      $a$les porte-paroles de la Justice$a$),
      $a$reconnus pour leur méthodes brutales$a$,
      $a$reconnus pour leurs méthodes brutales$a$),
      $a$n raison de leur grandes connaissances$a$,
      $a$n raison de leurs grandes connaissances$a$) ORDER BY ord)
  FROM unnest(rituels_manuel) WITH ORDINALITY t(e, ord))
WHERE nom = 'Les Justicares de Sorelf'
  AND EXISTS (SELECT 1 FROM unnest(rituels_manuel) e WHERE e LIKE $a$%les faits et soit à%$a$);

-- L'Ordre de la Mer de Ren (1 correction)
UPDATE religions SET rituels_manuel = (
  SELECT array_agg(replace(e,
      $a$bénédiction accordée par la Ren pour$a$,
      $a$bénédiction accordée par Ren pour$a$) ORDER BY ord)
  FROM unnest(rituels_manuel) WITH ORDINALITY t(e, ord))
WHERE nom = 'L''Ordre de la Mer de Ren'
  AND EXISTS (SELECT 1 FROM unnest(rituels_manuel) e WHERE e LIKE $a$%bénédiction accordée par la Ren pour%$a$);
