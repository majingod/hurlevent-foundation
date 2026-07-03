-- Expose le choix (cercle/domaine/etc.) dans le panneau admin des competences-maitre.
-- Nouvelle colonne ajoutee EN FIN de SELECT (contrainte CREATE OR REPLACE VIEW).
CREATE OR REPLACE VIEW public.vue_competences_maitre_admin AS
 SELECT pc.id,
    COALESCE(p.nom, 'Personnage inconnu'::text) AS personnage_nom,
    COALESCE(pj.nom, cpt.email, 'Joueur inconnu'::text) AS joueur_nom,
    COALESCE(c.nom, 'Competence inconnue'::text) AS competence_nom,
    pc.niveau_acquis,
    COALESCE(pc.nom_maitre, ''::text) AS nom_maitre,
    COALESCE(pc.statut_maitre, 'non_requis'::text) AS statut_maitre,
    pc.date_acquisition AS date_demande,
    pc.choix_achat
   FROM personnage_competences pc
     JOIN personnages p ON p.id = pc.personnage_id
     LEFT JOIN profils_joueur pj ON pj.id = p.joueur_id
     LEFT JOIN profiles cpt ON cpt.id = pj.compte_id
     LEFT JOIN competences c ON c.id = pc.competence_id
  WHERE est_animateur_ou_admin() AND pc.appris_via_maitre = true;
