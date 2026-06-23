-- Schéma de fiche "race" (moteur schema-driven) + 11 abrégés (resume_condense).
-- Idempotent : ON CONFLICT pour le schéma ; UPDATE par nom pour les abrégés.
-- traits_permis : source col:traits_permis (injectée côté front depuis la relation race_traits, noms distincts).
-- restrictions_classes : volontairement ABSENT (NULL pour les 11 races, règle #30).

INSERT INTO fiches_schemas (categorie, champs, mis_a_jour)
VALUES ('race', $champs$[
  {"cle":"lore","type":"texte","label":"Description","c":{"source":"col:resume_condense"},"v":{"source":"col:description"}},
  {"cle":"xp_depart","type":"mecanique","icone":"✨","label":"XP de départ","source":"col:xp_depart"},
  {"cle":"esperance_vie","type":"mecanique","icone":"🕰️","label":"Espérance de vie","source":"col:esperance_vie"},
  {"cle":"nb_traits_raciaux","type":"mecanique","icone":"🎁","label":"Trait racial offert","source":"col:nb_traits_raciaux"},
  {"cle":"traits_permis","type":"mecanique","label":"Traits raciaux permis","render":"liste_traits","source":"col:traits_permis"},
  {"cle":"exigences_costume","type":"texte","titre":"Exigences de costume","c":{"source":"col:exigences_costume"},"v":{"source":"col:exigences_costume"}}
]$champs$::jsonb, now())
ON CONFLICT (categorie) DO UPDATE SET champs = EXCLUDED.champs, mis_a_jour = now();

UPDATE races SET resume_condense = $a$Venus de Mérée par-delà les mers, ils compensent leur courte vie par le nombre, l’ambition et l’art de repousser toutes les limites — quitte à se faire la guerre entre eux.$a$ WHERE nom = 'Humain';

UPDATE races SET resume_condense = $a$Nés d’unions humaines et elfiques jadis maudites, au trait dominant et à longue vie, devenus de précieux érudits et gardiens du savoir, partout acceptés sauf chez les haut-elfes.$a$ WHERE nom = 'Demi-Elfe';

UPDATE races SET resume_condense = $a$Longtemps méprisés comme bâtards de guerre, ils s’imposent par la force brute au combat, ou par la magie héritée du sang humain, vénérée chez les orcs.$a$ WHERE nom = 'Demi-Orc';

UPDATE races SET resume_condense = $a$Elfes exilés dans l’Ombre-Terre qui ont renié leur passé (« elfe noir » = insulte mortelle) ; société matriarcale de dagues et de poison, de retour après deux siècles.$a$ WHERE nom = 'Drow';

UPDATE races SET resume_condense = $a$Anciens esclaves des orcs, nés de la survie sur les terres brûlées de Rakhas ; alchimistes inventifs qui aiment le pratique, l’ingénieux et l’éclatant.$a$ WHERE nom = 'Gobelin';

UPDATE races SET resume_condense = $a$Elfes reclus et hautains de royaumes cachés, d’une beauté ensorcelante mais d’une froideur impitoyable, qui se vengent sans pitié des intrus.$a$ WHERE nom = 'Haut-Elfe';

UPDATE races SET resume_condense = $a$Nains et Géants d’un même peuple, celui du Mythril : maîtres de la forge et des runes, qui honorent leurs ancêtres dans le métal.$a$ WHERE nom = 'Myrvalk';

UPDATE races SET resume_condense = $a$Peuple fier et belliqueux des steppes arides, incapable de magie mais inébranlable au combat, qui respecte la force et l’honneur et lave les insultes dans le sang.$a$ WHERE nom = 'Orc';

UPDATE races SET resume_condense = $a$Peuple éclectique mi-humain mi-animal né de l’unité des survivants ; longtemps au bord de l’extinction, aux mœurs très variables selon la lignée animale.$a$ WHERE nom = 'Chiméride';

UPDATE races SET resume_condense = $a$Êtres féeriques séduisants et imprévisibles, maîtres des mots qu’ils prennent au pied de la lettre et dont les dons cachent toujours un prix.$a$ WHERE nom = 'Fée';

UPDATE races SET resume_condense = $a$Catégorie ouverte pour incarner d’autres créatures surnaturelles de Destéa, sur concept approuvé par l’animation.$a$ WHERE nom = 'Les Non-Races';
