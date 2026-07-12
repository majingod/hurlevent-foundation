-- Resync verbatim religions (audit [RESYNC-VERBATIM], Gotcha C6) — lot 1/3 : lore_manuel.
-- Manuel corrigé 2026-06-18 = source de vérité. Idempotent : REPLACE ancrés + garde (rejouable = no-op).
-- Corrections de SENS (Pinte : « voie » ≠ « voix », phrase charabia Sigwulf) + accords grammaticaux.
-- Choix DB DÉLIBÉRÉS conservés (arbitrage Fred 2026-07-12) : Théodham, Karnak, de Foix, justicars, table des vertus Sigwulf.

-- Les Chevaliers Gris de Mergar (1 correction)
UPDATE religions SET lore_manuel = replace(lore_manuel,
    $a$surnaturel. Il était aussi des conseillers pour les morts$a$,
    $a$surnaturel. Ils étaient aussi des conseillers pour les morts$a$)
WHERE nom = 'Les Chevaliers Gris de Mergar'
  AND lore_manuel LIKE $a$%surnaturel. Il était aussi des conseillers pour les morts%$a$;

-- Les Éternels de Shen-Gon (1 correction)
UPDATE religions SET lore_manuel = replace(lore_manuel,
    $a$des démons et des créatures issus des âges$a$,
    $a$des démons et des créatures issues des âges$a$)
WHERE nom = 'Les Éternels de Shen-Gon'
  AND lore_manuel LIKE $a$%des démons et des créatures issus des âges%$a$;

-- Les Faéeries de Nalidala (1 correction)
UPDATE religions SET lore_manuel = replace(lore_manuel,
    $a$furent massacrées et complètement anéantis$a$,
    $a$furent massacrées et complètement anéanties$a$)
WHERE nom = 'Les Faéeries de Nalidala'
  AND lore_manuel LIKE $a$%furent massacrées et complètement anéantis%$a$;

-- Les Sauvages de Polan (1 correction)
UPDATE religions SET lore_manuel = replace(lore_manuel,
    $a$Ils vivent pour rendre fier leurs ancêtres$a$,
    $a$Ils vivent pour rendre fiers leurs ancêtres$a$)
WHERE nom = 'Les Sauvages de Polan'
  AND lore_manuel LIKE $a$%Ils vivent pour rendre fier leurs ancêtres%$a$;

-- Les Chevaliers de l'Écu de Sigwulf Roc (8 corrections)
UPDATE religions SET lore_manuel = replace(replace(replace(replace(replace(replace(replace(replace(lore_manuel,
    $a$ancien manuscrit. Il aboutit les plus anciennes de Farénée$a$,
    $a$ancien manuscrit. Il y évoque les maisons les plus anciennes de Farénée$a$),
    $a$leur bienfaisance et leur honneur étaient réputées dans la région$a$,
    $a$leur bienfaisance et leur honneur étaient réputés dans la région$a$),
    $a$avant d'être rejoint par l'ensemble des cultes$a$,
    $a$avant d'être rejointe par l'ensemble des cultes$a$),
    $a$plusieurs s'emploi aux populations$a$,
    $a$plusieurs s'emploient auprès des populations$a$),
    $a$chevaliers errants portant leur vertus$a$,
    $a$chevaliers errants portant leurs vertus$a$),
    $a$Un chevalier qui fausserait serait jugé$a$,
    $a$Un chevalier qui fauterait serait jugé$a$),
    $a$Responsables des affaires surnaturelles et du voile$a$,
    $a$Responsable des affaires surnaturelles et du voile$a$),
    $a$terres connues. Il a sous son contrôle tous les syndicats$a$,
    $a$terres connues. Elle a sous son contrôle tous les syndicats$a$)
WHERE nom = 'Les Chevaliers de l''Écu de Sigwulf Roc'
  AND lore_manuel LIKE $a$%ancien manuscrit. Il aboutit les plus anciennes de Farénée%$a$;

-- Le Culte de La Pinte Sauvage (8 corrections)
UPDATE religions SET lore_manuel = replace(replace(replace(replace(replace(replace(replace(replace(lore_manuel,
    $a$conclusion qu'une la Pinte Sauvage serait$a$,
    $a$conclusion que la Pinte Sauvage serait$a$),
    $a$la Sainte Pinte et se liquide faire renaître$a$,
    $a$la Sainte Pinte et de ce liquide firent renaître$a$),
    $a$ces idéaux vont finir par supposer et fragmenter l'ordre$a$,
    $a$ces idéaux vont finir par s'opposer et fragmenter l'ordre$a$),
    $a$suit les trois voix et refuse l'accès$a$,
    $a$suit les trois voies et refuse l'accès$a$),
    $a$Les trois voix peuvent s'opposer$a$,
    $a$Les trois voies peuvent s'opposer$a$),
    $a$La voix de l'Auberge$a$,
    $a$La voie de l'Auberge$a$),
    $a$La voix du Chaos$a$,
    $a$La voie du Chaos$a$),
    $a$La voix de la Quête$a$,
    $a$La voie de la Quête$a$)
WHERE nom = 'Le Culte de La Pinte Sauvage'
  AND lore_manuel LIKE $a$%conclusion qu'une la Pinte Sauvage serait%$a$;
