-- EFFETS-CALCULES lot 3 : Eau (11) + Feu (10) + Terre (10) = 31 effet_instance
-- + 8 description_courte nettoyées (queues « Niv. X »)
-- + fix verbatim Réchauffement du Métal (Manuel = canon : « chauffer à blanc », palier 11 « dégât de feu » au lieu de « glace »)
-- + Immunité au Poison : palier 20 réécrit en autonome (précédent s164) + capitalisation paliers alignée Manuel — à re-vérifier au RESYNC
-- Idempotent : UPDATE par (cercle, nom).

-- ===== EAU =====
UPDATE sorts SET effet_instance = $j${"template":"Les cibles agissent comme exposées à **-40 °C** et ne peuvent plus se concentrer pour lancer des sorts ou utiliser des compétences."}$j$::jsonb WHERE cercle='Eau' AND nom='Abaissement de Température';

UPDATE sorts SET effet_instance = $j${"template":"La cible reçoit **{n} point{s:n} d'armure temporaire{s:n}** (aucune armure physique portée ; tout dégât de feu inflige **+1 dégât** tant que le sort est actif).{paliers}","vars":{"n":{"div":2,"arrondi":"sup"}},"paliers_mode":"cumule"}$j$::jsonb,
  description_courte = $f$Armure de givre : points d'armure = moitié du niveau (arrondi sup.), sans armure physique ; vulnérable au feu (+1 dégât).$f$
WHERE cercle='Eau' AND nom='Armure Givre';

UPDATE sorts SET effet_instance = $j${"template":"Bouclier absorbant **{n} dégât{s:n} de glace**. Le bouclier disparaît à la fin de la durée.","vars":{"n":{"div":2,"arrondi":"sup"}}}$j$::jsonb WHERE cercle='Eau' AND nom='Bouclier de Glace';

UPDATE sorts SET effet_instance = $j${"template":"Gèle des objets métalliques, **impossibles à tenir** (objet non porté : affecté automatiquement ; objet porté : niveau du sort opposé au niveau du porteur). {palier}","paliers_mode":"remplace"}$j$::jsonb,
  description_courte = $f$Gèle des objets métalliques : impossibles à tenir (objet porté : niveau du sort vs porteur).$f$
WHERE cercle='Eau' AND nom='Froid Glacial';

UPDATE sorts SET effet_instance = $j${"template":"Les cibles deviennent des **statues de glace** : immobiles et muettes, mais insensibles aux dégâts (sens conservés). Ne compte pas comme de la pétrification."}$j$::jsonb WHERE cercle='Eau' AND nom='Iceberg';

UPDATE sorts SET effet_instance = $j${"template":"Immunise contre les **nouveaux poisons mineurs** reçus pendant la durée (n'annule pas les poisons déjà actifs). {palier}","paliers_mode":"remplace"}$j$::jsonb,
  paliers = $j$[{"texte":"Immunise contre les poisons intermédiaires.","niveau":6,"libelle":"Niv. 6"},{"texte":"Immunise contre les poisons majeurs. (À l'exception du poison mortel)","niveau":11,"libelle":"Niv. 11"},{"texte":"Immunise contre les poisons majeurs et contre l'effet du coup de grâce produit par le poison mortel : le personnage tombe simplement comateux, à 0 point de vie.","niveau":20,"libelle":"Niv. 20"}]$j$::jsonb,
  description = $f$Ce sort immunise contre les poisons mineurs qui seront reçus pendant la durée du sort. Ce sort n'annule pas les poisons déjà actifs au moment de l'incantation ; il empêche uniquement les nouveaux effets de poison reçus pendant la durée.

Niv. 6 : Immunise contre les poisons intermédiaires.
Niv. 11 : Immunise contre les poisons majeurs. (À l'exception du poison mortel)
Niv. 20 : Immunise contre les poisons majeurs et contre l'effet du coup de grâce produit par le poison mortel : le personnage tombe simplement comateux, à 0 point de vie.$f$,
  description_courte = $f$Immunise contre les nouveaux poisons (mineurs → majeurs selon le niveau).$f$
WHERE cercle='Eau' AND nom='Immunité au Poison';

UPDATE sorts SET effet_instance = $j${"template":"La cible **suffoque** : à genoux ou au sol, incapable de parler, d'incanter, d'attaquer ou d'utiliser des compétences. Elle peut seulement se déplacer lentement."}$j$::jsonb WHERE cercle='Eau' AND nom='Noyade';

UPDATE sorts SET effet_instance = $j${"template":"Inflige **{palier}**","paliers_mode":"remplace"}$j$::jsonb WHERE cercle='Eau' AND nom='Projectile de glace';

UPDATE sorts SET effet_instance = $j${"template":"**{palier}** Ne purifie que les liquides non consommés.","paliers_mode":"remplace"}$j$::jsonb WHERE cercle='Eau' AND nom='Purification des Liquides';

UPDATE sorts SET effet_instance = $j${"template":"Ronge de rouille les objets métalliques ciblés (objet non porté : affecté automatiquement ; objet porté : niveau du sort opposé au niveau du porteur). **{palier}**","paliers_mode":"remplace"}$j$::jsonb,
  description_courte = $f$Rouille des objets métalliques : l'armure perd 1 → 4 combats selon le niveau et les armes deviennent fragiles.$f$
WHERE cercle='Eau' AND nom='Rouille';

UPDATE sorts SET effet_instance = $j${"template":"Le lanceur doit toucher sa cible pendant l'incantation. **{palier}**","paliers_mode":"remplace"}$j$::jsonb WHERE cercle='Eau' AND nom='Toucher Glacial';

-- ===== FEU =====
UPDATE sorts SET effet_instance = $j${"template":"Les cibles sont accablées par la **soif** : trouver de l'eau potable devient leur priorité. Elles peuvent toujours se défendre."}$j$::jsonb WHERE cercle='Feu' AND nom='Assoiffé';

UPDATE sorts SET effet_instance = $j${"template":"Bouclier absorbant **{n} dégât{s:n} de feu**. Le bouclier disparaît à la fin de la durée.","vars":{"n":{"div":2,"arrondi":"sup"}}}$j$::jsonb WHERE cercle='Feu' AND nom='Bouclier de Feu';

UPDATE sorts SET effet_instance = $j${"template":"La cible est **Enflammée** et doit immédiatement consacrer une action claire à s'éteindre, sinon elle perd **50 % de ses points de vie et d'armure totaux**. Une seule fois par combat par cible."}$j$::jsonb WHERE cercle='Feu' AND nom='Brasero';

UPDATE sorts SET effet_instance = $j${"template":"Si le lanceur tombe à 0 PV pendant la durée, son corps **explose** (une seule fois ; pas si la chute est volontaire ; le lanceur est épargné) : **{palier}**","paliers_mode":"remplace"}$j$::jsonb WHERE cercle='Feu' AND nom='Brasier Vengeur';

UPDATE sorts SET effet_instance = $j${"template":"Inflige **{palier}**","paliers_mode":"remplace"}$j$::jsonb WHERE cercle='Feu' AND nom='Jet de flammes';

UPDATE sorts SET effet_instance = $j${"template":"Génère une **lumière magique** (lampe torche du joueur) que certaines créatures de l'ombre fuient. Interdit de viser les yeux pour aveugler."}$j$::jsonb WHERE cercle='Feu' AND nom='Lumière';

UPDATE sorts SET effet_instance = $j${"template":"Les cibles agissent comme exposées à **60 °C** et ne peuvent plus se concentrer pour lancer des sorts ou des prières."}$j$::jsonb WHERE cercle='Feu' AND nom='Réchauffement de Température';

UPDATE sorts SET effet_instance = $j${"template":"Chauffe à blanc des objets métalliques, **impossibles à tenir** (objet non porté : affecté automatiquement ; objet porté : niveau du sort opposé au niveau du porteur). {palier}","paliers_mode":"remplace"}$j$::jsonb,
  paliers = $j$[{"texte":"Si la cible n'est pas en mesure de retirer l'objet métallique affecté (armure ou bouclier bloquée), elle subit 1 dégât de feu au début du sort, puis 1 dégât de feu par minute tant que l'objet reste sur elle et que le sort est actif. Ces dégâts cessent immédiatement si l'objet est retiré ou si le sort prend fin.","niveau":11,"libelle":"Niv. 11"}]$j$::jsonb,
  description_tronc = replace(description_tronc, $f$qu'il fait chauffé à blanc$f$, $f$qu'il fait chauffer à blanc$f$),
  description = replace(replace(description, $f$qu'il fait chauffé à blanc$f$, $f$qu'il fait chauffer à blanc$f$), $f$elle subit 1 dégât de glace au début du sort$f$, $f$elle subit 1 dégât de feu au début du sort$f$),
  description_courte = $f$Chauffe à blanc des objets métalliques : impossibles à tenir (objet porté : niveau du sort vs porteur).$f$
WHERE cercle='Feu' AND nom='Réchauffement du Métal';

UPDATE sorts SET effet_instance = $j${"template":"Aura de flammes : chaque attaque de mêlée ou sort/prière au toucher reçu déclenche une riposte, à annoncer par le lanceur (les dégâts reçus s'appliquent quand même ; sans effet contre les attaques à distance) : **{palier}**","paliers_mode":"remplace"}$j$::jsonb WHERE cercle='Feu' AND nom='Retour de flamme';

UPDATE sorts SET effet_instance = $j${"template":"Le lanceur doit toucher sa cible pendant l'incantation. **{palier}**","paliers_mode":"remplace"}$j$::jsonb WHERE cercle='Feu' AND nom='Toucher de Braise';

-- ===== TERRE =====
UPDATE sorts SET effet_instance = $j${"template":"Bouclier absorbant **{n} dégât{s:n} d'acide**. Le bouclier disparaît à la fin de la durée.","vars":{"n":{"div":2,"arrondi":"sup"}}}$j$::jsonb WHERE cercle='Terre' AND nom='Bouclier de Terre';

UPDATE sorts SET effet_instance = $j${"template":"Les cibles sont enchevêtrées des pieds aux genoux : **impossible de se déplacer**, mais elles peuvent attaquer, se défendre et incanter. La terre magique se reforme même si on la frappe ou la creuse."}$j$::jsonb WHERE cercle='Terre' AND nom='Emprisonnement dans la Terre';

UPDATE sorts SET effet_instance = $j${"template":"**{palier}** Une attaque sournoise est bloquée mais consomme toutes les protections restantes ; les coups assommants comptent comme des coups réguliers. Les pétrifications de niveau inférieur échouent (dire « Résiste »).","paliers_mode":"remplace"}$j$::jsonb WHERE cercle='Terre' AND nom='Peau de Pierre';

UPDATE sorts SET effet_instance = $j${"template":"La cible est **pétrifiée** : immobile, muette, impossible à déplacer ou à blesser (sens conservés). Peut aussi **dépétrifier**, si le niveau utilisé dépasse celui de la pétrification d'origine."}$j$::jsonb WHERE cercle='Terre' AND nom='Pétrification/Dépétrification';

UPDATE sorts SET effet_instance = $j${"template":"Zone corrosive : toute créature vivante présente ou entrant subit les dégâts, puis **une fois par minute** tant qu'elle y reste (**+1 dégât d'acide** si la cible porte une armure physique ; le lanceur doit rester conscient dans la zone) : **{palier}**","paliers_mode":"remplace"}$j$::jsonb,
  description_courte = $f$Zone d'acide : 1 → 4 dégâts selon le niveau, répétés chaque minute (+1 contre armure physique).$f$
WHERE cercle='Terre' AND nom='Pluie acide';

UPDATE sorts SET effet_instance = $j${"template":"Permet de porter des **armes à deux mains** sans la compétence d'armes. {palier}","paliers_mode":"remplace"}$j$::jsonb,
  description_courte = $f$Permet de porter des armes à deux mains sans en avoir la compétence.$f$
WHERE cercle='Terre' AND nom='Poigne de fer';

UPDATE sorts SET effet_instance = $j${"template":"Inflige **{palier}**","paliers_mode":"remplace"}$j$::jsonb WHERE cercle='Terre' AND nom=$n$Rayon d'Acide$n$;

UPDATE sorts SET effet_instance = $j${"template":"Si la cible tombe à 0 PV (à l'extérieur, corps au sol) : **+1 PV par minute pendant 5 minutes**, et elle reprend conscience après 5 minutes au lieu de 10 (toujours sans souvenirs). Se réactive tant que la durée du sort court."}$j$::jsonb WHERE cercle='Terre' AND nom='Sang de la Terre';

UPDATE sorts SET effet_instance = $j${"template":"Le lanceur doit toucher sa cible pendant l'incantation ; **+1 dégât d'acide** si la cible porte une armure. **{palier}**","paliers_mode":"remplace"}$j$::jsonb WHERE cercle='Terre' AND nom='Toucher Corrosif';

UPDATE sorts SET effet_instance = $j${"template":"Les cibles **tombent au sol** (le lanceur est épargné). {palier}","paliers_mode":"remplace"}$j$::jsonb,
  description_courte = $f$Fait tomber au sol les personnages touchés (le lanceur est épargné).$f$
WHERE cercle='Terre' AND nom='Tremblement de Terre';
