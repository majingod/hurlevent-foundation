-- Migration : alchimie verbatim (CHANTIER-C tranche 1, PR data)
-- Idempotente : ADD COLUMN IF NOT EXISTS + UPDATE par id (rejouables)

ALTER TABLE public.recettes_alchimie
  ADD COLUMN IF NOT EXISTS description_verbatim text;

-- 40 recettes : description_verbatim + formule <- Manuel 2026
UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Venenum Diu De Catalepticus

Ingrédients :
• 1 catalyseur à poison
• 1 dose de Nagro
• 1 dose de Fulard
• 1 dose de Girof

Manipulations :
1. Le catalyseur est versé lentement afin d'éviter tout contact avec la peau.
2. Le Nagro est vigoureusement brassé pendant une minute dans la solution.
3. Le Girof est exposé à une lumière vive pendant une minute.
4. Le Fulard est ajouté en dernier, juste avant l'incantation.

Effet : Augmente la durée du coma de la victime de 10 minutes. Condition : La compétence Premiers soins 1 est requise pour faire ingérer une potion ou un poison à un personnage inconscient.

Durée : Effet instantané.',
  formule = 'Venenum Diu De Catalepticus'
WHERE id = '31065e4f-572d-4966-a8ce-ba5d846b400e';  -- Poison catalep tique (N1 poison)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Venenum Celeritate Anemia

Ingrédients :
• 1 catalyseur à poison
• 1 dose d'Anys
• 1 dose de Poulfis
• 1 dose de Batrus

Manipulations :
1. Le catalyseur est versé lentement afin d'éviter tout contact avec la peau.
2. L'Anys est laissé à l'air libre une minute avant d'être ajouté.
3. Le Batrus est combiné à un ingrédient sec avant incorporation.
4. Le Poulfis n'est ajouté qu'après l'incantation finale.

Effet : La victime ne peut bénéficier d'aucun effet de guérison ou de régénération.

Durée : 5 minutes',
  formule = 'Venenum Celeritate Anemia'
WHERE id = '6116abf6-98ba-47fa-b543-d6546fed4406';  -- Poison d'anémie (N1 poison)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Venenum Brachium Mollis

Ingrédients :
• 1 catalyseur à poison
• 1 dose de Fulard
• 1 dose de Manille
• 1 dose de Nartis

Manipulations :
1. Le catalyseur est versé lentement afin d'éviter tout contact avec la peau.
2. Le Nartis est ajouté en second pour lier les composants.
3. La Manille est manipulée sans outil métallique.
4. Le Fulard est ajouté en dernier, juste avant l'incantation.

Effet : Les mains de la victime sont affectées, l'empêchant de saisir ou tenir des objets.

Durée : 1 minute',
  formule = 'Venenum Brachium Mollis'
WHERE id = 'f0ed157d-fbc1-4306-8f20-aafa6abda0aa';  -- Poison de bras-mou (N1 poison)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Venenum Marcescere Dolor

Ingrédients :
• 1 catalyseur à poison
• 1 dose de Silice
• 1 dose de Fulard
• 1 dose de Noligraf

Manipulations :
1. Le catalyseur est versé lentement afin d'éviter tout contact avec la peau.
2. La fiole contenant la Silice est frappée trois fois sur un objet rigide avant l'incantation.
3. Le Noligraf est soigneusement mélangé au catalyseur.
4. Le Fulard est ajouté en dernier, juste avant l'incantation finale.

Effet : La victime est prise de violentes convulsions musculaires et elle est incapable d'attaquer ou de ce défendre et il lui est aussi impossible de lancer des sorts.

Durée : 15 secondes',
  formule = 'Venenum Marcescere Dolor'
WHERE id = 'd672d57c-63ab-4a19-95ed-917fcf242f7f';  -- Poison de douleur (N1 poison)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Venenum Altum Somnum

Ingrédients :
• 1 catalyseur à poison
• 1 dose de Pied de Grumpf
• 1 dose de Girof
• —

Manipulations :
1. Le catalyseur est versé lentement afin d'éviter tout contact avec la peau.
2. Le pied de Grumpf est longuement réduit en poudre fine.
3. Le Girof est exposé une minute à une lumière vive avant incorporation.

Effet : La victime tombe immédiatement dans un sommeil profond et s'effondre au sol. Elle n'est plus consciente de son environnement et si elle est secouée ou subit des dégâts, elle se réveille automatiquement.

Durée : 1 minute',
  formule = 'Venenum Altum Somnum'
WHERE id = '8dc491ff-f08c-4a79-83b5-7e47199953a5';  -- Poison de sommeil (N1 poison)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Venenum Diu Nigrum Caecitatis Afferimus

Ingrédients :
• 1 catalyseur à poison
• 1 dose de Noligraf
• 1 dose de Pied de Grumpf
• 1 dose de Poulfis

Manipulations :
1. Le catalyseur est versé lentement afin d'éviter tout contact avec la peau.
2. Le pied de Grumpf est longuement réduit en poudre fine.
3. Le Noligraf est mélangé au catalyseur afin de fixer l'effet.
4. Le Poulfis est ajouté après l'incantation.

Effet : La victime doit jouer l'aveuglement pendant 2 minutes. Il est recommandé d'ouvrir les yeux lors des déplacements tout en continuant de jouer l'effet subi.

Durée : 2 minutes',
  formule = 'Venenum Diu Nigrum Caecitatis Afferimus'
WHERE id = '773d270a-884c-4102-a291-263fd5e6b9dd';  -- Poison d'aveuglement (N2 poison)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Venenum Conscidisti Gravis Sanitatem

Ingrédients :
• 1 catalyseur à poison
• 1 dose de Noligraf
• 1 dose de Manille
• 1 dose de Verda

Manipulations :
1. Le catalyseur est versé lentement afin d'éviter tout contact avec la peau.
2. Le Noligraf est mélangé avec soin au catalyseur.
3. La Manille est manipulée uniquement à mains nues.
4. La solution est brassée avec un objet végétal naturel pendant une minute avant l'incantation.

Effet : La victime est considérée comme empoisonnée. L'état empoisonné réduit les points de vie maximum du personnage. Cet état peut être guéri par un antidote. Après guérison, le personnage reste à 2 points de vie, mais peut guérir normalement.

Durée : 12 heures',
  formule = 'Venenum Conscidisti Gravis Sanitatem'
WHERE id = '68b96918-e00a-46d8-ad80-05e86a6ff618';  -- Poison de gangrène (N2 poison)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Venenum Oculorum Caligo Ar Falsa

Ingrédients :
• 1 catalyseur à poison
• 1 dose de Ganos
• 1 dose de Poudre d'Alsase
• 1 dose de Nartis

Manipulations :
1. Le catalyseur est versé lentement afin d'éviter tout contact avec la peau.
2. Le Ganos est mélangé avec de l'eau pendant trente secondes, puis laissé au repos une minute complète.
3. La poudre d'Alsase est incorporée durant l'incantation en retournant la fiole.
4. Le Nartis est ajouté en second afin de stabiliser la préparation.

Effet : La victime est incapable d'attaquer, de se défendre ou de cibler une personne avec un sort et il tombe sous l'effet de folie.

Durée : 2 minutes',
  formule = 'Venenum Oculorum Caligo Ar Falsa'
WHERE id = 'ff9f6986-9b16-43de-9a87-473e8344a508';  -- Poison hallucinogène (intermédiaire) (N2 poison)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Nervorum Resolutiones Venenum Diuturnum

Ingrédients :
• 1 catalyseur à poison
• 1 dose de Girof
• 1 dose de Noligraf
• 1 dose de Silice

Manipulations :
1. Le catalyseur est versé lentement afin d'éviter tout contact avec la peau.
2. Le Girof est exposé à une lumière vive pendant une minute.
3. Le Noligraf est soigneusement mélangé au catalyseur.
4. La fiole contenant la Silice est frappée trois fois sur un objet rigide avant l'incantation.

Effet : La victime est paralysée instantanément pour une durée de 10 minutes. Elle est incapable de se déplacer, de parler ou de bouger ses membres. Toute blessure reçue met immédiatement fin à l'effet.

Durée : 10 minutes',
  formule = 'Nervorum Resolutiones Venenum Diuturnum'
WHERE id = '93338ffd-1ea3-4a9d-a67f-082d41a45191';  -- Poison paralysant (N2 poison)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Venenum Virga Fortis Infirmitas

Ingrédients :
• 1 catalyseur à poison
• 1 dose de Ficol
• 1 dose d'Alys
• 1 dose de Nartis

Manipulations :
1. Le catalyseur est versé lentement.
2. La solution est bouillie avant l'ajout du Ficol.
3. L'Alys est brassée avec le catalyseur dans le sens antihoraire pendant deux minutes.
4. Le Nartis est ajouté en second afin de stabiliser l'effet.
5. Utiliser un laboratoire pendant 5 minutes complètes.

Effet : La victime tombe à 1 point de vie, est incapable d'attaquer ou de lancer des sorts.

Durée : 15 minutes et à la fin de l'effet, la victime peut agir normalement, mais ne récupère pas ses points de vie.',
  formule = 'Venenum Virga Fortis Infirmitas'
WHERE id = '79bdf95e-3a53-4199-a1a7-9025a0c920eb';  -- Poison d'affaiblissement (N3 poison)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Venenum Delebit Oblivionis Tempore Venenis

Ingrédients :
• 1 catalyseur à poison
• 1 dose de Poulfis
• 1 dose d'Alys
• 1 dose d'Ortie

Manipulations :
1. Le catalyseur est versé lentement.
2. L'Alys est brassée avec le catalyseur dans le sens antihoraire pendant deux minutes.
3. L'Ortie est bouillie séparément avant incorporation.
4. Le Poulfis est ajouté uniquement après l'incantation finale.
5. Utiliser un laboratoire pendant 5 minutes complètes.

Effet : La victime oublie la dernière heure précédant l'empoisonnement. La compétence Hypnose permet de faire resurgir les souvenirs oubliés.

Durée : Instantanée',
  formule = 'Venenum Delebit Oblivionis Tempore Venenis'
WHERE id = 'cd8d19b5-9280-4fba-ae7a-6b9777880fc0';  -- Poison d'oubli (N3 poison)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Venenum Oculorum Caligo Ar Falsa

Ingrédients :
• 1 Catalysant à poison
• 1 dose de Ganos
• 1 dose de Poudre d'alsase
• 1 dose de Nartis

Manipulations :
1. Le catalyseur est versé lentement.
2. Le Ganos est mélangé avec de l'eau pendant trente secondes, puis laissé au repos une minute complète.
3. La poudre d'Alsase est incorporée durant l'incantation en retournant la fiole.
4. Le Nartis est ajouté en second afin de stabiliser la préparation.
5. Utiliser un laboratoire pendant 5 minutes complètes.

Effet : Ce poison rend sa victime incapable d'attaquer, lancer des sorts et de se défendre.

Durée : 2 minutes',
  formule = 'Venenum Oculorum Caligo Ar Falsa'
WHERE id = '635b21df-d1c6-4ba8-895a-8e179c4d29a2';  -- Poison hallucinogène (majeur) (N3 poison)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Venenum Mortiferum Effectus Potentia

Ingrédients :
• 1 catalyseur à poison
• 1 dose de Palos
• 1 dose de Sablon
• 1 dose d'Anys

Manipulations :
1. Le catalyseur est versé lentement.
2. Le Palos est activé par un souffle avant incorporation.
3. Le Sablon est distillé, seul l'extrait liquide est conservé.
4. L'Anys est laissé à l'air libre pendant une minute avant d'être ajouté.
5. Utiliser un laboratoire pendant 5 minutes complètes.

Effet : Dix secondes après l'inoculation, la victime subit de violentes douleurs et est immédiatement tuée, recevant un coup de grâce.

Durée : 10 secondes après l'inoculation',
  formule = 'Venenum Mortiferum Effectus Potentia'
WHERE id = 'a8831269-d984-40bf-a05a-3e26d72dae2d';  -- Poison mortel (N3 poison)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Mortuus Est Autem Ad Venenum Magi

Ingrédients :
• 1 catalyseur à poison
• 1 dose de Batrus
• 1 dose de Pied de Grumpf
• 1 dose de Ficol

Manipulations :
1. Le catalyseur est versé lentement.
2. Le Batrus est combiné à un ingrédient sec avant incorporation.
3. Le pied de Grumpf est longuement réduit en poudre fine.
4. La solution est bouillie avant l'ajout du Ficol.
5. Utiliser un laboratoire pendant 5 minutes complètes.

Effet : Tous les effets bénéfiques provenant de sorts ou de potions affectant actuellement la cible cessent immédiatement. Aucun nouvel effet bénéfique ne peut l'affecter pendant la durée du poison.

Durée : 5 minutes',
  formule = 'Mortuus Est Autem Ad Venenum Magi'
WHERE id = '7d12dcf6-2b0c-4a69-af72-0152c8e25f00';  -- Poison tue-mage (N3 poison)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Atramentum Activatio Runarum

Ingrédients :
• 1 Catalyseur magique
• 1 dose de Ganos
• 1 dose de Nartis
• 1 gemme ou minerai commun d'une valeur minimale de 1 écus

Manipulations :
1. Le catalyseur magique doit être mélangé lentement à l'aide d'un objet non métallique pendant 1 minute complète.
2. Le Ganos est mélangé 30 secondes avec de l'eau puis laissé au repos 1 minute.
3. Le Nartis doit obligatoirement être ajouté comme second ingrédient.
4. La gemme ou le minerai doit être réduit en poudre fine avant d'être incorporé à la préparation.

Effet : Cette encre permet d'activer un assemblage de runes qui peut être activer par l'encre dépend de la valeur de la pépite ou de la gemme utilisée : Chaque tranche de 1 écus de valeur équivaut à 1 activation. L'encre peut être utilisée sur plusieurs runes, jusqu'à épuisement des activations.

Durée : Instantanée',
  formule = 'Atramentum Activatio Runarum'
WHERE id = '8d6ca6f5-4128-4aff-87bf-fd50c49aeccf';  -- Encre d'Activation Runique (N1 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : In Temperatus Omnissa Munitione

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Girof
• 1 dose d'Anys
• 1 dose de Nagro

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible. Le Girof est exposé à une lumière vive pendant une minute. L'Anys est laissé à l'air libre une minute complète avant d'être ajouté. Le Nagro est vigoureusement brassé dans la solution avant incorporation finale.

Effet : Lors de la création, l'alchimiste choisit un élément parmi feu, glace, acide ou électricité. Le buveur réduit de 1 point tous les dégâts reçus de cet élément.

Durée : 5 minutes',
  formule = 'In Temperatus Omnissa Munitione'
WHERE id = 'c72dc224-b6df-43af-88c6-d771b12ba5de';  -- Fortifiant anti-éléments (N1 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Patientia Iae Militaris Mineo

Ingrédients :
• 1 catalyseur à potion
• 1 dose d'Anys
• 1 dose de Ganos
• 1 dose de Girof

Manipulations :
1. Le catalyseur est purifié avant toute autre étape.
2. L'Anys est laissé à l'extérieur pendant une minute afin de libérer ses propriétés.
3. Le Ganos doit être mélangé 30 secondes avec de l'eau et doit reposer pendant une minute.
4. Le Girof est exposé à une lumière vive pendant une minute avant d'être ajouté à la préparation.

Effet : Le personnage bénéficie de 1 point de vie supplémentaire, mais en contrepartie, tout sort lancé coûte 1 point de spiritualité additionnel.

Durée : 15 minutes',
  formule = 'Potio Ionis Patientia Iae Militaris Mineo'
WHERE id = 'f9ee47a4-2f27-4004-8a00-82791bfd3e0b';  -- Potion d'endurance guerrière (N1 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Cutis Arboris Mineo

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Girof
• 1 dose de Manille
• 1 dose de Nagro

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. Le Girof est exposé à une source de lumière vive pendant une minute complète.
3. La Manille est manipulée uniquement à mains nues, sans aucun outil métallique.
4. Le Nagro est vigoureusement brassé dans de l'eau avant son incorporation au finale.

Effet : Le personnage résiste à la prochaine attaque non magique reçue. Les attaques de feu ne peuvent pas être résistées par cet effet et infligent 1 dégât supplémentaire. Cette potion protège également contre une attaque sournoise, mais fait disparaître toutes les protections restantes.

Durée : 15 minutes ou jusqu'au déclenchement',
  formule = 'Potio Ionis Cutis Arboris Mineo'
WHERE id = 'ce222cb6-3405-4be1-92d4-16fcc3e3eb6e';  -- Potion de peau d'écorce (N1 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Resisto Is Ere Resisti Sortis Mineo

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Ganos
• 1 dose de Manille
• 1 dose de Nagro

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. Le Ganos doit être mélangé 30 secondes avec de l'eau et doit reposer pendant une minute.
3. La Manille est manipulée sans aucun contact avec le métal.
4. Le Nagro est brassé vigoureusement dans la solution avant d'être lié au catalyseur.

Effet : Le niveau de résistance aux sorts à effet du personnage est augmenté de 2 niveaux et tant que l'effet est actif, le personnage ne peut lancer aucun sort, mais il peut volontairement se concentrer pendant 1 minute pour mettre fin à l'effet.

Durée : 15 minutes',
  formule = 'Potio Ionis Resisto Is Ere Resisti Sortis Mineo'
WHERE id = '386b0b70-4b68-43ae-b52c-6fd0009f8290';  -- Potion de protection magique (N1 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Spiraea Mineo

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Batrus
• 1 dose de Fulard
• 1 dose de Ganos

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. Le Batrus est d'abord intégré à un ingrédient sec avant d'être versé dans la solution.
3. Le Ganos doit être mélangé 30 seconde avec de l'eau et doit reposer pendant une minute.
4. Le Fulard est ajouté en dernier, juste avant l'incantation.

Effet : Cette potion restaure l'énergie spirituelle du buveur. Le personnage récupère 5 points de spiritualité.

Durée : Effet instantané',
  formule = 'Potio Ionis Spiraea Mineo'
WHERE id = 'c596fd50-e388-474a-930d-028bf351ab31';  -- Potion de regain spirituel (N1 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Curas Mineo

Ingrédients :
• 1 catalyseur à potion
• 1 dose d'Anys
• 1 dose de Batrus
• 1 dose de Fulard

Manipulations :
1. Le catalyseur doit d'abord être purifié par filtration ou décantation afin d'en assurer la limpidité.
2. L'Anys est ensuite laissé à l'air libre pendant une minute complète avant d'être incorporé.
3. Le Batrus doit être combiné à un ingrédient sec avant d'entrer en contact avec le catalyseur.
4. Enfin, le Fulard est ajouté en dernier, juste avant que l'alchimiste ne prononce l'incantation finale.

Effet : La potion apaise la douleur et referme les blessures superficielles. Elle ne permet pas de ressouder des membres perdus, mais peut stopper un saignement actif. Le personnage récupère 2 points de vie et est réveillé de l'inconscience si applicable.

Durée : Effet instantané',
  formule = 'Potio Ionis Curas Mineo'
WHERE id = 'b56e20b8-dbc5-47e5-8c90-f9e9ba38d5b9';  -- Potion de soins (N1 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Temperatio Ionis Sapientia Mineo

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Batrus
• 1 dose de Nartis
• 1 dose de Noligraf

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. Le Batrus est d'abord intégré à un ingrédient sec avant toute autre étape.
3. Le Nartis doit impérativement être ajouté en second.
4. Le Noligraf est longuement mélangé au catalyseur avant l'assemblage final.

Effet : Cette potion réduit de 1 niveau la saturation alchimique du personnage. Elle ne compte pas dans le calcul de la saturation et fonctionne même lorsque celle-ci est atteinte.

Durée : Effet instantané',
  formule = 'Potio Ionis Temperatio Ionis Sapientia Mineo'
WHERE id = '5e6e1d81-5d2c-4779-9d1c-3bd9031f99c7';  -- Potion de stabilisation biochimique (N1 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Spiro As Are Avi Atum Aestus Mineo

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Nartis
• 1 dose de Noligraf
• 1 dose de Poulfis

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. Le Nartis est ajouté en second afin de stabiliser la réaction.
3. Le Noligraf est soigneusement mélangé au catalyseur.
4. Le Poulfis n'est incorporé qu'après l'incantation finale.

Effet : Dans les 15 minutes suivant l'ingestion, le personnage peut effectuer une seule attaque infligeant 2 dégâts de feu à une cible située à 10 pieds maximum. Lors de l'attaque, le buveur subit 1 point de dégât.

Durée : Usage unique',
  formule = 'Potio Ionis Spiro As Are Avi Atum Aestus Mineo'
WHERE id = 'cb704c6f-781a-4103-bb84-233d394bc197';  -- Potion du cracheur de feu (N1 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Antidotum Minor Interitio

Ingrédients :
• 1 catalyseur à potion
• 2 doses de Poulfis
• 1 dose d'Alys
• 1 dose de Palos

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. L'Alys est brassée dans le sens antihoraire pendant deux minutes.
3. Le Palos est activé par un souffle avant d'être incorporé.
4. Les doses de Poulfis sont ajoutées uniquement après l'incantation finale.

Effet : Cette concoction stoppe instantanément tous les effets de poison affectant le buveur. En contrepartie, celui-ci est pris de vomissements et de maux de ventre pendant 2 minutes.

Durée : Effet instantané',
  formule = 'Potio Ionis Antidotum Minor Interitio'
WHERE id = 'baa79734-26c8-481b-9301-4ea5dfa9721c';  -- Antidote universel (N2 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Fundamentum Scriptura Arcanum

Ingrédients :
• 2 doses du même ingrédient : Ganos, Ortie, Pied de Grumpf, Silice, Calyre ou Ficol

Manipulations :
1. L'ingrédient choisi est préparé selon sa manipulation propre.
2. Le mélange est appliqué sur un support vierge ou sur le reste de parchemin à l'aide d'un instrument non métallique.
3. Une phase d'activation est réalisée en concentrant l'énergie du laboratoire sur la préparation. La création nécessite l'utilisation d'un laboratoire alchimique en jeu pendant 5 minutes complètes, représentant l'imprégnation magique du support.

Effet : Permet de créer un catalyseur magique utilisé dans la fabrication de parchemins et de certains produits utilitaires liés à la magie.

Durée : Jusqu'à utilisation ou fin d'année de jeu.

Note : Une fois le catalyseur complété, il est obligatoire de se présenter au camp de l'organisation pour valider sa création et recevoir la composante associée.',
  formule = 'Fundamentum Scriptura Arcanum'
WHERE id = '720094c8-94f7-4675-aeea-9809e4924aa2';  -- Catalyseur magique (N2 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Fundamentum Nox Venenum

Ingrédients :
• 2 doses du même ingrédient : Noligraf, Poulfis, Poudre d'Alsase, Sablon, Ambre, Agline ou Liche

Manipulations :
1. L'ingrédient choisi est préparé selon sa manipulation propre.
2. Le catalyseur est versé lentement et manipulé avec précaution afin d'éviter tout contact direct avec la peau.
3. Une phase de brassage contrôlé est effectuée pour activer les propriétés instables du mélange. La création nécessite l'utilisation d'un laboratoire alchimique en jeu pendant 5 minutes complètes, représentant la concentration et la stabilisation des composés toxiques.

Effet : Crée un catalyseur à poison pouvant être utilisé dans la fabrication d'un poison.

Durée : Jusqu'à utilisation ou fin d'année de jeu.

Note : Une fois le catalyseur complété, il est obligatoire de se présenter au camp de l'organisation pour valider sa création et recevoir la composante associée.',
  formule = 'Fundamentum Nox Venenum'
WHERE id = '63ab6b91-2c2f-448c-90fb-6d09efa9ff37';  -- Catalyseur à poison (N2 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Fundamentum Vitae Potio

Ingrédients :
• 2 doses du même ingrédient : Anys, Batrus, Girof, Nagro, Verda, Alys, Palos ou Huile de Mouf

Manipulations :
1. L'ingrédient choisi est préparé selon sa manipulation propre.
2. Le mélange doit être filtré ou décanté afin d'assurer la pureté du liquide.
3. Le catalyseur est stabilisé par une courte phase de repos avant d'être mis en fiole. La création nécessite l'utilisation d'un laboratoire alchimique en jeu. Le laboratoire doit être utilisé pendant 5 minutes complètes, représentant la distillation et la stabilisation du catalyseur.

Effet : Crée un catalyseur à potion pouvant être utilisé dans la fabrication d'une potion.

Durée : Jusqu''à utilisation ou fin d'année de jeu.

Note : Une fois le catalyseur complété, il est obligatoire de se présenter au camp de l'organisation pour valider sa création et recevoir la composante associée.',
  formule = 'Fundamentum Vitae Potio'
WHERE id = '34065ea6-e3f8-4ffe-867b-449c833cac0e';  -- Catalyseur à potion (N2 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Communitis Patientia Toxinius

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Nagro
• 1 dose de Batrus
• 1 dose d'Alys

Manipulations :
1. Le catalyseur est clarifié avant l'assemblage.
2. Le Batrus est combiné à un ingrédient sec avant incorporation.
3. Le Nagro est vigoureusement brassé pendant une minute complète dans la solution.
4. L'Alys est brassée avec le catalyseur dans le sens antihoraire pendant deux minutes.

Effet : Lorsqu'un personnage ayant bu cette potion est empoisonné, le poison n'a aucun effet pendant 10 minutes. Une fois ce délai écoulé, le poison reprend son cours normal. Cette potion peut ralentir les effets d'un seul poison.

Durée : 2 heures.',
  formule = 'Communitis Patientia Toxinius'
WHERE id = '12bf3468-682f-46f0-802b-b16696e4d8d7';  -- Fortifiant d'endurance aux toxines (N2 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Patientia Iae Militaris Impigner Gra Grum Interitio

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Ganos
• 1 dose de Girof
• 1 dose de Silice

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. Le Ganos est préparé avec de l'eau, puis laissé au repos une minute complète.
3. Le Girof est exposé à une lumière vive pendant une minute.
4. La fiole contenant la Silice est frappée trois fois sur un objet rigide avant l'incantation.

Effet : Le personnage voit ses points de vie augmentés de 3 et tous les sorts qu'il lance coûtent 2 points de spiritualité supplémentaires.

Durée : 30 minutes',
  formule = 'Potio Ionis Patientia Iae Militaris Impigner Gra Grum Interitio'
WHERE id = '046e79fe-1a66-4864-a6ca-db495b0d6e37';  -- Potion d'endurance guerrière accrue (N2 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Cutis Saxum Interitio

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Girof
• 1 dose de Manille
• 1 dose de Verda

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. Le Girof est exposé à une lumière vive pendant une minute.
3. La Manille est manipulée uniquement à mains nues.
4. La solution est brassée pendant une minute complète à l'aide d'un objet végétal naturel.

Effet : Le personnage peut résister aux deux prochaines attaques non magiques et tous les dégâts magiques reçus pendant que la potion est active infligent 1 dégât supplémentaire. Les coups assommants comptent comme des coups réguliers et protège contre la prochaine attaque sournoise, mais fait disparaître toutes les protections restantes

Durée : 30 minutes ou jusqu'au déclenchement',
  formule = 'Potio Ionis Cutis Saxum Interitio'
WHERE id = 'bc0d357e-24f1-4f08-81e8-612c749a054c';  -- Potion de peau de pierre (N2 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Praesidium Magistratus Causa Interitio

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Manille
• 1 dose de Nagro
• 1 dose d'Alys

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. La Manille est manipulée sans aucun contact métallique.
3. Le Nagro est vigoureusement brassé pendant une minute complète dans la solution.
4. L'Alys est brassée avec le catalyseur dans le sens antihoraire pendant deux minutes.

Effet : Toutes les durées d'effets magiques affectant le personnage, ou qui vont l'affecter, sont réduites de moitié.

Durée : 30 minutes',
  formule = 'Potio Ionis Praesidium Magistratus Causa Interitio'
WHERE id = 'b9ef51d3-6ac3-464e-9737-5315911634ab';  -- Potion de résilience à la magie (N2 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Cura Impiger Gra Grum Interitio

Ingrédients :
• 1 catalyseur à potion
• 1 dose d'Anys
• 1 dose de Batrus
• 1 dose de Palos

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. L'Anys est laissé à l'air libre pendant une minute avant d'être incorporé.
3. Le Batrus est d'abord mélangé à un ingrédient sec pour activer ses propriétés.
4. Le Palos est brièvement réchauffé avant de l'ajouter au final.

Effet : Cette potion guérit les blessures et calme les douleurs profondes. Elle permet également de ressouder des membres perdus et peut stopper un saignement actif. Le personnage récupère 4 points de vie et est réveillé de l'inconscience si applicable.

Durée : Effet instantané',
  formule = 'Potio Ionis Cura Impiger Gra Grum Interitio'
WHERE id = '788c6b36-ce58-429f-85e3-3ebce9d6b45f';  -- Remède curatif (N2 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Heros Herois Interitio

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Nartis
• 1 dose de Fulard
• 1 dose de Poudre d'Alsase

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. Le Nartis est ajouté en second afin de stabiliser la solution.
3. La poudre d'Alsase est incorporée pendant l'incantation, la fiole étant lentement tournée de haut en bas.
4. Le Fulard est ajouté en dernier, juste avant la stabilisation finale.

Effet : Cette potion exploite l'énergie spirituelle latente du corps pour repousser ses limites. Le personnage n'est plus sujet à l'acte héroïque : il peut continuer de combattre et de lancer des sorts même lorsqu'il est à 1 point de vie.

Durée : 1 cycle complet',
  formule = 'Potio Ionis Heros Herois Interitio'
WHERE id = 'b7ee0808-03b2-4b10-80d2-4a506f4bb02d';  -- Élixir d'héroïsme (N2 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Spirae Impigner Gra Grum Interitio

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Fulard
• 1 dose de Ganos
• 1 dose de Pied de Grumpf

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. Le Ganos est mélangé à de l'eau pendant trente secondes, puis laissé au repos pendant une minute complète.
3. Le pied de Grumpf est longuement réduit en poudre fine.
4. Le Fulard est ajouté en dernier, juste avant l'incantation finale.

Effet : Lorsque cet élixir est bu, il restaure 10 points d'énergie spirituelle.

Durée : Effet instantané.',
  formule = 'Potio Ionis Spirae Impigner Gra Grum Interitio'
WHERE id = 'dd65feb7-860a-40c0-b17d-3dd9c426441a';  -- Élixir de plénitude spirituelle (N2 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Jusuiticum Restringens Mendacium

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Poulfis
• 1 dose de Fulard
• 1 dose de Poudre d'Alsase

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. La poudre d'Alsase est incorporée pendant l'incantation en retournant lentement la fiole.
3. Le Poulfis est ajouté uniquement après l'incantation.
4. Le Fulard est intégré en dernier afin de sceller l'effet.

Effet : Pendant 2 minutes, le buveur est incapable de mentir et il est contraint de répondre aux questions qui lui sont posées. Aucune interprétation volontaire ou silence ne peut contourner l'effet.

Durée : 2 minutes',
  formule = 'Jusuiticum Restringens Mendacium'
WHERE id = '94a8c95c-cdd6-4a25-bf2a-fece84627df2';  -- Élixir de vérité (N2 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Ultro Spiraea Impiger Gra Grum Commodum

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Ganos
• 1 dose de Pied de Grumpf
• 1 dose d'Ortie

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. Le Ganos est mélangé avec de l'eau pendant trente secondes, puis laissé au repos pendant une minute complète.
3. Le pied de Grumpf est longuement réduit en poudre fine.
4. L'Ortie est bouillie séparément avant d'être incorporée au catalyseur.
5. Utiliser un laboratoire pendant 5 minutes complètes.

Effet : Cette potion permet au personnage de récupérer jusqu'à 15 points de spiritualité.

Durée : Effet instantané',
  formule = 'Potio Ionis Ultro Spiraea Impiger Gra Grum Commodum'
WHERE id = '9aa7f493-cd00-4575-8518-a0e9541090e4';  -- Potion de mysticisme (N3 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Cutis Marmor Oris Commodum

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Manille
• 1 dose de Verda
• 1 dose d'Ambre

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. La Manille est manipulée uniquement à mains nues, sans aucun outil métallique.
3. Le Verda doit être brassée pendant une minute complète à l'aide d'un objet végétal naturel.
4. L'Ambre est incorporée dans une obscurité totale, juste avant l'incantation finale.
5. Utiliser un laboratoire pendant 5 minutes complètes.

Effet : Les quatre prochaines attaques, magiques ou non, ne produisent aucun dégât au personnage. Protège contre la prochaine attaque sournoise, mais fait disparaître toutes les protections restantes. Les coups assommants comptent comme des coups réguliers.

Durée : 1 heure ou jusqu'à déclenchement',
  formule = 'Potio Ionis Cutis Marmor Oris Commodum'
WHERE id = 'a55fb5a5-ea82-464e-ad48-56e60138f261';  -- Potion de peau de marbre (N3 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Sanus Cruor Oris Sanguis Commodum

Ingrédients :
• 1 catalyseur à potion
• 1 dose d'Anys
• 1 dose de Palos
• 1 dose d'Huile de Mouf

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. L'Anys est laissé à l'air libre pendant une minute avant d'être incorporé.
3. Le Palos est activé par un souffle volontaire de l'alchimiste.
4. L'huile de Mouf est préparée séparément avec une goutte d'eau, puis laissée au repos un cycle complet avant d'être ajoutée à la solution.
5. Utiliser un laboratoire pendant 5 minutes complètes.

Effet : Le buveur récupère l'intégralité de ses points de vie et est réveillé de l''inconscient. Cette potion peut également ressouder n'importe quel membre si elle est appliquée à l'endroit d'origine.

Durée : Effet instantané',
  formule = 'Potio Ionis Sanus Cruor Oris Sanguis Commodum'
WHERE id = 'd1e83eaa-96f6-47d4-8dfa-762632cf1b13';  -- Potion de régénération (N3 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Potio Ionis Spiro As Are Avi Atum Draconis Commodum

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Noligraf
• 1 dose de Poudre d'Alsase
• 1 dose d'Agline

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. Le Noligraf est soigneusement mélangé au catalyseur.
3. La poudre d'Alsase est incorporée durant l'incantation en retournant lentement la fiole.
4. L'Agline est chauffée avant d'être ajoutée à la préparation.
5. Utiliser un laboratoire pendant 5 minutes complètes.

Effet : Cette puissante mixture est une version hautement plus efficace que celle du cracheur de feu. Une fois la potion ingérée, le personnage peut infliger 4 dégâts de feu à toutes les cibles sur une distance de 10 pieds devant lui, il reçoit 2 points de dégâts dans le processus. L'attaque doit être faite dans une période de 15 minutes suivant l'ingestion de la potion. Cette potion n'offre qu'une seule attaque.

Durée : Effet instantané.',
  formule = 'Potio Ionis Spiro As Are Avi Atum Draconis Commodum'
WHERE id = '7d1dccda-01f9-422f-af60-b59e82f6742d';  -- Potion de souffle draconique (N3 potion)

UPDATE public.recettes_alchimie SET
  description_verbatim = 'Formule : Et Extendit Magicae Diebus Muniendis

Ingrédients :
• 1 catalyseur à potion
• 1 dose de Fulard
• 1 dose de Silice
• 1 dose de Sablon

Manipulations :
1. Le catalyseur est soigneusement filtré afin d'éliminer toute impureté visible.
2. La fiole contenant la Silice est frappée trois fois sur un objet rigide avant l'incantation.
3. Le Sablon est distillé avec de l'eau et seul l'extrait liquide est utilisé.
4. Le Fulard est ajouté en dernier, juste avant l'incantation finale.
5. Utiliser un laboratoire pendant 5 minutes complètes.

Effet : Pendant 1 minute après ingestion, le personnage peut doubler la durée de ses sorts possédant une durée. Cet effet ne peut affecter que les trois prochains sorts lancés.

Durée : Une fois la minute écoulée ou les trois sorts utilisés, la potion cesse de faire effet.',
  formule = 'Et Extendit Magicae Diebus Muniendis'
WHERE id = '0f4a8d67-580e-40eb-8844-d6b662026d95';  -- Élixir de potence spirituelle (N3 potion)

-- 2 corrections couche courte ciblées
UPDATE public.recettes_alchimie SET nom = 'Poison cataleptique'
WHERE id = '31065e4f-572d-4966-a8ce-ba5d846b400e';

UPDATE public.recettes_alchimie SET description = 'État empoisonné (PV max réduits) pendant 12 h.'
WHERE id = '68b96918-e00a-46d8-ad80-05e86a6ff618';
