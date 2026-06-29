-- Lots 4+5 MAGE + PRÊTRE : resume_condense + description_courte par niveau.
-- UPDATE ciblés par categorie ('mage' / 'pretre') -> aucun croisement sur les 4 homonymes.

-- A. resume MAGE (12)
UPDATE competences c SET resume_condense = v.r
FROM (VALUES
 ('Acquisition de Cercle', $r$Donne accès aux sorts d'un cercle de magie au choix, les paliers de niveaux disponibles s'élargissant à chaque achat (achetable plusieurs fois).$r$),
 ('Acquisition de Sort', $r$Permet d'acquérir un sort en ajustant ses paramètres (école, cibles, portée, durée, niveau), pour un coût variable plafonné.$r$),
 ('Alchimie', $r$Permet de confectionner des potions et d'acheter des recettes, la puissance réalisable augmentant à chaque niveau (recettes offertes à l'achat).$r$),
 ('Assemblage de Runes', $r$Permet d'assembler des runes (tracées à l'encre d'activation) pour produire des effets utilitaires et de protection, la maîtrise s'étendant à chaque niveau.$r$),
 ('Bâton de Sorcier', $r$Permet de lancer un sort « au toucher » via un bâton ou une baguette, sans main libre, en conservant le sort une minute.$r$),
 ('Canalisation', $r$Permet de prêter ses sorts à d'autres personnages et de créer des objets magiques, le nombre de sorts prêtés et le niveau d'objets croissant avec le niveau.$r$),
 ('Décryptage', $r$Permet de connaître une langue ancienne au choix (achetable plusieurs fois), avec son alphabet remis au joueur.$r$),
 ('Développement Spirituel', $r$Augmente le total de points de spiritualité de 1 par achat, jusqu'à un maximum de 20 (achetable plusieurs fois).$r$),
 ('Développement Spirituel Supérieur', $r$Augmente le total de points de spiritualité de 1 par achat, jusqu'à un maximum de 30 (achetable plusieurs fois).$r$),
 ('Identification d''objet', $r$Permet d'identifier le fonctionnement des objets magiques après inspection, le niveau accessible augmentant à chaque palier.$r$),
 ('Identification des Potions', $r$Permet d'identifier les herbes et formules d'un produit alchimique, la complexité analysable augmentant à chaque niveau.$r$),
 ('Piège Magique', $r$Permet d'emprisonner un sort de mage dans un piège placé dans un contenant, le niveau de sort piégeable dépendant de la Canalisation.$r$)
) AS v(nom,r) WHERE c.categorie='mage' AND c.nom=v.nom;

-- B. resume PRÊTRE (16)
UPDATE competences c SET resume_condense = v.r
FROM (VALUES
 ('Acquisition de Domaine', $r$Donne accès aux prières d'un domaine au choix, les paliers de niveaux disponibles s'élargissant à chaque achat (achetable plusieurs fois).$r$),
 ('Acquisition de Prière', $r$Permet d'acquérir une prière en ajustant ses paramètres (domaine, cibles, portée, durée, niveau), pour un coût variable plafonné.$r$),
 ('Assemblage de Runes', $r$Permet d'assembler des runes (tracées à l'encre d'activation) pour produire des effets utilitaires et de protection, la maîtrise s'étendant à chaque niveau.$r$),
 ('Bénédiction', $r$Permet de bénir, par une courte prière hors combat, l'eau d'une coupe, puis une arme, puis son symbole religieux (max 3 par cycle).$r$),
 ('Canalisation', $r$Permet de prêter ses sorts à d'autres personnages et de créer des objets magiques, le nombre de sorts prêtés et le niveau d'objets croissant avec le niveau.$r$),
 ('Chirurgien', $r$Permet de pratiquer des chirurgies complexes (rattacher un membre, greffer, extraire un corps étranger) hors combat, avec outils et temps appropriés.$r$),
 ('Consécration', $r$Permet de sanctifier les corps et d'exorciser les entités, l'effet s'étendant du corps individuel à la préservation des défunts puis à une zone entière.$r$),
 ('Développement Spirituel', $r$Augmente le total de points de spiritualité de 1 par achat, jusqu'à un maximum de 20 (achetable plusieurs fois).$r$),
 ('Développement Spirituel Supérieur', $r$Augmente le total de points de spiritualité de 1 par achat, jusqu'à un maximum de 30 (achetable plusieurs fois).$r$),
 ('Diagnostic', $r$Permet d'inspecter un personnage pour révéler blessures, maladies et effets, l'analyse s'étendant aux poisons puis au diagnostic à distance et à la cause de la mort.$r$),
 ('Formation Théologique', $r$Donne accès à un résumé approfondi du mythe de la création ou aux secrets de sa religion, obtenu auprès de l'animation.$r$),
 ('Grande Messe', $r$Permet de présider une grande messe rendant spiritualité et points de vie aux fidèles présents, participants requis et gains augmentant avec le niveau.$r$),
 ('Imposition des Mains', $r$Permet de guérir au toucher, en 5 secondes, des points de vie puisés dans une réserve égale au niveau du prêtre (réveille les inconscients).$r$),
 ('Premiers Soins', $r$Permet de soigner les blessures (une fois par combat par personne), les PV rendus augmentant et débloquant le retard puis la guérison des poisons et maladies.$r$),
 ('Réveil Expéditif', $r$Permet, en utilisant Premiers Soins, de réveiller un personnage inconscient au lieu de seulement le soigner.$r$),
 ('Rêves', $r$Permet d'obtenir d'un maître de jeu, par un rêve, une réponse indirecte mais jamais mensongère à une question posée sous forme de prière.$r$)
) AS v(nom,r) WHERE c.categorie='pretre' AND c.nom=v.nom;

-- C. aperçus niveau MAGE (6 multi)
WITH abreges(nom,niveau_num,abrege) AS (VALUES
 ('Acquisition de Cercle',1,$a$Accès aux sorts de niveaux 1 à 5 d'un cercle au choix (permet de lancer des sorts de mage).$a$),
 ('Acquisition de Cercle',2,$a$Accès aux sorts de niveaux 6 à 10 d'un cercle déjà pratiqué (rabais selon sorts possédés).$a$),
 ('Acquisition de Cercle',3,$a$Accès aux sorts de niveaux 11 à 20 d'un cercle déjà pratiqué (rabais selon sorts possédés).$a$),
 ('Alchimie',1,$a$Confectionner les potions mineures (5 recettes offertes).$a$),
 ('Alchimie',2,$a$Confectionner les potions intermédiaires (4 recettes offertes).$a$),
 ('Alchimie',3,$a$Confectionner les potions majeures (3 recettes offertes).$a$),
 ('Assemblage de Runes',1,$a$Tracer des assemblages pour soi-même (2 assemblages offerts).$a$),
 ('Assemblage de Runes',2,$a$Utiliser ses assemblages sur d'autres joueurs et les tracer sur des objets (2 de plus).$a$),
 ('Assemblage de Runes',3,$a$Exploiter le plein potentiel des assemblages et découvrir des assemblages oubliés.$a$),
 ('Canalisation',1,$a$Prêter 1 sort par cycle ; crée les objets magiques de niveau 1 et parchemins.$a$),
 ('Canalisation',2,$a$Prêter jusqu'à 2 sorts ; crée les objets de niveau 2 et recharge les objets magiques.$a$),
 ('Canalisation',3,$a$Prêter jusqu'à 3 sorts ; crée les objets de niveau 3 et un artefact (niveau 4).$a$),
 ('Identification d''objet',1,$a$Identifier les objets magiques de niveau 1 (30 min d'inspection).$a$),
 ('Identification d''objet',2,$a$Identifier les objets de niveau 2.$a$),
 ('Identification d''objet',3,$a$Identifier les objets de niveaux 3 et 4.$a$),
 ('Identification des Potions',1,$a$Identifier les herbes d'un produit mineur (30 min, produit détruit).$a$),
 ('Identification des Potions',2,$a$Identifier un produit intermédiaire et repérer les ingrédients non végétaux.$a$),
 ('Identification des Potions',3,$a$Identifier un produit majeur et connaître les formules des potions identifiées.$a$)
)
UPDATE competences c SET niveaux = sub.nouveaux
FROM (
  SELECT c2.id, jsonb_agg(CASE WHEN a.abrege IS NOT NULL THEN elem || jsonb_build_object('description_courte',a.abrege) ELSE elem END ORDER BY ord) AS nouveaux
  FROM competences c2
  CROSS JOIN LATERAL jsonb_array_elements(c2.niveaux) WITH ORDINALITY AS t(elem,ord)
  LEFT JOIN abreges a ON a.nom=c2.nom AND a.niveau_num=(elem->>'niveau')::int
  WHERE c2.categorie='mage' GROUP BY c2.id
) sub WHERE c.id=sub.id;

-- D. aperçus niveau PRÊTRE (8 multi)
WITH abreges(nom,niveau_num,abrege) AS (VALUES
 ('Acquisition de Domaine',1,$a$Accès aux prières de niveaux 1 à 5 d'un domaine au choix (permet de lancer des prières).$a$),
 ('Acquisition de Domaine',2,$a$Accès aux prières de niveaux 6 à 10 d'un domaine déjà pratiqué (rabais selon prières possédées).$a$),
 ('Acquisition de Domaine',3,$a$Accès aux prières de niveaux 11 à 20 d'un domaine déjà pratiqué (rabais selon prières possédées).$a$),
 ('Assemblage de Runes',1,$a$Tracer des assemblages pour soi-même (2 assemblages offerts).$a$),
 ('Assemblage de Runes',2,$a$Utiliser ses assemblages sur d'autres joueurs et les tracer sur des objets (2 de plus).$a$),
 ('Assemblage de Runes',3,$a$Exploiter le plein potentiel des assemblages et découvrir des assemblages oubliés.$a$),
 ('Bénédiction',1,$a$Bénir l'eau d'une coupe (jusqu'à utilisation ou fin de cycle, 1 PS).$a$),
 ('Bénédiction',2,$a$Bénir une arme (pour un combat ou jusqu'à la fin du cycle).$a$),
 ('Bénédiction',3,$a$Bénir son symbole religieux : -1 PS sur les sorts des domaines principaux pendant 1 h.$a$),
 ('Canalisation',1,$a$Prêter 1 sort par cycle ; crée les objets magiques de niveau 1 et parchemins.$a$),
 ('Canalisation',2,$a$Prêter jusqu'à 2 sorts ; crée les objets de niveau 2 et recharge les objets magiques.$a$),
 ('Canalisation',3,$a$Prêter jusqu'à 3 sorts ; crée les objets de niveau 3 et un artefact (niveau 4).$a$),
 ('Consécration',1,$a$Exorciser une entité ou sanctifier un corps (ni relevé en mort-vivant ni possédé).$a$),
 ('Consécration',2,$a$Préserver un corps mort depuis moins d'une heure pour permettre sa résurrection.$a$),
 ('Consécration',3,$a$Sanctifier une zone de 10 pieds pendant 1 h et détruire définitivement une entité exorcisée.$a$),
 ('Diagnostic',1,$a$Révèle blessures, maladie, effets non magiques et état réel (mort, coma, simulation).$a$),
 ('Diagnostic',2,$a$Révèle aussi les poisons affectant la cible et la cause d'un décès ou coma.$a$),
 ('Diagnostic',3,$a$Diagnostic complet à 6 pieds, plus l'arme du crime et la taille de l'assassin.$a$),
 ('Grande Messe',1,$a$Min. 3 fidèles (hors prêtre) : chacun regagne 3 PS et 1 PV.$a$),
 ('Grande Messe',2,$a$Min. 5 fidèles (prêtre inclus) : chacun regagne 5 PS et 2 PV.$a$),
 ('Grande Messe',3,$a$Min. 10 fidèles (prêtre inclus) : chacun regagne 15 PS et tous ses PV.$a$),
 ('Premiers Soins',1,$a$Soigner 1 PV en 1 minute (2 PV avec une dose de Nagro) ; ne réveille pas.$a$),
 ('Premiers Soins',2,$a$Soigner 2 PV et retarder de 30 min un poison ou une maladie mineure.$a$),
 ('Premiers Soins',3,$a$Soigner 3 PV, retarder un poison/maladie intermédiaire et guérir complètement les mineures.$a$)
)
UPDATE competences c SET niveaux = sub.nouveaux
FROM (
  SELECT c2.id, jsonb_agg(CASE WHEN a.abrege IS NOT NULL THEN elem || jsonb_build_object('description_courte',a.abrege) ELSE elem END ORDER BY ord) AS nouveaux
  FROM competences c2
  CROSS JOIN LATERAL jsonb_array_elements(c2.niveaux) WITH ORDINALITY AS t(elem,ord)
  LEFT JOIN abreges a ON a.nom=c2.nom AND a.niveau_num=(elem->>'niveau')::int
  WHERE c2.categorie='pretre' GROUP BY c2.id
) sub WHERE c.id=sub.id;
