-- EFFETS-CALCULÉS — Lot prières 1 : Bénédiction (15) + Connaissance (13) (s167)
-- 28 templates effet_instance + 5 types alignés Manuel + Régénération niveau 6→1
-- + 7 fixes verbatim (toutes colonnes) + 2 description_courte nettoyées.
-- Décisions Fred s167 : Q1 types = Manuel canon · Q2 Garde de la chair /
-- Zone Anti-Pathogène = cumule (protections étagées) · Q3 Savoir du Prophète = DB conservée.
-- Idempotent : SET directs + replace() no-op si chaîne absente.

-- ============ TEMPLATES BÉNÉDICTION (15) ============
UPDATE prieres SET effet_instance = $j${"template":"Les cibles regagnent **{palier}**"}$j$::jsonb WHERE domaine='Bénédiction' AND nom='Soins';
UPDATE prieres SET effet_instance = $j${"template":"Les cibles regagnent 1 point de vie par minute : **{palier}** Peut à la place rattacher un membre sectionné (même race, frais, hors combat)."}$j$::jsonb WHERE domaine='Bénédiction' AND nom='Régénération';
UPDATE prieres SET effet_instance = $j${"template":"Bénit un breuvage tenu en main (fin si lâché) ; chaque gorgée **{palier}** Une même personne ne peut en bénéficier qu'une fois par 5 minutes."}$j$::jsonb WHERE domaine='Bénédiction' AND nom='Boisson guérisseuse';
UPDATE prieres SET effet_instance = $j${"template":"**{palier}** Une seule maladie à la fois ; un cycle d'attente avant une nouvelle guérison."}$j$::jsonb WHERE domaine='Bénédiction' AND nom='Guérison des Maladies';
UPDATE prieres SET effet_instance = $j${"template":"**{palier}**"}$j$::jsonb WHERE domaine='Bénédiction' AND nom='Guérison des Poisons';
UPDATE prieres SET effet_instance = $j${"template":"Retourne un aliment solide à sa forme pure. **{palier}**"}$j$::jsonb WHERE domaine='Bénédiction' AND nom='Purification de la Nourriture';
UPDATE prieres SET effet_instance = $j${"template":"Immunise contre les nouveaux effets d'enchevêtrement, de paralysie, de pétrification et de maladresse de **niveau inférieur à {niveau}**. Ne dissipe pas les effets en cours."}$j$::jsonb WHERE domaine='Bénédiction' AND nom='Liberté de Mouvement';
UPDATE prieres SET effet_instance = $j${"template":"Génère une lumière magique (lampe torche du joueur) ; certaines créatures de l'ombre la fuient. Interdit d'aveugler quelqu'un."}$j$::jsonb WHERE domaine='Bénédiction' AND nom='Lumière';
UPDATE prieres SET effet_instance = $j${"template":"Les cibles résistent à la capture d'âme avec le **niveau {niveau}** au lieu du leur."}$j$::jsonb WHERE domaine='Bénédiction' AND nom='Protection de l''Âme';
UPDATE prieres SET effet_instance = $j${"template":"Les cibles ajoutent **1 point de guérison** à la compétence \"Premiers soins\" et peuvent retarder les effets des maladies et des poisons."}$j$::jsonb WHERE domaine='Bénédiction' AND nom='Renforcement Saint';
UPDATE prieres SET effet_instance = $j${"template":"Protège contre l'application de nouveaux effets (n'annule pas ceux en cours).{paliers}","paliers_mode":"cumule"}$j$::jsonb WHERE domaine='Bénédiction' AND nom='Garde de la chair';
UPDATE prieres SET effet_instance = $j${"template":"Sang béni : une créature de niveau inférieur qui se nourrit du personnage (cannibalisme) ne regagne aucun point de vie. {palier}"}$j$::jsonb WHERE domaine='Bénédiction' AND nom='Sang Sacré';
UPDATE prieres SET effet_instance = $j${"template":"Zone bloquant l'entrée ou la sortie (au choix) des personnes contaminées.{paliers}","paliers_mode":"cumule"}$j$::jsonb WHERE domaine='Bénédiction' AND nom='Zone Anti-Pathogène';
UPDATE prieres SET effet_instance = $j${"template":"Toute possession ou manipulation de l'âme doit dépasser le **niveau {niveau}**. À la mort, l'âme reste ancrée et le compte à rebours de retour à la vie est gelé."}$j$::jsonb WHERE domaine='Bénédiction' AND nom='Ancrage de l''âme';
UPDATE prieres SET effet_instance = $j${"template":"Barrière sur un lieu fixe contre une origine au choix (Tombes, Rêves, Néant ou Cauchemars) : **1 dégât magique** par franchissement ; entrée sur invitation seulement. Le lanceur doit rester dans le lieu."}$j$::jsonb WHERE domaine='Bénédiction' AND nom='Bénédiction du Seuil';

-- ============ TEMPLATES CONNAISSANCE (13) ============
UPDATE prieres SET effet_instance = $j${"template":"Les cibles résistent aux pièges avec le **niveau {niveau}** au lieu du leur."}$j$::jsonb WHERE domaine='Connaissance' AND nom='Alerte du Danger';
UPDATE prieres SET effet_instance = $j${"template":"Révèle l'origine d'une créature (Tombes, Rêves, Néant, Nature…) de **niveau {niveau} ou moins** ; sinon, impression confuse."}$j$::jsonb WHERE domaine='Connaissance' AND nom='Détection de la famille';
UPDATE prieres SET effet_instance = $j${"template":"Confirme la présence ou l'absence d'une aura magique, sans en révéler la nature ni la puissance ; détecte aussi les fausses auras."}$j$::jsonb WHERE domaine='Connaissance' AND nom='Détection de la magie';
UPDATE prieres SET effet_instance = $j${"template":"Immunise contre les sorts d'illusion de **niveau inférieur à {niveau}**. Lorsqu'une illusion est annulée, annoncer \"Annule\"."}$j$::jsonb WHERE domaine='Connaissance' AND nom='Discernement Divin';
UPDATE prieres SET effet_instance = $j${"template":"La cible comprend et parle les langues qui lui sont habituellement inconnues."}$j$::jsonb WHERE domaine='Connaissance' AND nom='Don des Langues';
UPDATE prieres SET effet_instance = $j${"template":"Protège un objet désigné (ruban jaune) : nul ne peut le saisir sans surpasser le **niveau {niveau}**. Fin si l'objet quitte la vue du lanceur."}$j$::jsonb WHERE domaine='Connaissance' AND nom='Ange Gardien';
UPDATE prieres SET effet_instance = $j${"template":"Pose **{n} question{s:n}** (réponse affirmative, négative ou indécise) à une force supérieure. Nécessite un animateur.","vars":{"n":{"div":2,"arrondi":"sup"}}}$j$::jsonb WHERE domaine='Connaissance' AND nom='Augure';
UPDATE prieres SET effet_instance = $j${"template":"Retire aux cibles tous les effets magiques de **niveau inférieur à {niveau}** (sorts, potions). Sans effet sur les objets magiques."}$j$::jsonb WHERE domaine='Connaissance' AND nom='Dissipation de la magie';
UPDATE prieres SET effet_instance = $j${"template":"Si la cible utilise la compétence Rêve la nuit suivante, le lanceur perçoit ce rêve (interception passive ; un seul lien à la fois)."}$j$::jsonb WHERE domaine='Connaissance' AND nom='Interception des rêves';
UPDATE prieres SET effet_instance = $j${"template":"Détecte si la créature possède une âme et s'il s'agit de la sienne d'origine. Au niveau 11 ou plus, perçoit l'origine d'une altération (pacte, malédiction, possession, échange)."}$j$::jsonb WHERE domaine='Connaissance' AND nom='Lecture de l''Âme';
UPDATE prieres SET effet_instance = $j${"template":"Met un membre ou organe amputé en stase : **+1 cycle** avant la greffe (maximum 2 au total). Une seule fois par membre."}$j$::jsonb WHERE domaine='Connaissance' AND nom='Suspension de la chair';
UPDATE prieres SET effet_instance = $j${"template":"Révèle les écoles et domaines des sorts actifs sur la cible, sans en révéler les effets, la durée ni le niveau."}$j$::jsonb WHERE domaine='Connaissance' AND nom='Vision de la magie';
UPDATE prieres SET effet_instance = $j${"template":"Interroge le prophète de sa religion : **{palier}** Le prophète peut refuser ou exiger une contrepartie."}$j$::jsonb WHERE domaine='Connaissance' AND nom='Savoir du Prophète';

-- ============ TYPES (Manuel = canon, décision Fred s167) ============
UPDATE prieres SET type_priere='effet'
WHERE domaine='Bénédiction' AND nom IN ('Guérison des Maladies','Guérison des Poisons','Purification de la Nourriture','Lumière','Liberté de Mouvement');

-- ============ RÉGÉNÉRATION 6 → 1 (dette validée Fred) ============
UPDATE prieres SET niveau=1 WHERE domaine='Bénédiction' AND nom='Régénération';

-- ============ FIXES VERBATIM (Manuel = canon, toutes colonnes) ============
UPDATE prieres SET
 description_tronc = replace(description_tronc, $x$même si il est fait$x$, $x$même s'il est fait$x$),
 description = replace(description, $x$même si il est fait$x$, $x$même s'il est fait$x$)
WHERE domaine='Bénédiction' AND nom='Guérison des Maladies';

UPDATE prieres SET
 paliers = replace(paliers::text, $x$Protège contre maladie mineur.$x$, $x$Protège contre maladie mineure.$x$)::jsonb,
 description = replace(description, $x$Protège contre maladie mineur.$x$, $x$Protège contre maladie mineure.$x$)
WHERE domaine='Bénédiction' AND nom='Garde de la chair';

UPDATE prieres SET
 description_tronc = replace(replace(description_tronc,
   $x$considéré comme bénit$x$, $x$considéré comme béni$x$),
   $x$qu'il aurait été supposé regagner$x$, $x$qu'elle aurait été supposée regagner$x$),
 paliers = replace(replace(paliers::text,
   $x$à son propriétaire lorsqu'il cible le personnage$x$, $x$à leur propriétaire lorsqu'ils ciblent le personnage$x$),
   $x$Cet effet ne s'importe pas du niveau$x$, $x$Cet effet s'applique peu importe le niveau$x$)::jsonb,
 description = replace(replace(replace(replace(description,
   $x$considéré comme bénit$x$, $x$considéré comme béni$x$),
   $x$qu'il aurait été supposé regagner$x$, $x$qu'elle aurait été supposée regagner$x$),
   $x$à son propriétaire lorsqu'il cible le personnage$x$, $x$à leur propriétaire lorsqu'ils ciblent le personnage$x$),
   $x$Cet effet ne s'importe pas du niveau$x$, $x$Cet effet s'applique peu importe le niveau$x$)
WHERE domaine='Bénédiction' AND nom='Sang Sacré';

UPDATE prieres SET description = replace(replace(description,
 $x$ancrée à son corps et, empêchant$x$, $x$ancrée à son corps, empêchant$x$),
 $x$Aucun temps ne s'écoule liée à la mort$x$, $x$Aucun temps ne s'écoule lié à la mort$x$)
WHERE domaine='Bénédiction' AND nom='Ancrage de l''âme';

UPDATE prieres SET description = replace(description,
 $x$qui sont moins puissantes que$x$, $x$qui sont moins puissants que$x$)
WHERE domaine='Connaissance' AND nom='Discernement Divin';

UPDATE prieres SET description = replace(description,
 $x$dont ils bénéficiaient$x$, $x$dont elles bénéficiaient$x$)
WHERE domaine='Connaissance' AND nom='Dissipation de la magie';

UPDATE prieres SET description = replace(description,
 $x$est perdu à la décomposition trop avancée$x$, $x$est perdu, la décomposition étant trop avancée$x$)
WHERE domaine='Connaissance' AND nom='Suspension de la chair';

-- ============ COURTES NETTOYÉES (2) ============
UPDATE prieres SET description_courte = $x$Sang du lanceur béni : une créature de niveau inférieur qui le cannibalise ne gagne aucun PV. À haut niveau, tout drain de vie subi inflige 1 dégât à son lanceur.$x$
WHERE domaine='Bénédiction' AND nom='Sang Sacré';

UPDATE prieres SET description_courte = $x$Détecte si une créature a une âme et s'il s'agit de la sienne d'origine. À haut niveau, perçoit l'origine d'une altération (pacte, malédiction, possession, échange).$x$
WHERE domaine='Connaissance' AND nom='Lecture de l''Âme';
