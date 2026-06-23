-- FICHES Phase 3 — catégorie traits_raciaux (fiche épaisse, mécanique en prose).
-- Schéma trait_racial (idempotent ON CONFLICT) + 20 resume_condense (abrégés rédigés depuis le manuel corrigé).
-- Idempotent : ON CONFLICT pour le schéma ; UPDATE par nom = valeurs fixes.

-- 1) Schéma trait_racial dans fiches_schemas
INSERT INTO fiches_schemas (categorie, champs, mis_a_jour)
VALUES (
  'trait_racial',
  $json$[
    {"cle":"cout","type":"mecanique","icone":"🎓","label":"Coût","source":"col:cout_xp"},
    {"cle":"effet","type":"texte","label":"Effet","c":{"source":"col:resume_condense"},"v":{"source":"col:texte_manuel"}}
  ]$json$::jsonb,
  now()
)
ON CONFLICT (categorie) DO UPDATE
  SET champs = EXCLUDED.champs, mis_a_jour = now();

-- 2) Abrégés (resume_condense) — réduction sans perte depuis texte_manuel (manuel corrigé)
UPDATE traits_raciaux SET resume_condense = $abr$Communiquer par langage corporel avec animaux et créatures non-verbales — comprendre leurs émotions (sans poser de questions), marquer son territoire, les effrayer ; hors combat, annoncé le poing levé.$abr$ WHERE nom = 'Affinité animale';
UPDATE traits_raciaux SET resume_condense = $abr$1 fois par cycle, pour fuir un adversaire, lui asséner un coup au pied (« Casse-pied ») le force à s'arrêter 5 secondes — uniquement en fuite, pas en plein combat.$abr$ WHERE nom = 'Casse-pied';
UPDATE traits_raciaux SET resume_condense = $abr$Dévorer 2 min la chair crue d'un corps frais (même cycle) ou d'un vivant rend 1 PV par 2 min (max 5 PV/cycle, hors combat) ; un corps empoisonné vous empoisonne, et dévorer un vivant lui inflige 1 dégât/min.$abr$ WHERE nom = 'Charognard';
UPDATE traits_raciaux SET resume_condense = $abr$Re-piger une seule carte lors de la collecte de plantes ou de minerais ; la 2ᵉ pige est la valide.$abr$ WHERE nom = 'Coup du destin';
UPDATE traits_raciaux SET resume_condense = $abr$De nuit, +1 point de vie.$abr$ WHERE nom = 'Créature des ténèbres';
UPDATE traits_raciaux SET resume_condense = $abr$Ingérer par cycle un nombre de potions égal à ses points de vie totaux, au lieu du 50 % habituel.$abr$ WHERE nom = 'Estomac d''acier';
UPDATE traits_raciaux SET resume_condense = $abr$Suivre une cible à l'odeur (même si elle vole ou change d'apparence) présente dans les 12 dernières heures, à partir d'un échantillon de son odeur — pluie, feu ou fortes odeurs peuvent gêner ; surtout pour retrouver des PNJ, guidé par un maître de jeu.$abr$ WHERE nom = 'Flair affûté';
UPDATE traits_raciaux SET resume_condense = $abr$Au début de chaque événement, bénéficier d'1 action parmi 4 (monnaie, minerai commun, plante commune ou information), à déclarer à l'inscription avant le jeu.$abr$ WHERE nom = 'Fortuné';
UPDATE traits_raciaux SET resume_condense = $abr$Ne jamais avoir de points de spiritualité (ni de base ni à l'achat) ; en échange, +1 point de vie.$abr$ WHERE nom = 'Inapte à la magie';
UPDATE traits_raciaux SET resume_condense = $abr$1 fois par événement, remplacer par sa salive 1 dose alchimique d'une potion ou d'un poison mineur (sauf catalyseur), mêmes manipulations ; la dose peut être mise en fiole, valable 1 cycle.$abr$ WHERE nom = 'Infusé';
UPDATE traits_raciaux SET resume_condense = $abr$1 fois par événement, résister à la compétence Assommer (jouer la surprise sans perdre connaissance).$abr$ WHERE nom = 'Instinct de survie';
UPDATE traits_raciaux SET resume_condense = $abr$1 fois par événement, imposer un « Dernier Prix » qui force l'interlocuteur à son prix le plus bas (sans vendre à perte) ; possibilité d'une épreuve de volonté du regard pour le faire céder un peu.$abr$ WHERE nom = 'Marchandage Musclé';
UPDATE traits_raciaux SET resume_condense = $abr$1 fois par événement, résister au premier effet de vérité reçu (sort ou potion), sans avoir à l'annoncer — ne protège pas contre Torture ni Hypnose.$abr$ WHERE nom = 'Mythomane';
UPDATE traits_raciaux SET resume_condense = $abr$En agrippant la peau nue d'une cible vivante 30 secondes, lui infliger 1 dégât pour 1 point de spiritualité — 1 fois par cycle, sans gants ni armure.$abr$ WHERE nom = 'Poigne ardente';
UPDATE traits_raciaux SET resume_condense = $abr$1 fois par événement, secouer sa barbe pour obtenir une pépite de minerai commun au hasard.$abr$ WHERE nom = 'Poussière des profondeurs';
UPDATE traits_raciaux SET resume_condense = $abr$En buvant un breuvage alcoolisé pendant un soin par Premiers Soins (hors combat, 1 boisson par soin), regagner 1 point de vie supplémentaire.$abr$ WHERE nom = 'Remède des Braves';
UPDATE traits_raciaux SET resume_condense = $abr$1 fois par événement, le premier poison reçu est neutralisé : un poison mineur est résisté automatiquement, un intermédiaire ou majeur ne requiert qu'un antidote d'un cran inférieur.$abr$ WHERE nom = 'Résistance aux poisons';
UPDATE traits_raciaux SET resume_condense = $abr$1 fois par cycle, en touchant un objet 30 secondes, détecter s'il est magique (sans en connaître les effets ni le niveau) et distinguer enchantement réel, masqué ou illusoire.$abr$ WHERE nom = 'Résonance magique';
UPDATE traits_raciaux SET resume_condense = $abr$1 fois par événement, résister au premier sort du cercle de Charme reçu.$abr$ WHERE nom = 'Sang féerique';
UPDATE traits_raciaux SET resume_condense = $abr$1 fois par événement, par une saignée de 2 minutes, produire une fiole de « Poison de douleur » valable 1 cycle.$abr$ WHERE nom = 'Sang toxique';
