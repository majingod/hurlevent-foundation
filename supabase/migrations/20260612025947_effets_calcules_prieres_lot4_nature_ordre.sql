-- LOT 4 FINAL effets calculés : Nature (17) + Ordre (15) — s170
-- Fixes : type Baies de Guérison, niveau Interrogatoire 6→1, 11 fixes verbatim,
-- palier 20 Sacrifice de soi réécrit autonome (tracé RESYNC), 2 courtes sans Niv.
-- Idempotent : replace() inopérants si déjà appliqués, SET = réécritures.

-- ===== 1. FIXES STRUCTURELS =====
UPDATE prieres SET type_priere='effet bénéfique'
WHERE nom='Baies de Guérison' AND domaine='Nature' AND est_actif;

UPDATE prieres SET niveau=1
WHERE nom='Interrogatoire' AND domaine='Ordre' AND est_actif;

-- ===== 2. FIXES VERBATIM (toutes colonnes porteuses) =====
UPDATE prieres SET
  description = replace(description,'ils sont mangés','il est mangé'),
  description_tronc = replace(description_tronc,'ils sont mangés','il est mangé')
WHERE nom='Baies de Guérison' AND domaine='Nature';

UPDATE prieres SET
  description = replace(replace(description,'7 noix, au niveau 8 : 8 noix et ainsi','7 cocottes, au niveau 8, 8 cocottes, et ainsi'),'(Ex : ce sort','(Ex. Ce sort'),
  bonus_niveau = jsonb_set(bonus_niveau,'{texte}',to_jsonb(replace(replace(bonus_niveau->>'texte','7 noix, au niveau 8 : 8 noix et ainsi','7 cocottes, au niveau 8, 8 cocottes, et ainsi'),'(Ex : ce sort','(Ex. Ce sort')))
WHERE nom='Cocotte Magique' AND domaine='Nature';

UPDATE prieres SET description = replace(description,'Il devra','Elles devront')
WHERE nom='Ennemi de la Nature' AND domaine='Nature';

UPDATE prieres SET
  description = replace(replace(description,'aucunes traces derrières elles','aucune trace derrière elles'),'retrouver ses traces','retrouver leurs traces'),
  description_tronc = replace(replace(description_tronc,'aucunes traces derrières elles','aucune trace derrière elles'),'retrouver ses traces','retrouver leurs traces')
WHERE nom='Passage sans Trace' AND domaine='Nature';

UPDATE prieres SET
  description = replace(description,'pas à lui-même','pas au lanceur lui-même'),
  bonus_niveau = jsonb_set(bonus_niveau,'{texte}',to_jsonb(replace(bonus_niveau->>'texte','pas à lui-même','pas au lanceur lui-même')))
WHERE nom='Marque de la menace' AND domaine='Nature';

UPDATE prieres SET description = replace(description,'la zone sont bloqués','la zone est bloqué')
WHERE nom='Serment de la terre Mère' AND domaine='Nature';

UPDATE prieres SET
  description = replace(description,'Berzerk','Berserk'),
  description_courte = replace(description_courte,'Berzerk','Berserk')
WHERE nom='Calme' AND domaine='Ordre';

UPDATE prieres SET description = replace(description,'se voient incapable de','se voient incapables de')
WHERE nom='Vérité' AND domaine='Ordre';

UPDATE prieres SET description = replace(replace(description,'Leur sens tel la vue','Leurs sens tels la vue'),'mais ils ne peuvent plus parler','mais elles ne peuvent plus parler')
WHERE nom='Paralysie' AND domaine='Ordre';

UPDATE prieres SET
  description = replace(replace(description,'prendre un maux différent','prendre un mal différent'),'conséquence, jusqu','conséquences, jusqu'),
  description_tronc = replace(replace(description_tronc,'prendre un maux différent','prendre un mal différent'),'conséquence, jusqu','conséquences, jusqu')
WHERE nom='Sacrifice de soi' AND domaine='Ordre';

UPDATE prieres SET description = replace(replace(replace(description,'une école ou un domaine choisi','une école ou d''un domaine choisi'),'école magie','école de magie'),'être modifiée par la suite','être modifié par la suite')
WHERE nom='Verrou de la loi' AND domaine='Ordre';

-- ===== 3. PALIER 20 SACRIFICE DE SOI → autonome subsumant (tracé RESYNC) =====
UPDATE prieres SET paliers = jsonb_set(paliers,'{3,texte}', to_jsonb('Le prêtre absorbe tout poison, maladie et malédiction affectant la cible, ainsi que le coup de grâce si le sort est lancé dans les 2 minutes qui le suivent.'::text))
WHERE nom='Sacrifice de soi' AND domaine='Ordre';

-- ===== 4. COURTES SANS « Niv. » =====
UPDATE prieres SET description_courte='Repousse les entités qui ne sont pas de ce monde (niveau ≥ requis) : morts-vivants neutralisés, puis créatures extraplanaires aux niveaux supérieurs.'
WHERE nom='Bannissement' AND domaine='Ordre';

UPDATE prieres SET description_courte='Le prêtre prend sur lui l''affliction d''une cible avec tous ses malus : poison, puis maladie, malédiction et même coup de grâce aux niveaux supérieurs.'
WHERE nom='Sacrifice de soi' AND domaine='Ordre';

-- ===== 5. TEMPLATES NATURE (17) =====
UPDATE prieres SET effet_instance = $j${"template":"Le lanceur se crée une armure organique : **{palier}** Points perdus non récupérables ; sans effet si la cible porte une armure physique.","paliers_mode":"remplace"}$j$::jsonb WHERE nom='Armure de Bois' AND domaine='Nature';

UPDATE prieres SET effet_instance = $j${"template":"Enchante des petits fruits : chacun rend **1 PV** une fois mangé. Sans effet après expiration de la durée."}$j$::jsonb WHERE nom='Baies de Guérison' AND domaine='Nature';

UPDATE prieres SET effet_instance = $j${"template":"Enchante un bâton travaillé d'au moins 4 pieds : tant qu'il est porté, son détenteur résiste aux sorts de **niveau inférieur à {niveau}**. Prend fin au premier sort bloqué."}$j$::jsonb WHERE nom='Bâton de Protection' AND domaine='Nature';

UPDATE prieres SET effet_instance = $j${"template":"Enchante des cocottes de pin : chacune inflige **1 dégât magique** lorsqu'elle est lancée sur une cible."}$j$::jsonb WHERE nom='Cocotte Magique' AND domaine='Nature';

UPDATE prieres SET effet_instance = $j${"template":"Communique avec une entité naturelle annoncée au choix : elle répond par oui, non ou indécis. Le lanceur peut lui poser **{x} question{s:x}**.","vars":{"x":{}}}$j$::jsonb WHERE nom='Communion avec la Nature' AND domaine='Nature';

UPDATE prieres SET effet_instance = $j${"template":"Les cibles sont **immobilisées** par des lianes indestructibles (ni coupées ni brûlées) ; seule la fin du sort ou une dissipation les libère."}$j$::jsonb WHERE nom='Enchevêtrement' AND domaine='Nature';

UPDATE prieres SET effet_instance = $j${"template":"Les cibles ne peuvent pas s'approcher à **moins de 3 pieds des bois** : chemins et constructions seulement."}$j$::jsonb WHERE nom='Ennemi de la Nature' AND domaine='Nature';

UPDATE prieres SET effet_instance = $j${"template":"Ensevelit magiquement un corps mort dans le sol en **1 minute**. N'empêche ni de le déterrer, ni de le piller, ni de le relever."}$j$::jsonb WHERE nom='Enterrement magique' AND domaine='Nature';

UPDATE prieres SET effet_instance = $j${"template":"Une nuée d'insectes harcèle les cibles : **aucune action offensive** possible — seulement se défendre, reculer ou chasser les insectes."}$j$::jsonb WHERE nom='Essaim Vorace' AND domaine='Nature';

UPDATE prieres SET effet_instance = $j${"template":"Les cibles ne laissent aucune trace ; seul un personnage avec Pistage ou Flair affûté de niveau égal ou supérieur au sort peut les suivre. {palier}","paliers_mode":"remplace"}$j$::jsonb WHERE nom='Passage sans Trace' AND domaine='Nature';

UPDATE prieres SET effet_instance = $j${"template":"Le lanceur gagne le trait racial **Flair affûté**. {palier}","paliers_mode":"remplace"}$j$::jsonb WHERE nom='Traque Bestiale' AND domaine='Nature';

UPDATE prieres SET effet_instance = $j${"template":"Une créature **monstrueuse vivante** considère le lanceur comme une autorité : elle obéit selon ses capacités, sans jamais se mettre en danger de mort."}$j$::jsonb WHERE nom='Envoûtement de Créature' AND domaine='Nature';

UPDATE prieres SET effet_instance = $j${"template":"Confère un trait racial des Chimérides au choix (Affinité animale, Charognard, Flair affûté ou Instinct de survie) ; comportement **sauvage et instinctif**, masque ou maquillage animal obligatoire."}$j$::jsonb WHERE nom='Esprit animal' AND domaine='Nature';

UPDATE prieres SET effet_instance = $j${"template":"Crée autour du lanceur une zone que **nul ne peut approcher**, tant l'odeur est répugnante."}$j$::jsonb WHERE nom='Odeur Infecte' AND domaine='Nature';

UPDATE prieres SET effet_instance = $j${"template":"Si la cible tombe à 0 PV (à l'extérieur, corps au sol) : **+1 PV par minute pendant 5 minutes**, et elle reprend conscience après 5 minutes au lieu de 10 (toujours sans souvenirs). Se réactive tant que la durée du sort court."}$j$::jsonb WHERE nom='Sang de la Terre' AND domaine='Nature';

UPDATE prieres SET effet_instance = $j${"template":"Marque une cible comme ennemie de la Nature : tous les Sorts à Effet du domaine de la Nature qui la visent gagnent **{palier}** Le niveau effectif ne peut jamais dépasser 20. Le lanceur applique lui-même le bonus et en avertit ses alliés. Ne peut pas être lancé sur soi-même.","paliers_mode":"remplace"}$j$::jsonb WHERE nom='Marque de la menace' AND domaine='Nature';

UPDATE prieres SET effet_instance = $j${"template":"Cercle de protection lancé au sol : tant que le lanceur reste dans la zone, la nécromancie de **niveau {niveau} ou moins** visant ses alliés est bloquée, et les sorts de zone de la Nature du prêtre épargnent ses alliés. Zone immobile ; effets perdus en entrant dans une construction."}$j$::jsonb WHERE nom='Serment de la terre Mère' AND domaine='Nature';

-- ===== 6. TEMPLATES ORDRE (15) =====
UPDATE prieres SET effet_instance = $j${"template":"Bulle de force invisible : personnages, attaques physiques et sorts ne la traversent pas ; on peut s'y déplacer et parler à travers la membrane. Un personnage ou un sort de **niveau supérieur à {niveau}** la perce et met fin au sort."}$j$::jsonb WHERE nom='Bulle d''emprisonnement' AND domaine='Ordre';

UPDATE prieres SET effet_instance = $j${"template":"Les cibles deviennent **calmes** et perdent toute colère ; stoppe Berserk, Rageur Fou, Antipathie et Avidité. Les ordres d'agressivité d'un contrôle mental cessent d'agir."}$j$::jsonb WHERE nom='Calme' AND domaine='Ordre';

UPDATE prieres SET effet_instance = $j${"template":"Dissipe des cibles tous les effets de **Charme et d'Illusion de niveau {niveau} ou moins** (mots de pouvoir « Guerben » et « Veltel »)."}$j$::jsonb WHERE nom='Délivrance des Envoûtements' AND domaine='Ordre';

UPDATE prieres SET effet_instance = $j${"template":"Les cibles doivent **fixer leur attention sur le lanceur** tant qu'il parle ou se donne en spectacle. S'il s'arrête, l'effet cesse ; une cible blessée ou bousculée est libérée."}$j$::jsonb WHERE nom='Discours captivant' AND domaine='Ordre';

UPDATE prieres SET effet_instance = $j${"template":"Les cibles résistent aux sorts de l'école de Charme avec le **niveau {niveau}** au lieu du leur. N'annule pas les effets déjà actifs."}$j$::jsonb WHERE nom='Esprit Inviolable' AND domaine='Ordre';

UPDATE prieres SET effet_instance = $j${"template":"Les cibles intangibles **redeviennent tangibles** et ne peuvent plus redevenir intangibles pour la durée du sort."}$j$::jsonb WHERE nom='Pieu Spirituel' AND domaine='Ordre';

UPDATE prieres SET effet_instance = $j${"template":"Les cibles ne peuvent plus **mentir volontairement**, mais ne sont pas obligées de parler."}$j$::jsonb WHERE nom='Vérité' AND domaine='Ordre';

UPDATE prieres SET effet_instance = $j${"template":"Neutralise les entités qui ne sont pas de ce monde, de **niveau {niveau} ou moins**.{paliers}","paliers_mode":"cumule"}$j$::jsonb WHERE nom='Bannissement' AND domaine='Ordre';

UPDATE prieres SET effet_instance = $j${"template":"Dissipe des cibles tous les effets de **malédiction de niveau {niveau} ou moins**."}$j$::jsonb WHERE nom='Délivrance des Malédictions' AND domaine='Ordre';

UPDATE prieres SET effet_instance = $j${"template":"Les cibles **ne peuvent pas mentir** et doivent répondre aux questions posées. **{palier}**","paliers_mode":"remplace"}$j$::jsonb WHERE nom='Interrogatoire' AND domaine='Ordre';

UPDATE prieres SET effet_instance = $j${"template":"Marque la cible du sceau de la Justice céleste : **toute attaque lui est interdite**, même pour se défendre, sauf contre les monstres non humanoïdes."}$j$::jsonb WHERE nom='Justice céleste' AND domaine='Ordre';

UPDATE prieres SET effet_instance = $j${"template":"Les cibles sont **paralysées** : immobiles et muettes, vue et ouïe intactes. L'effet se dissipe si la cible subit des dégâts."}$j$::jsonb WHERE nom='Paralysie' AND domaine='Ordre';

UPDATE prieres SET effet_instance = $j${"template":"Le prêtre prend sur lui le mal d'une cible, avec tous ses malus et jusqu'à la mort s'il le faut : **{palier}**","paliers_mode":"remplace"}$j$::jsonb WHERE nom='Sacrifice de soi' AND domaine='Ordre';

UPDATE prieres SET effet_instance = $j${"template":"La cible **suit à la lettre** les instructions du lanceur, sauf celles pouvant causer ses blessures ou sa mort imminente."}$j$::jsonb WHERE nom='Injonction' AND domaine='Ordre';

UPDATE prieres SET effet_instance = $j${"template":"Empêche la cible de lancer les sorts d'**une école ou d'un domaine choisi** au lancement (non modifiable ensuite). N'annule pas les effets déjà actifs."}$j$::jsonb WHERE nom='Verrou de la loi' AND domaine='Ordre';
