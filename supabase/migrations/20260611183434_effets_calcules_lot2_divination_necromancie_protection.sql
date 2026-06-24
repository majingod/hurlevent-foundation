-- ============================================================
-- EFFETS-CALCULES-LOTS-DATA — lot 2 : Divination + Nécromancie + Protection
-- - 29 effet_instance (couverture 100 % des 3 cercles)
-- - DETTE-DB-SORTS : 6 corrections de type (Manuel = canon, validé Fred s164)
-- - Palier 20 de Connaissance des malédictions réécrit en autonome (validé Fred s164)
-- - 5 description_courte nettoyées (queues « Niv. X »)
-- Idempotent : UPDATE à valeur fixe.
-- ============================================================

-- A. DETTE-DB-SORTS : 6 corrections de type
UPDATE public.sorts SET type_sort = 'effet bénéfique' WHERE nom = 'Augure' AND cercle = 'Divination';
UPDATE public.sorts SET type_sort = 'effet bénéfique' WHERE nom = 'Connaissance des malédictions' AND cercle = 'Divination';
UPDATE public.sorts SET type_sort = 'effet bénéfique' WHERE nom = 'Détection des Toxines' AND cercle = 'Divination';
UPDATE public.sorts SET type_sort = 'effet bénéfique' WHERE nom = 'Bouclier Contre la Mort' AND cercle = 'Nécromancie';
UPDATE public.sorts SET type_sort = 'effet' WHERE nom = 'Pieu Spirituel' AND cercle = 'Nécromancie';
UPDATE public.sorts SET type_sort = 'effet' WHERE nom = 'Liberté de Mouvement' AND cercle = 'Protection';

-- B. Palier 20 autonome : Connaissance des malédictions
UPDATE public.sorts SET paliers = $j$[
 {"texte":"Permet de détecter et d'identifier une malédiction mineure.","niveau":11,"libelle":"Niv. 11"},
 {"texte":"Permet de détecter et d'identifier les malédictions mineures et intermédiaires.","niveau":14,"libelle":"Niv. 14"},
 {"texte":"Permet de détecter et d'identifier les malédictions mineures, intermédiaires et majeures.","niveau":18,"libelle":"Niv. 18"},
 {"texte":"Permet de détecter et d'identifier toutes les malédictions, et d'apprendre leur origine (rituel, entité, objet ou sort).","niveau":20,"libelle":"Niv. 20"}
]$j$::jsonb WHERE nom = 'Connaissance des malédictions' AND cercle = 'Divination';

-- C. effet_instance — DIVINATION (10)
UPDATE public.sorts SET effet_instance = $j${"template": "Communique avec un **esprit du type annoncé** à l'incantation : il peut discuter pleinement et ne peut pas mentir. La nature de l'esprit détermine l'efficacité selon le **niveau {niveau}**. Nécessite un animateur."}$j$::jsonb WHERE nom = 'Contact avec les Esprits' AND cercle = 'Divination';
UPDATE public.sorts SET effet_instance = $j${"template": "Confirme la **présence ou l'absence d'une aura magique**, sans en révéler la nature ni la puissance. Objet porté ou aura dissimulée : le **niveau {niveau}** doit égaler ou dépasser celui du porteur ou de l'effet de dissimulation. Identifie aussi les fausses auras."}$j$::jsonb WHERE nom = 'Détection de la magie' AND cercle = 'Divination';
UPDATE public.sorts SET effet_instance = $j${"template": "Identifie la présence et le nom des afflictions de la cible, sans leurs effets ni leur traitement.{paliers}", "paliers_mode": "cumule"}$j$::jsonb WHERE nom = 'Détection des Toxines' AND cercle = 'Divination';
UPDATE public.sorts SET effet_instance = $j${"template": "Les cibles **comprennent et parlent** les langues qui leur sont habituellement inconnues."}$j$::jsonb WHERE nom = 'Don des Langues' AND cercle = 'Divination';
UPDATE public.sorts SET effet_instance = $j${"template": "Révèle le potentiel magique de la cible (objets, potions et effets temporaires exclus).{paliers}", "paliers_mode": "cumule"}$j$::jsonb WHERE nom = 'Sensibilité des Arcanes' AND cercle = 'Divination';
UPDATE public.sorts SET effet_instance = $j${"template": "Immunise contre les sorts d'**Illusion de niveau {niveau} ou moins** ; annoncer « Résiste » quand un sort est ainsi annulé."}$j$::jsonb WHERE nom = 'Vision Lucide' AND cercle = 'Divination';
UPDATE public.sorts SET effet_instance = $j${"template": "Pose **{x} question{s:x}** à une force supérieure (réponse : oui, non ou indécis). Nécessite un animateur.", "vars": {"x": {"div": 2, "arrondi": "sup"}}}$j$::jsonb WHERE nom = 'Augure' AND cercle = 'Divination';
UPDATE public.sorts SET effet_instance = $j${"template": "Scrute la trame magique entourant la cible.{paliers}", "paliers_mode": "cumule"}$j$::jsonb WHERE nom = 'Détection runique' AND cercle = 'Divination';
UPDATE public.sorts SET effet_instance = $j${"template": "Identifie les **écoles et domaines** des sorts actifs sur la cible, sans en connaître les effets précis, la durée restante ni le niveau."}$j$::jsonb WHERE nom = 'Vision de la magie' AND cercle = 'Divination';
UPDATE public.sorts SET effet_instance = $j${"template": "Scrute les flux magiques de la cible ; si aucune malédiction n'est présente, le lanceur en a la certitude. **{palier}**", "paliers_mode": "remplace"}$j$::jsonb WHERE nom = 'Connaissance des malédictions' AND cercle = 'Divination';

-- D. effet_instance — NÉCROMANCIE (10)
UPDATE public.sorts SET effet_instance = $j${"template": "Cibles mortes ou comateuses uniquement (les mortes ne peuvent pas résister au sort). **{palier}** Les morts-vivants sont sous le contrôle du lanceur, qui fournit les masques nécessaires ; une cible comateuse s'éveille 1 minute après la fin du sort, sans aucun souvenir.", "paliers_mode": "remplace"}$j$::jsonb WHERE nom = 'Animation des morts' AND cercle = 'Nécromancie';
UPDATE public.sorts SET effet_instance = $j${"template": "Bouclier annulant **{x} dégât{s:x} de vol de vie** (drainlife) ; disparaît à la fin du sort.", "vars": {"x": {"div": 2, "arrondi": "sup"}}}$j$::jsonb WHERE nom = 'Bouclier Contre la Mort' AND cercle = 'Nécromancie';
UPDATE public.sorts SET effet_instance = $j${"template": "Interroge un personnage **mort** (s'il possède au moins sa tête) : il répond à voix haute et peut donner des réponses complexes. Le lanceur peut poser **{x} question{s:x}**. Impossible durant un combat.", "vars": {"x": {"div": 5, "arrondi": "inf", "plus": 1}}}$j$::jsonb WHERE nom = 'Communication avec les Cadavres' AND cercle = 'Nécromancie';
UPDATE public.sorts SET effet_instance = $j${"template": "Inflige **{x} dégât{s:x} magiques** à tout mort-vivant affecté.", "vars": {"x": {"fois": 1}}}$j$::jsonb WHERE nom = 'Destruction des Morts-Vivants' AND cercle = 'Nécromancie';
UPDATE public.sorts SET effet_instance = $j${"template": "Les cibles paraissent **mortes** (aucun signe vital) ; toute action évidente (mouvement ou parole) met immédiatement fin au sort. **{palier}**", "paliers_mode": "remplace"}$j$::jsonb WHERE nom = 'Masque Funèbre' AND cercle = 'Nécromancie';
UPDATE public.sorts SET effet_instance = $j${"template": "Les cibles intangibles **redeviennent tangibles** et ne peuvent plus redevenir intangibles pour la durée du sort."}$j$::jsonb WHERE nom = 'Pieu Spirituel' AND cercle = 'Nécromancie';
UPDATE public.sorts SET effet_instance = $j${"template": "Les morts-vivants affectés **obéissent à la lettre**, même au péril de leur destruction. Si la cible est déjà contrôlée ou animée, le **niveau {niveau}** doit être supérieur au sort déjà actif."}$j$::jsonb WHERE nom = 'Contrôle des morts-vivants' AND cercle = 'Nécromancie';
UPDATE public.sorts SET effet_instance = $j${"template": "Inflige **{x} dégât{s:x}** et soigne le lanceur d'autant, sans dépasser son maximum. À partir du **niveau 20**, les PV gagnés peuvent être transférés à une cible consentante à 5 pieds.", "vars": {"x": {"div": 5, "arrondi": "inf"}}}$j$::jsonb WHERE nom = 'Drain de vie' AND cercle = 'Nécromancie';
UPDATE public.sorts SET effet_instance = $j${"template": "Les morts-vivants de **niveau inférieur à {niveau}** n'attaquent pas les cibles ; ils peuvent seulement les déplacer si elles leur barrent le chemin."}$j$::jsonb WHERE nom = 'Protection Contre les Morts-Vivants' AND cercle = 'Nécromancie';
UPDATE public.sorts SET effet_instance = $j${"template": "Emprisonne l'âme d'un personnage **mort** dans une pierre d'âme, si le **niveau {niveau}** égale ou dépasse celui du personnage. Une pierre brisée libère l'âme."}$j$::jsonb WHERE nom = $n$Capture d'Âmes$n$ AND cercle = 'Nécromancie';

-- E. effet_instance — PROTECTION (9)
UPDATE public.sorts SET effet_instance = $j${"template": "Les cibles résistent aux pièges avec le **niveau {niveau}** du sort au lieu du leur."}$j$::jsonb WHERE nom = 'Alerte du Danger' AND cercle = 'Protection';
UPDATE public.sorts SET effet_instance = $j${"template": "Immunise contre l'enchevêtrement, la paralysie, la pétrification et la maladresse de **niveau inférieur à {niveau}** ; ne dissipe pas les effets déjà en cours."}$j$::jsonb WHERE nom = 'Liberté de Mouvement' AND cercle = 'Protection';
UPDATE public.sorts SET effet_instance = $j${"template": "Immunise contre les effets de **paralysie de niveau {niveau} ou moins** (la pétrification est un effet distinct)."}$j$::jsonb WHERE nom = 'Protection contre la Paralysie' AND cercle = 'Protection';
UPDATE public.sorts SET effet_instance = $j${"template": "Encaisse sans dégâts les **{x} prochain{s:x} coup{s:x}** d'armes conventionnelles non magiques (coups assommants compris). Une attaque sournoise est bloquée mais consomme toutes les protections restantes.", "vars": {"x": {"div": 5, "arrondi": "inf", "plus": 1}}}$j$::jsonb WHERE nom = 'Protection contre les Armes Conventionnelles' AND cercle = 'Protection';
UPDATE public.sorts SET effet_instance = $j${"template": "**{palier}** La cible n'est pas obligée de répondre à l'hypnotiseur et peut mentir ou dire la vérité, sans avoir à annoncer « Résiste ».", "paliers_mode": "remplace"}$j$::jsonb WHERE nom = 'Esprit impénétrable' AND cercle = 'Protection';
UPDATE public.sorts SET effet_instance = $j${"template": "Le lanceur **encaisse à la place de la cible** les dégâts qui lui seraient infligés, tant qu'il la regarde."}$j$::jsonb WHERE nom = 'Gardien Cabalistique' AND cercle = 'Protection';
UPDATE public.sorts SET effet_instance = $j${"template": "Bloque **{x} dégât{s:x}** d'énergie négative et de drain de vie.", "vars": {"x": {"div": 2, "arrondi": "sup"}}}$j$::jsonb WHERE nom = 'Protection contre les Effets Négatifs' AND cercle = 'Protection';
UPDATE public.sorts SET effet_instance = $j${"template": "Les personnages de **niveau inférieur à {niveau}** ne peuvent pas approcher à moins de 10 pieds du lanceur ; ne bloque ni les sorts, ni les prières, ni les armes à distance."}$j$::jsonb WHERE nom = 'Répulsion' AND cercle = 'Protection';
UPDATE public.sorts SET effet_instance = $j${"template": "Tout **coup de grâce** contre la cible doit être de **niveau supérieur à {niveau}**."}$j$::jsonb WHERE nom = 'Lien avec le monde vivant' AND cercle = 'Protection';

-- F. description_courte nettoyées (5)
UPDATE public.sorts SET description_courte = $t$Révèle si la cible peut lancer des sorts et l'origine de son pouvoir (magique/divin) ; à haut niveau, ses écoles/domaines puis son niveau de maîtrise.$t$ WHERE nom = 'Sensibilité des Arcanes' AND cercle = 'Divination';
UPDATE public.sorts SET description_courte = $t$Détecte les assemblages runiques sur la cible (corps puis équipement) ; à haut niveau, les identifie tous et peut les bloquer temporairement.$t$ WHERE nom = 'Détection runique' AND cercle = 'Divination';
UPDATE public.sorts SET description_courte = $t$Détecte et identifie une malédiction (puissance + effets généraux), de mineure à majeure selon le niveau, jusqu'à son origine ; ne peut pas la lever.$t$ WHERE nom = 'Connaissance des malédictions' AND cercle = 'Divination';
UPDATE public.sorts SET description_courte = $t$Fait paraître les cibles mortes (signes vitaux absents) ; toute action visible rompt l'effet. Trompe la compétence Diagnostic selon le niveau.$t$ WHERE nom = 'Masque Funèbre' AND cercle = 'Nécromancie';
UPDATE public.sorts SET description_courte = $t$Inflige 1 → 4 dégâts selon le niveau et soigne le lanceur d'autant ; au plus haut niveau, peut transférer les PV gagnés à un allié.$t$ WHERE nom = 'Drain de vie' AND cercle = 'Nécromancie';
