-- Étage NIVEAU (description_courte) pour les 8 compétences multi-niveaux générales + 2 resume_condense resserrés en vue d'ensemble.
-- Idempotent : `||` remplace toute valeur description_courte existante (réécrit le legacy Créatures/Dépeçage).

WITH abreges(nom, niveau_num, abrege) AS (VALUES
 ('Connaissances Criminelles', 1, $a$Connaître les grands groupes criminels de la région et leurs spécialités.$a$),
 ('Connaissances Criminelles', 2, $a$Obtenir un contact dans une famille criminelle, ouvrant certaines sphères (sans place acquise).$a$),
 ('Connaissances Criminelles', 3, $a$Rejoindre une organisation criminelle à part entière, avantages et risques compris.$a$),
 ('Connaissances des Créatures', 1, $a$Choisir une catégorie de créatures (parmi 12) et identifier ses créatures communes ; achetable plusieurs fois.$a$),
 ('Connaissances des Créatures', 2, $a$Approfondir une catégorie déjà connue : créatures rares et entités d'exception.$a$),
 ('Dépeçage', 1, $a$Récolter des ressources sur les créatures dont on possède Connaissances des Créatures 1.$a$),
 ('Dépeçage', 2, $a$Récolter des ressources sur les créatures dont on possède Connaissances des Créatures 2.$a$),
 ('Estimation', 1, $a$Estimer la valeur des objets communs (métaux, plantes, produits de base).$a$),
 ('Estimation', 2, $a$Estimer la valeur des objets de valeur et des trésors intermédiaires.$a$),
 ('Estimation', 3, $a$Estimer la valeur des objets rares, magiques et légendaires.$a$),
 ('Herbalisme', 1, $a$Récolter 3 cartes d'herbes communes au début de chaque événement.$a$),
 ('Herbalisme', 2, $a$Récolter 4 cartes et accéder aux expéditions d'herbes rares.$a$),
 ('Herbalisme', 3, $a$Récolter 5 cartes ; peut renoncer à sa récolte pour prospecter des mines.$a$),
 ('Hypnose', 1, $a$Hypnotiser une cible volontaire pour qu'elle réponde avec sincérité (2 min de travail).$a$),
 ('Hypnose', 2, $a$Faire resurgir des souvenirs oubliés via un pattern précis répété 2 minutes.$a$),
 ('Hypnose', 3, $a$Hypnotiser une cible non consentante et contrôler si elle se souvient de la séance.$a$),
 ('Méditation', 1, $a$Récupérer 3 PS ou 2 PV par tranche de 15 min de calme.$a$),
 ('Méditation', 2, $a$Récupérer 5 PS ou 3 PV par tranche de 15 min.$a$),
 ('Méditation', 3, $a$Récupérer 10 PS ou 5 PV par tranche de 15 min.$a$),
 ('Mineur', 1, $a$Récolter 2 cartes de métaux communs au début de chaque événement.$a$),
 ('Mineur', 2, $a$Récolter 3 cartes et accéder aux expéditions de métaux rares.$a$),
 ('Mineur', 3, $a$Récolter 4 cartes ; peut renoncer à sa récolte pour prospecter des mines.$a$)
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
  WHERE c2.categorie = 'generale'
    AND c2.nom IN ('Connaissances Criminelles','Connaissances des Créatures','Dépeçage','Estimation','Herbalisme','Hypnose','Méditation','Mineur')
  GROUP BY c2.id
) sub
WHERE c.id = sub.id;

UPDATE competences SET resume_condense = $b$Connaissance et infiltration progressive du milieu criminel régional, du simple savoir à l'appartenance à une organisation.$b$
WHERE categorie='generale' AND nom='Connaissances Criminelles';
UPDATE competences SET resume_condense = $b$Permet d'hypnotiser une cible pour en tirer la vérité, la maîtrise croissant du volontaire au récalcitrant.$b$
WHERE categorie='generale' AND nom='Hypnose';
