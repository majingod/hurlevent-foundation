-- [RESYNC-VERBATIM] Lot D3 (a) — audit factuel des 18 fiches lore vs manuel corrigé 2026-06-18 (s329)
-- A1-A4 : coquilles factuelles (GO Fred) · B1 : emblème Hurlevent (manuel l.13418)
-- B2 : réécriture Forteresse Écarlate (« Mur des Hommes »/« Rakash » non sourcés dans le manuel)
-- + 6 nouvelles fiches : sections du manuel sans fiche (GO Fred s329)
-- Idempotent : UPDATE ancrés LIKE (re-run = 0 ligne), INSERT gardés par NOT EXISTS.

-- A1 — Varia : sous-titre « de Postes » -> « des Postes » (manuel l.13205)
UPDATE lore SET sous_titre = $hv$La Cité des Jeux et des Postes$hv$, updated_at = now()
WHERE nom = $hv$Varia$hv$ AND sous_titre LIKE $hv$%Jeux et de Postes%$hv$;

-- A2 — Shéol : « ressusciter les vivants » -> « ressusciter les gens » (manuel l.14453)
UPDATE lore SET description = replace(description, $hv$ressusciter les vivants$hv$, $hv$ressusciter les gens$hv$), updated_at = now()
WHERE nom = $hv$Les Terres de Shéol$hv$ AND description LIKE $hv$%ressusciter les vivants%$hv$;

-- A3 — Amileth : « visible depuis Torekh » -> « presque visible » (manuel l.13150)
UPDATE lore SET description = replace(description, $hv$d'Asbeth visible depuis Torekh$hv$, $hv$d'Asbeth presque visible depuis Torekh$hv$), updated_at = now()
WHERE nom = $hv$Amileth$hv$ AND description LIKE $hv$%d'Asbeth visible depuis Torekh%$hv$;

-- A4 — L'Ardil : « après l'âge perdu » -> « pendant l'âge perdu » (manuel l.14240)
UPDATE lore SET description = replace(description, $hv$redécouverte après l'âge perdu$hv$, $hv$redécouverte pendant l'âge perdu$hv$), updated_at = now()
WHERE nom = $hv$L'Ardil$hv$ AND description LIKE $hv$%redécouverte après l'âge perdu%$hv$;

-- B1 — Hurlevent : emblème (manuel l.13418 « dépend de la Maison »)
UPDATE lore SET embleme = $hv$Dépend de la Maison$hv$, updated_at = now()
WHERE nom = $hv$Hurlevent$hv$ AND categorie = $hv$cite$hv$ AND embleme IS NULL;

-- B2 — Forteresse Écarlate : description + résumé réécrits selon le manuel (l.13644+)
UPDATE lore SET
  description = $hv$Double forteresse érigée sur chaque rive du fleuve, reliée par un immense pont de cent mètres où des villes entières sont aménagées. Son nom vient de la couleur rouge de ses murs, marqués par le temps et un pacte ancien. Poste de garde le plus avancé de Torekh, elle sert de point de jonction entre les Badlands de l'est et de l'ouest et contrôle le commerce sur la mer Torekhienne.

Lieu de rencontre des nobles du continent, avec auberges et banques prestigieuses — la plus grande étant la Banque des De Payens. Abrite les hôpitaux les plus avancés, où médecins, prêtres et alchimistes collaborent.

Gouvernée par la Maison de Nevers — la Reine Irène de Nevers en est issue. Plusieurs écoles de magie profane s'y affrontent, produisant les mages les plus réputés de la région.

Chaque année, un tournoi désigne le Champion de la Ville, qui prête le Serment de la Forteresse : un engagement solennel à défendre les intérêts du royaume, inscrit sur les murs.$hv$,
  resume_condense = $hv$Double forteresse-pont sur le fleuve et poste de garde le plus avancé de Torekh : jonction des Badlands est et ouest, contrôle du commerce de la mer Torekhienne, sous la Maison de Nevers.$hv$,
  updated_at = now()
WHERE nom = $hv$Forteresse Écarlate$hv$ AND description LIKE $hv$%Mur des Hommes%$hv$;

-- Nouvelles fiches (6) — sections du manuel sans fiche
INSERT INTO lore (categorie, nom, sous_titre, embleme, description, resume_condense, ordre)
SELECT $hv$cite$hv$, $hv$Fort-aux-Fous$hv$, $hv$La Prison de Torekh$hv$, $hv$Masque à deux faces$hv$,
$hv$La plus ancienne forteresse des Badlands, prison mythique et plus grand sanatorium de Destéa, où sont enfermés les criminels les plus fous et les plus dangereux. On dit qu'aucun être ne peut s'en échapper une fois emprisonné.

Les détenus sont issus de rituels magiques déviants, d'erreurs divines ou d'expérimentations interdites qui ont mal tourné. Le fort sert aussi d'isolement pour ceux dont l'esprit a été dévoré par la magie du Voile d'Asbeth.

Centre de pouvoir de l'Ordre des Justicars, élite de juges divins chargés de maintenir l'ordre et d'exécuter les sentences prononcées par la royauté. L'Asile accepte toutes les demandes visant à enfermer un condamné ou tenter de le ramener sur le droit chemin.

Selon la légende, une magie ancienne tissée dans ses murs force quiconque y reçoit une peine à la purger, maintenu en vie artificiellement jusqu'à ce que sa sentence soit accomplie.$hv$,
$hv$Plus ancienne forteresse des Badlands et plus grand sanatorium de Destéa : prison mythique dont nul ne s'échappe, siège de l'Ordre des Justicars ; une magie ancienne force chaque condamné à purger sa peine.$hv$, 101
WHERE NOT EXISTS (SELECT 1 FROM lore WHERE nom = $hv$Fort-aux-Fous$hv$);

INSERT INTO lore (categorie, nom, sous_titre, embleme, description, resume_condense, ordre)
SELECT $hv$cite$hv$, $hv$Château Danos$hv$, $hv$La Cité des explorations$hv$, $hv$Cheval de mer entouré d'étoiles$hv$,
$hv$Château fort à douves sur une colline, doté d'un port fortifié protégeant le commerce de la mer Torekhienne. Reconnu pour son ingéniosité architecturale (égouts avant-gardistes, latrines, bains), ce port militaire abrite et construit la flotte de Torekh.

Célèbre pour les Bardesques, festivals de musique grandioses où les nouvelles du continent sont chantées plutôt que proclamées, propageant rumeurs, légendes et exploits en ballades.

Gouvernée par la Maison des Long-Rang, descendante de la lignée de Danos : philanthropes, grands collectionneurs et amoureux de l'exploration, liés aux corsaires et pirates de la mer de Danos. Elle détient le monopole de la construction navale.

Théâtre des plus grandes expéditions du continent pour redécouvrir Destéa. Le Culte de Ren y possède l'un de ses plus gros sanctuaires, et ses académies forment stratèges, lettrés et magistrats.$hv$,
$hv$Château fort et port militaire abritant la flotte de Torekh, célèbre pour ses festivals Bardesques ; la Maison des Long-Rang y organise les plus grandes expéditions du continent et détient le monopole naval.$hv$, 102
WHERE NOT EXISTS (SELECT 1 FROM lore WHERE nom = $hv$Château Danos$hv$);

INSERT INTO lore (categorie, nom, sous_titre, embleme, description, resume_condense, ordre)
SELECT $hv$cite$hv$, $hv$Fort Gronde$hv$, $hv$La Cité des chasses et des Forges$hv$, $hv$Flamme sur fond bleu$hv$,
$hv$Forge vivante et cœur battant de l'armement de Torekh. Ses artisans, descendants des maîtres forgerons des inquisiteurs, se spécialisent dans les armes anti-créatures : épées gravées de runes, arbalètes perçant la carapace des démons, fioles d'argent liquide. Les plus réputées sont les forges d'Élyos.

Jadis fief des De Beauchamp, la forteresse est le domaine des St-Giles, lignée d'inquisiteurs et de chasseurs de monstres qui ont pris ces terres après avoir accusé les De Beauchamp de pactiser avec des démons.

Tout ordre religieux ou militaire y trouve sa place s'il jure allégeance à l'éradication du mal ; l'ordre le plus représenté est celui des Ecclésias.

Seule la magie divine y est pleinement acceptée : la magie profane est vue avec méfiance et les mages doivent constamment prouver leur loyauté.$hv$,
$hv$Forge vivante de l'armement de Torekh, spécialisée dans les armes anti-créatures, tenue par les St-Giles, inquisiteurs et chasseurs de monstres ; seule la magie divine y est pleinement acceptée.$hv$, 103
WHERE NOT EXISTS (SELECT 1 FROM lore WHERE nom = $hv$Fort Gronde$hv$);

INSERT INTO lore (categorie, nom, sous_titre, embleme, description, resume_condense, ordre)
SELECT $hv$cite$hv$, $hv$Cité-Forêt de Melchior$hv$, NULL, $hv$Celui de Farénée (Sanglier sur un Triskel)$hv$,
$hv$Commanderie construite dans les arbres par le vénéré paladin Maelos de Sama, sur d'anciens terrains d'entraînement sacrés des paladins du culte d'Asméis. Située à la confluence de trois rivières, la cité bénéficie d'une fertilité exceptionnelle et peut s'autogérer pendant des années.

Assiégée lors de l'Inquisition : les hérétiques venus des Badlands massacrèrent ses défenseurs, empalant leurs corps sur les rives des trois rivières. Les noms des martyrs sont gravés dans les murs.

Rebaptisée en l'honneur de Melchior, héros légendaire de l'ordre, elle est aujourd'hui le centre névralgique de l'Ordre du Tres Ex Parte Animae. Les membres qui s'aventurent dans les Badlands acceptent un isolement permanent.

Depuis le Voile d'Asbeth, la cité est une porte d'entrée stratégique pour les bracoeurs et les ordres cherchant à traverser le voile vers l'Empire.$hv$,
$hv$Commanderie-forêt du Tres Ex Parte Animae à la confluence de trois rivières, marquée par le siège de l'Inquisition ; depuis le Voile, porte d'entrée des bracoeurs vers l'Empire.$hv$, 104
WHERE NOT EXISTS (SELECT 1 FROM lore WHERE nom = $hv$Cité-Forêt de Melchior$hv$);

INSERT INTO lore (categorie, nom, sous_titre, embleme, description, resume_condense, ordre)
SELECT $hv$cite$hv$, $hv$Fort-Aro$hv$, NULL, $hv$Arbre à cinq branches sur fond noir$hv$,
$hv$Forteresse de pierres lunaires qui captent la lumière nocturne, bastion principalement peuplé de demi-elfes réputés pour leur habileté à naviguer et à défendre leurs côtes. Le port d'armes y est fortement taxé, limitant les violences internes.

Position stratégique clé : elle protège le détroit vital reliant la mer Torekhienne à la région et constitue la frontière entre la Lobadie et l'Ardil, bouclier contre les invasions maritimes.

Bastion principal des Edhel-Einor, elle protège aussi l'entrée vers la Forteresse Écarlate et facilite les échanges avec Torekh via la cité portuaire de Gard'noss. Sa flotte veille sur les eaux.

Elle joue aussi un rôle plus subtil : préserver l'équilibre fragile entre les puissances naturelles et les anciens pouvoirs des elfes.$hv$,
$hv$Forteresse navale de pierres lunaires des Edhel-Einor, gardienne du détroit entre Lobadie et Ardil ; sa flotte protège les côtes et l'entrée vers la Forteresse Écarlate.$hv$, 105
WHERE NOT EXISTS (SELECT 1 FROM lore WHERE nom = $hv$Fort-Aro$hv$);

INSERT INTO lore (categorie, nom, sous_titre, embleme, description, resume_condense, ordre)
SELECT $hv$cite$hv$, $hv$Cité de Sil'dor$hv$, NULL, $hv$Drapeau multicolore$hv$,
$hv$Située au cœur de l'Ardil, majoritairement peuplée d'artistes et de musiciens ayant fui la mentalité élitiste de Io. Sa musique résonne à des centaines de mètres au-delà de ses murs et un prestigieux concours attire chaque année bardes et musiciens. Réputée aussi pour ses duels de magie, joutes oratoires où les sorts remplacent les mots.

Selon la légende, Nalidala fit naître un arbre immense en plein cœur de la ville pour déclarer son amour à Sil'dor, le plus beau haut-elfe de Destéa. Le culte de Nalidala réside dans cette colossale structure de bois sacré.

Cité profondément religieuse, gouvernée par un conclave des grandes figures religieuses de la ville. L'ordre de Nalidala, le plus ancien, détient l'autorité de reconnaître ou rejeter les cultes qui souhaitent s'y établir.

Depuis le Voile d'Asbeth, Sil'dor est une référence en connaissance des créatures surnaturelles ; chasseurs et érudits s'y rassemblent, dont plusieurs membres de l'ordre des Ecclésias.$hv$,
$hv$Cité des artistes et musiciens de l'Ardil, bâtie autour de l'arbre sacré de Nalidala ; conclave religieux, duels de magie, et depuis le Voile, référence en chasse aux créatures surnaturelles.$hv$, 125
WHERE NOT EXISTS (SELECT 1 FROM lore WHERE nom = $hv$Cité de Sil'dor$hv$);