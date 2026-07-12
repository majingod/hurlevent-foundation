-- [RESYNC-VERBATIM-2] Lot C compétences niveaux — batch 1/4 (s327)
-- Corrections verbatim vs manuel corrigé 2026-06-18. Idempotent (garde md5-avant).
-- Niveaux: alchimie·mage·1, alchimie·mage·2, alchimie·mage·3, benediction·pretre·1, benediction·pretre·3, berserk·guerrier·1, berserk·guerrier·2, berserk·guerrier·3, canalisation·mage·2, canalisation·pretre·2

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = '4fbecb0eba6ef4d397276195811e031e'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Permet la confection des potions mineures. Le personnage reçoit 5 recettes de potion mineures gratuitement avec l'achat de cette compétence. La fabrication d'une potion nécessite que les manipulations soient faites sans interruption ainsi que les composantes nécessaires à la potion fabriquée. Une fois cette compétence achetée, le personnage peut ensuite se procurer de nouvelles recettes alchimiques au coût de 3 points d'expériences chacune. Pour une explication détaillée des processus de fabrication, veuillez vous référer au document "Alchimie'.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'mage'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'alchimie'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = '4fbecb0eba6ef4d397276195811e031e');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 2 AND md5(e->>'description') = '7b2d536cef36805fd82cd7f187d061ec'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Permet la confection des potions intermédiaires. Le personnage reçoit 4 recettes de potion intermédiaire gratuitement avec l'achat de cette compétence. Une fois cette compétence achetée, le personnage peut ensuite se procurer de nouvelles recettes alchimiques au coût de 3 points d'expérience chacune.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'mage'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'alchimie'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 2 AND md5(e2->>'description') = '7b2d536cef36805fd82cd7f187d061ec');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 3 AND md5(e->>'description') = '6b1d45c9a6528c56af45fa0fca6dbe6d'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Permet la confection des potions majeures. Le personnage reçoit 3 recettes de potion majeure gratuitement avec l'achat de cette compétence. Une fois cette compétence achetée, le personnage peut ensuite se procurer de nouvelles recettes alchimiques au coût de 3 points d'expérience chacune.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'mage'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'alchimie'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 3 AND md5(e2->>'description') = '6b1d45c9a6528c56af45fa0fca6dbe6d');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = 'ac59693a65261f7d650d5346b1ca4058'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Cette compétence permet au joueur de bénir l'eau contenue dans une coupe. La bénédiction dure jusqu'à l'utilisation ou jusqu'au changement de cycle. Pour bénir l'eau, le personnage doit prier sa divinité pendant 10 secondes et hors combat. Un personnage ne peut jamais produire plus de 3 bénédictions par cycle, peu importe le niveau de bénédiction utilisé, et coûte un point de spiritualité à chaque fois.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'pretre'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'benediction'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = 'ac59693a65261f7d650d5346b1ca4058');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 3 AND md5(e->>'description') = 'db31133faa392d51160ea032ad217d5a'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Cette compétence permet au joueur de bénir son symbole religieux. La bénédiction dure jusqu'à l'utilisation ou jusqu'au changement de cycle. Pour bénir son symbole religieux personnel, le personnage doit prier sa divinité pendant 10 secondes et hors combat. Vous pouvez bénir votre symbole sacré au coût d'un point de spiritualité. Ceci vous donne une réduction de 1 point de spiritualité sur tous vos sorts lancés des domaines principaux de votre religion pendant 1 heure.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'pretre'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'benediction'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 3 AND md5(e2->>'description') = 'db31133faa392d51160ea032ad217d5a');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = '62016ed8dadb23afbd5f044454b60f6a'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Cette compétence permet au personnage d'entrer dans un état d'esprit instable et barbare lui conférant 2 points de vie temporaires. Durant la rage, le personnage doit attaquer tout ce qui se trouve autour de lui, commençant par la personne la plus proche, sans faire distinction entre ennemis et alliés. De plus, lorsqu'un personnage est en rage, son niveau de résistance aux sorts à effet augmente de 2 sauf contre les effets de calme. Un personnage entrant dans une rage berserk doit l'initier de façon roleplay. Les effets de la rage cessent lorsqu'il tombe inconscient, est calmé magiquement ou lorsqu'il est le dernier debout à la fin du combat. On ne peut pas déclencher deux rages dans le même combat.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'guerrier'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'berserk'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = '62016ed8dadb23afbd5f044454b60f6a');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 2 AND md5(e->>'description') = '94518d974bdc2fa68c837193af2cec5d'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$La rage Berserk confère maintenant 4 points de vie temporaires et le niveau de résistance aux sorts à effet augmente de 3 sauf contre les effets de calme. Le deuxième niveau de la compétence de "Berserk" permet aussi de continuer à combattre lorsque le personnage est à 1 seul point de vie en ignorant les effets de l'Acte héroïque. On ne peut pas déclencher deux rages dans le même combat.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'guerrier'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'berserk'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 2 AND md5(e2->>'description') = '94518d974bdc2fa68c837193af2cec5d');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 3 AND md5(e->>'description') = 'aa418fede43e86c226496afd34776661'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$La rage Berserk confère maintenant 6 points de vie temporaires et le niveau de résistance aux sorts à effet augmente de 4 sauf contre les effets de calme. On ne peut pas déclencher deux rages dans le même combat.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'guerrier'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'berserk'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 3 AND md5(e2->>'description') = 'aa418fede43e86c226496afd34776661');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 2 AND md5(e->>'description') = '50dc8a3681776a256767c06fcb3d0eec'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Cette compétence permet au lanceur de sort de prêter jusqu'à 2 sorts à d'autres personnages. Elle est également nécessaire à la création d'objets magiques de niveau 2 et pour recharger un objet magique en points de spiritualité.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'mage'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'canalisation'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 2 AND md5(e2->>'description') = '50dc8a3681776a256767c06fcb3d0eec');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 2 AND md5(e->>'description') = '966d9732f8ae242aec2311fc6d526f5b'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Cette compétence permet au lanceur de sort de prêter jusqu'à 2 sorts à d'autres personnages. Elle est également nécessaire à la création d'objets magiques de niveau 2 et pour recharger un objet magique en points de spiritualité.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'pretre'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'canalisation'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 2 AND md5(e2->>'description') = '966d9732f8ae242aec2311fc6d526f5b');
