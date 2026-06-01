-- B3 : descriptions courtes (mode « Fiche ») pour races + classes.
-- Le verbatim (colonne description) reste intact. Fallback applicatif :
-- description_courte si non-NULL, sinon description.
-- Idempotent : ADD COLUMN IF NOT EXISTS + UPDATE gardé par IS DISTINCT FROM.

ALTER TABLE races   ADD COLUMN IF NOT EXISTS description_courte text;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS description_courte text;

UPDATE races AS r SET description_courte = v.dc
FROM (VALUES
 ('Chiméride', $b3$Peuple éclectique mi-humain, mi-animal, né de l'union de races au bord de l'extinction. Chaque lignée chiméride suit ses propres instincts et valeurs : un peuple aussi adaptable que divisé.$b3$),
 ('Demi-Elfe', $b3$Descendants d'unions entre humains et elfes, les demi-elfes vivent près de 160 ans. Communs et plutôt bien acceptés partout — sauf chez les haut-elfes —, on les estime pour leur savoir et leur rôle de gardiens de la mémoire.$b3$),
 ('Demi-Orc', $b3$Craints pour leur peau verte et leur réputation guerrière, les demi-orcs sont recherchés comme gardes et soldats pour leur force. Leur sang humain leur ouvre la magie — honorée chez les orcs —, mais leur vie reste courte (60 ans) et vouée à la loyauté envers un maître.$b3$),
 ('Drow', $b3$Elfes bannis dans l'Ombre-Terre, les drows ont renié leur passé elfique — les nommer « elfes noirs » est une insulte mortelle. Leur société matriarcale, régie par des matrones impitoyables à coups de dagues et de poison, refait surface en Destéa après deux siècles d'absence.$b3$),
 ('Fée', $b3$Êtres au charme surnaturel, fascinants et inquiétants, les fées prennent tout au pied de la lettre et changent la moindre parole en piège. Imprévisibles, elles offrent des dons précieux — toujours à un prix caché —, et rares sont ceux qui sortent indemnes d'une rencontre.$b3$),
 ('Gobelin', $b3$Survivants des terres volcaniques de Rakhas, les gobelins ont fait de l'alchimie et de la débrouille un art de survie. Longtemps esclaves, puis ingénieux conseillers et inventeurs, ils aiment tout ce qui est pratique, novateur et éclatant.$b3$),
 ('Haut-Elfe', $b3$Reclus dans des royaumes cachés par les brumes et les forêts, les haut-elfes méprisent les autres races, qu'ils tiennent pour des parasites. D'une beauté éthérée masquant une froideur implacable, ils ne pardonnent ni ne négocient et se vengent sans pitié des offenses faites à leurs terres.$b3$),
 ('Humain', $b3$Venus de Mérée, une terre aujourd'hui légendaire, les humains se sont imposés sur Destéa par leur nombre et leur ambition. Vie courte (80 ans) mais croissance rapide, ils repoussent sans relâche les limites de tout ce qu'ils touchent — quitte à se faire la guerre.$b3$),
 ('Les Non-Races', $b3$Créatures intelligentes et surnaturelles vivant en secret, loin des civilisations. Incarner l'une d'elles est possible, mais le concept doit impérativement être approuvé par l'équipe d'animation.$b3$),
 ('Myrvalk', $b3$Connus sous les noms de Nains et de Géants, les Myrvalks ne forment qu'un seul peuple : celui du Mythril. Maîtres artisans à la longévité de 180 ans, ils ornent leur corps de pierres et du métal de leurs ancêtres ; peuple festif, fier de la forge, des runes et de ses rancunes tenaces.$b3$),
 ('Orc', $b3$Fiers et indomptables, forgés par des terres arides, les orcs ne manient pas la magie et comptent sur leur force brute et leur esprit guerrier. Peuple nomade et belliqueux, ils respectent la force, l'honneur et la parole donnée — et ne cherchent jamais la paix.$b3$)
) AS v(nom, dc)
WHERE r.nom = v.nom AND r.description_courte IS DISTINCT FROM v.dc;

UPDATE classes AS c SET description_courte = v.dc
FROM (VALUES
 ('Guerrier', $b3$Spécialiste des armes et de la puissance physique, le guerrier excelle au combat et repousse ses limites corporelles — barbare, garde du corps, forgeron, rôdeur, paladin, chasseur de têtes, chevalier, samurai…$b3$),
 ('Mage', $b3$Maître des arts profanes, le mage puise dans les énergies du monde par l'étude des arcanes et des objets — scribe, enchanteur, alchimiste, magicien…$b3$),
 ('Prêtre', $b3$Par sa foi et sa dévotion à un dieu, le prêtre cherche à comprendre les esprits qui gouvernent le monde, visible et invisible — croyant, inquisiteur, druide, chaman, médecin, nécromancien…$b3$),
 ('Voleur', $b3$Maître de la surprise et des foules, le voleur excelle dans la filouterie, le meurtre comme le commerce — brigand, espion, marchand, amuseur public, assassin, cambrioleur, ninja…$b3$)
) AS v(nom, dc)
WHERE c.nom = v.nom AND c.description_courte IS DISTINCT FROM v.dc;
