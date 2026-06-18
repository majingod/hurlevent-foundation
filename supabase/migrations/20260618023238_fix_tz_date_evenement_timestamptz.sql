-- BUG-TZ-ÉVÉNEMENTS : date_evenement timestamp(sans tz) -> timestamptz
-- Réinterprète l'existant comme UTC (instant préservé, affichage corrigé).
-- Idempotent : ALTER conditionnel + DROP IF EXISTS + recréation des 6 vues dépendantes.

DROP VIEW IF EXISTS vue_evenements_admin;
DROP VIEW IF EXISTS vue_evenements_publies;
DROP VIEW IF EXISTS vue_inscriptions_par_evenement;
DROP VIEW IF EXISTS vue_inscriptions_resumees;
DROP VIEW IF EXISTS vue_prochain_evenement;
DROP VIEW IF EXISTS vue_stats_admin;

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='evenements' AND column_name='date_evenement')
     = 'timestamp without time zone' THEN
    ALTER TABLE evenements
      ALTER COLUMN date_evenement TYPE timestamptz
      USING date_evenement AT TIME ZONE 'UTC';
  END IF;
END $$;

CREATE VIEW vue_evenements_admin AS
 SELECT e.id, e.titre, e.description,
    e.date_evenement AS date_debut,
    e.date_fin, e.lieu,
    count(i.id)::integer AS nb_participants,
    COALESCE(e.est_publie, false) AS est_publie
   FROM evenements e
     LEFT JOIN inscriptions_evenements i ON i.evenement_id = e.id
  WHERE est_animateur_ou_admin()
  GROUP BY e.id, e.titre, e.description, e.date_evenement, e.date_fin, e.lieu, e.est_publie;

CREATE VIEW vue_evenements_publies AS
 SELECT id, titre, date_evenement, date_fin, lieu, type_evenement,
    xp_recompense, max_participants, description,
    COALESCE(( SELECT count(*)::integer AS count
           FROM inscriptions_evenements ie
          WHERE ie.evenement_id = e.id AND (ie.statut = ANY (ARRAY['en_attente'::text, 'present'::text]))), 0) AS nb_inscrits,
    niveaux_recompense, adresse_physique
   FROM evenements e
  WHERE est_publie = true
  ORDER BY date_evenement;

CREATE VIEW vue_inscriptions_par_evenement AS
 SELECT i.id AS inscription_id, i.evenement_id, i.statut, i.xp_attribue,
    i.date_inscription, i.date_confirmation,
    e.titre AS evenement_titre, e.date_evenement, e.type_evenement,
    p.id AS personnage_id, p.nom AS personnage_nom, p.niveau AS personnage_niveau,
    p.pv_max, p.ps_max, p.est_mort, p.est_actif, p.est_verrouille,
    r.nom AS race_nom, c.nom AS classe_nom,
    pj.id AS joueur_id, pj.nom AS joueur_nom,
    cpt.email AS joueur_email, cpt.username AS joueur_username
   FROM inscriptions_evenements i
     JOIN evenements e ON e.id = i.evenement_id
     JOIN personnages p ON p.id = i.personnage_id
     JOIN profils_joueur pj ON pj.id = i.joueur_id
     LEFT JOIN profiles cpt ON cpt.id = pj.compte_id
     LEFT JOIN races r ON r.id = p.race_id
     LEFT JOIN classes c ON c.id = p.classe_id
  ORDER BY e.date_evenement DESC, pj.nom;

CREATE VIEW vue_inscriptions_resumees AS
 SELECT i.id, i.joueur_id, i.personnage_id, i.evenement_id, i.statut, i.xp_attribue,
    i.date_inscription,
    e.titre AS evenement_titre, e.date_evenement, e.date_fin, e.lieu,
    e.type_evenement, e.xp_recompense, e.max_participants,
    p.nom AS personnage_nom, pj.nom AS joueur_nom,
    ( SELECT count(*) AS count
           FROM inscriptions_evenements ie2
          WHERE ie2.evenement_id = i.evenement_id AND ie2.statut = 'present'::text) AS nb_inscrits_confirmes
   FROM inscriptions_evenements i
     JOIN evenements e ON i.evenement_id = e.id
     JOIN personnages p ON i.personnage_id = p.id
     JOIN profils_joueur pj ON i.joueur_id = pj.id;

CREATE VIEW vue_prochain_evenement AS
 SELECT e.id, e.titre, e.description, e.date_evenement, e.date_fin, e.lieu,
    e.xp_recompense, e.max_participants, e.type_evenement, e.est_publie, e.created_by,
    count(i.id) FILTER (WHERE i.statut <> 'annule'::text) AS nb_inscrits,
        CASE
            WHEN e.max_participants IS NULL THEN NULL::bigint
            ELSE e.max_participants - count(i.id) FILTER (WHERE i.statut <> 'annule'::text)
        END AS places_restantes
   FROM evenements e
     LEFT JOIN inscriptions_evenements i ON i.evenement_id = e.id
  WHERE e.est_publie = true AND e.date_evenement > now()
  GROUP BY e.id
  ORDER BY e.date_evenement
 LIMIT 1;

CREATE VIEW vue_stats_admin AS
 SELECT ( SELECT count(*) AS count FROM profiles WHERE profiles.role = 'joueur'::text) AS nb_joueurs,
    ( SELECT count(*) AS count FROM personnages WHERE personnages.est_actif = true AND personnages.est_mort = false) AS nb_personnages_actifs,
    ( SELECT count(*) AS count FROM inscriptions_evenements WHERE inscriptions_evenements.statut = 'en_attente'::text) AS nb_presences_attente,
    ( SELECT count(*) AS count FROM personnage_competences WHERE personnage_competences.statut_maitre = 'en_attente'::text) AS nb_competences_attente,
    ( SELECT evenements.titre FROM evenements WHERE evenements.est_publie = true AND evenements.date_evenement > now() ORDER BY evenements.date_evenement LIMIT 1) AS prochain_evenement_titre,
    ( SELECT evenements.date_evenement FROM evenements WHERE evenements.est_publie = true AND evenements.date_evenement > now() ORDER BY evenements.date_evenement LIMIT 1) AS prochain_evenement_date,
    ( SELECT count(*) AS count FROM personnage_races_demandes WHERE personnage_races_demandes.statut = 'en_attente'::text) AS nb_races_attente
   FROM ( SELECT 1 AS "?column?" WHERE est_animateur_ou_admin()) garde;
