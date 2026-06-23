-- Fix régression multi-profils : personnages.joueur_id -> profils_joueur (pas profiles).
-- Les 2 vues races joignaient l'ancienne table profiles => 0 ligne (INNER JOIN mort).
-- Chaîne correcte : personnages -> profils_joueur (nom) -> profiles (email du compte).
-- Colonnes de sortie inchangées (noms/ordre/types) => CREATE OR REPLACE valide.

CREATE OR REPLACE VIEW public.vue_demandes_races_attente AS
SELECT prd.id,
    prd.personnage_id,
    p.nom AS personnage_nom,
    p.niveau AS personnage_niveau,
    p.joueur_id,
    pj.nom AS joueur_nom,
    compte.email AS joueur_email,
    r.id AS race_id,
    r.nom AS race_nom,
    r.nom_latin AS race_nom_latin,
    prd.background,
    prd.created_at AS date_demande
   FROM public.personnage_races_demandes prd
     JOIN public.personnages p ON p.id = prd.personnage_id
     JOIN public.profils_joueur pj ON pj.id = p.joueur_id
     JOIN public.profiles compte ON compte.id = pj.compte_id
     JOIN public.races r ON r.id = prd.race_id
  WHERE prd.statut = 'en_attente'::text
  ORDER BY prd.created_at;

CREATE OR REPLACE VIEW public.vue_demandes_races_complet AS
SELECT prd.id,
    prd.personnage_id,
    p.nom AS personnage_nom,
    p.niveau AS personnage_niveau,
    p.joueur_id,
    pj.nom AS joueur_nom,
    compte.email AS joueur_email,
    r.id AS race_id,
    r.nom AS race_nom,
    r.nom_latin AS race_nom_latin,
    prd.background,
    prd.statut,
    prd.raison_refus,
    prd.approuve_par,
    approuveur.nom_affichage AS approuve_par_nom,
    prd.created_at AS date_demande,
    prd.date_approbation
   FROM public.personnage_races_demandes prd
     JOIN public.personnages p ON p.id = prd.personnage_id
     JOIN public.profils_joueur pj ON pj.id = p.joueur_id
     JOIN public.profiles compte ON compte.id = pj.compte_id
     JOIN public.races r ON r.id = prd.race_id
     LEFT JOIN public.profiles approuveur ON approuveur.id = prd.approuve_par
  ORDER BY prd.created_at DESC;
