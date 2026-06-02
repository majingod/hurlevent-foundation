-- religion_dual_couche_data_lot2
-- Saisie dual-couche (Fiche curée + Manuel verbatim) pour le lot 2 (religions standard) :
--   L'Ordre de la Connaissance de Sol-gon, Les Chevaliers Gris de Mergar,
--   Les Ecclésias d'Acarthas, Les Saronides de Garron.
-- Conventions : coquilles de frappe corrigées (s47) ; « récréation du monde » -> « recréation »
--   (re-création, cohérent avec Shen-Gon) ; accords/élisions corrigés.
-- Règle 1:1 : array_length(rituels_fiche) = array_length(rituels_manuel).
-- Idempotent (UPDATE par id).

-- ====================== SOL-GON (9 rituels) ======================
UPDATE religions SET
  lore_fiche = $f$Ordre voué à Solgon, le plus grand érudit de son époque devenu une entité magique liée à la bibliothèque de l'Ordre, dédié à la préservation et à l'accumulation de tout le savoir du monde. Pour ses scribes, aucune connaissance ne doit rester secrète, toute magie peut être étudiée et l'ignorance est l'ennemie de la raison ; ils vénèrent le soleil qui éclaire les écrits et fondent des bibliothèques à travers Destea. Échappé de l'Inquisition avec les archives d'Io, l'Ordre veille désormais sur la Bibliothèque Perdue, cachée dans le désert et gardée par d'anciennes créatures.$f$,
  rituels_fiche = ARRAY[
    $rf$Partager ses découvertes avec les membres de l'Ordre.$rf$,
    $rf$Prier le Soleil au zénith et brûler un résumé de ses apprentissages pour que la cendre monte vers lui.$rf$,
    $rf$Ne jamais refuser un nouveau savoir qui sert ses desseins.$rf$,
    $rf$Tout savoir doit être partagé à Solgon : aucun n'a le droit de rester secret.$rf$,
    $rf$Défendre le libre exercice de toute magie devant l'autorité de Solgon.$rf$,
    $rf$Préserver les dragons et leur savoir ; leurs restes sont des ingrédients inestimables.$rf$,
    $rf$Fonder toute opinion sur des recherches et des sources confirmées.$rf$,
    $rf$Percer les secrets de la nature, indispensables pour transformer le monde.$rf$,
    $rf$Mériter le titre de scribe par les épreuves d'Io et de Torekh, sur autorisation d'Io.$rf$
  ]::text[],
  lore_manuel = $L$La connaissance est omniprésente en Destea, et chacun doit développer son esprit d'une façon ou d'une autre. L'ignorance est l'ennemie de la raison et de l'évolution. L'Ordre de la Connaissance s'est répandu à travers Destea afin de fonder des bibliothèques et d'y consigner le savoir des populations et des civilisations.

Solgon cherche à rassembler l'ensemble des connaissances existantes afin de mieux comprendre le développement du monde. Ce dernier, le plus grand érudit de son époque, eut une vision du Grand Astre du Soleil qui lui révéla qu'il devait partir en quête de tous les savoirs. Il quitta alors Akashendir, sa ville natale, et parcourut le monde. Il aurait rencontré toutes les civilisations et fait plusieurs fois le tour du globe avant de fonder son ordre.

L'Ordre de la Connaissance est un ordre religieux dédié à la préservation et à l'accumulation de toutes les connaissances existantes. Il incarne une curiosité sans limites et aspire au savoir universel. Ses membres ont la réputation d'avoir toujours réponse à tout et, s'ils ne l'ont pas, ils feront tout pour l'obtenir.

Pour Solgon, aucun savoir ne doit rester secret. Interdire l'accès à une connaissance est un crime. Tout savoir doit être accessible à tous. Cette soif de savoir est mal perçue par d'autres cultes et ordres, notamment par les Saronides de Garron, qui dissimulent leurs secrets druidiques de génération en génération.

Solgon valorise l'enseignement dans la lumière. Il vénère le soleil, qui révèle les écrits et éclaire les lectures. Pour lui, l'ombre assombrit le jugement éclairé d'une personne et la nuit fait toujours ressortir le pire chez les gens. Pour les adeptes de Solgon, il faut toujours avoir les idées claires.

À sa mort, et suivant ses directives, Solgon parvint à s'incruster magiquement dans la bibliothèque de l'Ordre, devenant ainsi une entité qui continue à guider ses scribes vers une plus grande compréhension du monde. Son esprit fait écho dans celui de ses disciples et guide leurs recherches. L'Ordre de Solgon est ainsi reconnu pour avoir été le berceau des plus grands esprits du monde connu.

L'Ordre valorise le savoir écrit avant le savoir oral et prône la fondation de bibliothèques pour archiver toute la connaissance du monde. La grande bibliothèque de l'Ordre est située à Ardil, dans la ville d'Io, sous la gouverne du Roi-Dieu. Sous son règne, l'Ordre de la Connaissance atteint une grande reconnaissance et attire toutes les personnes en quête de savoir. Tous les scribes de la Connaissance doivent venir faire rapport une fois par an des avancées de leurs recherches.

Histoire récente
Les scribes de Solgon sont depuis longtemps connus comme les plus énigmatiques chercheurs de Destea. Lors de l'Inquisition, ils parvinrent à s'échapper avec la majorité des archives de la bibliothèque de l'Ordre à Io et fondèrent une autre bibliothèque ailleurs : la Bibliothèque Perdue. La légende raconte qu'ils se seraient enfuis dans le désert avec un savoir antique inestimable. La bibliothèque serait désormais protégée par d'anciennes créatures du désert qui, au fil du temps, seraient devenues les adeptes de l'Ordre.$L$,
  rituels_manuel = ARRAY[
    $r$Doivent partager leur découverte avec les membres de leur ordre.$r$,
    $r$Doivent faire une prière au Soleil au zénith. Doivent faire brûler un résumé des choses apprises afin que la cendre monte vers le soleil du midi.$r$,
    $r$Ne doivent jamais refuser l'apprentissage de nouvelles connaissances, si cette dernière sert ses desseins.$r$,
    $r$Aucun savoir n'a le droit de rester secret, tous les savoirs doivent être partagés à Solgon et doivent être découverts.$r$,
    $r$Toute magie peut être utilisée et quiconque interdit son exercice doit en répondre devant l'autorité de Solgon.$r$,
    $r$Les dragons ont une compréhension de l'univers et leurs parties sont des ingrédients de rituel inestimables, il faut absolument en assurer la survivance. Le contact avec les dragons est une chose que l'ordre de la connaissance recherche activement. Si l'on ne peut pas sauver un dragon de la mort aussi bien utiliser son corps. Si les dragons sont morts ? Se sont-ils reproduits ?$r$,
    $r$Avant d'avoir une opinion, il faut faire des recherches et confirmer ses sources.$r$,
    $r$Les secrets de la nature sont des secrets inestimables, il faut absolument les découvrir. Il serait impossible de transformer le monde sans ces derniers.$r$,
    $r$Pour devenir digne d'être scribes de Solgon, il faut atteindre un niveau de connaissance importante et passer l'épreuve d'Io, pour passer l'épreuve d'Io, il faut passer l'épreuve de Torekh, pour passer l'épreuve de Torekh, il faut une autorisation de la part d'Io, qui analysera votre candidature.$r$
  ]::text[]
WHERE id = '5f1397a7-220a-4587-ae7f-a2a544a8d2bc';

-- ====================== MERGAR (9 rituels) ======================
UPDATE religions SET
  lore_fiche = $f$Ordre de nécromanciens et d'alchimistes voués à Mergar, qui reçut de Sélénir le secret de la création des vampires, ultimes défenseurs de la nuit. Les Chevaliers Gris cherchent à étendre leur contrôle sur les créatures de la nuit puis sur toute vie, prêchant la collaboration, la négociation et l'emprisonnement plutôt que la destruction, et concluent des pactes durables avec les êtres surnaturels pour maintenir l'équilibre. Banni du temple d'Akupaï pour avoir trahi l'Inquisition au profit des hérétiques et des démons, l'ordre cherche depuis son retour à retrouver son prestige, le secret des vampires se faisant toujours plus rare.$f$,
  rituels_fiche = ARRAY[
    $rf$Saluer la lune à minuit pour ne pas troubler son éveil.$rf$,
    $rf$Offrir aux pleines lunes le sang d'une créature du jour, et user de l'alchimie en rituel.$rf$,
    $rf$Laisser aller voix et corps pour appeler la gloire de la lune et la bénédiction de Mergar.$rf$,
    $rf$En temps de conflit, former des cercles où les sacrifices nourrissent runes et peintures de guerre.$rf$,
    $rf$Reconnaître comme seigneurs chevaliers gris les plus puissants détenteurs d'un domaine.$rf$,
    $rf$Infiltrer les organisations politiques, économiques et sociales pour contrôler les terres.$rf$,
    $rf$Respecter tout membre de l'ordre et toute créature surnaturelle non hostile vouée à la nuit.$rf$,
    $rf$Aider le passage des morts-vivants et créatures intelligentes capables de s'exprimer.$rf$,
    $rf$Tirer avantage des démons, dangers pour l'équilibre ; détruire ceux qu'on ne peut capturer.$rf$
  ]::text[],
  lore_manuel = $L$Quiconque questionne notre domination sur la nuit goûtera notre fureur. La lune couvre toute la surface de la terre et notre foi est loi de ces lueurs. Pour les adeptes des Chevaliers Gris, même durant le jour, il y aura toujours de l'ombre. Pour ces derniers, leur pouvoir et leur mission leur provient de la lune Sélénir.

Les Chevaliers Gris de Mergar sont un ordre de nécromancie et d'alchimistes dévots qui souhaitent d'abord étendre leur contrôle sur les créatures de la nuit, puis à toute forme de vie magique ou non-magique.

Mergar, leur prophète fondateur, reçut de Sélénir le secret de la création des vampires, des créatures buveuses de sang ayant pour rôle d'assurer le contrôle de la nuit à l'Astre. Il s'agit d'une créature rituelle qui ne peut pas transmettre ses dons.

Les vampires deviennent des armes de domination pour l'ordre sur l'ensemble du royaume de la nuit. Le secret de leur création est un des savoirs les mieux gardés de l'ordre. Les vampires sont les ultimes défenseurs de la nuit.

Autrefois, ils étaient utilisés pour garder les biens les plus précieux de l'ordre dans leurs temples et ne se réveillaient que rarement. Maintenant, ils sont si rares que l'ordre ne rend pas publics leurs déplacements et ce même aux adeptes normaux. Plusieurs disent qu'il n'en existerait même plus.

Leurs rivaux, les Ecclésias, souhaitent la destruction de toutes ces créatures et l'anéantissement. Là où les chevaliers prêchent la collaboration, la négociation, le contrôle, l'emprisonnement, les Ecclésias ne conçoivent que destruction.

Depuis la recréation du monde par Datrakan et l'arrivée des démons sur Destea, l'ordre change de vocation et s'intéresse aux démons. Les démons sont considérés comme des menaces à l'ordre de l'équilibre de la nuit mais ils doivent être contrôlés.

Avec l'art occulte conservé avec les années, l'ordre parvient à découvrir une manière de capturer ces derniers et de rendre utiles les démons qui visitent Destea. Pourquoi tuer un démon, s'il peut être utile ? Pourquoi tuer une créature surnaturelle si elle peut prévenir des cataclysmes ?

Ils sont donc connus pour faire des accords durables avec des créatures surnaturelles de manière à maintenir leur contrôle et leur domination sur un territoire. Les chevaliers gris sont ainsi dispersés dans tous les royaumes, plusieurs y organisent des domaines pour y faire des accords de coopération avec des créatures de la nuit. Les chevaliers gris sont assurés que leur présence et leur contrôle des créatures surnaturelles assurent une balance avec le monde surnaturel.

Histoire de l'ordre
L'ordre assigne des prêtres et prêtresses par territoire afin de garantir leur présence partout où il y a des cimetières ou la présence du surnaturel. Il était aussi des conseillers pour les morts. Les vampires étaient peu nombreux mais leur puissance faisait le prestige de l'ordre.

Lors de l'Inquisition, l'ordre se joint au départ. Jusqu'à ce qu'il trahisse cette dernière pour faire front avec les hérétiques et les démons. Cette trahison fut hautement punie et l'ordre fut banni du temple d'Akupaï, pour 100 ans. Lieu où coexistent toutes les religions. Toutes ses possessions dans la cité furent laissées à l'abandon.

Pendant leur période d'exil, certains racontent qu'ils auraient réussi à trouver des nouvelles façons de capturer et maîtriser les créatures de la nuit, ça ne reste que des rumeurs. Depuis leur retour à Akupai, les chevaliers gris cherchent à reprendre leur prestige d'autrefois mais ils ont encore le goût amer du bannissement se retrouvant dépossédés. Le secret et la création des vampires se font de plus en plus rares. Uniquement les seigneurs chevaliers gris les plus éminents sont octroyés à avoir ce savoir.$L$,
  rituels_manuel = ARRAY[
    $r$Il faut saluer la lune à minuit, pour ne pas la déranger pendant son éveil.$r$,
    $r$Les soirs de pleine lune, une offrande de sang à la lune est offerte. Le sang provient d'une créature du jour. Les chevaliers gris sont aussi connus pour utiliser l'alchimie comme composante de rituel. Mergar prêche que la source même de la non-vie réside aussi dans les plantes magiques de notre monde.$r$,
    $r$Vous devez laisser aller votre voix et votre corps et appeler la gloire de la lune et la bénédiction de Mergar.$r$,
    $r$En temps de conflits, des réunions et cercles se forment partout sur les terres laissant place à une fête magique où des sacrifices servent à des runes mystiques leur permettant d'en faire des peintures de guerre.$r$,
    $r$Les chevaliers les plus respectés et les plus puissants et ayant un domaine y sont reconnus comme des seigneurs chevaliers gris.$r$,
    $r$Le but de l'ordre est de prendre le contrôle des terres, infiltrant leurs membres dans toutes les grandes organisations politiques, économiques et sociales ; assassins et mercenaires au service des êtres de la nuit seulement.$r$,
    $r$Toujours faire preuve de respect auprès d'un autre membre de l'ordre ou toute créature surnaturelle qui n'est pas hostile et qui décide de choisir le chemin de la nuit et de la nécromancie.$r$,
    $r$Tout mort vivant ou créatures surnaturelles dotées d'intelligence et pouvant s'exprimer mérite pleinement de pouvoir le faire et il est de notre devoir d'aider son passage sur Destea.$r$,
    $r$Les démons et autres créatures sont des dangers pour l'équilibre de la nuit, il faut apprendre à en tirer avantage et ceux et celles qui ne peuvent être capturés doivent être détruits.$r$
  ]::text[]
WHERE id = '4979679f-74a6-4564-aa02-0aaf9d8c171a';

-- ====================== ACARTHAS (9 rituels) ======================
UPDATE religions SET
  lore_fiche = $f$Ordre de chevaliers dévots voués à Acarthas, forgeron et chevalier légendaire investi d'une mission divine du soleil-créateur : purger Destea des créatures de la nuit et de leurs adeptes. Ennemis jurés des Chevaliers Gris, les Ecclésias se marquent au fer rouge, ne conçoivent que la destruction des morts-vivants et des démons, et se mettent au service des puissants pour traquer les engeances surnaturelles. De cette lutte est née une nouvelle génération, les chevaliers de l'aube — tueurs de démons et exorcistes — qui font du Fort Gronde la base de leurs chasses.$f$,
  rituels_fiche = ARRAY[
    $rf$Au coucher du soleil, prier devant un feu pour la protection de la nuit à venir.$rf$,
    $rf$Marquer les guerriers au fer rouge la veille des grandes batailles ; plus de marques, plus haut le rang.$rf$,
    $rf$Entretenir partout les flammes, unique rempart contre les forces de la nuit.$rf$,
    $rf$Détruire toute vie morte-vivante et bannir les démons au néant.$rf$,
    $rf$Marquer les adeptes des forces noires ; les repentis font pèlerinage pour prouver leur retour à la lumière.$rf$,
    $rf$S'armer de tout l'arsenal nécessaire pour contrer la domination de la nuit.$rf$,
    $rf$Surpasser ses propres limites et infliger à l'ennemi les tourments dont il est capable.$rf$,
    $rf$Manifester la puissance du soleil par des rituels et des miracles.$rf$,
    $rf$Tirer fierté de ses victoires : porter les ossements et cendres de ses proies, inscrire leurs noms sur ses bannières.$rf$
  ]::text[],
  lore_manuel = $L$Dans des temps anciens, les créatures de la nuit régnaient en secret sur le monde. Sous l'Égide des tyranniques chevaliers gris, ces créatures corrompent les régions du monde. Pour les Ecclésias d'Acarthas, il n'y a aucune raison de partager le territoire avec les êtres de la nuit. Le feu et la lumière du jour offrent plus de bienfaits que la froideur et la noirceur de la nuit.

Pour exister, toutes les créatures de la nuit doivent se nourrir de l'essence des vivants. La base de leur existence n'est que malédiction et il faut purger les terres de ces créatures meurtrières et de leurs adeptes. En se marquant au fer rouge et en prêtant des vœux pieux, les Ecclésias s'imposent la mission de combattre sans relâche et de n'avoir aucun repos jusqu'à la victoire totale du Soleil sur les forces de la nuit. Ils se voient comme les uniques vigies dans l'obscurantisme du monde.

Les Ecclésias sont un ordre de chevaliers dévots investis d'une mission divine provenant du soleil-créateur. Sous le commandement d'Acarthas, un forgeron et chevalier légendaire, l'ordre parvient à s'armer contre les forces de la nuit.

Afin de contrecarrer l'influence des chevaliers gris, les Ecclésias se mettent au service des riches et des puissants. Toutes les royautés de Destea ayant déjà fait appel à leurs services, les Ecclésias acquièrent une grande expertise dans la lutte contre les engeances mortes-vivantes et envers toutes créatures démoniaques.

L'ordre avait découvert avant la recréation du monde, une arme capable de réduire les vampires des chevaliers gris en cendre. Avec la disparition de la magie, cette arme était sans effet, toutefois l'ordre put en tirer des enseignements et des savoirs magiques permettant de former une nouvelle génération d'Ecclésias : Les chevaliers de l'aube. Des chasseurs de monstres qui transfèrent leur haine de la nuit aux créatures démoniaques. Des tueurs de démons par excellence et des exorcistes de grand talent.

Histoire récente
Pendant l'Inquisition, les Ecclésias vont collaborer. Ils vont y acquérir une grande noblesse et un grand courage. Avec l'apparition des monstres et du voile d'Asbeth, l'ordre décide de changer de vocation et ajoute à leur quête la chasse et l'annihilation de ces créatures. Il fait du Fort Gronde, la base de ses opérations afin d'assurer l'envoi d'adeptes dans les territoires qui sont malmenés par le surnaturel.

D'abord par l'étude et ensuite par la mort, tout Ecclésias aspire à être un expert dans la traque des monstres du continent. Les adeptes sont de toutes les chasses. Ils sont aussi des forgerons, des alchimistes et des runistes renommés ayant développé l'art de combattre ces monstres et de découvrir leurs mystères.$L$,
  rituels_manuel = ARRAY[
    $r$Au coucher du soleil, les Ecclésias prient devant un feu demandant protection et lumière pour la nuit à venir. Ils sont des vigiles de nuit, s'attaquant sans gêne aux créatures de la nuit.$r$,
    $r$À la veille de grande bataille, les grands prêtres bénissent leur guerrier en leur brûlant le corps d'un fer rouge. Plus le guerrier a de marques, plus son rang est élevé dans leur ordre.$r$,
    $r$Il faut toujours que la lumière puisse être. Les flammes sont l'unique rempart contre les forces de la nuit. Il faut toujours s'assurer que les feux puissent éclairer les vivants.$r$,
    $r$Il n'existe aucune forme de vie morte-vivante ou d'adeptes nécromantiques qui ne doit pas être détruite. Les démons sont un cancer pour Destea et doivent être bannis à jamais dans le néant. Il est de notre devoir de vaincre.$r$,
    $r$Les adeptes des forces noires doivent porter la marque de leurs crimes, s'ils veulent se repentir, sans quoi, il ne mérite que la mort. Les repentis doivent faire pèlerinage pour prouver un véritable périple vers la lumière et porter la marque de leur crime.$r$,
    $r$Il faut savoir s'armer et obtenir toutes les armes nécessaires pour contrer la domination de la nuit.$r$,
    $r$La puissance de notre ordre doit surpasser les frontières de nos consciences, s'ils sont capables des pires tourments, nous ne pouvons que leur faire vivre la même chose.$r$,
    $r$La puissance du soleil doit être montrée, il faut manifester sa présence par des rituels et des miracles afin de prouver sa puissance.$r$,
    $r$Les proies que nous chassons sont des ennemis de la création et il faut être fier de leur défaite. Utiliser les cendres de vos ennemis dans vos armes et dans vos armures, porter leurs ossements, rappeler leur existence, inscrivez leurs noms sur vos bannières. Il faut donc garder trophée de vos victoires.$r$
  ]::text[]
WHERE id = '0d412540-c3f0-48e3-9c49-97a8cbc4701f';

-- ====================== GARRON (13 rituels) ======================
UPDATE religions SET
  lore_fiche = $f$Ordre druidique voué à Garron Ducalion, le druide le plus ancien et puissant, créateur des lycanthropes et gardien des secrets de la nature investi par Rairun et Sélénir. Rejetant la société pour vivre dans les forêts, les Saronides honorent à parts égales le jour et la nuit, protègent le cycle naturel et la terre-mère, et dissimulent jalousement leurs secrets — dont celui des Garoux — sous peine de la grande chasse. Divisés en ordres claniques portant chacun le signe de leur animal totem, ils s'isolent depuis l'Inquisition et luttent aujourd'hui contre le Voile d'Asbeth qui menace l'équilibre de la nature.$f$,
  rituels_fiche = ARRAY[
    $rf$Veiller partout où s'étend une forêt, soigner et protéger la nature de tout maléfice.$rf$,
    $rf$Réunir le cercle aux solstices et équinoxes pour fêter la saison et partager le savoir.$rf$,
    $rf$Faire le pont avec les puissances naturelles, comme presque tous les druides de Destea.$rf$,
    $rf$Se souvenir que le monde sombre dans le chaos et que la nature se meurt.$rf$,
    $rf$Se rapprocher de son animal totem, en porter l'emblème et assurer la survie de son espèce.$rf$,
    $rf$Préserver la nature jour et nuit et l'honorer avant d'en faire usage.$rf$,
    $rf$Faire prier la nature avec les adeptes, une fois par jour, près d'un arbre.$rf$,
    $rf$Ne jamais tuer sans raison : contenir la pulsion bestiale, car la vie est le don ultime.$rf$,
    $rf$Ne jamais briser le cycle naturel et empêcher la magie d'en perturber l'équilibre.$rf$,
    $rf$User des atouts de la nature pour aider les siens ou nuire à ses ennemis.$rf$,
    $rf$Se méfier des démons qui souillent la création.$rf$,
    $rf$Ne jamais trahir les secrets de la forêt, sous peine de la grande chasse.$rf$,
    $rf$Se détacher des biens des hommes : pierres et écus ne valent rien dans la nature.$rf$
  ]::text[],
  lore_manuel = $L$L'histoire des Saronides remonte aux premières civilisations et ils ont toujours rejeté la vie en société pour continuer de vivre dans les forêts du monde. Les mystères entourant les Saronides sont immenses, certains racontent qu'ils connaissent jusqu'aux secrets de la création du monde.

Les Saronides accordent autant d'importance au cycle du jour qu'au cycle de la nuit. Les deux étant nécessaires à la croissance naturelle. Les Saronides de Garron furent désignés par les deux astres comme les grands protecteurs de la nature et ils sont les gardiens du secret de la vie.

Autrefois, il existait un équilibre dans la nature du monde. Il existait un monde où la nature était respectée et où la vie y était abondante. La magie et la vie ne faisaient qu'un et dans cette nature équitable naquit bon nombre de créatures magiques et toutes les espèces vivantes. Les civilisations respectaient la nature et savaient la préserver. Les civilisations étaient sous la tutelle des Faes et la vie pouvait perdurer dans la paix.

Un jour, les Faes de Nalidala ont décidé d'abandonner Destea pour s'exiler dans le monde des rêves. Elles avaient trop peur que le chaos qui allait se répandre en Destea ne se répande dans leur royaume. À ce moment, elles abandonnèrent notre terre-mère à de terribles supplices. En l'absence des Faes, les secrets de la terre-mère étaient vulnérables.

Les ordres druidiques des Saronides furent alors fondés afin de protéger le cycle contre le chaos et pour protéger les secrets de la nature. Sans les druides, la vie n'existerait plus en Destea.

Garron Ducalion, l'unificateur de l'ordre des Saronides, est le druide le plus ancien et le plus puissant qui soit. Il est connu pour être le créateur des lycanthropes, les défenseurs ultimes de la nature. Le secret du rituel de leur création est l'un des secrets les mieux gardés de l'ordre et il faut être choisi pour devenir un Garou ou pour connaître le secret de leur conception. La grande chasse de Garron menace tout druide qui divulguerait ses secrets. Il aurait été investi par Rairun et Sélénir de la mission de protéger la nature et les secrets des Garoux. Les Garoux sont des créatures rituelles qui ne peuvent pas transmettre la lycanthropie aux autres.

Cet ordre considère que la vie en Destea provient de la terre-mère. Ils voyagent dans le monde établissant des domaines forestiers où ils assurent la protection. Les cercles druidiques sont consacrés par les adeptes aux alentours des cités et servent de services pour servir les populations.

Les Saronides sont basés un peu partout où il existe une étendue de forêt. Ces druides considèrent qu'il faut défendre la nature contre ceux qui souhaitent en contrecarrer l'harmonie. Les Saronides sont connus pour être les plus grands druides au monde et sont divisés par ordres claniques. Chaque ordre porte le signe distinctif de leur animal totem.

Histoire Récente
Il n'existe plus de conclave mondial des druides et des druidesses saronides. Les anciens cercles d'autrefois ont perdu leur pouvoir et les puissances magiques qui y habitent sont mortes. Les rares créatures existantes sont devenues des légendes.

Ne pouvant se réunir via ses cercles, l'ordre s'isole en petites communautés où le secret de création des Garoux devient un savoir secret et les conditions pour se rendre digne de cet honneur. L'ordre devient national. L'isolation leur donne un abri contre l'inquisition.

Pendant l'Inquisition, l'ordre Saronide de Torekh dénonce le sort réservé aux chimérides et non-humains et cherche à briser le cercle de violence. Il s'établit dans la cité de Sam'Rag. Ensuite, une multitude de communautés s'installe dans le royaume de Torekh aux abords des cités.

Avec le retour des monstres et le Voile d'Asbeth, les cités sont isolées entre elles et l'ordre aspire à devenir la référence. Les Garoux deviennent des armes contre le voile et les monstres, mais restent vulnérables à son influence. Bien qu'ils soient les premiers à la combattre. Pour les Saronides, il faut absolument lutter contre le Voile car il menace l'équilibre de la nature entière.$L$,
  rituels_manuel = ARRAY[
    $r$L'ordre est répandu partout dans le monde où il y a une région boisée. Elle assure la guérison et le respect de la nature. Elle souhaite repousser tout maléfice qui pourrait corrompre ou nuire à la forêt.$r$,
    $r$Le cercle doit se réunir à tous les Solstices et Équinoxes pour fêter la nouvelle saison et pour partager des nouvelles connaissances.$r$,
    $r$Les Saronides font le pont avec les puissances naturelles qui animent notre monde. Presque tous les druides et Druidesse en Destea sont des Saronides.$r$,
    $r$Depuis, le monde n'est que chaos et la puissance de la nature se meurt à mesure que des terribles créatures surgissent des profondeurs de nos forêts.$r$,
    $r$Il faut se rapprocher de notre animal totem, il faut suivre l'exemple de ces derniers pour adopter une nouvelle vision de la vie. Il faut en porter l'emblème pour qu'il soit connu et tout druide doit en assurer la survie de son espèce totem.$r$,
    $r$De jour comme de nuit, la nature doit être préservée. La forêt est un lieu de sainteté qu'il faut respecter en tout point. Il faut toujours, d'une manière ou d'une autre, honorer la nature avant d'en faire usage, car tous dons de la terre-mère doivent être honorés.$r$,
    $r$Il faut faire prier la nature avec les adeptes, il faut célébrer et effectuer une prière collective pour demander de l'aide aux esprits de la nature, souvent en rond autour ou près d'un arbre, et ce, une fois par jour.$r$,
    $r$La vie est le don ultime, il ne faut jamais tuer sans raison. Le Saronide n'est pas une bête sans raisonnement et sait qu'il faut contenir la pulsion bestiale de tuer et plutôt raisonner. Les actes de guerre et de violence gratuite sont des malversations du chaos.$r$,
    $r$Les Saronides protègent la nature et ne doivent jamais briser le cycle naturel, il faut honorer la nature et le cycle naturel, éviter que la magie n'en perturbe trop l'équilibre.$r$,
    $r$Utilise les atouts de la nature pour aider les tiens ou pour nuire à tes ennemis.$r$,
    $r$Méfie-toi des démons qui souillent la création.$r$,
    $r$Ne trahis jamais les secrets de la forêt sans quoi, la grande chasse se lancera sur toi.$r$,
    $r$Détache-toi des biens des hommes. Les pierres et les écus ne valent rien dans la nature.$r$
  ]::text[]
WHERE id = '420644a3-34c7-44f7-99b2-d9b478d1043f';
