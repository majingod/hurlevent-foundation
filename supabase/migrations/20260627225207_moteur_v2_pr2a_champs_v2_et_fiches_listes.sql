-- MOTEUR V2 — PR2a : moteur de fiche schema-driven (champs_v2) + configs de liste.
-- ADDITIF · ADMIN-GATED · prod intacte. La colonne champs_v2 est lue UNIQUEMENT par
-- FicheMoteur2/EncyclopedieV2. Le LIVE lit champs (v1) et filtre .in(classe,race,
-- trait_racial,sorts,prieres,assemblages) -> zero impact. EXPAND/CONTRACT : PR3 swappera.
-- Idempotent : ADD COLUMN IF NOT EXISTS + ON CONFLICT (categorie) DO UPDATE.

-- 1) EXPAND : nouvelle colonne, ne touche pas champs (v1).
ALTER TABLE public.fiches_schemas ADD COLUMN IF NOT EXISTS champs_v2 jsonb;

-- 2) SEEDS champs_v2 (5 temoins). Pour sorts/forge (lignes existantes) le ON CONFLICT
--    ne met a jour QUE champs_v2 -> champs (v1) preserve. Pour competences/pieges/
--    bestiaire (nouvelles lignes) champs = '[]' (jamais lu en live pour ces categories).

-- SORTS : retro-compat v1 (memes champs) + primitive `liste` (paliers) + toggle swap.
INSERT INTO public.fiches_schemas (categorie, champs, champs_v2) VALUES
('sorts', '[]'::jsonb, $json$[
  {"cle":"lore","type":"texte","label":"Description","toggle":"swap","c":{"source":"col:resume_condense"},"v":{"source":"col:description"}},
  {"cle":"niveau","type":"mecanique","icone":"📈","label":"Niveau minimal","source":"col:niveau"},
  {"cle":"type_sort","type":"mecanique","icone":"✴️","label":"Type","source":"col:type_sort"},
  {"cle":"zone_effet","type":"mecanique","icone":"🎯","label":"Type de cible","source":"col:zone_effet"},
  {"cle":"portee","type":"mecanique","icone":"📏","label":"Distance max.","source":"col:portee"},
  {"cle":"duree","type":"mecanique","icone":"⏳","label":"Durée max.","source":"col:duree"},
  {"cle":"cout_xp_base","type":"mecanique","icone":"✖️","label":"Coefficient","format":"coefficient","source":"col:cout_xp_base"},
  {"cle":"paliers","type":"mecanique","render":"liste","titre":"Paliers de niveau","source":"col:paliers","item":{"primaire":"libelle","secondaire":"texte"}}
]$json$::jsonb)
ON CONFLICT (categorie) DO UPDATE SET champs_v2 = EXCLUDED.champs_v2, mis_a_jour = now();

-- COMPETENCES : toggle peek (`liste` niveaux, verbatim depliable) + `relation` prerequis (denormalise).
INSERT INTO public.fiches_schemas (categorie, champs, champs_v2) VALUES
('competences', '[]'::jsonb, $json$[
  {"cle":"resume","type":"texte","label":"","toggle":"aucun","v":{"source":"col:resume_condense"}},
  {"cle":"niveaux","type":"mecanique","render":"liste","toggle":"peek","titre":"Niveaux","source":"col:niveaux","item":{"primaire":"niveau","prefixe":"Niveau ","meta_xp":"cout_xp","suffixe_xp":"XP","verbatim":"description"}},
  {"cle":"prerequis","type":"mecanique","render":"relation","titre":"Prérequis","source":"col:prerequis_competences","relation":{"forme":"par_niveau","denormalise":"competence_nom","niveau_min":"niveau_min"}}
]$json$::jsonb)
ON CONFLICT (categorie) DO UPDATE SET champs_v2 = EXCLUDED.champs_v2, mis_a_jour = now();

-- FORGE : toggle swap + `section` materiaux + `si_flag` non_reparable + `relation` reparation (FK injectee).
INSERT INTO public.fiches_schemas (categorie, champs, champs_v2) VALUES
('forge', '[]'::jsonb, $json$[
  {"cle":"type","type":"mecanique","label":"Type","source":"col:type"},
  {"cle":"prise","type":"mecanique","label":"Prise","source":"col:prise"},
  {"cle":"emplacement","type":"mecanique","label":"Emplacement","source":"col:emplacement"},
  {"cle":"degats_membre","type":"mecanique","label":"Dégâts membre","source":"col:degats_membre"},
  {"cle":"degats_torse","type":"mecanique","label":"Dégâts torse","source":"col:degats_torse"},
  {"cle":"points_armure","type":"mecanique","label":"Points d'armure","source":"col:points_armure"},
  {"cle":"effet","type":"mecanique","label":"Effet","source":"col:effet"},
  {"cle":"fabrication","type":"mecanique","label":"Fabrication","suffixe":"min","source":"col:temps_fabrication_minutes"},
  {"cle":"materiaux","type":"mecanique","render":"section","titre":"Matériaux","lignes":[{"label":"Commun","source":"col:materiaux_communs"},{"label":"Rare","source":"col:materiaux_rares"}]},
  {"cle":"non_reparable","type":"mecanique","render":"si_flag","source":"col:non_reparable","texte":"⚠ Non réparable"},
  {"cle":"reparation","type":"mecanique","render":"relation","titre":"Réparation","source":"col:reparation_id","relation":{"forme":"fk","lookup":"reparations","affiche":"nom_affichage"}},
  {"cle":"lore","type":"texte","titre":"Description","toggle":"swap","c":{"source":"col:resume_condense"},"v":{"source":"col:description"}}
]$json$::jsonb)
ON CONFLICT (categorie) DO UPDATE SET champs_v2 = EXCLUDED.champs_v2, mis_a_jour = now();

-- PIEGES : primitive `tableau` (lignes regroupees par nom -> 1 fiche). Colonnes affichees si elles VARIENT.
INSERT INTO public.fiches_schemas (categorie, champs, champs_v2) VALUES
('pieges', '[]'::jsonb, $json$[
  {"cle":"tableau","type":"mecanique","render":"tableau","regroupe_par":"nom","effet":{"primaire":"col:effet_generique","fallback":"col:effets"},"meta":[{"label":"Type","source":"col:type_piege"},{"label":"Durée","source":"col:duree"}],"colonnes":[{"cle":"niveau","lib":"Niv.","cle_or":true},{"cle":"cout_xp","lib":"Coût XP"},{"cle":"rayon","lib":"Rayon (pi)","si_varie":true},{"cle":"magnitude","lib_source":"magnitude_label","si_varie":true}],"construction":"col:construction"}
]$json$::jsonb)
ON CONFLICT (categorie) DO UPDATE SET champs_v2 = EXCLUDED.champs_v2, mis_a_jour = now();

-- BESTIAIRE : mode `aucun` (integral-seul, pas de resume_condense) + `section` prose.
INSERT INTO public.fiches_schemas (categorie, champs, champs_v2) VALUES
('bestiaire', '[]'::jsonb, $json$[
  {"cle":"categorie","type":"mecanique","label":"Catégorie","source":"col:categorie"},
  {"cle":"pv","type":"mecanique","label":"Points de vie","source":"col:pv_formule"},
  {"cle":"description","type":"mecanique","render":"section","titre":"Description","source":"col:description"},
  {"cle":"capacites","type":"mecanique","render":"section","titre":"Capacités spéciales","encadre":true,"source":"col:capacites_speciales"},
  {"cle":"immunites","type":"mecanique","render":"section","titre":"Immunités","source":"col:immunites"}
]$json$::jsonb)
ON CONFLICT (categorie) DO UPDATE SET champs_v2 = EXCLUDED.champs_v2, mis_a_jour = now();

-- 3) SEEDS fiches_listes (5 configs). source/fiche = categorie (implicite).
INSERT INTO public.fiches_listes (categorie, recherche, navigation, carte, annexes) VALUES
('sorts',
 $json$["nom"]$json$::jsonb,
 $json$[{"axe":"onglets","champ":"cercle","valeurs":"auto"}]$json$::jsonb,
 $json${"titre":"nom","sousTitre":"resume_condense","badges":["niveau"],"mode":"swap"}$json$::jsonb,
 $json$[]$json$::jsonb),
('competences',
 $json$["nom"]$json$::jsonb,
 $json$[{"axe":"onglets","champ":"categorie","valeurs":["generale","guerrier","voleur","mage","pretre"],"libelles":{"generale":"Générales","guerrier":"Guerrier","voleur":"Voleur","mage":"Mage","pretre":"Prêtre"}}]$json$::jsonb,
 $json${"titre":"nom","sousTitre":"resume_condense","mode":"peek"}$json$::jsonb,
 $json$[]$json$::jsonb),
('forge',
 $json$["nom"]$json$::jsonb,
 $json$[{"axe":"filtre","champ":"type","mode":"exclusif","libelles":{"accessoire":"Accessoires","arme":"Armes","armure":"Armures"}}]$json$::jsonb,
 $json${"titre":"nom","sousTitre":"resume_condense","badges":["type"],"mode":"swap"}$json$::jsonb,
 $json$[]$json$::jsonb),
('pieges',
 $json$["nom"]$json$::jsonb,
 $json$[]$json$::jsonb,
 $json${"titre":"nom","sousTitre":"resume_condense","mode":"swap","regroupe_par":"nom"}$json$::jsonb,
 $json$[]$json$::jsonb),
('bestiaire',
 $json$["nom"]$json$::jsonb,
 $json$[{"axe":"filtre","champ":"categorie","mode":"exclusif","libelles":{"mort_vivant":"Morts-vivants"}}]$json$::jsonb,
 $json${"titre":"nom","sousTitre":"pv_formule","mode":"aucun"}$json$::jsonb,
 $json$[]$json$::jsonb)
ON CONFLICT (categorie) DO UPDATE SET
  recherche = EXCLUDED.recherche,
  navigation = EXCLUDED.navigation,
  carte = EXCLUDED.carte,
  annexes = EXCLUDED.annexes,
  mis_a_jour = now();
