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
    ee.j ->> 'etat'::text AS etat,
    ee.j ->> 'evenement_inscrit_titre'::text AS evenement_inscrit_titre,
    (ee.j ->> 'evenement_inscrit_date'::text)::timestamptz AS evenement_inscrit_date,
    (ee.j ->> 'dans_fenetre_gel'::text)::boolean AS dans_fenetre_gel
   FROM personnages p
     LEFT JOIN races r ON r.id = p.race_id
     LEFT JOIN classes c ON c.id = p.classe_id
     LEFT JOIN LATERAL (SELECT public.etat_edition_personnage(p.id) AS j) ee ON true
  WHERE p.est_actif = true;
