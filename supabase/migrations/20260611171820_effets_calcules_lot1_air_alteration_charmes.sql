-- ============================================================
-- EFFETS-CALCULES-LOTS-DATA — lot 1 : Air + Altération + Charmes
-- - 24 effet_instance (les 7 du lot 0 s162 restent inchangés)
-- - Correction niveau : Nuage de Mort 1 -> 11 (Manuel autoritaire, validé Fred)
-- - 9 description_courte nettoyées (queues « Niv. X »)
-- Idempotent : UPDATE à valeur fixe.
-- ============================================================

-- A. DETTE-DB-SORTS : Nuage de Mort 1 -> 11
UPDATE public.sorts SET niveau = 11 WHERE nom = 'Nuage de Mort' AND cercle = 'Air';

-- B. effet_instance — AIR (7)
UPDATE public.sorts SET effet_instance = $j${"template": "Toute personne dans le rayon tombe **inconsciente pendant 5 minutes**. Impossible de la réveiller en la bougeant ou en lui parlant : seuls des dégâts ou une dissipation de la magie brisent l'effet."}$j$::jsonb WHERE nom = 'Nuage de Mort' AND cercle = 'Air';
UPDATE public.sorts SET effet_instance = $j${"template": "Inflige **{palier}**", "paliers_mode": "remplace"}$j$::jsonb WHERE nom = 'Rayon Électrique' AND cercle = 'Air';
UPDATE public.sorts SET effet_instance = $j${"template": "Chaque arme enchantée (1 par cible) peut repousser de 5 pieds, vers l'arrière uniquement : **{palier}**", "paliers_mode": "remplace"}$j$::jsonb WHERE nom = 'Tornade Martiale' AND cercle = 'Air';
UPDATE public.sorts SET effet_instance = $j${"template": "La cible tombe au sol et **suffoque** : incapable de parler, d'incanter, d'attaquer ou d'utiliser des compétences. Elle peut seulement se déplacer lentement."}$j$::jsonb WHERE nom = 'Asphyxie' AND cercle = 'Air';
UPDATE public.sorts SET effet_instance = $j${"template": "Les cibles deviennent une **brume intangible** : déplacement libre (sans courir), aucune interaction physique, incapables d'attaquer, de se défendre ou d'incanter. Seules la **magie pure** et les armes frappant magique les affectent."}$j$::jsonb WHERE nom = 'Forme de Brume' AND cercle = 'Air';
UPDATE public.sorts SET effet_instance = $j${"template": "Inflige **{x} dégât{s:x} de foudre** à toute cible de la zone, alliés compris. À partir du **niveau 20**, les alliés du lanceur ne sont plus touchés.", "vars": {"x": {"div": 3, "arrondi": "inf", "plus": 1}}}$j$::jsonb WHERE nom = 'Tempête de Foudre' AND cercle = 'Air';
UPDATE public.sorts SET effet_instance = $j${"template": "Le lanceur doit toucher sa cible pendant l'incantation. **{palier}**", "paliers_mode": "remplace"}$j$::jsonb WHERE nom = 'Toucher Foudroyant' AND cercle = 'Air';

-- C. effet_instance — ALTÉRATION (8)
UPDATE public.sorts SET effet_instance = $j${"template": "Le ou les objets ciblés deviennent **intangibles** et ne peuvent plus être saisis. Objet porté : le **niveau {niveau}** du sort s'oppose au niveau du porteur ; une armure rendue intangible ne donne plus ses points.{paliers}", "paliers_mode": "cumule"}$j$::jsonb WHERE nom = 'État Instable' AND cercle = 'Altération';
UPDATE public.sorts SET effet_instance = $j${"template": "L'objet ciblé devient si fragile qu'il **se brise au moindre dégât** pris ou bloqué. Objet porté : le **niveau {niveau}** du sort s'oppose au niveau du porteur.{paliers}", "paliers_mode": "cumule"}$j$::jsonb WHERE nom = 'Fragilité' AND cercle = 'Altération';
UPDATE public.sorts SET effet_instance = $j${"template": "Les cibles deviennent **intangibles**, comme des fantômes : visibles mais intouchables, aucune interaction physique, incapables d'attaquer, de se défendre ou d'incanter contre le tangible. Seules la **magie pure** et les armes frappant magique les affectent."}$j$::jsonb WHERE nom = 'Intangibilité' AND cercle = 'Altération';
UPDATE public.sorts SET effet_instance = $j${"template": "La cible est ralentie à **50 % de sa vitesse** : ses coups n'infligent aucun dégât, déplacement en marche lente, voix incompréhensible."}$j$::jsonb WHERE nom = 'Lenteur' AND cercle = 'Altération';
UPDATE public.sorts SET effet_instance = $j${"template": "La cible se prend pour **l'animal choisi** par le lanceur (comportement seul, pas d'apparence) : aucune compétence ni équipement utilisable. Elle garde le souvenir à la fin."}$j$::jsonb WHERE nom = 'Demi-morphisme' AND cercle = 'Altération';
UPDATE public.sorts SET effet_instance = $j${"template": "Le ou les objets ciblés deviennent **indestructibles** : protégés contre la destruction et la Fragilité, sauf face à un sort de **niveau supérieur à {niveau}**."}$j$::jsonb WHERE nom = 'Indestructibilité' AND cercle = 'Altération';
UPDATE public.sorts SET effet_instance = $j${"template": "Les cibles sont **paralysées** : immobiles et muettes, vue et ouïe intactes. L'effet se dissipe si la cible subit des dégâts."}$j$::jsonb WHERE nom = 'Paralysie' AND cercle = 'Altération';
UPDATE public.sorts SET effet_instance = $j${"template": "Les cibles subissent un **vieillissement accéléré** : trop affaiblies pour se battre ou incanter, déplacements lents et incertains (jouer la grande fatigue).{paliers}", "paliers_mode": "cumule"}$j$::jsonb WHERE nom = 'Vieillissement' AND cercle = 'Altération';

-- D. effet_instance — CHARMES (9)
UPDATE public.sorts SET effet_instance = $j${"template": "Les cibles deviennent **hostiles** envers le lanceur : elles se mettent à le détester (sans aller jusqu'à le tuer)."}$j$::jsonb WHERE nom = 'Antipathie' AND cercle = 'Charmes';
UPDATE public.sorts SET effet_instance = $j${"template": "Les cibles cherchent par tous les moyens à **s'emparer de l'objet désigné** et à le garder, de la supercherie jusqu'à tuer selon leur caractère. Prend fin si la cible tombe inconsciente."}$j$::jsonb WHERE nom = 'Avidité' AND cercle = 'Charmes';
UPDATE public.sorts SET effet_instance = $j${"template": "Les cibles doivent **fixer leur attention sur le lanceur** tant qu'il parle ou se donne en spectacle. S'il s'arrête, l'effet cesse ; une cible blessée ou bousculée est libérée."}$j$::jsonb WHERE nom = 'Discours captivant' AND cercle = 'Charmes';
UPDATE public.sorts SET effet_instance = $j${"template": "La cible est **abrutie** : phrases de 5 mots max, compte jusqu'à 5, aucun sort, prière ni compétence. Réflexes de défense conservés."}$j$::jsonb WHERE nom = 'Esprit du Simplet' AND cercle = 'Charmes';
UPDATE public.sorts SET effet_instance = $j${"template": "La cible est prise d'un **fou rire incontrôlable** : incapable d'attaquer ou d'incanter, et peine à se défendre.{paliers}", "paliers_mode": "cumule"}$j$::jsonb WHERE nom = 'Fou Rire Incessant' AND cercle = 'Charmes';
UPDATE public.sorts SET effet_instance = $j${"template": "Une créature vivante **non humanoïde** considère le lanceur comme une autorité : elle obéit selon ses capacités, sans jamais se mettre en danger de mort."}$j$::jsonb WHERE nom = 'Envoûtement de Créature' AND cercle = 'Charmes';
UPDATE public.sorts SET effet_instance = $j${"template": "La cible est **incapable de dire la vérité**, à l'oral comme à l'écrit, et résiste aux effets de vérité de **niveau inférieur à {niveau}**."}$j$::jsonb WHERE nom = 'Mensonge' AND cercle = 'Charmes';
UPDATE public.sorts SET effet_instance = $j${"template": "**{palier}** L'oubli est permanent, indétectable et inannulable ; une même personne ne peut être affectée qu'une fois par événement.", "paliers_mode": "remplace"}$j$::jsonb WHERE nom = 'Oubli' AND cercle = 'Charmes';
UPDATE public.sorts SET effet_instance = $j${"template": "Les cibles sombrent dans un **sommeil profond** ; réveil au moindre dégât ou contact sur leur corps.{paliers}", "paliers_mode": "cumule"}$j$::jsonb WHERE nom = 'Sommeil' AND cercle = 'Charmes';

-- E. description_courte nettoyées (9)
UPDATE public.sorts SET description_courte = $t$Bloque 1 → 6 projectiles physiques selon le niveau.$t$ WHERE nom = $n$Globe d'Air$n$ AND cercle = 'Air';
UPDATE public.sorts SET description_courte = $t$Inflige 3 → 7 dégâts de foudre à toute la zone (alliés compris) selon le niveau.$t$ WHERE nom = 'Tempête de Foudre' AND cercle = 'Air';
UPDATE public.sorts SET description_courte = $t$Donne aux cibles un trait racial d'une race au choix (costume requis).$t$ WHERE nom = 'Altération du Corps' AND cercle = 'Altération';
UPDATE public.sorts SET description_courte = $t$Rend des objets intangibles, donc insaisissables (objet porté : niveau du sort vs porteur ; armure perd ses points).$t$ WHERE nom = 'État Instable' AND cercle = 'Altération';
UPDATE public.sorts SET description_courte = $t$Rend un objet si fragile qu'il se brise au moindre dégât ; matériaux affectés selon le niveau.$t$ WHERE nom = 'Fragilité' AND cercle = 'Altération';
UPDATE public.sorts SET description_courte = $t$L'objet ciblé ne peut plus être soulevé (objet porté : niveau du sort vs porteur).$t$ WHERE nom = 'Augmentation du poids' AND cercle = 'Altération';
UPDATE public.sorts SET description_courte = $t$Vieillit les cibles : trop affaiblies pour se battre ou lancer des sorts, déplacements lents.$t$ WHERE nom = 'Vieillissement' AND cercle = 'Altération';
UPDATE public.sorts SET description_courte = $t$Prise d'un fou rire : la cible ne peut ni attaquer ni lancer de sort et peine à se défendre.$t$ WHERE nom = 'Fou Rire Incessant' AND cercle = 'Charmes';
UPDATE public.sorts SET description_courte = $t$Plonge les cibles dans un sommeil profond ; réveil au moindre dégât ou contact.$t$ WHERE nom = 'Sommeil' AND cercle = 'Charmes';
