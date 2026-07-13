-- [RESYNC-VERBATIM-2] Lot C compétences niveaux — batch 2/4 (s327)
-- Corrections verbatim vs manuel corrigé 2026-06-18. Idempotent (garde md5-avant).
-- Niveaux: chirurgien·pretre·1, combatadeuxarmes·guerrier·1, combatadeuxarmes·guerrier·3, competencedarmedimpact·guerrier·3, connaissancesdescreatures·generale·1, connaissancesdescreatures·generale·2, connaissancesheraldique·generale·1, creationetdesarmementdepiege·voleur·2, creationetdesarmementdepiege·voleur·3

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = '6d4f59df7664ce6927ff982a9b46d95e'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Le personnage possède les connaissances médicales nécessaires pour pratiquer des interventions chirurgicales complexes. Cette compétence permet de rattacher un membre sectionné, effectuer une greffe, retirer un parasite, extraire un corps étranger ou réaliser toute autre opération invasive nécessitant précision et matériel adéquat. Toute chirurgie exige des outils appropriés qui doivent avoir été vus avant le début de la fin de semaine, un éclairage convenable ainsi qu'un environnement calme et sécuritaire. L'intervention demande 5 minutes de préparation suivies de 10 minutes complètes d'opération en jeu, jouées de manière crédible. Cette compétence ne peut jamais être utilisée en situation de combat. Les éléments utilisés en chirurgie doivent être frais, c'est-à-dire séparés du corps depuis moins d'un cycle. Les greffes ne peuvent être réalisées qu'entre individus de la même race, sauf mention contraire. Pour les règles complètes concernant les membres sectionnés, leur récupération et leur conservation, voir la section Règle liée à la perte de membre.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'pretre'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'chirurgien'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = '6d4f59df7664ce6927ff982a9b46d95e');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = '5959c2df190eb58f1331b40b5b179493'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Cette compétence permet le port de deux armes, une dans chaque main lors des combats. Le personnage doit par contre s'en tenir à un maximum de 2 armes courtes (45 cm ou moins). C'est toujours la plus longue qui est une prémisse pour la compétence. Donc, il n'est pas possible d'avoir une arme longue et une arme courte à moins que vous ayez la compétence niveau 3.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'guerrier'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'combatadeuxarmes'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = '5959c2df190eb58f1331b40b5b179493');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 3 AND md5(e->>'description') = 'e4424b0c94e78660cea8538e7f141c76'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Le personnage peut maintenant porter 2 armes longues (80 cm à 110 cm).$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'guerrier'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'combatadeuxarmes'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 3 AND md5(e2->>'description') = 'e4424b0c94e78660cea8538e7f141c76');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 3 AND md5(e->>'description') = '72cb399fc405d0fb63d0143792a63bbb'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Lorsque le personnage utilise la compétence Berserk, le personnage annonce toujours l'habileté "Repoussé 3 pieds' à chacun de ses coups lors d'un combat. Il doit utiliser une masse ou un marteau pour utiliser cette compétence.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'guerrier'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'competencedarmedimpact'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 3 AND md5(e2->>'description') = '72cb399fc405d0fb63d0143792a63bbb');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = 'c98819e64f5229b8753c9a520cf0a7b7'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Le personnage possédant Connaissance des Créatures 1 a étudié les créatures autrefois présentes à Destea et celles qui y réapparaissent. Lors de l'acquisition de la compétence, le joueur doit choisir une catégorie de monstres parmi les suivantes : Forêt, artificielles, montagnes, rêves, mythiques, Souterrains, tombes, mers, cauchemars, rakashans, déserts ou du Néant. Le joueur doit ensuite se présenter à l'organisation afin de recevoir un document regroupant de nombreuses informations sur la catégorie choisie. Cette compétence peut être acquise plusieurs fois afin de débloquer plusieurs catégories de créatures. Le niveau 1 donne accès aux créatures communes de la catégorie choisie. Pour utiliser cette compétence en jeu, le joueur peut demander discrètement au PNJ qui joue le monstre s'il fait partie de la famille de créatures dont le joueur possède la connaissance. Le PNJ lui répondra simplement oui ou non et il revient au joueur d'identifier la créature à l'aide de ses notes et du document fourni. L'expérimentation et l'observation restent une part essentielle de l'apprentissage en raison que ce sont uniquement les informations de base qui vous seront fournies.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'generale'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'connaissancesdescreatures'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = 'c98819e64f5229b8753c9a520cf0a7b7');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 2 AND md5(e->>'description') = 'c9022d18e8fd3334dd37296a06a06666'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Un personnage possédant connaissance des Créatures 2 approfondit son savoir sur une catégorie de créatures déjà choisie au niveau 1. Ce niveau donne accès aux créatures rares et aux entités d'exception associées à la catégorie concernée. Le joueur reçoit de l'organisation une documentation regroupant de nouvelles créatures liées à cette catégorie.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'generale'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'connaissancesdescreatures'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 2 AND md5(e2->>'description') = 'c9022d18e8fd3334dd37296a06a06666');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = '1792efcf68276ab751be2f90efa675a6'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Cette compétence représente le fait que votre personnage connaît bien les maisons nobles des Badlands ainsi que leurs emblèmes. Elle permet d'en savoir plus sur le fonctionnement et les habitudes de ces familles. Vous recevrez de l'animation des informations supplémentaires sur les familles nobles. Cette compétence permet à votre personnage de connaître l'étiquette et les bonnes manières.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'generale'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'connaissancesheraldique'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = '1792efcf68276ab751be2f90efa675a6');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 2 AND md5(e->>'description') = '176e55a9ca3c0237f0996290d2eb9a4f'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Permet d'installer des pièges de niveau 2. Le personnage peut améliorer deux recettes de piège de niveau 1 au niveau 2 gratuitement avec l'achat de cette compétence. Cette compétence permet aussi de saboter un piège de niveau 2.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'voleur'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'creationetdesarmementdepiege'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 2 AND md5(e2->>'description') = '176e55a9ca3c0237f0996290d2eb9a4f');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 3 AND md5(e->>'description') = 'd07c9a85b1921603817f7ac3a6d9d773'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Permet d'installer des pièges de niveau 3. Le personnage peut améliorer une recette de piège de niveau 2 au niveau 3 gratuitement avec l'achat de cette compétence. Cette compétence permet aussi de saboter un piège de niveau 3.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'voleur'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'creationetdesarmementdepiege'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 3 AND md5(e2->>'description') = 'd07c9a85b1921603817f7ac3a6d9d773');
