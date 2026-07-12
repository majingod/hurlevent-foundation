-- [RESYNC-VERBATIM-2] Lot C compétences niveaux — batch 3/4 (s327)
-- Corrections verbatim vs manuel corrigé 2026-06-18. Idempotent (garde md5-avant).
-- Niveaux: crochetagedeserrure·voleur·1, depecage·generale·2, diagnostic·pretre·1, discoursducommandement·guerrier·1, formationtheologique·pretre·1, frenesiemagique·generale·1, grandemesse·pretre·1, grandemesse·pretre·2, grandemesse·pretre·3

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = '3145f2d5426186a352c28e390b8be709'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Permet au personnage d'ouvrir les serrures "Facile" sans la clé. L'ouverture d'une serrure en la crochetant exige 2 minutes de travail.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'voleur'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'crochetagedeserrure'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = '3145f2d5426186a352c28e390b8be709');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 2 AND md5(e->>'description') = '9dab3b565ba687c78d51b6bf40d2bacf'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Le personnage possède les connaissances nécessaires pour récolter efficacement les ressources naturelles des créatures qu'il chasse. En jouant un rôleplay approprié pendant au moins 30 secondes sur une créature tuée, il doit informer le PNJ incarnant la créature qu'il utilise la compétence Dépeçage 2 et préciser la ressource qu'il souhaite récolter. Si la créature peut fournir cette ressource, le PNJ la remet au joueur. Pour pouvoir dépecer une créature, le personnage doit également posséder la compétence Connaissances des Créatures 2 correspondant à la famille exacte de la créature concernée. Sans cette connaissance précise, il est impossible d'effectuer une récolte sur celle-ci.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'generale'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'depecage'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 2 AND md5(e2->>'description') = '9dab3b565ba687c78d51b6bf40d2bacf');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = '1ccbbb9744822632c2819df70f17052a'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Cette compétence permet d'inspecter un personnage pendant 10 secondes et découvrir quelles sont les blessures, le type de maladie, et les effets non magiques tels les coups-vicieux et la paralysie subie par sa cible. De plus, il est capable après son inspection de savoir si sa cible est décédée, comateuse ou si elle fait semblant d'être inconsciente. Le diagnostic se fait en posant un doigt sur l'épaule de la cible. Un personnage voulant nuire au guérisseur en bougeant constamment annulera le diagnostic.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'pretre'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'diagnostic'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = '1ccbbb9744822632c2819df70f17052a');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = '694d6b7bf24e0da2f26f3e85473fa981'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Avant un combat, le guerrier peut prononcer un discours inspirant d'une durée minimale de cinq minutes. À l'issue de ce discours, il active une aura de commandement dont la durée est de trois heures ou jusqu'à la fin du prochain combat, selon ce qui survient en premier. Le guerrier peut alors choisir entre deux et six alliés situés dans un rayon de 10 pieds (environ 3 mètres) autour de lui et il peut augmenter le nombre de personnes affectées, mais il doit ajouter 30 secondes de plus à son discours. Chaque allié choisi peut ignorer une attaque physique non magique par combat sans perdre de point de vie. Pour bénéficier de cet effet, l'allié doit annoncer « Résiste ! » au moment de l'impact de l'attaque. Cette compétence peut être utilisée jusqu'à deux fois par cycle.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'guerrier'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'discoursducommandement'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = '694d6b7bf24e0da2f26f3e85473fa981');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = '7ddf9fad595ad656bbc63fda8a7685ec'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Permet aux adeptes d'avoir reçu des enseignements secrets sur le mythe de la création ou sur leur religion pendant leur baptême ce qui leur permet d'obtenir de l'animation un résumé plus poussé sur la création de l'univers OU des secrets de leur religion.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'pretre'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'formationtheologique'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = '7ddf9fad595ad656bbc63fda8a7685ec');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = '37ae70f79313a5934fc0e1ee8020c015'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Lorsque le lanceur de sorts arrive à la fin de son essence magique, il peut puiser au fond de lui-même pour continuer de lancer des sorts. Il peut utiliser ses points de vie, au taux de 1 point de vie pour 1 point de spiritualité, pour lancer ses sorts. Cette compétence est terriblement souffrante et les soins physiques (Premier soins) ne pourront pas soigner ces dégâts. Il faudra utiliser une potion, recevoir des soins magiques ou se soigner avec la régénération naturelle au changement de cycle pour récupérer ces points de vie. Cette compétence fonctionne seulement avec les points de vie naturels du lanceur de sort, les points de vie temporaires ou magiques ne fonctionnent pas. Cette compétence n'est pas utilisable pour se soigner soi-même magiquement.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'generale'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'frenesiemagique'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = '37ae70f79313a5934fc0e1ee8020c015');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = 'e7281ef8bc03397c53faa3f9951f8176'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Le personnage doit organiser et présider une grande messe aux couleurs de son ordre durant au minimum 2 minutes par participant, avec un minimum de 3 participants partageant la même religion et excluant le prêtre. Une fois complété, chaque personnage d'une même religion ayant participé à la messe regagne 3 points de spiritualité ainsi qu'un point de vie. Cela exclut le prêtre.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'pretre'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'grandemesse'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = 'e7281ef8bc03397c53faa3f9951f8176');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 2 AND md5(e->>'description') = '894c923f7dd513a9834eee1fec294e68'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Le personnage doit organiser et présider une grande messe aux couleurs de son ordre durant au minimum 2 minutes par participant, avec un minimum de 5 participants partageant la même religion et incluant le prêtre. Une fois complété, chaque personnage partageant la même religion ayant participé à la messe regagne 5 points de spiritualité ainsi que 2 points de vie.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'pretre'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'grandemesse'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 2 AND md5(e2->>'description') = '894c923f7dd513a9834eee1fec294e68');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 3 AND md5(e->>'description') = '3d26cab11ea939c7a9478b9d50c56851'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Le personnage doit organiser et présider une grande messe aux couleurs de son ordre durant au minimum 2 minutes par participant, avec un minimum de 10 participants partageant la même religion et incluant le prêtre. Une fois complété, chaque personnage ayant participé à la messe regagne 15 points de spiritualité ainsi que tous ses points de vie.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'pretre'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'grandemesse'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 3 AND md5(e2->>'description') = '3d26cab11ea939c7a9478b9d50c56851');
