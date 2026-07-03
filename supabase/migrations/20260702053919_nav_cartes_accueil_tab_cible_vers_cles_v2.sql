-- #0-NAV : aligne cartes_accueil.tab_cible sur les cles de categorie du Moteur V2.
-- La page /encyclopedie lit ?cat=<cle_v2> ; les cartes d'accueil pointaient vers
-- d'anciennes valeurs (vestige v1). Idempotent : chaque UPDATE ne matche que
-- l'ancienne valeur, donc rejouable a froid sans effet.
UPDATE cartes_accueil SET tab_cible = 'race'         WHERE tab_cible = 'races';
UPDATE cartes_accueil SET tab_cible = 'trait_racial' WHERE tab_cible = 'traits-raciaux';
UPDATE cartes_accueil SET tab_cible = 'classe'       WHERE tab_cible = 'classes';
UPDATE cartes_accueil SET tab_cible = 'sorts'        WHERE tab_cible = 'magie';
UPDATE cartes_accueil SET tab_cible = 'lore'         WHERE tab_cible = 'monde';
