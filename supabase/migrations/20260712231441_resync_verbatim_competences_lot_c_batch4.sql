-- [RESYNC-VERBATIM-2] Lot C compétences niveaux — batch 4/4 (s327)
-- Corrections verbatim vs manuel corrigé 2026-06-18. Idempotent (garde md5-avant).
-- Niveaux: hypnose·generale·2, hypnose·generale·3, identificationdespotions·mage·3, impositiondesmains·pretre·1, pistage·voleur·1, premierssoins·pretre·1, resolutionguerriere·guerrier·1

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 2 AND md5(e->>'description') = '085007599b684691b25fbcb81949f6ab'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$La compétence permet de faire resurgir des souvenirs oubliés et les circonstances de son coma, sauf si la personne a perdu ou modifié ses souvenirs par un sort. L'hypnotiseur doit répéter un pattern bien spécifique pendant deux minutes pour affecter sa cible. Exemple : Frapper sur la table avec sa jointure au rythme 1-2-1 et à toutes les 10 secondes dire 'patate'. Le sujet doit appliquer l'effet du sort, même si le sort l'oblige à mentir.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'generale'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'hypnose'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 2 AND md5(e2->>'description') = '085007599b684691b25fbcb81949f6ab');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 3 AND md5(e->>'description') = '621cb797770bfddca04e4257c4f5552d'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$La cible de l'hypnose n'est maintenant pas obligée d'être volontaire. L'hypnotiseur peut maintenant choisir si sa victime se souvient de la séance ou non et savoir si la personne a été affectée par un sort lié à son comportement ou ses souvenirs sans savoir l'effet.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'generale'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'hypnose'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 3 AND md5(e2->>'description') = '621cb797770bfddca04e4257c4f5552d');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 3 AND md5(e->>'description') = 'f5d474a24576ba78365cab62e3340249'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Le personnage peut maintenant identifier un produit alchimique majeur et connaître les formules des potions identifiées.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'mage'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'identificationdespotions'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 3 AND md5(e2->>'description') = 'f5d474a24576ba78365cab62e3340249');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = 'd7c2864999d2214b2a848f2f59669b4b'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Le personnage peut, au toucher, réciter une prière d'une durée de 5 secondes pour guérir un personnage du nombre de points de vie désiré provenant de la réserve du prêtre. La réserve de points de guérison du prêtre est égale à son niveau de personnage. Un personnage inconscient guéri à l'aide d'imposition des mains sort de son coma. Cette réserve se régénère uniquement entre chaque événement.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'pretre'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'impositiondesmains'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = 'd7c2864999d2214b2a848f2f59669b4b');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = 'd93c2cc0514d40e40caa3816ce75134e'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Le personnage possédant cette compétence sait reconnaître et suivre les traces laissées au sol. Cette compétence permet de connaître plusieurs informations telles ; la race ayant laissé les traces, le nombre d'individus, la vitesse à laquelle les traqués allaient, leur poids et même l'endroit où ils se dirigeaient. Les traces doivent dater de 4 heures ou moins. Si vous êtes un Chiméride, cela vous donne deux heures de plus à cause de votre odorat et vous pouvez pister la nuit. Cette compétence est principalement utilisée pour retrouver des Personnages Non-Joueur (PNJ). Si la cible est en jeu, un maître de jeu le guidera dans la poursuite. Notez que si vous cherchez un joueur, il est fort possible que le maître de jeu ne sache pas où il se trouve.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'voleur'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'pistage'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = 'd93c2cc0514d40e40caa3816ce75134e');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = 'f747865cd86381d0b17de0666096a9bb'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Cette compétence permet au personnage de panser et traiter les blessures et les plaies. Pour ce faire, le personnage doit travailler pendant 1 minute sur la plaie à guérir. Cette compétence guérit 1 point de vie et ne peut être utilisée qu'une fois par personnage par combat. Elle ne peut guérir que les points de vie et non les points d'armure. Cette compétence ne réveille pas le personnage de l'inconscience. Un personnage possédant la compétence "Connaissances des Herbes Communes" peut guérir une blessure de 2 points de vie en dépensant 1 dose de Nagro, une plante trouvable en jeu. Le joueur doit apporter ses propres bandages qu'il utilisera pour soigner les personnages.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'pretre'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'premierssoins'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = 'f747865cd86381d0b17de0666096a9bb');

UPDATE competences SET niveaux = (
  SELECT jsonb_agg(CASE WHEN (e->>'niveau')::int = 1 AND md5(e->>'description') = 'b75a22f47b3e6a0dff0a47d42d941209'
    THEN jsonb_set(e, '{description}', to_jsonb($hv$Le personnage n'est plus soumis à l'effet de l'acte héroïque et peut donc continuer d'agir normalement lorsqu'il se trouve à 1 seul point de vie. Autrement, un personnage à 1 point de vie tombe comateux après avoir attaqué ou lancé un sort.$hv$::text)) ELSE e END ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS u(e, ord))
WHERE categorie = 'guerrier'
  AND regexp_replace(translate(replace(replace(lower(nom),'œ','oe'),'æ','ae'),'àâäáéèêëíîïóôöúùûüçñ','aaaaeeeeiiiooouuuucn'),'[^a-z0-9]','','g') = 'resolutionguerriere'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(niveaux) e2
              WHERE (e2->>'niveau')::int = 1 AND md5(e2->>'description') = 'b75a22f47b3e6a0dff0a47d42d941209');
