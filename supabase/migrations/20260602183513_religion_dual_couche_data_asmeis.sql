-- religion_dual_couche_data_asmeis
-- PR-B (lot pilote) : saisie double couche pour Asméis.
-- Couche Manuel = verbatim (coquilles de frappe corrigees, convention s47).
-- Couche Fiche = curation 1:1 (10 rituels = 10).

UPDATE public.religions SET
  lore_fiche = $L$Culte voué à Asméis, le Dieu-Soleil incarnant Rairun, qui fait régner la lumière, l'ordre et la justice face aux ténèbres d'Asbeth. Maudit puis dispersé en reliques à travers Destea, Asméis veille depuis le monde des rêves, et ses fidèles cherchent à réunir ses reliques pour faire triompher la lumière. Jadis culte dominant de Destea, l'ordre fut brisé par une infiltration d'Asbeth et survit à travers des paladins devenus chevaliers errants, aujourd'hui rares.$L$,
  rituels_fiche = ARRAY[
    $r$Honorer le Soleil au soir et se réunir pour demander à Asméis de bénir ses entreprises.$r$,
    $r$Toujours pardonner et offrir la rédemption, mais punir sans pitié l'impardonnable.$r$,
    $r$Chérir son âme avant le corps, se garder des tentations menant vers Asbeth.$r$,
    $r$Se méfier du mal en toute chose, ne jamais embrasser les ténèbres.$r$,
    $r$Obéir à Asméis et à ses commandements, étendre le culte de la lumière.$r$,
    $r$Aider et guider son prochain ; pratiquer l'hospitalité, marque d'Asméis.$r$,
    $r$N'user de l'épée qu'en dernier recours, la consacrer à Asméis avant de tuer.$r$,
    $r$Ne jamais mentir : la vérité est un don d'Asméis, le mensonge une marque d'Asbeth.$r$,
    $r$Honorer ses serments ; une parole donnée doit être tenue.$r$,
    $r$Respecter l'ordre et les lois, défendre contre l'oppression, faire rendre justice.$r$
  ],
  lore_manuel = $L$Pour les adeptes, Asméis règne sur toutes les formes de lumière qui percent les ténèbres et apporte sagesse et sécurité sous sa clarté. Il s'agit d'Asméis, le Dieu-Soleil, qui fait naître la vie. Asméis est l'incarnation de Rairun en Destea et se doit de protéger Destea contre toute forme de maléfice pouvant entraver l'ordre et la justice. Le culte d'Asméis et celui d'Asbeth se vouent une rivalité immémoriale, et le culte d'Asméis doit combattre toute organisation faisant la promotion du chaos et cherchant à faire régner la nuit sur le jour.

Asméis souhaite instaurer un nouvel ordre mondial harmonieux et équilibré, dans lequel Destea serait débarrassée des monstres, des créatures et des maléfices. Ces derniers sont considérés comme des entités malfaisantes issues des Ombres d'Asbeth.

Asméis fut maudit par Asbeth et dispersé en plusieurs reliques éparpillées à travers Destea. Le but ultime de l'ordre est de retrouver ces reliques afin de permettre l'accomplissement ultime et le règne de la lumière sur les ombres. Asméis s'est rendu dans le monde des rêves afin de protéger Destea des cauchemars d'Asbeth et de le maintenir emprisonné pour qu'il ne puisse plus nuire à quiconque.

Histoire ancienne
Aux temps jadis, Asméis était la divinité la plus vénérée de tout Destea. Son culte régnait sur toutes les civilisations et instaurait paix et harmonie. Depuis la grande cité-temple d'Asméis, capitale de Shéol, le culte d'Asméis était un véritable phare pour le monde.

Malheureusement, le culte d'Asbeth parvint à infiltrer celui d'Asméis. Un grand prêtre d'Asbeth invoqua la divinité de Shen-Gon afin de s'approprier son pouvoir. En tentant d'incarner Shen-Gon, le prêtre détruisit le culte d'Asméis, la grande cité et corrompit les terres de Shéol, faisant naître un royaume de nécropoles.

Asméis dispersé en reliques
L'essence divine d'Asméis fut alors dispersée aux quatre coins de Destea sous la forme de reliques. De nombreux adeptes du culte d'Asméis, connus pour être des paladins ou des rois-prophètes, ont marqué leur époque par leurs épopées visant à retrouver ces reliques. Les tablettes des préceptes d'Asméis furent préservées par des prophètes, des bardes de renom et des oracles de grande puissance qui luttaient sans relâche contre le chaos des civilisations et sensibilisaient les populations à la bienfaisance.

L'ombre cherchera toujours à détruire la lumière, et l'obscurité de la nuit doit être contrôlée. L'ombre ne doit jamais prévaloir sur la lumière, sans quoi le monde sombrerait dans le chaos et la mort. Asméis existe pour restaurer la bienveillance, purifier les terres infestées par Asbeth et imposer l'ordre face aux terribles maléfices qui menacent la création.

Histoire récente du culte
Depuis l'Inquisition, l'ordre d'Asméis est considéré comme le plus réfractaire aux violences et aux carnages. Il a plusieurs fois dû mener des guerres contre d'autres ordres religieux. Régulièrement infiltré par Asbeth, il a dû lutter pour préserver sa pureté.

Progressivement, le culte d'Asméis a perduré parmi la population et est devenu un symbole des temps anciens et des héros d'antan. Malheureusement, le culte d'Éliah et celui d'Asbeth ont pris de l'ampleur, notamment avec l'apparition du Voile d'Asbeth et la multiplication des pactes surnaturels exigeant des âmes comme monnaie d'échange. Les paladins d'Asméis ont alors changé de vocation, devenant des chevaliers errants parcourant les cités pour combattre le mal et rechercher les reliques.

Sous la gouvernance d'Armand le Reliquaire, l'ordre d'Asméis a décidé d'être plus vigilant face à Asbeth et a entrepris une décentralisation en plusieurs petites commanderies. Le bastion de l'ordre se trouve au Temple d'Akupai.

Disparition des Paladins
Malheureusement, le grand traumatisme causé par le Voile d'Asbeth a considérablement affaibli l'ordre, entraînant la perte de nombreux paladins et la disparition progressive des secrets de leurs rites. Les connaissances de l'ordre des paladins d'Asméis deviennent de plus en plus difficiles à obtenir, et leur formation est désormais réservée à un cercle restreint. Les paladins d'Asméis sont réputés pour être insensibles au Voile d'Asbeth et capables de prodiges inimaginables.$L$,
  rituels_manuel = ARRAY[
    $r$Le Soleil est l'astre qu'il faut honorer au soir pour que l'écho de nos prières puisse accompagner le lever du jour. Il faut se réunir pour demander à Asméis de bénir les actions que nous voulons entreprendre.$r$,
    $r$Le pardon et la rédemption sont les uniques manières de faire avancer les choses. Même s'il faut toujours pardonner, tout le temps, l'impardonnable existe et il faut alors le punir sans aucune pitié.$r$,
    $r$L'âme est la chose la plus importante qui soit, le corps doit chérir son âme pour rester dans la lumière et faire attention aux tentations qui pourraient le mener vers Asbeth.$r$,
    $r$Méfiez-vous du mal et ne soyez jamais adepte des ténèbres. Le mal existe dedans et en dehors du royaume d'Asbeth. Il faut toujours être aux aguets.$r$,
    $r$L'obéissance doit régner entre tous les disciples d'Asméis, le maître suprême qui protège notre monde contre les maléfices de la nuit. Il faut étendre notre culte pour assurer la lumière et ne pas douter de ses commandements.$r$,
    $r$Aide ton prochain lorsqu'il est dans le besoin, guide ceux et celles qui cherchent la lumière dans l'obscurité d'Asbeth, assure-toi de bien accueillir les gens chez toi car l'hospitalité est marquée d'Asméis.$r$,
    $r$Bien que la violence soit la dernière des options, il faut savoir utiliser l'épée pour détruire le mal. Consacre ton épée à Asméis avant de prendre une vie.$r$,
    $r$Il ne faut pas mentionner son nom sans raison. La vérité est un don d'Asméis et le mensonge est une marque d'Asbeth. Il ne faut pas mentir et il faut toujours faire preuve de franchise et d'honnêteté. Ainsi, la vérité pourra prévaloir sur le mensonge.$r$,
    $r$Il faut honorer ses serments car l'honneur et l'honnêteté sont les paroles d'Asméis et qu'une parole donnée doit être respectée.$r$,
    $r$Respecte l'ordre et assure-toi que les lois des nations soient respectées, fais-toi défenseur contre l'oppression et assure-toi que justice soit rendue lorsque l'injustice arrive.$r$
  ]
WHERE id = '3fd199e6-f4d6-4779-a132-6f023e14a9fd';