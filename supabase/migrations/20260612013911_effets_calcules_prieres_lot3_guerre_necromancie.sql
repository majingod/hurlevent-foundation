-- ============================================================
-- EFFETS-CALCULÉS — lot prières 3 : Guerre (15) + Nécromancie (15)
-- Session 169. 30 effet_instance + 11 fixes verbatim (Manuel canon)
-- + type Sanctuaire 'effet bénéfique'→'effet' + 6 courtes nettoyées.
-- Idempotent : replace()/regexp_replace() no-op si déjà appliqué,
-- seeds effet_instance ré-écrivables.
-- ============================================================

-- ===== A. FIXES VERBATIM GUERRE =====
UPDATE prieres SET
  paliers = regexp_replace(paliers::text, $p$mais qu['’']elles peuvent$p$, 'mais elles peuvent', 'g')::jsonb,
  description = regexp_replace(description, $p$mais qu['’']elles peuvent$p$, 'mais elles peuvent', 'g')
WHERE domaine='Guerre' AND nom='Arme Magique';

UPDATE prieres SET
  paliers = replace(paliers::text, '": "immunise contre l', '": "Immunise contre l')::jsonb,
  description = replace(description, ': immunise contre l', ': Immunise contre l')
WHERE domaine='Guerre' AND nom='Immunité au Poison';

UPDATE prieres SET
  description_tronc = regexp_replace(description_tronc, $p$s['’']ils n['’']ont pas la compétence$p$, $f$si elles n'ont pas la compétence$f$, 'g'),
  description = regexp_replace(description, $p$s['’']ils n['’']ont pas la compétence$p$, $f$si elles n'ont pas la compétence$f$, 'g')
WHERE domaine='Guerre' AND nom='Poigne de fer';

UPDATE prieres SET
  description = replace(description, 'Ils ne sont plus capables', 'Elles ne sont plus capables')
WHERE domaine='Guerre' AND nom='Présence intimidante';

UPDATE prieres SET
  description_tronc = replace(description_tronc, 'une de ses attaques', 'une de ces attaques'),
  paliers = replace(paliers::text, 'et de Backstab', 'et le Backstab')::jsonb,
  description = replace(replace(description, 'une de ses attaques', 'une de ces attaques'), 'et de Backstab', 'et le Backstab')
WHERE domaine='Guerre' AND nom='Sens aiguisé';

-- ===== B. TYPE SANCTUAIRE (Manuel canon : Sort à effet) =====
UPDATE prieres SET type_priere='effet' WHERE domaine='Guerre' AND nom='Sanctuaire';

-- ===== C. FIXES VERBATIM NÉCROMANCIE =====
UPDATE prieres SET
  description_tronc = replace(description_tronc, 'cette compétence doit fournir', 'ce sort doit fournir'),
  paliers = replace(replace(paliers::text, 'cibles zombies ou en squelette.', 'cibles en zombies ou en squelettes.'), 'blême ou spectre.', 'blêmes ou spectres.')::jsonb,
  description = replace(replace(replace(description, 'cette compétence doit fournir', 'ce sort doit fournir'), 'cibles zombies ou en squelette.', 'cibles en zombies ou en squelettes.'), 'blême ou spectre.', 'blêmes ou spectres.')
WHERE domaine='Nécromancie' AND nom='Animation des morts';

UPDATE prieres SET
  description = replace(replace(description, 'en emprisonnant dans', $f$en l'emprisonnant dans$f$), 'auquel on tente', 'dont on tente')
WHERE domaine='Nécromancie' AND nom LIKE 'Capture d_Âmes';

UPDATE prieres SET
  paliers = replace(paliers::text, 'transférer ses propres points de vie à une cible consentante à 5 pieds de lui.', $f$transférer à une cible consentante à 5 pieds de lui les points de vie gagnés par le drain, ainsi qu'une quantité de ses propres points de vie, à sa discrétion.$f$)::jsonb,
  description = replace(description, 'transférer ses propres points de vie à une cible consentante à 5 pieds de lui.', $f$transférer à une cible consentante à 5 pieds de lui les points de vie gagnés par le drain, ainsi qu'une quantité de ses propres points de vie, à sa discrétion.$f$)
WHERE domaine='Nécromancie' AND nom='Drain de vie';

UPDATE prieres SET
  description_tronc = replace(description_tronc, 'ils ne possèdent plus des signes', 'elles ne possèdent plus de signes'),
  description = replace(description, 'ils ne possèdent plus des signes', 'elles ne possèdent plus de signes')
WHERE domaine='Nécromancie' AND nom='Masque Funèbre';

UPDATE prieres SET
  description = replace(replace(description, 'Leur sens tel la vue', 'Leurs sens tels la vue'), 'mais ils ne peuvent plus parler', 'mais elles ne peuvent plus parler')
WHERE domaine='Nécromancie' AND nom='Paralysie de Morts-Vivants';

UPDATE prieres SET
  description_tronc = replace(description_tronc, 'semblent entiers', 'semblent entières'),
  description = replace(description, 'semblent entiers', 'semblent entières')
WHERE domaine='Nécromancie' AND nom='Simulacre de vie';

-- ===== D. EFFET_INSTANCE — GUERRE (15) =====
UPDATE prieres SET effet_instance = $j${"template":"Enchante **une arme par cible**.{paliers}","paliers_mode":"cumule"}$j$::jsonb WHERE domaine='Guerre' AND nom='Arme Magique';
UPDATE prieres SET effet_instance = $j${"template":"Armure énergétique non récupérable, cumulable avec une armure physique. **{palier}**","paliers_mode":"remplace"}$j$::jsonb WHERE domaine='Guerre' AND nom='Armure';
UPDATE prieres SET effet_instance = $j${"template":"Empêche la cible de recevoir tout sort à effets bénéfiques de **niveau inférieur à {niveau}** (n'enlève pas ceux déjà actifs)."}$j$::jsonb WHERE domaine='Guerre' AND nom='Châtiment du Traître';
UPDATE prieres SET effet_instance = $j${"template":"Le lanceur peut combattre et garder les **yeux ouverts** même aveuglé."}$j$::jsonb WHERE domaine='Guerre' AND nom='Combat Aveugle';
UPDATE prieres SET effet_instance = $j${"template":"Armure énergétique non récupérable : **{palier}** Immunise contre la peur de niveau inférieur tant que des points d'armure restent.","paliers_mode":"remplace"}$j$::jsonb WHERE domaine='Guerre' AND nom='Fureur Divine';
UPDATE prieres SET effet_instance = $j${"template":"Le lanceur **encaisse les dégâts à la place de la cible** (il doit la regarder ; son armure absorbe d'abord)."}$j$::jsonb WHERE domaine='Guerre' AND nom='Gardien Dévot';
UPDATE prieres SET effet_instance = $j${"template":"Immunise contre les **nouveaux poisons mineurs** reçus pendant la durée (n'annule pas les poisons déjà actifs). {palier}","paliers_mode":"remplace"}$j$::jsonb WHERE domaine='Guerre' AND nom='Immunité au Poison';
UPDATE prieres SET effet_instance = $j${"template":"La douleur n'affecte plus la cible, sans réduire les dégâts reçus.{paliers}","paliers_mode":"cumule"}$j$::jsonb WHERE domaine='Guerre' AND nom='Insensibilité à la douleur';
UPDATE prieres SET effet_instance = $j${"template":"La cible ralentit de **moitié** : ses coups n'infligent plus de dégâts, elle ne peut que marcher lentement et sa voix devient incompréhensible."}$j$::jsonb WHERE domaine='Guerre' AND nom='Lenteur';
UPDATE prieres SET effet_instance = $j${"template":"Les cibles portent des **armes à deux mains** sans la compétence d'armes. {palier}","paliers_mode":"remplace"}$j$::jsonb WHERE domaine='Guerre' AND nom='Poigne de fer';
UPDATE prieres SET effet_instance = $j${"template":"**Effet de peur** : les cibles ne peuvent ni attaquer ni cibler le lanceur et doivent fuir jusqu'à ne plus le voir (elles peuvent encore se défendre)."}$j$::jsonb WHERE domaine='Guerre' AND nom='Présence intimidante';
UPDATE prieres SET effet_instance = $j${"template":"**{palier}** Une attaque sournoise est bloquée mais consomme toutes les protections restantes ; les coups assommants comptent comme un coup régulier.","paliers_mode":"remplace"}$j$::jsonb WHERE domaine='Guerre' AND nom='Protection contre les Armes Conventionnelles';
UPDATE prieres SET effet_instance = $j${"template":"La cible doit **tenter de blesser le lanceur** par tout moyen ; l'effet cesse dès qu'elle a fait couler son sang."}$j$::jsonb WHERE domaine='Guerre' AND nom='Provocation';
UPDATE prieres SET effet_instance = $j${"template":"Empêche les personnages de **niveau {niveau} ou moins** de s'approcher à moins de 10 pieds (le lanceur choisit qui peut entrer). Il ne doit pas se déplacer ; sans effet sur les projectiles et les sorts."}$j$::jsonb WHERE domaine='Guerre' AND nom='Sanctuaire';
UPDATE prieres SET effet_instance = $j${"template":"Immunise contre les attaques par surprise (annoncer « Annule ») ; le sort prend fin lorsqu'il bloque une attaque.{paliers}","paliers_mode":"cumule"}$j$::jsonb WHERE domaine='Guerre' AND nom='Sens aiguisé';

-- ===== E. EFFET_INSTANCE — NÉCROMANCIE (15) =====
UPDATE prieres SET effet_instance = $j${"template":"Cibles mortes ou comateuses uniquement (les mortes ne peuvent pas résister au sort). **{palier}** Les morts-vivants sont sous le contrôle du lanceur, qui fournit les masques nécessaires ; une cible comateuse s'éveille 1 minute après la fin du sort, sans aucun souvenir.","paliers_mode":"remplace"}$j$::jsonb WHERE domaine='Nécromancie' AND nom='Animation des morts';
UPDATE prieres SET effet_instance = $j${"vars":{"n":{"div":2,"arrondi":"sup"}},"template":"Bouclier absorbant **{n} dégât{s:n} de vol de vie (drainlife)**."}$j$::jsonb WHERE domaine='Nécromancie' AND nom='Bouclier Contre la Mort';
UPDATE prieres SET effet_instance = $j${"template":"Emprisonne dans une **pierre d'âme** l'âme d'un personnage mort de **niveau {niveau} ou moins** ; briser la pierre libère l'âme."}$j$::jsonb WHERE domaine='Nécromancie' AND nom LIKE 'Capture d_Âmes';
UPDATE prieres SET effet_instance = $j${"template":"Interroge un personnage mort (sa tête au minimum requise) : il répond à voix haute. **{palier}** Hors combat uniquement.","paliers_mode":"remplace"}$j$::jsonb WHERE domaine='Nécromancie' AND nom='Communication avec les Cadavres';
UPDATE prieres SET effet_instance = $j${"template":"Communique avec un **fantôme** au choix via un objet lui ayant appartenu : discussion complète, il ne peut pas mentir. Nécessite un animateur."}$j$::jsonb WHERE domaine='Nécromancie' AND nom='Contact avec les Anciens';
UPDATE prieres SET effet_instance = $j${"template":"Les morts-vivants ciblés **obéissent à la lettre** au lanceur. Si la cible est déjà contrôlée (Contrôle ou Animation), ce sort prend le dessus si le sort actif est de **niveau {niveau} ou moins**."}$j$::jsonb WHERE domaine='Nécromancie' AND nom='Contrôle des Morts-Vivants';
UPDATE prieres SET effet_instance = $j${"vars":{"n":{"fois":1}},"template":"Inflige **{n} dégât{s:n} magique{s:n}** aux morts-vivants."}$j$::jsonb WHERE domaine='Nécromancie' AND nom='Destruction des Morts-Vivants';
UPDATE prieres SET effet_instance = $j${"vars":{"x":{"div":5,"arrondi":"inf"}},"template":"Inflige **{x} dégât{s:x}** et soigne le lanceur d'autant, sans dépasser son maximum. À partir du **niveau 20**, le lanceur peut transférer à une cible consentante à 5 pieds les PV gagnés, ainsi qu'une partie de ses propres PV."}$j$::jsonb WHERE domaine='Nécromancie' AND nom='Drain de vie';
UPDATE prieres SET effet_instance = $j${"vars":{"n":{"fois":1}},"template":"Soigne les cibles mortes-vivantes de **{n} point{s:n} de vie**. Sans effet sur les personnages vivants."}$j$::jsonb WHERE domaine='Nécromancie' AND nom='Guérison des Morts-Vivants';
UPDATE prieres SET effet_instance = $j${"template":"Les cibles paraissent **mortes** (aucun signe vital, inspections médicales faussées) sans les empêcher d'agir. **{palier}**","paliers_mode":"remplace"}$j$::jsonb WHERE domaine='Nécromancie' AND nom='Masque Funèbre';
UPDATE prieres SET effet_instance = $j${"template":"Les morts-vivants ciblés sont **incapables de bouger** (sens actifs, parole impossible). Tout dégât reçu dissipe l'effet."}$j$::jsonb WHERE domaine='Nécromancie' AND nom='Paralysie de Morts-Vivants';
UPDATE prieres SET effet_instance = $j${"template":"Zone fixe d'énergie négative : à l'entrée puis chaque minute, les vivants subissent les dégâts et les morts-vivants récupèrent des PV. **{palier}** La régénération ne se cumule pas avec d'autres effets.","paliers_mode":"remplace"}$j$::jsonb WHERE domaine='Nécromancie' AND nom='Puits de Putréfaction';
UPDATE prieres SET effet_instance = $j${"template":"Empêche les morts-vivants de **niveau inférieur à {niveau}** de s'approcher à moins de 5 pieds du lanceur. Affecte tous les morts-vivants, alliés compris."}$j$::jsonb WHERE domaine='Nécromancie' AND nom='Répulsion des morts-vivants';
UPDATE prieres SET effet_instance = $j${"template":"Ramène à la vie, à **1 point de vie**, un personnage mort de **niveau {niveau} ou moins**. Sans effet sur les inconscients ou comateux."}$j$::jsonb WHERE domaine='Nécromancie' AND nom='Retour à la Vie';
UPDATE prieres SET effet_instance = $j${"template":"Les cibles paraissent **vivantes et entières** (signes vitaux simulés). **{palier}**","paliers_mode":"remplace"}$j$::jsonb WHERE domaine='Nécromancie' AND nom='Simulacre de vie';

-- ===== F. COURTES « Niv. » NETTOYÉES (6) =====
UPDATE prieres SET description_courte = $f$Enchante des armes (1 par cible) : dégâts magiques, puis indestructibles et insensibles aux sorts à plus haut niveau. Au plus haut niveau, peut enchanter toutes les armes à 10 pieds.$f$ WHERE domaine='Guerre' AND nom='Arme Magique';
UPDATE prieres SET description_courte = $f$Immunise contre les nouveaux poisons (gravité ↑ avec le niveau, mineur → majeur). À haut niveau, survit même au poison mortel (comateux à 0 PV).$f$ WHERE domaine='Guerre' AND nom='Immunité au Poison';
UPDATE prieres SET description_courte = $f$La douleur n'affecte plus la cible (sans réduire les dégâts). À plus haut niveau, immunise à la Torture puis aux sorts de douleur de niveau inférieur.$f$ WHERE domaine='Guerre' AND nom='Insensibilité à la douleur';
UPDATE prieres SET description_courte = $f$Les cibles peuvent manier des armes à deux mains sans en avoir la compétence. À haut niveau, elles ne peuvent plus être désarmées.$f$ WHERE domaine='Guerre' AND nom='Poigne de fer';
UPDATE prieres SET description_courte = $f$Bloque une attaque par surprise (annoncer « Annule ») : couverture ↑ avec le niveau (pièges → backstab). Le sort prend fin au blocage, sauf au plus haut niveau.$f$ WHERE domaine='Guerre' AND nom='Sens aiguisé';
UPDATE prieres SET description_courte = $f$Inflige 1 → 4 dégâts selon le niveau et soigne le lanceur d'autant (jamais au-delà du max). À haut niveau, peut transférer les PV gagnés à un allié consentant à 5 pieds.$f$ WHERE domaine='Nécromancie' AND nom='Drain de vie';
