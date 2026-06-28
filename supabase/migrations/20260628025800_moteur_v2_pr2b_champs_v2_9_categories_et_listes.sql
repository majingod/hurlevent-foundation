-- MOTEUR V2 — PR2b : généralisation aux 9 dernières catégories (-> 14/14).
-- ADDITIF · ADMIN-GATED · prod intacte. champs_v2 lu UNIQUEMENT par FicheMoteur2.
-- LIVE lit champs (v1) + filtre .in(classe,race,trait_racial,sorts,prieres,assemblages)
-- -> races/traits/classes/prieres/assemblages : on n'ÉCRIT QUE champs_v2 (champs intact).
-- religions/lore/alchimie/joaillerie : hors filtre live -> invisibles au LIVE.
-- Idempotent : ON CONFLICT (categorie) DO UPDATE ; UPDATE joaillerie filtré sur vides.

-- ───────────────────────────────────────────────────────────────────────────
-- A) JOAILLERIE — doublons (choix Fred s288) : resume_condense = description.
--    Le verbatim étant déjà 1 phrase, abrégé == intégral (toggle aux 2 côtés identiques).
UPDATE public.objets_joaillerie
SET resume_condense = description
WHERE est_actif AND (resume_condense IS NULL OR btrim(resume_condense) = '');

-- ───────────────────────────────────────────────────────────────────────────
-- B) SEEDS champs_v2 — 5 catégories LIVE : PORTAGE EXACT du schéma v1 (rétro-compat).
--    (FicheMoteur2 rend déjà chips/bloc_maitrise/liste_competences/liste_traits/paliers.)

-- RACE — copie v1 à l'identique.
INSERT INTO public.fiches_schemas (categorie, champs, champs_v2) VALUES
('race', '[]'::jsonb, $json$[{"c":{"source":"col:resume_condense"},"v":{"source":"col:description"},"cle":"lore","type":"texte","label":"Description"},{"cle":"xp_depart","type":"mecanique","icone":"✨","label":"XP de départ","source":"col:xp_depart","suffixe":"XP"},{"cle":"esperance_vie","type":"mecanique","icone":"🕰️","label":"Espérance de vie","source":"col:esperance_vie"},{"cle":"nb_traits_raciaux","type":"mecanique","icone":"🎁","label":"Trait racial offert","source":"col:nb_traits_raciaux"},{"cle":"traits_permis","type":"mecanique","label":"Traits raciaux permis","render":"liste_traits","source":"col:traits_permis"},{"c":{"source":"col:exigences_costume"},"v":{"source":"col:exigences_costume"},"cle":"exigences_costume","type":"texte","titre":"Exigences de costume"}]$json$::jsonb)
ON CONFLICT (categorie) DO UPDATE SET champs_v2 = EXCLUDED.champs_v2, mis_a_jour = now();

-- TRAIT_RACIAL — copie v1.
INSERT INTO public.fiches_schemas (categorie, champs, champs_v2) VALUES
('trait_racial', '[]'::jsonb, $json$[{"cle":"cout","type":"mecanique","icone":"🎓","label":"Coût","source":"col:cout_xp","suffixe":"XP"},{"c":{"source":"col:resume_condense"},"v":{"source":"col:texte_manuel"},"cle":"effet","type":"texte","label":"Effet"}]$json$::jsonb)
ON CONFLICT (categorie) DO UPDATE SET champs_v2 = EXCLUDED.champs_v2, mis_a_jour = now();

-- CLASSE — copie v1 (densités E/D conservées).
INSERT INTO public.fiches_schemas (categorie, champs, champs_v2) VALUES
('classe', '[]'::jsonb, $json$[{"c":{"source":"col:resume_condense","densite":"E"},"v":{"source":"col:description","densite":"D"},"cle":"lore","type":"texte","label":"Description"},{"cle":"pv_depart","type":"mecanique","icone":"❤️","label":"Points de Vie de départ","source":"col:pv_depart","densite":"E","suffixe":"PV"},{"cle":"ps_depart","type":"mecanique","icone":"✨","label":"Points de Spiritualité de départ","source":"col:ps_depart","densite":"E","suffixe":"PS"},{"cle":"competences_gratuites","type":"mecanique","label":"Compétences gratuites","render":"liste_competences","source":"col:competences_gratuites","densite":"E"}]$json$::jsonb)
ON CONFLICT (categorie) DO UPDATE SET champs_v2 = EXCLUDED.champs_v2, mis_a_jour = now();

-- PRIERES — copie v1 + AJOUT paliers en primitive `liste` (comme sorts).
INSERT INTO public.fiches_schemas (categorie, champs, champs_v2) VALUES
('prieres', '[]'::jsonb, $json$[{"c":{"source":"col:resume_condense"},"v":{"source":"col:description"},"cle":"lore","type":"texte","label":"Description"},{"cle":"niveau","type":"mecanique","icone":"📈","label":"Niveau minimal","source":"col:niveau"},{"cle":"type_priere","type":"mecanique","icone":"✴️","label":"Type","source":"col:type_priere"},{"cle":"zone_effet","type":"mecanique","icone":"🎯","label":"Type de cible","source":"col:zone_effet"},{"cle":"portee","type":"mecanique","icone":"📏","label":"Distance max.","source":"col:portee"},{"cle":"duree","type":"mecanique","icone":"⏳","label":"Durée max.","source":"col:duree"},{"cle":"cout_xp_base","type":"mecanique","icone":"✖️","label":"Coefficient","format":"coefficient","source":"col:cout_xp_base"},{"cle":"paliers","type":"mecanique","render":"liste","titre":"Paliers de niveau","source":"col:paliers","item":{"primaire":"libelle","secondaire":"texte"}}]$json$::jsonb)
ON CONFLICT (categorie) DO UPDATE SET champs_v2 = EXCLUDED.champs_v2, mis_a_jour = now();

-- ASSEMBLAGES — copie v1.
INSERT INTO public.fiches_schemas (categorie, champs, champs_v2) VALUES
('assemblages', '[]'::jsonb, $json$[{"c":{"source":"col:resume_condense"},"v":{"source":"col:texte_manuel"},"cle":"lore","type":"texte","label":"Description"},{"cle":"runes","type":"mecanique","label":"Runes requises","render":"chips","source":"col:runes_requises"},{"cle":"cible","type":"mecanique","icone":"🎯","label":"Cible","source":"col:cible"},{"cle":"duree","type":"mecanique","icone":"⏳","label":"Durée","source":"col:duree"},{"cle":"cout_xp","type":"mecanique","icone":"📜","label":"Apprentissage","source":"col:cout_xp","suffixe":"XP"},{"cle":"cout_ps","type":"mecanique","icone":"✨","label":"Activation","source":"col:cout_ps","suffixe":"PS"},{"cle":"maitrise","type":"mecanique","badge":"Niveau 3","label":"Maîtrise","render":"bloc_maitrise","source":"col:effet_maitrise","source_cout":"col:cout_ps_maitrise","suffixe_cout":"PS"}]$json$::jsonb)
ON CONFLICT (categorie) DO UPDATE SET champs_v2 = EXCLUDED.champs_v2, mis_a_jour = now();

-- ───────────────────────────────────────────────────────────────────────────
-- C) SEEDS champs_v2 — catégories CUSTOM (hors filtre live).

-- JOAILLERIE — copie v1 ; lore passe en swap resume_condense/description (doublons).
INSERT INTO public.fiches_schemas (categorie, champs, champs_v2) VALUES
('joaillerie', '[]'::jsonb, $json$[{"c":{"source":"col:resume_condense"},"v":{"source":"col:description"},"cle":"lore","type":"texte","label":"Description"},{"cle":"effet","type":"mecanique","icone":"✨","label":"Effet","source":"col:effet"},{"cle":"fabrication","type":"mecanique","label":"Fabrication","render":"paliers","paliers":[{"tier":"Métaux communs","icone":"🔩","temps":"col:temps_fabrication_minutes","verrou":"Joaillerie 1","recette":"col:materiaux_communs"},{"tier":"Métaux rares","icone":"💎","temps":"col:temps_rare_minutes","verrou":"Joaillerie 2","recette":"col:materiaux_rares"}]}]$json$::jsonb)
ON CONFLICT (categorie) DO UPDATE SET champs_v2 = EXCLUDED.champs_v2, mis_a_jour = now();

-- RELIGIONS — mode aucun (pas d'abrégé) : fondateur + section (description_longue).
INSERT INTO public.fiches_schemas (categorie, champs, champs_v2) VALUES
('religions', '[]'::jsonb, $json$[{"cle":"fondateur","type":"mecanique","icone":"👤","label":"Fondateur","source":"col:fondateur"},{"cle":"description","type":"mecanique","render":"section","titre":"Description","source":"col:description_longue"}]$json$::jsonb)
ON CONFLICT (categorie) DO UPDATE SET champs_v2 = EXCLUDED.champs_v2, mis_a_jour = now();

-- LORE — mode aucun : section (description). sous_titre s'affiche sur la carte de liste.
INSERT INTO public.fiches_schemas (categorie, champs, champs_v2) VALUES
('lore', '[]'::jsonb, $json$[{"cle":"description","type":"mecanique","render":"section","titre":"Description","source":"col:description"}]$json$::jsonb)
ON CONFLICT (categorie) DO UPDATE SET champs_v2 = EXCLUDED.champs_v2, mis_a_jour = now();

-- ALCHIMIE — swap : abrégé = resume_condense ; intégral = RecetteSections (render délégué `recette`).
--   Le render `recette` réutilise le pipeline validé parseRecetteVerbatim (utils/alchimie.ts).
INSERT INTO public.fiches_schemas (categorie, champs, champs_v2) VALUES
('alchimie', '[]'::jsonb, $json$[{"cle":"niveau_requis","type":"mecanique","icone":"📈","label":"Niveau requis","source":"col:niveau_requis"},{"cle":"type","type":"mecanique","icone":"⚗️","label":"Type","source":"col:type"},{"cle":"cout_xp","type":"mecanique","icone":"🎓","label":"Apprentissage","source":"col:cout_xp","suffixe":"XP"},{"cle":"recette","type":"mecanique","render":"recette","toggle":"swap","abrege":{"source":"col:resume_condense"}}]$json$::jsonb)
ON CONFLICT (categorie) DO UPDATE SET champs_v2 = EXCLUDED.champs_v2, mis_a_jour = now();

-- ───────────────────────────────────────────────────────────────────────────
-- D) SEEDS fiches_listes — 9 configs. source/fiche = categorie (implicite).
INSERT INTO public.fiches_listes (categorie, recherche, navigation, carte, annexes) VALUES
('races',
 $json$["nom"]$json$::jsonb, $json$[]$json$::jsonb,
 $json${"titre":"nom","sousTitre":"resume_condense","emoji":"emoji","mode":"swap"}$json$::jsonb, $json$[]$json$::jsonb),
('traits',
 $json$["nom"]$json$::jsonb, $json$[]$json$::jsonb,
 $json${"titre":"nom","sousTitre":"resume_condense","badges":["cout_xp"],"mode":"swap"}$json$::jsonb, $json$[]$json$::jsonb),
('classes',
 $json$["nom"]$json$::jsonb, $json$[]$json$::jsonb,
 $json${"titre":"nom","sousTitre":"resume_condense","emoji":"emoji","mode":"swap"}$json$::jsonb, $json$[]$json$::jsonb),
('prieres',
 $json$["nom"]$json$::jsonb,
 $json$[{"axe":"onglets","champ":"domaine","valeurs":"auto"}]$json$::jsonb,
 $json${"titre":"nom","sousTitre":"resume_condense","badges":["niveau"],"mode":"swap"}$json$::jsonb, $json$[]$json$::jsonb),
('assemblages',
 $json$["nom"]$json$::jsonb, $json$[]$json$::jsonb,
 $json${"titre":"nom","sousTitre":"resume_condense","badges":["effet"],"mode":"swap"}$json$::jsonb, $json$[]$json$::jsonb),
('joaillerie',
 $json$["nom"]$json$::jsonb, $json$[]$json$::jsonb,
 $json${"titre":"nom","sousTitre":"resume_condense","badges":["effet"],"mode":"swap"}$json$::jsonb, $json$[]$json$::jsonb),
('religions',
 $json$["nom"]$json$::jsonb, $json$[]$json$::jsonb,
 $json${"titre":"nom","sousTitre":"fondateur","mode":"aucun"}$json$::jsonb, $json$[]$json$::jsonb),
('lore',
 $json$["nom"]$json$::jsonb,
 $json$[{"axe":"groupe","champ":"categorie","mode":"section"}]$json$::jsonb,
 $json${"titre":"nom","sousTitre":"sous_titre","mode":"aucun"}$json$::jsonb, $json$[]$json$::jsonb),
('alchimie',
 $json$["nom"]$json$::jsonb,
 $json$[{"axe":"filtre","champ":"type","mode":"exclusif","libelles":{"potion":"Potions","poison":"Poisons"}},{"axe":"filtre","champ":"niveau_requis","mode":"select","libelle":"Niveau"}]$json$::jsonb,
 $json${"titre":"nom","sousTitre":"resume_condense","badges":["type"],"mode":"swap"}$json$::jsonb, $json$[]$json$::jsonb)
ON CONFLICT (categorie) DO UPDATE SET
  recherche = EXCLUDED.recherche, navigation = EXCLUDED.navigation,
  carte = EXCLUDED.carte, annexes = EXCLUDED.annexes, mis_a_jour = now();
