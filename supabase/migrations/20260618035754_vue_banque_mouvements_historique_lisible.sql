-- Historique lisible des mouvements de banque XP d'un joueur (gain mini-GN / ouverture, transfert, ajustement).
-- security_invoker => hérite de la RLS de banque_xp_mouvements (joueur voit le sien, admin voit tout)
-- ET de la RLS de profiles (acteur_nom NULL pour un joueur, rempli pour un admin).
CREATE OR REPLACE VIEW public.vue_banque_mouvements AS
  SELECT m.id, m.joueur_id, m.type_mouvement, m.montant, m.description, m.created_at,
    m.personnage_cible_id, pc.nom AS personnage_cible_nom,
    m.evenement_id, e.titre AS evenement_titre, e.type_evenement AS evenement_type,
    m.acteur_id, pr.nom_affichage AS acteur_nom,
    CASE m.type_mouvement
      WHEN 'gain_mini_gn' THEN CASE e.type_evenement
          WHEN 'mini_gn' THEN 'Mini-GN' || COALESCE(' — ' || e.titre, '')
          WHEN 'entretien_terrain' THEN 'Ouverture de terrain' || COALESCE(' — ' || e.titre, '')
          ELSE COALESCE(e.titre, 'Gain XP') END
      WHEN 'transfert_vers_personnage' THEN 'Versé à ' || COALESCE(pc.nom, 'un personnage')
      WHEN 'ajustement_admin' THEN 'Ajustement staff'
      ELSE m.type_mouvement END AS libelle
  FROM public.banque_xp_mouvements m
  LEFT JOIN public.personnages pc ON pc.id = m.personnage_cible_id
  LEFT JOIN public.evenements e ON e.id = m.evenement_id
  LEFT JOIN public.profiles pr ON pr.id = m.acteur_id;

ALTER VIEW public.vue_banque_mouvements SET (security_invoker = on);
