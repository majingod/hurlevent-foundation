-- Expose etat_edition_personnage(id)->>'etat' en fin de vue_personnages_joueur.
-- Permet au tableau de bord de griser « Transférer… » sur les persos gelés/morts.
-- Idempotent (CREATE OR REPLACE VIEW). Déjà appliqué en prod (s227).
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
    COALESCE(p.ouvertures_terrain, 0) AS ouvertures_terrain,
    (public.etat_edition_personnage(p.id) ->> 'etat') AS etat
   FROM personnages p
     LEFT JOIN races r ON r.id = p.race_id
     LEFT JOIN classes c ON c.id = p.classe_id
  WHERE p.est_actif = true;
