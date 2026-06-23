-- DASHBOARD-JOUEUR-BANQUE / PR2 (s191)
-- Expose les compteurs de progression (GN réguliers, mini-GN, ouvertures de terrain)
-- sur la vue joueur, pour la ligne "progression" des cartes perso du tableau de bord.
-- Additif (colonnes ajoutées en fin de SELECT) + idempotent : CREATE OR REPLACE VIEW.
CREATE OR REPLACE VIEW public.vue_personnages_joueur AS
 SELECT p.id,
    p.joueur_id,
    p.nom,
    p.niveau,
    p.xp_total,
    p.xp_depense,
    p.etape_creation,
    p.est_actif,
    p.created_at,
    COALESCE(r.nom, 'Race inconnue'::text) AS race_nom,
    COALESCE(c.nom, 'Classe inconnue'::text) AS classe_nom,
    p.est_finalise,
    COALESCE(p.gn_completes, 0) AS gn_completes,
    COALESCE(p.mini_gn_completes, 0) AS mini_gn_completes,
    COALESCE(p.ouvertures_terrain, 0) AS ouvertures_terrain
   FROM personnages p
     LEFT JOIN races r ON r.id = p.race_id
     LEFT JOIN classes c ON c.id = p.classe_id
  WHERE p.est_actif = true;
