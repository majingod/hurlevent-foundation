-- EFFETS-CALCULES lot 5 (final sorts) : Magie Noire (14) + Magie Pure (10) = 24 sorts
-- + fixes verbatim (Manuel corrigé = canon) : Pestilence p20 (phrase dupliquée), Saignée Mystique p10/p15,
--   L'Entente du Néant (ponctuation), Ténèbres (durée 1 Minute + « subi »), Explosion arcanique p11/p20,
--   Inspiration spirituel (paragraphe objet/parchemin déplacé au tronc, palier 20 épuré)
-- + 4 description_courte nettoyées (Faiblesse, Pestilence, L'Entente du Néant, Absorption Magique)
-- Décisions s166 : Ténèbres durée alignée Manuel ; nom « Inspiration spirituel » conservé tel quel.
-- Idempotent : UPDATE par nom+cercle, valeurs figées (replace() inoffensif en re-run).

-- ============ MAGIE NOIRE (14) ============

UPDATE sorts SET effet_instance = $j${"vars":{"n":{"div":2,"arrondi":"sup"}},"template":"Bouclier absorbant **{n} dégât{s:n} d'énergie négative**. Le bouclier disparaît à la fin de la durée."}$j$::jsonb
WHERE nom = $n$Bouclier contre l'Énergie négative$n$ AND cercle = 'Magie Noire';

UPDATE sorts SET effet_instance = $j${"template":"Les cibles deviennent **aveugles** pour la durée du sort."}$j$::jsonb
WHERE nom = 'Cécité' AND cercle = 'Magie Noire';

UPDATE sorts SET effet_instance = $j${"template":"Les cibles deviennent **muettes** pour la durée du sort."}$j$::jsonb
WHERE nom = 'Perte de la Parole' AND cercle = 'Magie Noire';

UPDATE sorts SET effet_instance = $j${"template":"Inflige **{palier}**","paliers_mode":"remplace"}$j$::jsonb
WHERE nom = $n$Rayon d'Énergie Négative$n$ AND cercle = 'Magie Noire';

UPDATE sorts SET effet_instance = $j${"template":"Les cibles se **tordent de douleur** : incapables d'attaquer ou de lancer un sort, et peinent à se défendre."}$j$::jsonb
WHERE nom = 'Souffrance' AND cercle = 'Magie Noire';

UPDATE sorts SET effet_instance = $j${"template":"Les cibles perdent **{niveau} points de spiritualité**."}$j$::jsonb
WHERE nom = 'Brûlure Spirituelle' AND cercle = 'Magie Noire';

UPDATE sorts SET effet_instance = $j${"template":"La cible passe la nuit en **cauchemars** : au réveil, aucun point de vie ni de spiritualité récupéré."}$j$::jsonb
WHERE nom = 'Cauchemar' AND cercle = 'Magie Noire';

UPDATE sorts SET
  effet_instance = $j${"template":"Les points de vie des cibles sont **réduits à 2** pour la durée. {palier}","paliers_mode":"remplace"}$j$::jsonb,
  description_courte = $f$Réduit les PV de la cible à 2 pour la durée ; à plus haut niveau, lui interdit les armes à deux mains puis tout combat.$f$
WHERE nom = 'Faiblesse' AND cercle = 'Magie Noire';

-- Pestilence : fix verbatim palier 20 (phrase dupliquée retirée) + courte
UPDATE sorts SET
  effet_instance = $j${"template":"État **pestiféré** : points de vie plafonnés à 2 jusqu'à guérison (guérison des maladies de niveau supérieur à {niveau}). {palier}","paliers_mode":"remplace"}$j$::jsonb,
  paliers = $j$[{"texte":"Les cibles affectées deviennent contagieuses pour la durée complète du sort. La maladie se transmet au toucher direct entre personnages. Un même contact ne peut transmettre la maladie qu'une seule fois par fin de semaine.","niveau":20,"libelle":"Niv. 20"}]$j$::jsonb,
  description_courte = $f$État pestiféré : PV plafonnés à 2 jusqu'à guérison (guérison des maladies de niveau supérieur) ; contagieux au toucher à haut niveau.$f$
WHERE nom = 'Pestilence' AND cercle = 'Magie Noire';

UPDATE sorts SET effet_instance = $j${"template":"État **Saignement** : la cible perd 1 point de vie par minute ; chaque plaie soignée se rouvre aussitôt. Ne descend jamais sous 1 point de vie ; seule l'anti-magie (ou la fin du sort) l'interrompt."}$j$::jsonb
WHERE nom = 'Saignée à blanc' AND cercle = 'Magie Noire';

-- Saignée Mystique : fix verbatim paliers 10/15 (« supplémentaires »)
UPDATE sorts SET
  effet_instance = $j${"template":"Draine la magie des cibles. **{palier}**","paliers_mode":"remplace"}$j$::jsonb,
  paliers = $j$[{"texte":"Tout sort lancé par la cible coûte 1 point de spiritualité supplémentaire.","niveau":6,"libelle":"Niv. 6"},{"texte":"Tout sort lancé par la cible coûte 2 points de spiritualité supplémentaires.","niveau":10,"libelle":"Niv. 10"},{"texte":"Tout sort lancé par la cible coûte 3 points de spiritualité supplémentaires.","niveau":15,"libelle":"Niv. 15"},{"texte":"Tout sort lancé par la cible coûte 4 points de spiritualité supplémentaires.","niveau":20,"libelle":"Niv. 20"}]$j$::jsonb
WHERE nom = 'Saignée Mystique' AND cercle = 'Magie Noire';

-- Ténèbres : durée alignée Manuel (1 Minute, bonus (*) déjà en formule) + fix « subit » → « subi »
UPDATE sorts SET
  effet_instance = $j${"template":"Crée une zone d'**obscurité totale** : quiconque y entre est aveuglé tant qu'il y reste."}$j$::jsonb,
  duree = '1 Minute',
  description_tronc = replace(description_tronc, $x$l'aveuglement subit$x$, $x$l'aveuglement subi$x$)
WHERE nom = 'Ténèbres' AND cercle = 'Magie Noire';

-- L'Entente du Néant : fix « contrecoup; » → « contrecoup : » + courte
UPDATE sorts SET
  effet_instance = $j${"template":"Pose une question au **Néant**, qui répond toujours la vérité ; en retour, répondre à la sienne avec vérité, sous peine de **malédiction**. {palier}","paliers_mode":"remplace"}$j$::jsonb,
  description_tronc = replace(description_tronc, 'contrecoup; une malédiction', 'contrecoup : une malédiction'),
  description_courte = $f$Pose une question au Néant qui répond toujours vrai ; en échange, il faut répondre à la sienne avec vérité, sous peine de malédiction.$f$
WHERE nom = $n$L'Entente du Néant$n$ AND cercle = 'Magie Noire';

UPDATE sorts SET effet_instance = $j${"template":"Zone où tout sort de niveau inférieur à {niveau}, hors **magie noire**, ne produit aucun effet."}$j$::jsonb
WHERE nom = 'Oraison Funeste' AND cercle = 'Magie Noire';

-- ============ MAGIE PURE (10) ============

UPDATE sorts SET effet_instance = $j${"vars":{"n":{"div":2,"arrondi":"sup"}},"template":"Confère **{n} point{s:n} d'armure** ; sans effet si la cible porte une armure physique."}$j$::jsonb
WHERE nom = $n$Bouclier d'Énergie Spirituelle$n$ AND cercle = 'Magie Pure';

UPDATE sorts SET effet_instance = $j${"vars":{"n":{"div":2,"arrondi":"sup"}},"template":"Bouclier absorbant **{n} dégât{s:n} de magie pure**. Ne protège pas contre le drain de vie ni les dégâts d'énergie négative."}$j$::jsonb
WHERE nom = 'Bouclier Magique' AND cercle = 'Magie Pure';

UPDATE sorts SET effet_instance = $j${"template":"Emprisonne les créatures présentes dans une **bulle infranchissable** : rien n'entre ni ne sort. Un personnage de niveau supérieur la perce et met fin au sort."}$j$::jsonb
WHERE nom = $n$Bulle d'emprisonnement$n$ AND cercle = 'Magie Pure';

UPDATE sorts SET effet_instance = $j${"template":"**Renvoie au lanceur** un sort ou une prière de niveau inférieur à {niveau} ciblant la cible."}$j$::jsonb
WHERE nom = 'Miroir' AND cercle = 'Magie Pure';

UPDATE sorts SET effet_instance = $j${"template":"Inflige **{palier}** Les dégâts magiques blessent aussi les intangibles.","paliers_mode":"remplace"}$j$::jsonb
WHERE nom = 'Projectile Magique' AND cercle = 'Magie Pure';

UPDATE sorts SET effet_instance = $j${"template":"Zone d'**anti-magie** : tout sort de niveau inférieur à {niveau} y est annulé ; les objets magiques y perdent leurs capacités. **{palier}**","paliers_mode":"remplace"}$j$::jsonb
WHERE nom = $n$Coquille d'anti-magie$n$ AND cercle = 'Magie Pure';

UPDATE sorts SET effet_instance = $j${"template":"**Dissipe** sur les cibles les effets magiques (sorts, potions) de niveau inférieur à {niveau}. Sans effet sur les objets magiques."}$j$::jsonb
WHERE nom = 'Dissipation de la magie' AND cercle = 'Magie Pure';

-- Explosion arcanique : fix verbatim paliers 11/20 (« à chacune », « dégâts magiques »)
UPDATE sorts SET
  effet_instance = $j${"template":"Le lanceur doit toucher sa cible pendant l'incantation. **{palier}**","paliers_mode":"remplace"}$j$::jsonb,
  paliers = $j$[{"texte":"4 Dégâts magiques.","niveau":6,"libelle":"Niv. 6"},{"texte":"6 Dégâts magiques.","niveau":10,"libelle":"Niv. 10"},{"texte":"Le lanceur du sort peut toucher deux cibles et produire 4 dégâts magiques à chacune, ou 1 seule cible produisant 8 dégâts magiques.","niveau":11,"libelle":"Niv. 11"},{"texte":"Le lanceur du sort peut toucher deux cibles et produire 5 dégâts magiques à chacune, ou 1 seule cible produisant 10 dégâts magiques.","niveau":20,"libelle":"Niv. 20"}]$j$::jsonb
WHERE nom = 'Explosion arcanique' AND cercle = 'Magie Pure';

-- Inspiration spirituel : restructuration verbatim Manuel (paragraphe objet/parchemin → tronc ; palier 20 épuré)
-- Décision s166 : nom conservé tel quel (« Inspiration spirituel »).
UPDATE sorts SET
  effet_instance = $j${"template":"Transfère sa propre énergie à une cible vivante (sans dépasser son maximum) : **{palier}**","paliers_mode":"remplace"}$j$::jsonb,
  description_tronc = $f$Le lanceur du sort transfère immédiatement une partie de son énergie magique à une cible vivante.

La quantité transférée varie selon le niveau du sort. Un sort de plus haut niveau permet de transférer plus efficacement son énergie. Le coût d'un sort en points de spiritualité représente l'énergie totale investie par le lanceur. Toutefois, seule une partie de cette énergie est réellement transférée à la cible. Exemple : au niveau 6, le sort coûte 5 points de spiritualité. Parmi ceux-ci, 2 points sont transférés à la cible.

La cible qui reçoit cette énergie spirituelle ne peut pas dépasser son maximum normal de spiritualité. Si elle reçoit plus que son maximum, les points excédentaires sont perdus.

Si ce sort est utilisé dans le cadre de la création ou de l'activation d'un objet magique/parchemin, le créateur paie le coût de spiritualité pour lancer le sort. La quantité de spiritualité fournie par l'objet à la cible est alors puisée dans la réserve de points de spiritualité de l'utilisateur de l'objet au moment de son utilisation afin d'être transférée à la cible.$f$,
  paliers = $j$[{"texte":"Transfert de 2 points de spiritualité.","niveau":6,"libelle":"Niveau 6"},{"texte":"Transfert de 3 points de spiritualité.","niveau":8,"libelle":"Niveau 8"},{"texte":"Transfert de 4 points de spiritualité.","niveau":10,"libelle":"Niveau 10"},{"texte":"Transfert de 5 points de spiritualité.","niveau":12,"libelle":"Niveau 12"},{"texte":"Transfert de 6 points de spiritualité.","niveau":14,"libelle":"Niveau 14"},{"texte":"Transfert de 7 points de spiritualité.","niveau":16,"libelle":"Niveau 16"},{"texte":"Transfert de 8 points de spiritualité.","niveau":18,"libelle":"Niveau 18"},{"texte":"Transfert de 10 points de spiritualité.","niveau":20,"libelle":"Niveau 20"}]$j$::jsonb
WHERE nom = 'Inspiration spirituel' AND cercle = 'Magie Pure';

-- Absorption Magique : courte nettoyée
UPDATE sorts SET
  effet_instance = $j${"template":"Le **premier sort** visant le lanceur est dissipé et lui rend **1 point de spiritualité** (sans effet sur les attaques physiques). {palier}","paliers_mode":"remplace"}$j$::jsonb,
  description_courte = $f$Dissipe le premier sort visant le lanceur et lui rend de la spiritualité (pas les attaques physiques).$f$
WHERE nom = 'Absorption Magique' AND cercle = 'Magie Pure';
