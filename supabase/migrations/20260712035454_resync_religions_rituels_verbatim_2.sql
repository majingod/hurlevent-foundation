-- Resync verbatim religions — lot 3/3 : rituels_manuel (Sigwulf, Shen-Gon, Nalidala, Saronides, Polan, Pinte).
-- Manuel corrigé 2026-06-18 = source de vérité. Idempotent : REPLACE ancrés par élément + garde EXISTS.
-- Préfixes éditoriaux « Auberge/Chaos/Quête — » (Pinte) conservés.

-- Les Chevaliers de l'Écu de Sigwulf Roc (2 corrections)
UPDATE religions SET rituels_manuel = (
  SELECT array_agg(replace(replace(e,
      $a$de l'écus croient en neuf vertus$a$,
      $a$de l'écu croient en neuf vertus$a$),
      $a$mener à l'internalisme$a$,
      $a$mener à l'infernalisme$a$) ORDER BY ord)
  FROM unnest(rituels_manuel) WITH ORDINALITY t(e, ord))
WHERE nom = 'Les Chevaliers de l''Écu de Sigwulf Roc'
  AND EXISTS (SELECT 1 FROM unnest(rituels_manuel) e WHERE e LIKE $a$%de l'écus croient en neuf vertus%$a$);

-- Les Éternels de Shen-Gon (2 corrections)
UPDATE religions SET rituels_manuel = (
  SELECT array_agg(replace(replace(e,
      $a$afin qu'il participe au nouveau monde$a$,
      $a$afin qu'ils participent au nouveau monde$a$),
      $a$doivent être convertis ou mourir$a$,
      $a$doivent être converties ou mourir$a$) ORDER BY ord)
  FROM unnest(rituels_manuel) WITH ORDINALITY t(e, ord))
WHERE nom = 'Les Éternels de Shen-Gon'
  AND EXISTS (SELECT 1 FROM unnest(rituels_manuel) e WHERE e LIKE $a$%afin qu'il participe au nouveau monde%$a$);

-- Les Faéeries de Nalidala (3 corrections)
UPDATE religions SET rituels_manuel = (
  SELECT array_agg(replace(replace(replace(e,
      $a$tiliser ses ingrédients dans un rituel$a$,
      $a$tiliser ces ingrédients dans un rituel$a$),
      $a$renez gare aux tentations$a$,
      $a$renez garde aux tentations$a$),
      $a$du chaos et ne doit pas être utilisé$a$,
      $a$du chaos et ne doivent pas être utilisées$a$) ORDER BY ord)
  FROM unnest(rituels_manuel) WITH ORDINALITY t(e, ord))
WHERE nom = 'Les Faéeries de Nalidala'
  AND EXISTS (SELECT 1 FROM unnest(rituels_manuel) e WHERE e LIKE $a$%tiliser ses ingrédients dans un rituel%$a$);

-- Les Saronides de Garron (4 corrections)
UPDATE religions SET rituels_manuel = (
  SELECT array_agg(replace(replace(replace(replace(e,
      $a$druides et Druidesse en Destéa$a$,
      $a$druides et druidesses en Destéa$a$),
      $a$à mesure que des terribles créatures$a$,
      $a$à mesure que de terribles créatures$a$),
      $a$tout druide doit en assurer la survie de son espèce totem$a$,
      $a$tout druide doit assurer la survie de son espèce totem$a$),
      $a$car tous dons de la terre$a$,
      $a$car tous les dons de la terre$a$) ORDER BY ord)
  FROM unnest(rituels_manuel) WITH ORDINALITY t(e, ord))
WHERE nom = 'Les Saronides de Garron'
  AND EXISTS (SELECT 1 FROM unnest(rituels_manuel) e WHERE e LIKE $a$%druides et Druidesse en Destéa%$a$);

-- Les Sauvages de Polan (5 corrections)
UPDATE religions SET rituels_manuel = (
  SELECT array_agg(replace(replace(replace(replace(replace(e,
      $a$se rassembler et organiser à un grand banquet$a$,
      $a$se rassembler et organiser un grand banquet$a$),
      $a$contre toute autres menaces$a$,
      $a$contre toutes autres menaces$a$),
      $a$enterrer ses morts amènent les mauvais esprits$a$,
      $a$enterrer ses morts amène les mauvais esprits$a$),
      $a$élève pas vers leur ancêtres$a$,
      $a$élève pas vers leurs ancêtres$a$),
      $a$foi en leur ancêtre est suffisante$a$,
      $a$foi en leurs ancêtres est suffisante$a$) ORDER BY ord)
  FROM unnest(rituels_manuel) WITH ORDINALITY t(e, ord))
WHERE nom = 'Les Sauvages de Polan'
  AND EXISTS (SELECT 1 FROM unnest(rituels_manuel) e WHERE e LIKE $a$%se rassembler et organiser à un grand banquet%$a$);

-- Le Culte de La Pinte Sauvage (21 corrections)
UPDATE religions SET rituels_manuel = (
  SELECT array_agg(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(e,
      $a$prêtres de la voix de la pinte$a$,
      $a$prêtres de la voie de la pinte$a$),
      $a$un prêtre de cette voix lui barre$a$,
      $a$un prêtre de cette voie lui barre$a$),
      $a$adepte de la voix de la pinte$a$,
      $a$adepte de la voie de la pinte$a$),
      $a$arranger pour finir déchirer$a$,
      $a$arranger pour finir par se déchirer$a$),
      $a$ne fait pas vivre tes émotions$a$,
      $a$ne fais pas vivre tes émotions$a$),
      $a$tenir l'auberge festives$a$,
      $a$tenir l'auberge festive$a$),
      $a$famille, soit solidaire$a$,
      $a$famille, sois solidaire$a$),
      $a$famille soit solidaire$a$,
      $a$famille sois solidaire$a$),
      $a$oit avec tes ennemies$a$,
      $a$ois avec tes ennemies$a$),
      $a$dire des belles choses$a$,
      $a$dire de belles choses$a$),
      $a$u pire, prend une gorgée$a$,
      $a$u pire, prends une gorgée$a$),
      $a$pprend à connaître ton auberge$a$,
      $a$pprends à connaître ton auberge$a$),
      $a$à choisir le tient$a$,
      $a$à choisir le tien$a$),
      $a$plus fort que soit$a$,
      $a$plus fort que soi$a$),
      $a$nous rapprochent de la$a$,
      $a$nous rapproche de la$a$),
      $a$onnes comme les mauvaises se font$a$,
      $a$onnes comme les mauvaises idées se font$a$),
      $a$un journal des tes actes d'importances$a$,
      $a$un journal de tes actes d'importance$a$),
      $a$être pieu dans une auberge$a$,
      $a$être pieux dans une auberge$a$),
      $a$personnes qui demande le silence$a$,
      $a$personnes qui demandent le silence$a$),
      $a$parole puisse être donné à$a$,
      $a$parole puisse être donnée à$a$),
      $a$et crier ''Al Pinte'' et partage la.$a$,
      $a$et crier ''Al Pinte'' et ensuite partager son idée.$a$) ORDER BY ord)
  FROM unnest(rituels_manuel) WITH ORDINALITY t(e, ord))
WHERE nom = 'Le Culte de La Pinte Sauvage'
  AND EXISTS (SELECT 1 FROM unnest(rituels_manuel) e WHERE e LIKE $a$%prêtres de la voix de la pinte%$a$);
