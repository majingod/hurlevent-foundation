-- Lot 3 VOLEUR : 15 resume_condense + 21 description_courte par niveau (7 multi).
UPDATE competences c
SET resume_condense = v.r
FROM (VALUES
 ('Assommer', $r$Permet d'assommer une cible surprise hors combat pour 10 minutes, l'arme requise se réduisant à chaque niveau jusqu'à la main nue.$r$),
 ('Attaque sournoise', $r$Permet d'abattre une cible surprise hors combat (0 PV), la méthode évoluant de l'égorgement au brise-cou puis à l'assassinat dans le dos.$r$),
 ('Cachette secrète', $r$Permet de dissimuler sur soi un objet de la taille d'un poing, insaisissable car protégé hors-jeu par un ruban rouge.$r$),
 ('Compétence d''arme à distance', $r$Avec un arc, une arbalète ou une arme de jet, débloque des tirs spéciaux : coupe-jarret, coup vicieux, puis saignement.$r$),
 ('Création et désarmement de piège', $r$Permet d'installer et de saboter des pièges, le niveau accessible augmentant à chaque palier (recettes offertes à l'achat).$r$),
 ('Crochetage de serrure', $r$Permet d'ouvrir des serrures sans clé en 2 minutes, le niveau de difficulté accessible augmentant à chaque palier.$r$),
 ('Empoisonnement de projectile', $r$Permet d'appliquer ses poisons sur les projectiles (flèches, carreaux, armes de jet), sans devoir toucher une zone non protégée.$r$),
 ('Expertise en toxicologie', $r$Permet d'appliquer les poisons mineurs et intermédiaires sur une arme tranchante et de transformer les poisons mineurs en poudre volatile.$r$),
 ('Falsification', $r$Permet de falsifier des documents en main, à raison de 15 minutes par page, avec les informations nécessaires à leur crédibilité.$r$),
 ('Fouille rapide', $r$Réduit le temps de fouille d'une cible sans défense (15 secondes pour la fouille courte, 1 minute pour la longue).$r$),
 ('Joaillerie', $r$Permet de tailler et d'incruster des gemmes dans des bijoux, la rareté des gemmes et métaux travaillés augmentant avec le niveau.$r$),
 ('Piège sécurisé', $r$Permet d'ajouter à ses pièges un accès sécurisé qu'un tiers peut désactiver et réactiver instantanément avec la méthode secrète.$r$),
 ('Pistage', $r$Permet de reconnaître et suivre des traces de moins de 4 heures pour en déduire race, nombre, vitesse et direction des individus.$r$),
 ('Rumeur', $r$Permet de lancer, via un animateur, une rumeur qui se répandra sur le territoire de son choix.$r$),
 ('Torture', $r$Permet de torturer une victime pour lui soutirer la vérité, le nombre de questions forcées augmentant avec le niveau.$r$)
) AS v(nom, r)
WHERE c.categorie='voleur' AND c.nom = v.nom;

WITH abreges(nom, niveau_num, abrege) AS (VALUES
 ('Assommer',1,$a$Assommer avec une arme longue contondante (toucher l'épaule, cible surprise hors combat).$a$),
 ('Assommer',2,$a$Assommer avec une arme courte contondante.$a$),
 ('Assommer',3,$a$Assommer à main nue.$a$),
 ('Attaque sournoise',1,$a$Égorger une cible surprise avec une arme courte à lame (« Égorgement »).$a$),
 ('Attaque sournoise',2,$a$Briser le cou à mains nues (« Brise-cou »).$a$),
 ('Attaque sournoise',3,$a$Assassiner dans le dos avec une lame courte, même en combat (« Backstab »).$a$),
 ('Compétence d''arme à distance',1,$a$« Coupe-jarret » force la cible à poser un genou 5 secondes (1 fois par cycle).$a$),
 ('Compétence d''arme à distance',2,$a$« Coup vicieux » annule la prochaine guérison de la cible (2 fois par cycle).$a$),
 ('Compétence d''arme à distance',3,$a$« Saignement » inflige 1 dégât par minute jusqu'à soin (2 fois par cycle).$a$),
 ('Création et désarmement de piège',1,$a$Installer et saboter les pièges de niveau 1 (3 recettes offertes).$a$),
 ('Création et désarmement de piège',2,$a$Installer et saboter les pièges de niveau 2 (2 recettes améliorées).$a$),
 ('Création et désarmement de piège',3,$a$Installer et saboter les pièges de niveau 3 (1 recette améliorée).$a$),
 ('Crochetage de serrure',1,$a$Ouvrir les serrures « Faciles » (2 min de travail).$a$),
 ('Crochetage de serrure',2,$a$Ouvrir les serrures « Moyennes » (2 min de travail).$a$),
 ('Crochetage de serrure',3,$a$Ouvrir les serrures « Difficiles » (2 min de travail).$a$),
 ('Joaillerie',1,$a$Tailler et incruster les gemmes communes dans un métal commun (enchantables).$a$),
 ('Joaillerie',2,$a$Tailler les gemmes rares dans un métal rare (utilisables en rituel).$a$),
 ('Joaillerie',3,$a$Incruster des gemmes sur métal légendaire (enchantées pour objets magiques).$a$),
 ('Torture',1,$a$Après 10 min, la victime tombe à 1 PV et répond à une question avec sincérité.$a$),
 ('Torture',2,$a$La victime doit répondre à deux questions.$a$),
 ('Torture',3,$a$La victime doit répondre à trois questions.$a$)
)
UPDATE competences c
SET niveaux = sub.nouveaux
FROM (
  SELECT c2.id,
    jsonb_agg(
      CASE WHEN a.abrege IS NOT NULL
        THEN elem || jsonb_build_object('description_courte', a.abrege)
        ELSE elem END
      ORDER BY ord
    ) AS nouveaux
  FROM competences c2
  CROSS JOIN LATERAL jsonb_array_elements(c2.niveaux) WITH ORDINALITY AS t(elem, ord)
  LEFT JOIN abreges a ON a.nom = c2.nom AND a.niveau_num = (elem->>'niveau')::int
  WHERE c2.categorie='voleur'
  GROUP BY c2.id
) sub
WHERE c.id = sub.id;
