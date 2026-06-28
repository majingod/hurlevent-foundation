-- s289 — Lore : abrégés (resume_condense) + toggle « Texte du manuel »
-- EXPAND : ADD COLUMN IF NOT EXISTS (idempotent). description = intégral inchangé.
-- Régime lore : 1 phrase (2-3 pour les gros textes). Abrégés validés par Fred s289.

-- 1) EXPAND : colonne abrégé
ALTER TABLE public.lore ADD COLUMN IF NOT EXISTS resume_condense text;

-- 2) SEED des 18 abrégés (dollar-quoting pour les apostrophes ; nom apostrophé doublé)
UPDATE public.lore AS l SET resume_condense = v.abr
FROM (VALUES
  ('Torekh',              $a$La plus grande cité de Destéa : carrefour cosmopolite protégé par des remparts techno-magiques, reconstruit à la vapeur et à la magie, gouverné par la famille royale Montclair sous l'œil de la police secrète (le Veto).$a$),
  ('Gard''noss',          $a$Cité-libre et cœur économique des Badlands, réputée pour ses écoles d'alchimie et son quartier financier — mais sous la prospérité prospère le plus grand marché noir, tenu par les Serres Noires.$a$),
  ('Amileth',             $a$Cité sombre dominée par la Cathédrale d'Asbeth, refuge des parias et labyrinthe de catacombes ouvrant sur l'Ombre-Terre ; plaque tournante des passeurs du Voile, tenue par la Maison Des Vallières.$a$),
  ('Varia',               $a$Bâtie autour de La Grande-Poste qui monopolise les communications du royaume ; célèbre pour ses arènes de gladiateurs et ses enchères d'objets magiques, sous la philanthrope Maison De Comtois.$a$),
  ('Zirink',              $a$Vermocratie gobeline dirigée par la famille Wak : ville d'inventeurs et d'artistes à l'urbanisme labyrinthique, championne du droit des non-humains à la pleine citoyenneté torekhienne.$a$),
  ('Grièle',              $a$Seule nécropole reconnue de Torekh : quiconque y meurt revient mort-vivant et ne peut plus quitter la ville. Immense manufacture où les morts servent les vivants, sous la Maison Sans-regret.$a$),
  ('Hurlevent',           $a$Bourgade ancienne et sacrée des Badlands, l'un des rares lieux où la magie rituelle reste possible et où serait né Datrakan ; aujourd'hui encerclée par le Voile d'Asbeth, elle sert de halte autour de l'Auberge du Sanglier-rieur.$a$),
  ('Sam''Rag',            $a$Cité-libre des Chimérides dans l'Ouest, abritant la plus ancienne bouche vers l'Ombre-Terre ; matriarcat drow de la Maison Saeldard-El et bastion des races non-humaines.$a$),
  ('Temple d''Akupaï',    $a$Sanctuaire le plus sacré des Saronides et de Nalidala, au bord du Lac des Brumes Éternelles ; protégé du Voile, désarmé et pacifique, il abrite le plus grand autel d'Asméis et sert de coffre-fort aux objets trop dangereux à détruire.$a$),
  ('Forteresse Écarlate', $a$Forteresse militaire du Mur des Hommes, tenue par la Maison de Nevers, qui protège les Badlands contre les invasions de Rakash.$a$),
  ('Mikima',              $a$Capitale de la Lobadie, bâtie autour d'anciens portails elfiques : centre administratif et financier majeur, ouvert sur l'Ombre-Terre, sous la Famille Edhel-Einor.$a$),
  ('Port de Lurnien',     $a$Cité portuaire prospère de l'est lobadien, porte vers l'océan et cœur économique de la région ; grand sanctuaire de Ren, majoritairement dirigée par des femmes.$a$),
  ('Cité Io',             $a$Capitale de l'Ardil et l'une des plus belles cités de Destéa : elle abrite la colossale bibliothèque de l'Ordre de la Connaissance et un grand observatoire, sous un conclave d'intellectuels.$a$),
  ('Royaume de Torekh',   $a$Royaume multiculturel à majorité humaine centré sur Torekh, uni par la Paix Torekhienne et ses trois interdits (magie noire, collaboration surnaturelle, esclavage) ; sa noblesse se réclame d'ancêtres héroïques, sous l'œil du Veto.$a$),
  ('Empire de Farénée',   $a$Théocratie impériale humaine d'inspiration celto-romaine, héritière de l'Empire Polanien et instigatrice de l'Inquisition ; dirigée par le Tres Ex Parte Animae en trois castes, elle s'est totalement refermée depuis le Grand Traumatisme.$a$),
  ('La Lobadie',          $a$Berceau des demi-elfes, nés de l'union des humains et des Fae-Nobilis : terre de forêts profondes et de ruines haut-elfiques, réputée pour son élégance, aujourd'hui fermée par le Voile d'Asbeth.$a$),
  ('L''Ardil',            $a$Région non-humaine d'inspiration grecque et universitaire où la magie fut redécouverte : vouée à la paix et à l'intellect (les conflits se règlent en duels verbaux), isolée par le Voile, elle forme les meilleurs chasseurs de monstres.$a$),
  ('Les Terres de Shéol', $a$Ancienne nécropole du Roi-Liche de Shen-Gon, rayée à la renaissance du monde, aujourd'hui forêt luxuriante semée de ziggourats en ruine ; depuis le Voile, des murmures de morts y prennent vie. Lieu sacré de l'ordre de Shen-Gon.$a$)
) AS v(nom, abr)
WHERE l.nom = v.nom;

-- 3) FLIP schéma moteur v2 : Description -> texte + toggle swap (abrégé/intégral)
UPDATE public.fiches_schemas
SET champs_v2 = $json$[{"cle":"description","type":"texte","titre":"Description","toggle":"swap","c":{"source":"col:resume_condense"},"v":{"source":"col:description"}}]$json$::jsonb
WHERE categorie = 'lore';
