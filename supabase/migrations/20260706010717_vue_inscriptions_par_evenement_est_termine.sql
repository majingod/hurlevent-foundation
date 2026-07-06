-- Ajout additif de e.est_termine (fin de liste — ordre des colonnes existantes préservé)
-- pour que la File d'approbations distingue exactement Terminé / À venir
-- (groupement par événement + bouton bulk scoped, s309).
CREATE OR REPLACE VIEW public.vue_inscriptions_par_evenement AS
 SELECT i.id AS inscription_id,
    i.evenement_id,
    i.statut,
    i.xp_attribue,
    i.date_inscription,
    i.date_confirmation,
    e.titre AS evenement_titre,
    e.date_evenement,
    e.type_evenement,
    p.id AS personnage_id,
    p.nom AS personnage_nom,
    p.niveau AS personnage_niveau,
    p.pv_max,
    p.ps_max,
    p.est_mort,
    p.est_actif,
    p.est_verrouille,
    r.nom AS race_nom,
    c.nom AS classe_nom,
    pj.id AS joueur_id,
    pj.nom AS joueur_nom,
    cpt.email AS joueur_email,
    cpt.username AS joueur_username,
    e.est_termine
   FROM inscriptions_evenements i
     JOIN evenements e ON e.id = i.evenement_id
     JOIN personnages p ON p.id = i.personnage_id
     JOIN profils_joueur pj ON pj.id = i.joueur_id
     LEFT JOIN profiles cpt ON cpt.id = pj.compte_id
     LEFT JOIN races r ON r.id = p.race_id
     LEFT JOIN classes c ON c.id = p.classe_id
  ORDER BY e.date_evenement DESC, pj.nom;
