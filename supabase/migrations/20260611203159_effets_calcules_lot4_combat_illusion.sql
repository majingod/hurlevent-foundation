-- EFFETS-CALCULES lot 4 : Combat (10) + Illusion (11) = 21 sorts
-- + 6 fixes verbatim (Manuel corrigé = canon) + 5 description_courte nettoyées
-- Idempotent : UPDATE par nom+cercle, valeurs figées.

-- ============ COMBAT (10) ============

UPDATE sorts SET effet_instance = $j${"template":"Armure énergétique non récupérable, cumulable avec une armure physique. **{palier}**","paliers_mode":"remplace"}$j$::jsonb
WHERE nom = 'Armure' AND cercle = 'Combat';

UPDATE sorts SET effet_instance = $j${"template":"Permet de **combattre normalement même aveuglé** : le lanceur garde les yeux ouverts."}$j$::jsonb
WHERE nom = 'Combat Aveugle' AND cercle = 'Combat';

UPDATE sorts SET
  effet_instance = $j${"template":"Supprime la douleur ; dégâts et états s'appliquent normalement.{paliers}","paliers_mode":"cumule"}$j$::jsonb,
  description_courte = $f$Supprime la douleur (les dégâts s'appliquent quand même) ; protège contre Torture puis contre les sorts de douleur selon le niveau.$f$
WHERE nom = 'Insensibilité à la douleur' AND cercle = 'Combat';

UPDATE sorts SET effet_instance = $j${"template":"**Effet de peur** : les cibles ne peuvent plus attaquer ni cibler le lanceur et doivent fuir hors de sa vue ; elles peuvent encore se défendre."}$j$::jsonb
WHERE nom = 'Présence intimidante' AND cercle = 'Combat';

UPDATE sorts SET effet_instance = $j${"template":"La cible doit **tenter de blesser le lanceur** par tout moyen ; l'effet cesse dès qu'elle a fait couler son sang."}$j$::jsonb
WHERE nom = 'Provocation' AND cercle = 'Combat';

-- Sens aiguisé : cumule + fix verbatim tronc & palier 20 (Manuel = canon : cibles, pas lanceur)
UPDATE sorts SET
  effet_instance = $j${"template":"Immunise contre les attaques par surprise (annoncer « Annule ») et réduit de **moitié les dégâts des pièges**.{paliers}","paliers_mode":"cumule"}$j$::jsonb,
  description_tronc = $f$Les cibles du sort s'immunisent contre les attaques basées sur la surprise. Lorsqu'elles seront affligées d'une de ces attaques, elles devront annoncer "Annule". De plus, elles reçoivent toujours la moitié des dégâts provenant des pièges pour la durée du sort.$f$,
  paliers = $j$[{"texte":"Résiste aux attaques de niveau 1 soit \"Égorgement\" et \"Assommement\".","niveau":1,"libelle":"Niv. 1"},{"texte":"Résiste aux attaques sournoises de niveau 2 soit le \"Brise-Cou\".","niveau":6,"libelle":"Niv. 6"},{"texte":"Résiste aux attaques sournoises de niveau 3, le \"Backstab\". De plus, la cible utilise son niveau de personnage doublé pour résister aux effets des pièges, magiques ou non.","niveau":20,"libelle":"Niv. 20"}]$j$::jsonb
WHERE nom = 'Sens aiguisé' AND cercle = 'Combat';

-- Arme Magique : cumule + fix verbatim palier 20 (« mais qu'elles » → « mais elles ») + courte
UPDATE sorts SET
  effet_instance = $j${"template":"Enchante **une arme par cible**.{paliers}","paliers_mode":"cumule"}$j$::jsonb,
  description_courte = $f$Enchante des armes (1 par cible) : dégâts magiques, puis indestructible, puis insensible aux sorts selon le niveau.$f$,
  paliers = $j$[{"texte":"L'arme enchantée produit des dégâts magiques.","niveau":6,"libelle":"Niv. 6"},{"texte":"L'arme enchantée ne peut plus être détruite pour la durée du sort.","niveau":10,"libelle":"Niv. 10"},{"texte":"L'arme enchantée ne peut plus être affectée par un autre sort (comme augmentation de la température) pour la durée du sort.","niveau":15,"libelle":"Niv. 15"},{"texte":"Lorsque le personnage lance le sort, il peut choisir de le lancer normalement ou d'enchanter les armes de tous les personnages autour de lui, dans un rayon de 10 pieds, qui frappent maintenant magiques, mais elles peuvent encore être détruites ou affectées par un autre sort.","niveau":20,"libelle":"Niv. 20"}]$j$::jsonb
WHERE nom = 'Arme Magique' AND cercle = 'Combat';

UPDATE sorts SET effet_instance = $j${"template":"Dégâts de **magie pure** : **{palier}** Lançable en plein combat ; les coups reçus ne déconcentrent pas le lanceur.","paliers_mode":"remplace"}$j$::jsonb
WHERE nom = 'Lame Dimensionnelle' AND cercle = 'Combat';

-- Poigne de fer : fix verbatim tronc (« s'ils » → « si elles ») + courte
UPDATE sorts SET
  effet_instance = $j${"template":"Les cibles portent des **armes à deux mains** sans la compétence d'armes. {palier}","paliers_mode":"remplace"}$j$::jsonb,
  description_tronc = $f$Les cibles du sort peuvent maintenant porter des armes à deux mains, même si elles n'ont pas la compétence d'armes, pour la durée du sort.$f$,
  description_courte = $f$Permet de porter des armes à deux mains sans la compétence ; à haut niveau, la cible ne peut plus être désarmée.$f$
WHERE nom = 'Poigne de fer' AND cercle = 'Combat';

UPDATE sorts SET effet_instance = $j${"template":"Un bouclier par cible. **{palier}**","paliers_mode":"remplace"}$j$::jsonb
WHERE nom = 'Bouclier Mystique' AND cercle = 'Combat';

-- ============ ILLUSION (11) ============

UPDATE sorts SET effet_instance = $j${"template":"Donne aux objets ciblés une **fausse aura magique** au choix (objet déjà magique : le niveau {niveau} doit excéder le sien). **{palier}**","paliers_mode":"remplace"}$j$::jsonb
WHERE nom = 'Aura magique' AND cercle = 'Illusion';

UPDATE sorts SET effet_instance = $j${"template":"Altère les prémonitions : la compétence **« Rêves »** renvoie la vision choisie par le lanceur."}$j$::jsonb
WHERE nom = 'Fausses visions' AND cercle = 'Illusion';

UPDATE sorts SET effet_instance = $j${"template":"Un bâton de bois paraît un **serpent venimeux** (illusion totale : toucher, vue, odeur) ; **effet de peur** émanant du bâton."}$j$::jsonb
WHERE nom = $n$L'Esprit du Serpent$n$ AND cercle = 'Illusion';

UPDATE sorts SET effet_instance = $j${"template":"Change les traits de la cible pour **éviter d'être reconnue** (sans imiter fidèlement quelqu'un) ; modifications physiques à apporter en jeu."}$j$::jsonb
WHERE nom = $n$Modification d'Apparence$n$ AND cercle = 'Illusion';

UPDATE sorts SET effet_instance = $j${"template":"Les cibles surestiment la fortune du lanceur : chaque écu qu'il présente **compte triple**."}$j$::jsonb
WHERE nom = 'Or des Fous' AND cercle = 'Illusion';

UPDATE sorts SET effet_instance = $j${"template":"Les cibles voient tout personnage comme un **ennemi** et l'attaquent. Cesse face à un sort de calme de niveau supérieur ou si la cible tombe inconsciente."}$j$::jsonb
WHERE nom = 'Rageur Fou' AND cercle = 'Illusion';

-- Simulacre de vie : fix tronc (« entiers » → « entières ») + courte
UPDATE sorts SET
  effet_instance = $j${"template":"Simule les signes vitaux : **{palier}**","paliers_mode":"remplace"}$j$::jsonb,
  description_tronc = $f$Les cibles affectées donnent l'impression d'être en vie, elles possèdent des signes vitaux et semblent entières si ce n'est pas généralement le cas.$f$,
  description_courte = $f$Fait paraître les cibles vivantes (signes vitaux simulés) et trompe les Diagnostics selon le niveau.$f$
WHERE nom = 'Simulacre de vie' AND cercle = 'Illusion';

-- Aura indétectable : fix palier 20 (« les aura des artéfacts » → « les auras des artefacts ») + courte
UPDATE sorts SET
  effet_instance = $j${"template":"Masque l'**aura magique** d'objets : une détection de niveau inférieur à {niveau} n'y voit aucune magie. {palier}","paliers_mode":"remplace"}$j$::jsonb,
  paliers = $j$[{"texte":"Peut cacher les auras des artefacts.","niveau":20,"libelle":"Niv. 20"}]$j$::jsonb,
  description_courte = $f$Masque l'aura magique d'objets : une détection de niveau inférieur n'y voit aucune magie ; cache même les artefacts à haut niveau.$f$
WHERE nom = 'Aura indétectable' AND cercle = 'Illusion';

-- Incantation Fourbe : fix verbatim (« Permets » ×5 → « Permet » ; « nécessaire » → « nécessaires »)
UPDATE sorts SET
  effet_instance = $j${"template":"Lance ses formules de mage en **langue commune**. **{palier}**","paliers_mode":"remplace"}$j$::jsonb,
  description_tronc = $f$Le lanceur du sort peut maintenant lancer ses formules en utilisant des mots de la langue commune plutôt que les mots de pouvoir nécessaires aux formules d'un sort de mage. Dépendamment du niveau du sort, le changement peut être plus ou moins important.$f$,
  paliers = $j$[{"texte":"Permet de remplacer 1 mot de pouvoir par n'importe quel mot.","niveau":6,"libelle":"Niv. 6"},{"texte":"Permet de remplacer 2 mots de pouvoir par n'importe quels mots.","niveau":10,"libelle":"Niv. 10"},{"texte":"Permet de remplacer 3 mots de pouvoir par n'importe quels mots.","niveau":11,"libelle":"Niv. 11"},{"texte":"Permet de remplacer 4 mots de pouvoir par n'importe quels mots.","niveau":15,"libelle":"Niv. 15"},{"texte":"Permet de remplacer 5 mots de pouvoir par n'importe quels mots.","niveau":20,"libelle":"Niv. 20"}]$j$::jsonb
WHERE nom = 'Incantation Fourbe' AND cercle = 'Illusion';

UPDATE sorts SET effet_instance = $j${"template":"**Effet de peur** : les cibles ne peuvent plus attaquer ni viser la source, peuvent se défendre, et doivent fuir hors de sa vue."}$j$::jsonb
WHERE nom = 'Vision Terrifiante' AND cercle = 'Illusion';

UPDATE sorts SET effet_instance = $j${"template":"La cible affronte sa **pire peur** : si elle ne résiste pas, inconsciente 1 minute ; si son niveau est inférieur à la moitié de {niveau}, elle perd ses points de vie restants et devient **comateuse**."}$j$::jsonb
WHERE nom = 'Assassin Imaginaire' AND cercle = 'Illusion';
