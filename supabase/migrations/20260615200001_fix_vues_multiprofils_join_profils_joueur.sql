-- Régression multi-profils : personnages/inscriptions_evenements.joueur_id -> profils_joueur.
-- 9 vues joignaient encore l'ancienne table profiles directement sur .joueur_id.
-- Profils PRINCIPAUX (même id que l'ancien profiles) passaient ; profils SECONDAIRES cassaient
-- (INNER = lignes perdues, LEFT = nom/email NULL). ~13/26 persos affectés.
-- Patron : JOIN joueur sur profils_joueur (nom) ; email/username via LEFT JOIN profiles (compte_id).
-- joueur_nom = nom du PROFIL DE JEU (pj.nom), cohérent avec la correction des vues races.
-- Colonnes de sortie inchangées (noms/ordre/types) => CREATE OR REPLACE valide.

CREATE OR REPLACE VIEW public.vue_competences_maitre_attente AS
SELECT pc.id, pc.niveau_acquis, pc.nom_maitre, pc.statut_maitre, pc.xp_depense,
  pc.personnage_id, c.nom AS competence_nom, c.description AS competence_description,
  p.nom AS personnage_nom, p.niveau AS personnage_niveau, pj.nom AS joueur_nom, pj.id AS joueur_id
FROM personnage_competences pc
  JOIN competences c ON pc.competence_id = c.id
  JOIN personnages p ON pc.personnage_id = p.id
  JOIN profils_joueur pj ON p.joueur_id = pj.id
WHERE pc.appris_via_maitre = true
ORDER BY pc.statut_maitre, pj.nom;

CREATE OR REPLACE VIEW public.vue_inscriptions_par_evenement AS
SELECT i.id AS inscription_id, i.evenement_id, i.statut, i.xp_attribue, i.date_inscription,
  i.date_confirmation, e.titre AS evenement_titre, e.date_evenement, e.type_evenement,
  p.id AS personnage_id, p.nom AS personnage_nom, p.niveau AS personnage_niveau, p.pv_max, p.ps_max,
  p.est_mort, p.est_actif, p.est_verrouille, r.nom AS race_nom, c.nom AS classe_nom,
  pj.id AS joueur_id, pj.nom AS joueur_nom, cpt.email AS joueur_email, cpt.username AS joueur_username
FROM inscriptions_evenements i
  JOIN evenements e ON e.id = i.evenement_id
  JOIN personnages p ON p.id = i.personnage_id
  JOIN profils_joueur pj ON pj.id = i.joueur_id
  LEFT JOIN profiles cpt ON cpt.id = pj.compte_id
  LEFT JOIN races r ON r.id = p.race_id
  LEFT JOIN classes c ON c.id = p.classe_id
ORDER BY e.date_evenement DESC, pj.nom;

CREATE OR REPLACE VIEW public.vue_inscriptions_resumees AS
SELECT i.id, i.joueur_id, i.personnage_id, i.evenement_id, i.statut, i.xp_attribue, i.date_inscription,
  e.titre AS evenement_titre, e.date_evenement, e.date_fin, e.lieu, e.type_evenement, e.xp_recompense,
  e.max_participants, p.nom AS personnage_nom, pj.nom AS joueur_nom,
  (SELECT count(*) FROM inscriptions_evenements ie2 WHERE ie2.evenement_id = i.evenement_id AND ie2.statut = 'present') AS nb_inscrits_confirmes
FROM inscriptions_evenements i
  JOIN evenements e ON i.evenement_id = e.id
  JOIN personnages p ON i.personnage_id = p.id
  JOIN profils_joueur pj ON i.joueur_id = pj.id;

CREATE OR REPLACE VIEW public.vue_joueurs_maitres AS
SELECT DISTINCT pj.id AS joueur_id, pj.nom AS joueur_nom, p.id AS personnage_id, p.nom AS personnage_nom,
  r.nom AS race, c.nom AS classe, p.niveau, p.xp_total
FROM personnage_competences pc
  JOIN personnages p ON pc.personnage_id = p.id
  JOIN profils_joueur pj ON p.joueur_id = pj.id
  JOIN races r ON p.race_id = r.id
  JOIN classes c ON p.classe_id = c.id
WHERE pc.niveau_acquis = 3 AND pc.statut_maitre = ANY(ARRAY['non_requis','approuve']) AND p.est_actif = true AND p.est_mort = false
ORDER BY pj.nom;

CREATE OR REPLACE VIEW public.vue_competences_maitre_admin AS
SELECT pc.id,
  COALESCE(p.nom, 'Personnage inconnu') AS personnage_nom,
  COALESCE(pj.nom, cpt.email, 'Joueur inconnu') AS joueur_nom,
  COALESCE(c.nom, 'Compétence inconnue') AS competence_nom,
  pc.niveau_acquis, COALESCE(pc.nom_maitre, '') AS nom_maitre,
  COALESCE(pc.statut_maitre, 'non_requis') AS statut_maitre, pc.date_acquisition AS date_demande
FROM personnage_competences pc
  JOIN personnages p ON p.id = pc.personnage_id
  LEFT JOIN profils_joueur pj ON pj.id = p.joueur_id
  LEFT JOIN profiles cpt ON cpt.id = pj.compte_id
  LEFT JOIN competences c ON c.id = pc.competence_id
WHERE est_animateur_ou_admin() AND pc.appris_via_maitre = true;

CREATE OR REPLACE VIEW public.vue_personnages_admin AS
SELECT p.id, p.nom,
  COALESCE(pj.nom, cpt.email, 'Joueur inconnu') AS joueur_nom,
  COALESCE(r.nom, 'Race inconnue') AS race_nom,
  COALESCE(c.nom, 'Classe inconnue') AS classe_nom,
  COALESCE(p.niveau, 1) AS niveau, p.est_actif, p.etape_creation, p.created_at
FROM personnages p
  LEFT JOIN profils_joueur pj ON pj.id = p.joueur_id
  LEFT JOIN profiles cpt ON cpt.id = pj.compte_id
  LEFT JOIN races r ON r.id = p.race_id
  LEFT JOIN classes c ON c.id = p.classe_id
WHERE est_animateur_ou_admin();

CREATE OR REPLACE VIEW public.vue_personnages_admin_complet AS
SELECT p.id, p.nom, p.joueur_id,
  COALESCE(pj.nom, cpt.email, 'Joueur inconnu') AS joueur_nom,
  COALESCE(r.nom, 'Race inconnue') AS race_nom,
  COALESCE(c.nom, 'Classe inconnue') AS classe_nom,
  cs.nom AS classe_secondaire_nom, rel.nom AS religion_nom, fc.nom AS famille_nom,
  COALESCE(p.niveau, 1) AS niveau, p.xp_total, p.xp_depense, p.est_actif, p.est_mort,
  p.est_finalise, p.est_verrouille, p.etape_creation, p.created_at,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('nom', tr.nom) ORDER BY tr.nom)
    FROM jsonb_array_elements(p.traits_raciaux_choisis) t(elem)
    JOIN traits_raciaux tr ON tr.id = ((t.elem ->> 'trait_id'))::uuid), '[]'::jsonb) AS traits_raciaux,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('nom', x.nom, 'niveau', x.niv) ORDER BY x.nom)
    FROM (SELECT co.nom, max(pc.niveau_acquis) AS niv FROM personnage_competences pc
      JOIN competences co ON co.id = pc.competence_id WHERE pc.personnage_id = p.id GROUP BY co.nom) x), '[]'::jsonb) AS competences,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('nom', x.nom, 'niveau', x.niv) ORDER BY x.nom)
    FROM (SELECT s.nom, max(ps.niveau_sort) AS niv FROM personnage_sorts ps
      JOIN sorts s ON s.id = ps.sort_id WHERE ps.personnage_id = p.id GROUP BY s.nom) x), '[]'::jsonb) AS sorts,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('nom', x.nom, 'niveau', x.niv) ORDER BY x.nom)
    FROM (SELECT pi.nom, max(pp.niveau_priere) AS niv FROM personnage_prieres pp
      JOIN prieres pi ON pi.id = pp.priere_id WHERE pp.personnage_id = p.id GROUP BY pi.nom) x), '[]'::jsonb) AS prieres,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('nom', x.nom) ORDER BY x.nom)
    FROM (SELECT DISTINCT ar.nom FROM personnage_assemblages pa
      JOIN assemblages_runes ar ON ar.id = pa.assemblage_id WHERE pa.personnage_id = p.id) x), '[]'::jsonb) AS assemblages,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('nom', x.nom) ORDER BY x.nom)
    FROM (SELECT DISTINCT ra.nom FROM personnage_recettes prc
      JOIN recettes_alchimie ra ON ra.id = prc.recette_id WHERE prc.personnage_id = p.id) x), '[]'::jsonb) AS recettes,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('nom', x.nom, 'niveau', x.niv) ORDER BY x.nom)
    FROM (SELECT pp2.piege_nom AS nom, max(pp2.niveau_acquis) AS niv FROM personnage_pieges pp2
      WHERE pp2.personnage_id = p.id GROUP BY pp2.piege_nom) x), '[]'::jsonb) AS pieges
FROM personnages p
  LEFT JOIN profils_joueur pj ON pj.id = p.joueur_id
  LEFT JOIN profiles cpt ON cpt.id = pj.compte_id
  LEFT JOIN races r ON r.id = p.race_id
  LEFT JOIN classes c ON c.id = p.classe_id
  LEFT JOIN classes cs ON cs.id = p.classe_secondaire_id
  LEFT JOIN religions rel ON rel.id = p.religion_id
  LEFT JOIN familles_criminelles fc ON fc.id = p.famille_criminelle_id
WHERE est_animateur_ou_admin();

CREATE OR REPLACE VIEW public.vue_tableau_de_bord AS
SELECT p.id, p.joueur_id, p.nom, p.niveau, p.xp_total, p.xp_depense, p.est_mort, p.est_actif,
  p.date_creation, r.nom AS race_nom, c1.nom AS classe_nom, c2.nom AS classe_secondaire_nom, cpt.email AS joueur_email
FROM personnages p
  LEFT JOIN races r ON p.race_id = r.id
  LEFT JOIN classes c1 ON p.classe_id = c1.id
  LEFT JOIN classes c2 ON p.classe_secondaire_id = c2.id
  LEFT JOIN profils_joueur pj ON p.joueur_id = pj.id
  LEFT JOIN profiles cpt ON cpt.id = pj.compte_id;

CREATE OR REPLACE VIEW public.vue_xp_personnage AS
SELECT p.id, p.nom, p.joueur_id, p.xp_total, p.xp_depense, (p.xp_total - p.xp_depense) AS xp_disponible,
  p.niveau, p.pv_max, p.ps_max, p.est_actif, p.est_mort, p.est_verrouille, p.etape_creation,
  p.gn_completes, p.mini_gn_completes, p.ouvertures_terrain, r.nom AS race_nom, r.nom_latin AS race_latin,
  c.nom AS classe_nom, c.pv_depart, c.ps_depart, rel.nom AS religion_nom, fc.nom AS famille_nom, pj.nom AS joueur_nom
FROM personnages p
  LEFT JOIN races r ON p.race_id = r.id
  LEFT JOIN classes c ON p.classe_id = c.id
  LEFT JOIN religions rel ON p.religion_id = rel.id
  LEFT JOIN familles_criminelles fc ON p.famille_criminelle_id = fc.id
  LEFT JOIN profils_joueur pj ON p.joueur_id = pj.id;
