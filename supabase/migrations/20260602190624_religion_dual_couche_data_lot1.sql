-- religion_dual_couche_data_lot1
-- Saisie dual-couche (Fiche curée + Manuel verbatim) pour le lot 1 :
--   Culte des Ombres d'Asbeth, Les Protecteurs du Temps d'Éliah,
--   Les Faéeries de Nalidala, Les Éternels de Shen-Gon.
-- Conventions : coquilles de frappe corrigées (s47), nom dirigeant Asbeth
-- normalisé en « Sayar L'Innommé », « Vision de Sayar » fondue dans lore_manuel.
-- Règle 1:1 : array_length(rituels_fiche) = array_length(rituels_manuel).
-- Idempotent (UPDATE par id).

-- ====================== ASBETH (8 rituels) ======================
UPDATE religions SET
  lore_fiche = $f$Culte voué à Asbeth, incarnation de Sélénir et maître de la nuit, qui prône le chaos, la liberté absolue et la domination de l'ombre sur la lumière, en opposition éternelle à Asméis. Attirant marginaux et adeptes des arts noirs, il collabore avec les démons du néant et voit dans l'âme un don d'Asbeth, monnaie d'échange et source d'opportunités. Jadis l'un des trois ordres primaires, détruit puis ranimé par le prophète orc War'Drun'Naa et écrasé par l'Inquisition, il consacre de nouveau, par la vision de Sayar, des templiers gardiens secrets de la liberté et du Voile.$f$,
  rituels_fiche = ARRAY[
    $rf$Bénir la lune par le chant et tenir une prière collective où chacun partage ses buts avec Asbeth.$rf$,
    $rf$N'obéir qu'à Asbeth et respecter la hiérarchie des templiers, ses seuls messagers.$rf$,
    $rf$Ne jamais rester seul, s'entourer d'adeptes pour grandir son ombre, et défendre les libertés de tous.$rf$,
    $rf$Offrir une âme à Asbeth, sacrifice ultime, par offrande ou conversion.$rf$,
    $rf$Toujours avoir un but la nuit venue et laisser place au chaos pour combattre l'ordre.$rf$,
    $rf$Faire vivre un cauchemar à ses ennemis avant de leur donner la mort.$rf$,
    $rf$Manier la dissimulation, art oratoire des ombres, pour ne pas s'exposer à la lumière.$rf$,
    $rf$Garder secrets les rites d'adoubement des templiers, réservés à l'excellence.$rf$
  ]::text[],
  lore_manuel = $L$Pour les adeptes d'Asbeth, la lumière n'existerait pas sans l'ombre, et cette dualité existe pour chaque chose. Toutefois, l'ombre doit contenir la lumière avant d'être anéantie par celle-ci, et il ne faut reculer devant rien pour assurer notre survie.

Sous l'ombre de la lune, la vraie nature des choses se révèle, alors que la lumière du jour aveugle ses disciples. Asbeth incarne l'absolue liberté de la nuit et la domination de la nuit sur le jour. Asbeth est l'incarnation de Sélénir et a le devoir de combattre Asméis et Rairun ou toute organisation voulant contrecarrer la domination totale de la lune et imposer le règne du soleil. Il incarne aussi la dualité entre les rêves et les cauchemars.

Asbeth incarne des idéaux d'interdits, de transgression de l'autorité, du désordre naturel des choses. Asbeth prône le chaos, la désobéissance et l'anarchie sociale. Le culte d'Asbeth attire de nombreux dissidents et marginaux de la société, de même que des adeptes des arts noirs.

Le culte des ombres est fort répandu chez les races non humaines ou chez les gens exploités par le pouvoir. L'écho des paroles et des enseignements d'Asbeth habite les esprits les plus disjonctés et leur donne courage face aux jugements des partisans de la lumière.

Pour Asbeth, l'unité et la loyauté envers leur culte sont les deux valeurs les plus importantes qui soient. Tout suivant de ce culte sait très bien qu'un jour ou l'autre, la lumière tentera de frapper à la porte. Si l'ombre frappe en premier, l'ombre reste.

Pour Asbeth, l'erreur est toujours possible, mais il faut toujours apprendre de ces dernières. La mort étant elle-même un apprentissage pour Asbeth. Pour lui, il faut être prêt à risquer son âme pour pouvoir en avoir une nouvelle et la risquer à nouveau. Pour ce culte, l'âme est un don d'Asbeth, car elle permet d'ouvrir ses opportunités.

Le monde des rêves et des cauchemars est la responsabilité de Sélénir uniquement, et Rairun ne devrait pas influencer à ce point le cœur de ce monde. Le culte considère qu'Asbeth ne devrait pas cogérer le monde des rêves et des cauchemars. Asméis a comme obsession de faire régner un régime tyrannique sur un monde qui devrait être libre et accessible.

Bien que les démons du néant soient des opportunistes, Asbeth accepte que ses adeptes collaborent avec eux. Ils sont des produits de la création et peuvent être utiles et contrôlés. Les autres créatures, comme les Fae, qui existent dans les autres mondes, sont aussi des cibles de choix pour les adeptes d'Asbeth. Pour Asbeth, il n'y a pas de différence entre un démon ou une Fae dans la mesure où ils font la même chose : des pactes. Ces pactes sont une source de curiosité pour leurs adeptes.

Les adeptes sont passés maîtres dans l'art de comprendre les démons et les créatures du Voile, et leur servitude est un symbole de prestige. Plusieurs disciples vendent leurs services aux diverses arènes de Destea pour fournir des créatures intéressantes.

Histoire de l'ordre
Ancienne : Asbeth est l'un des trois désignés par les Astres pour diriger Destea. Il est l'un des plus anciens ordres religieux du monde. De son vivant, il n'existe aucune certitude sur sa vie, un capharnaüm d'histoires mythiques existe, mais il était le plus digne d'être investi du pouvoir de Sélénir.

Le culte d'Asbeth fut détruit en même temps que le culte d'Asméis et d'Éliah, sa puissance fut enfermée sous la mer Torekhienne. On raconte qu'Asbeth aurait autrefois pactisé avec Shen-Gon, le prince démon des morts-vivants, afin de se débarrasser de l'influence d'Asméis et d'Éliah. Il y parvint, en fragmentant Asméis en reliques dispersées sur Destea et en endormant Éliah. Toutefois, il fut berné par Shen-Gon, qui utilisa les pouvoirs prêtés par Asbeth pour s'incarner en Roi-Liche, fit oublier leur existence et fonda un royaume mort-vivant à Shéol.

Nouvelle : Toutefois, des millénaires d'inactivité plus tard, Asbeth parvint à faire un appel du plus profond de son tombeau. Le premier grand prophète orc, War'Drun'Naa, qui, pour célébrer son retour, construisit la cathédrale d'Amileth, répondit à l'appel et libéra la lune si longtemps enfermée. War'Drun'Naa parvint à conquérir le monde entier au nom d'Asbeth, mais progressivement, les Rakashans retournèrent dans leur contrée, et l'on ignore s'ils sont encore des adeptes ou non. Toujours est-il que ces créatures ont permis aux templiers d'Asbeth de prendre le contrôle du monde.

Avec le renouveau du monde, l'Ordre d'Asbeth, autrefois puissant, subit une répression brutale de l'Inquisition, ses membres étant traqués et exécutés pour le divertissement du peuple. Privés de magie et de leur maître, ils durent s'adapter pour survivre, allant jusqu'à rejoindre l'Inquisition et éliminer leurs propres compagnons. Malgré cette trahison forcée, leur résilience leur permit de regagner une place en Destea, obtenant le droit d'exercer à la cathédrale d'Amileth, mais au prix de renoncer à former de nouveaux templiers et d'effacer des éléments fondamentaux de leur croyance.

Récente : Jusqu'à ce qu'une vision de Sayar L'Innommé lui ordonne de consacrer à nouveau des templiers d'Asbeth, mais en introduisant une nouvelle règle portant son nom. Ces chevaliers, qui, dans l'ombre, défendent les valeurs de liberté, servent de contre-pouvoir contre le Voile d'Asbeth qui, contrairement aux paladins d'Asméis, ne peuvent se déplacer dans le Voile. Toutefois, devenir templier d'Asbeth est un honneur qui fonctionne au mérite, et uniquement un grand maître…

Vision de Sayar : Sur le Voile d'Asbeth
Asbeth dit que le Voile d'Asbeth est une bénédiction, une opportunité pour voir et explorer le chaos à l'état pur. Le voile est sa zone et nous avons le devoir de veiller à défendre les populations de Destea et de contrôler les engeances qui s'y trouvent.

Le Voile d'Asbeth est en réponse à la présence des démons du néant qui ont apporté avec eux des monstres d'un autre âge. Il faut veiller à l'explorer et apprendre à vivre en co-habitation avec elle. Elle est le symbole de notre ascension. Les monstres et les dangers sont notre responsabilité.

Les templiers d'Asbeth supplantent ceux d'Asméis. Honneur à quiconque souhaite être digne des facettes secrètes d'Asbeth. Asbeth emprisonne les créatures du voile qui ne se plient pas à sa volonté.

Les destins des templiers noirs sont désormais liés à la zone. Les templiers vont désormais arpenter son domaine et apporter l'aide d'Asbeth. Seuls ceux et celles que l'ordre jugera digne pourront aspirer à prendre les vœux des templiers et ainsi redécouvrir les trois facettes de l'ombre et traverser la zone.

Les démons ont une dette envers Asbeth et ils doivent le comprendre et respecter son autorité. Autrement ils doivent être renvoyés aux néants.$L$,
  rituels_manuel = ARRAY[
    $r$Il faut bénir la lune mère de chant et de récit afin qu'elle illumine nos louanges de ces étoiles, il faut organiser une prière collective à la lune où tous et toutes partagent leurs expériences et leur but avec Asbeth.$r$,
    $r$Asbeth est l'unique maître. Vous ne pouvez donner votre allégeance à un autre ou vous prosterner devant quiconque, sauf Asbeth. Il faut respecter la hiérarchie et les volontés des templiers d'Asbeth. Ils sont les messagers de sa volonté et entendent la voix d'Asbeth.$r$,
    $r$L'autorité d'Asbeth s'incarne dans ces adeptes, seuls vous n'êtes rien et vous ne servez à rien. Ne soyez jamais seul, entourez-vous toujours d'adeptes. Ils font grandir votre ombre face à la lumière. Il faut rassembler les gens et apprendre à ces derniers l'importance de ne jamais contraindre nos libertés.$r$,
    $r$Pour plaire à Asbeth, le sacrifice ultime est une âme. L'âme est le réceptacle des expériences de toute une vie. Par offrande ou par conversion, offrir une âme à Asbeth est un acte assurant son regard.$r$,
    $r$Ayez toujours un objectif une fois la nuit tombée, ne soyez jamais sans but. Il faut toujours être à l'affût des malversations de la lumière et toujours laisser libre place au chaos. Dans un monde où l'ordre prédomine sur nos libertés, tous les coups sont possibles pour combattre l'ordre, autrement la liberté ne peut véritablement exister.$r$,
    $r$Fais vivre un cauchemar à tes ennemis avant de leur infliger la mort, il faut qu'il honore Asbeth de leur peur et que tu puisses les bénir dans la mort.$r$,
    $r$La dissimulation est l'art oratoire des ombres, sachez faire preuve de finesse pour ne pas vous exposer à la lumière qui cherche à vous tuer. L'art oratoire est un don d'Asbeth.$r$,
    $r$Être templier d'Asbeth incarne l'absolue dévotion et les secrets de leur adoubement sont cachés et réservés à l'excellence parmi les disciples.$r$
  ]::text[]
WHERE id = 'e8f0c9fd-38d7-425f-9a7c-a96920109748';

-- ====================== ÉLIAH (10 rituels) ======================
UPDATE religions SET
  lore_fiche = $f$Culte voué à Éliah, troisième dieu primaire avec Asméis et Asbeth, gardien du temps, du cycle de la vie et de la mort, et médiateur universel. Divinité de la magie et des ritualistes, il attire érudits, philosophes et diplomates, prône la neutralité absolue et veille à l'équilibre du monde et au passage des âmes. Endormi par Asbeth puis réveillé pour la renaissance du monde, son ordre tient ses temples funéraires dans toutes les cités, son bastion à Aro, sur le fleuve Écarlate qui mène au monde des morts.$f$,
  rituels_fiche = ARRAY[
    $rf$Protéger et perpétuer la vie et la descendance sous toutes ses formes.$rf$,
    $rf$Écouter et comprendre toute forme de vie, même celle des morts, pour guider leur passage.$rf$,
    $rf$Servir de médiateur en toute discorde ; la violence est l'ultime recours.$rf$,
    $rf$Rester neutre et sans parti pris : ne voir que les faits.$rf$,
    $rf$Cultiver la discipline et la patience, mères de toutes les vertus.$rf$,
    $rf$Connaître les limites de la magie et accepter les conséquences de leur dépassement.$rf$,
    $rf$Transmettre de son vivant son savoir à quelqu'un de digne : le choix d'une vie.$rf$,
    $rf$Fuir la guerre, fléau et source du chaos ; faire prédominer la paix.$rf$,
    $rf$Donner un but à sa vie et y laisser sa marque, car seule la mémoire est immortelle.$rf$,
    $rf$Devenir vigie du savoir par de dures épreuves pour mériter de guider les âmes.$rf$
  ]::text[],
  lore_manuel = $L$Éliah est le troisième des dieux primaires de Destea avec Asméis et Asbeth. Éliah représente le temps, l'importance du cycle de la vie qui recommence sans arrêt et sert de médiateur universel. Rairun et Sélénir ensemble lui ont fait le don de la magie et la responsabilité du monde des morts et des âmes.

Le culte d'Éliah attire bien des érudits, des philosophes, des adeptes de la magie et des diplomates. Il symbolise l'histoire et le développement de Destea sous la forme d'un sablier sans fin. Le culte d'Éliah ne prêche pas la violence, bien qu'il en conçoive l'utilité, et aspire au maintien de l'unité du cycle de la vie.

Il symbolise aussi la mort. Plusieurs de ses adeptes se perçoivent comme des guides et ont des métiers en lien avec cette dernière, tant pour la sauver que pour la donner. Les adeptes d'Éliah sont connus pour leur neutralité et leur impartialité. Tout le monde finit par mourir et doit mourir.

Traditions
Pour les adeptes du culte d'Éliah, la vie comme la mort est un voyage et il faut faire le premier jusqu'au bout. La vie et la mort sont un recommencement et un apprentissage constant. Dans la vie, il faut bouger et faire changer les choses pour assurer la balance du monde. Éliah incarne la divinité du changement et du voyage.

Éliah prouve aussi qu'il est possible de manipuler la réalité en utilisant la magie. L'existence d'Éliah prouve qu'avec la magie, tout est possible. Il incarne ainsi le développement de la pensée et de la magie. Éliah est la divinité de la magie et des ritualistes, en plus d'être une divinité liée à la mort.

Les adeptes des protecteurs du temps sont des gens d'une extrême compassion pour le monde, mais d'une grande discrétion. Ces adeptes sont des solitaires ne transmettant leur connaissance qu'à un seul apprenti à la fois. Un prêtre d'Éliah peut consacrer sa vie à choisir sa relève, alors qu'un autre peut consacrer sa vie à un seul élève ou à plusieurs, selon le gré des rencontres.

Éliah a transmis ses directives à ses adeptes via des grimoires magiques renfermant les secrets de la magie et les mystères de la création du monde des rêves. Ses adeptes s'assurent que le cycle de la vie perdure, que l'équilibre des choses soit en place, que chaque race ait une descendance et survive au passage du temps. Toujours à la recherche de ses écrits saints.

Éliah est responsable du monde des morts et s'assure que la diversité de toutes les croyances puisse exister dans le firmament. Il assure une gouvernance éclairée sur le monde des morts.

Histoire du Culte
Ancienne : À la création, Éliah était un adepte occulte qui a découvert les premiers portails vers d'autres mondes. Ainsi, il parvient à rencontrer les astres qui lui confèrent la responsabilité du monde des morts et leurs pouvoirs pour garantir l'équilibre. Pendant des millénaires, il guide les nations dans leur développement, imposant les premiers codes de loi. Malheureusement, il fut endormi par Asbeth pendant des millénaires et ne fut éveillé que pour faire renaître le monde et accomplir sa destinée.

Nouvelle : Ainsi réveillé, le culte d'Éliah se répand à nouveau et s'implique pendant l'Inquisition afin de consigner les incidents. Ils sont les juges du surnaturel et ceux et celles qui ont la tâche de régler des problèmes occultes dont personne n'a de solution, de même que lors de conflits en lien avec la sorcellerie. Avec l'éveil progressif de la magie après la recréation du monde, le culte d'Éliah est le premier à posséder des pouvoirs magiques permettant aux vigies de guider les morts vers leur destination finale. L'ordre s'implante alors dans toutes les cités sous forme de temples funéraires où les gens sont exposés et où les rites peuvent être consacrés. Leur bastion se trouve dans la cité portuaire d'Aro, sur les berges du fleuve Écarlate. La légende raconte qu'il s'agit d'un fleuve menant au monde des morts.$L$,
  rituels_manuel = ARRAY[
    $r$Protéger et perpétuer la descendance et la vie sous toutes ses formes.$r$,
    $r$S'assurer de comprendre et d'être à l'écoute de toutes les formes de vie y compris celle provenant du monde des morts afin de guider leurs passages.$r$,
    $r$Doit toujours servir de médiateur lors d'une discorde. Il y a toujours une solution à tout problème. La violence est toujours la dernière des solutions.$r$,
    $r$Toujours rester neutre. Ne peut pas avoir de parti pris. Seulement voir les faits.$r$,
    $r$La discipline et la patience sont la mère de toutes les vertus.$r$,
    $r$La magie a des limites, même s'il faut savoir dépasser les limites pour atteindre l'équilibre, il faut savoir en connaître les limites et être prêt à accepter les conséquences.$r$,
    $r$Les secrets accumulés de mon vivant doivent être transmis de mon vivant, je dois trouver quelqu'un digne de mon savoir et le partager. Il s'agit du choix d'une vie.$r$,
    $r$La guerre mène au chaos et il faut savoir trouver d'autres alternatives. La paix doit toujours prédominer. La guerre est le plus grand fléau qui puisse être, la violence faisant surgir le pire en chacun de nous.$r$,
    $r$Pour être vivant, il faut savoir quoi faire de sa vie et une personne sans objectif concret n'est pas une personne accomplie, le but de la vie est de réussir à laisser sa marque et accepter que seule la mémoire est immortelle.$r$,
    $r$Devenir une vigie du savoir est une tâche importante et une responsabilité immense, une vigie se doit de suivre des préceptes difficiles et des épreuves afin de recevoir la responsabilité de guider les âmes vers le trépas. Leurs pouvoirs sont si grands qu'ils peuvent même donner des âmes.$r$
  ]::text[]
WHERE id = '2ca72bae-dff7-464b-9363-e92ec6b44141';

-- ====================== NALIDALA (11 rituels) ======================
UPDATE religions SET
  lore_fiche = $f$Culte voué à Nalidala, reine du monde des rêves née des racines de la terre, qui rêve d'un monde féerique où toute vie, magique ou non, vivrait en union. Prônant l'égalité de toutes les races issues de la source primaire, le rejet de toute discrimination et un retour à la nature, ses disciples — espiègles, solidaires, vêtus de couleurs vives — habitent les forêts et traquent le surnaturel pour communiquer avec les Fées. Massacré sous l'Inquisition puis réfugié à Sil'dor, l'ordre célèbre ses rites en quête d'une vraie Fae, luttant contre les infernalistes qui jadis chassèrent les fées de Destea.$f$,
  rituels_fiche = ARRAY[
    $rf$Ne jamais tolérer le rabaissement d'aucune autre race.$rf$,
    $rf$Protéger les vestiges des Fées : utiliser des ossements de fée en rituel est inacceptable.$rf$,
    $rf$Laisser les choses développer leur conscience plutôt que d'enfermer ses conceptions.$rf$,
    $rf$Faire preuve de compétence et de discernement en chaque aspect de sa vie.$rf$,
    $rf$Assister ceux qui interviennent dans le royaume des rêves et les prémunir de ses cauchemars.$rf$,
    $rf$Chercher à comprendre les créatures féériques ; toute magie a sa raison d'être.$rf$,
    $rf$Juger l'intolérance, non l'ignorance, et écouter tous les points de vue.$rf$,
    $rf$Jouer des tours : la magie sert à égayer le quotidien, comme le font les fées.$rf$,
    $rf$Porter des couleurs vives, don de Nalidala que les Fées chérissent.$rf$,
    $rf$Anéantir l'infernalisme et la magie noire, perversions du chaos qui chassèrent les fées.$rf$,
    $rf$Guider le passage de quiconque souhaite entrer en contact avec les fées.$rf$
  ]::text[],
  lore_manuel = $L$Vision du monde
Autrefois, les fées vivaient en cohabitation avec Destea jusqu'au jour où des démons envahirent le monde et qu'elles durent fuir dans le monde des rêves pour s'y enfermer.

Nalidala propose un monde idyllique dans lequel toutes les formes de vie, magiques et non magiques, seraient en union pour accueillir et développer un monde féerique comme autrefois. Ses adeptes incarnent la nostalgie d'une époque où les fées régnaient sur les saisons. En leur honneur, ceux et celles qui décident de prendre la voie de Nalidala portent des couleurs vives.

Les disciples de Nalidala considèrent que les autres races de Destea sont des produits de la même source primaire et qu'elles doivent être traitées équitablement. Pour les Faéeries de Nalidala, toute personne provient de la source primaire et, en ce sens, tout le monde est une Fae. Elles considèrent toute forme de discrimination ou de racisme comme une preuve d'intolérance et d'inutilité pour le développement des civilisations. Les fées étant toutes et tous égaux devant elle, toute création doit faire de même.

Pour les disciples de Nalidala, il faut revenir aux sources primaires et faire germer sur le monde un voile de renaissance naturelle et magique. Il faut revenir à la nature primaire et être à l'écoute du monde des rêves et des commandements de Nalidala. Pour protéger la source primaire, il faut prévenir les infernalistes qui sacrifient leur corps à la magie noire et qui sacrifient leur âme et leur corps pour détruire la création. Ces créations du mal existent aussi dans le monde des Faes, et il faut prévenir leur influence sur notre monde.

Valeurs des adeptes
Les disciples de Nalidala ont un grand esprit de famille. Ils sont très proches les uns des autres et ne laisseront jamais un des leurs dans la misère ou en train de mourir sur un champ de bataille. Ils ont le cœur sur la main pour aider leur prochain. Ils ont un très grand esprit de solidarité envers ceux et celles qui partagent leur périple. Ils sont aussi reconnus pour leur espièglerie et leur sens de l'humour.

Les adeptes de Nalidala sont très répandus chez les peuples des forêts en Lobadie et en Ardil, mais leur influence se répand plus largement en Destea. Ils ont un grand respect pour la nature. Nalidala représente la méditation et le voyage intérieur. Elle encourage le questionnement et cherche à comprendre les choses. Elle représente les arts magiques, le chant, le raisonnement et le rire. Elle fait de la forêt un lieu de famille où tout est possible.

Les grandes figures de leur ordre se font appeler les Faéeries et incarnent la communication avec Nalidala et le monde des rêves. Pour le devenir, l'ordre se garde de divulguer à tout le monde les secrets de leurs épreuves de création.

Les disciples de Nalidala habitent près des sources magiques des forêts et dans tout endroit où le lien magique avec le monde des rêves est plus facile. Ils sont souvent à la recherche de phénomènes surnaturels qui pourraient leur permettre de communiquer avec des fées.

Histoire du culte
Ancienne : Alors que le royaume des rêves fut délaissé par les trois primaires disparues, il fallait quelqu'un pour administrer son immensité et gouverner le peuple des fées qui y vivait. Nalidala naquit à partir des racines de la terre et du souffle de naissance du monde des rêves. Elle est désignée comme la descendante des éléments primaires du monde des rêves, l'entité incontestée du royaume féerique. Son règne s'étend sur les saisons et son regard embrasse toute magie. Nalidala incarne un idéal de famille, prêche un retour aux sources primaires et souhaite utiliser la toute-puissance de la magie pour accélérer cette reconversion du monde.

Nouvelle : Après le remaniement du monde par les trois divinités primaires, Asméis et Asbeth héritèrent de son royaume. Malheureusement, leur incompétence permit à Asbeth de fuir vers le néant, ce qui provoqua le Voile et le retour des infernalistes en Destea. Nalidala conteste l'autorité d'Asméis et se prétend seule reine du monde des rêves. Elle a capturé Asbeth alors qu'il revenait du néant et l'a exposé devant Asméis et Éliah. Pendant l'Inquisition, les Faéeries du culte de Nalidala, ces êtres bénis capables de parler avec les Fae de Nalidala, furent massacrées et complètement anéantis. Jugé hérétique, l'ordre rejoint l'opposition à l'Inquisition en Ardil et en Lobadie afin de repousser les forces inquisitrices. La cité sainte de Sil'dor, où se trouve le bastion du culte, devint une base forte pour exporter leur religion partout en Destea. Depuis, à l'abri de l'Inquisition, le culte continue de célébrer des messes et des rituels pour essayer de rejoindre les Faes. Ils tentent toutes sortes d'expérimentations et le but de tout adepte est d'en rencontrer une vraie. Jusqu'au jour où le Voile d'Asbeth vint de nouveau mettre en péril les objectifs du culte.$L$,
  rituels_manuel = ARRAY[
    $r$Il ne faut supporter en aucun cas le rabaissement envers n'importe quelle autre race.$r$,
    $r$Souhaite faire renaître la belle époque où les Faes vivaient en Destea. Les squelettes de fée sont des héritages inestimables de cette époque. Utiliser ses ingrédients dans un rituel est inacceptable. Il s'agit des vestiges inestimables des Faes et elles doivent être protégées.$r$,
    $r$Il est impossible de maintenir l'ordre dans la création, il faut simplement que les choses puissent avoir la possibilité de développer leur conscience propre plutôt que d'enfermer nos conceptions dans des boîtes.$r$,
    $r$La compétence est une qualité de plus en plus rare, sachez faire preuve de compétence et de discernement dans chaque aspect de votre vie.$r$,
    $r$Assister toujours ceux qui souhaitent intervenir dans le royaume des rêves afin de prévenir leur excès et leur sécurité. Le monde des rêves est aussi un monde de cauchemars. Prenez gare aux tentations de l'autre-monde.$r$,
    $r$Cherche toujours à comprendre les motivations des créatures féériques et magiques, toute magie a une raison d'exister. La magie doit être utilisée pour développer le monde et accélérer la croissance du monde.$r$,
    $r$Ne pas juger l'ignorance d'une personne et plutôt juger l'intolérance, pour Nalidala, il faut accepter de discuter tout point de vue, car il y a toujours deux facettes aux choses et d'écouter les autres.$r$,
    $r$Il est important de jouer des tours, la magie est faite pour être utilisée pour rendre le quotidien moins ennuyeux. Les fées agissent ainsi et il faut s'en inspirer.$r$,
    $r$Porter des couleurs vives ! Les couleurs sont le don de Nalidala et les Fées adorent le style. Il faut leur faire honneur.$r$,
    $r$L'infernalisme et la magie noire sont des perversions du chaos et ne doit pas être utilisé. Les infernalistes doivent être anéantis : un bon infernaliste est un infernaliste mort, mais même mort, il reste une menace. Les infernalistes sont ceux qui ont tué les fées et repoussé ces dernières de Destea.$r$,
    $r$Partout où les gens souhaitent entrer en contact avec des fées, un disciple de Nalidala peut guider son passage.$r$
  ]::text[]
WHERE id = '8f211631-f901-4b00-87d4-f2f85956dfb4';

-- ====================== SHEN-GON (8 rituels) ======================
UPDATE religions SET
  lore_fiche = $f$Culte voué à Shen-Gon, premier être à conquérir l'immortalité, puis consumé par son obsession et exilé dans le néant en conscience désincarnée, maître des démons et des morts-vivants. Son culte prône la domination des morts sur les vivants, la collaboration totale avec les démons du néant et la quête de la vie éternelle, son regard perçant tous les secrets depuis l'infini du néant. Jadis serviteur d'Asbeth qu'il berna pour devenir Roi-Liche de Shéol, écrasé par l'Inquisition puis ranimé lors du Bûcher de Grièle, l'ordre tient désormais bastion dans cette cité où morts et vivants collaborent.$f$,
  rituels_fiche = ARRAY[
    $rf$Faire signer des pactes de sang à ses adeptes et tout transmettre à l'autorité divine.$rf$,
    $rf$Infiltrer et saboter les organisations, quitte à se sacrifier pour la cause de Shen-Gon.$rf$,
    $rf$Bénir Shen-Gon en infiltrant une autre messe en secret, puis réunir l'ordre au crépuscule pour partager les plans.$rf$,
    $rf$Mêler le sang à tout rituel et conserver les âmes comme monnaie d'échange.$rf$,
    $rf$Percer les secrets obscurs des gens et garder ceux du culte sous peine de mort.$rf$,
    $rf$Poursuivre l'immortalité, l'éternité et la domination des morts sur les vivants.$rf$,
    $rf$Apprendre des morts-vivants et du néant le moyen de ramener Shen-Gon.$rf$,
    $rf$Unir les démons, bénédiction du nouveau monde : les convertir ou les faire mourir.$rf$
  ]::text[],
  lore_manuel = $L$Selon leurs croyances, toutes les âmes, vivantes ou mortes, recherchent la vie éternelle. Le rêve de l'éternité absolue est une des conceptions les plus anciennes qui existent. Shen-Gon, aux temps primaires, aurait été le premier être à obtenir l'immortalité. Shen-Gon est l'incarnation de notre volonté collective de vouloir revenir à la vie, avant et après notre mort. Il incarne le néant, un monde où les choses que l'on oublie continuent d'exister et où vivent des démons et des créatures issus des âges d'autrefois.

La soif d'immortalité de Shen-Gon n'ayant pas de limite, il est lui-même consumé par sa propre obsession et est forcé d'exister dans le néant sans pouvoir être autre chose qu'une conscience désincarnée. Il est le maître des démons et des esprits morts-vivants qui veulent revenir en Destea. La puissance de Shen-Gon ne peut coexister avec les forces de la nature ; la décrépitude étant synonyme de cet ordre, il faut que la nature soit désacralisée pour pouvoir faire naître l'équilibre de la non-vie. Il est aussi considéré comme le maître du monde du néant et le protecteur de ces créatures.

Son culte incarne un idéal de domination des morts sur les vivants, où l'existence serait imperméable à la mort. Le culte de Shen-Gon représente le cauchemar et la terreur de la domination d'un monde nécromantique.

Il incarne aussi la collaboration totale avec les démons du néant, que Shen-Gon libéra en ensorcelant Asbeth pour répandre le Voile sur le monde. Bien des démons considèrent Shen-Gon comme une divinité du néant ou un prince démon des morts-vivants. De l'infinité du néant, Shen-Gon voit tout, sait tout et entend tout ; son regard perce toute lumière et toute ténèbre, il parvient toujours à tout savoir et à obtenir tous les secrets, même les plus obscurs. Les disciples de l'ordre de Shen-Gon recherchent la vie éternelle et font tout pour trouver un moyen de ramener leur maître en Destea.

Histoire ancienne
Autrefois, l'âme de Shen-Gon fut recueillie par Asbeth, dont il devint le plus fidèle serviteur. Ensemble, ils parvinrent, par un rituel, à détruire le culte d'Asméis et d'Éliah et à faire oublier leur existence. Malheureusement pour Asbeth, Shen-Gon avait rusé, et il fut lui aussi enfermé et oublié. Après la disparition du culte des Trois, le culte de Shen-Gon se développa en terre de Shéol avec les restes de l'armée d'Asméis, qui y vivaient alors transformés en morts-vivants. Shen-Gon utilisa la magie employée dans le rituel pour créer un Roi-Liche tout-puissant, qui régna sur Shéol et envahit autant de fois le monde qu'il le sauva.

Histoire nouvelle
Lors de la recréation du monde et de la disparition de la magie, les antiques créatures de Shen-Gon tombèrent progressivement en poussière et/ou furent chassées par l'Inquisition. La civilisation du Roi-Liche fut anéantie, remplacée par d'immenses jungles. Une poignée d'exilé·es fidèles à Shen-Gon parvint à fuir l'Inquisition et participa à la fondation de la cité de Grièle dans les Badlands. Ils y fondèrent une nécropole héritière des grandes cités de Shéol avant d'être envahis et brûlés vifs lors du Bûcher de Grièle. Mais Shen-Gon répondit alors aux prières de ses adeptes et déclencha une magie hautement contagieuse sur la cité. Dès lors, tous les morts se relevèrent et purent continuer de vivre leur vie jusqu'à la décomposition complète. Malheureusement, les morts ne pouvaient quitter la cité. L'idée selon laquelle les morts-vivants peuvent collaborer avec les vivants se développa, et bien des avancées en médecine et en science furent rendues possibles grâce à la participation des morts-vivants de cette cité. L'ordre tient désormais bastion dans la cité de Grièle.$L$,
  rituels_manuel = ARRAY[
    $r$Toute personne responsable d'un culte souhaitant étendre la puissance de Shen-Gon doit faire signer des pactes de sang à ses adeptes afin d'à jamais sceller leurs croyances. Ces personnes doivent transmettre toute information à leur autorité divine.$r$,
    $r$Apprendre à infiltrer des organisations est l'apprentissage d'Asbeth à Shen-Gon, le sabotage fait partie de notre mission. Le but ultime étant d'éventuellement se faire prendre et de faire l'honneur de se sacrifier pour la cause de Shen-Gon.$r$,
    $r$Pour bénir Shen-Gon chaque jour, il faut absolument infiltrer une messe d'une autre religion ou conseil privé et dans le secret prononcer dans une prière le nom de Shen-Gon. Vous devez ensuite réunir l'ordre au coucher du soleil afin que l'obscurité voile vos traces et partager les plans des diverses religions.$r$,
    $r$Tous les rituels doivent avoir du sang comme élément de rituel, le contact avec Shen-Gon doit se faire dans le sang. Les âmes sont une monnaie d'échange qui doit être conservée et utilisée afin d'ouvrir le potentiel des gens.$r$,
    $r$Il faut comprendre les secrets les plus obscurs des gens, tout le monde a un côté sombre et tout le monde souhaite vivre éternellement. Comme un cadavre, il faut rester sous la terre, il faut rester caché à la vue des autres et il faut garder le silence des secrets du culte sous peine de mort.$r$,
    $r$Tous les priants de Shen-Gon sont animés par la poursuite de l'immortalité, de l'éternité et de la domination des morts sur les vivants.$r$,
    $r$Les morts-vivants et les esprits des morts apportent des connaissances sur la mort, il faut apprendre à en tirer avantage et apprendre sur le monde des morts pour trouver des indices pour ramener Shen-Gon. Le monde du néant guide notre chemin.$r$,
    $r$L'apparition des démons est une bénédiction et Shen-Gon doit unir tous les démons afin qu'il participe au nouveau monde. Il s'agit de créatures qui ont le droit d'exister en Destea mais doivent être convertis ou mourir.$r$
  ]::text[]
WHERE id = '8d14315d-5c9d-45e6-9efd-23e40848867a';
