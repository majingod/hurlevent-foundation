-- Cloche STAFF "Organisation" : notifications enrichies de l'état de traitement.
-- Pour chaque notif dont reference_id pointe une demande de race, on joint
-- l'etat de la demande (source UNIQUE de "traite") + le nom du traitant.
-- La taxonomie des types staff reste cote front (filtre .in('type', TYPES_STAFF)).
-- security_invoker = true : herite des RLS de notifications (chaque compte ne
-- voit que ses notifs), personnage_races_demandes et profiles (staff lit tout
-- en mode actif). Pas de duplication d'etat sur les copies fan-out.
CREATE OR REPLACE VIEW public.vue_notifications_staff
WITH (security_invoker = true) AS
SELECT
  n.id,
  n.user_id,
  n.message,
  n.type,
  n.lu,
  n.created_at,
  n.reference_id,
  n.profil_id,
  d.statut                                             AS demande_statut,
  d.approuve_par                                       AS traite_par_id,
  coalesce(pr.nom_affichage, pr.username, pr.email)    AS traite_par_nom,
  d.date_approbation                                   AS traite_le,
  -- A traiter : la notif correspond a une demande encore en attente.
  -- (demande absente / supprimee => false, n'alourdit pas le compteur.)
  (d.statut = 'en_attente')                            AS a_traiter
FROM public.notifications n
LEFT JOIN public.personnage_races_demandes d
  ON d.id = n.reference_id AND n.type = 'demande_race_nouvelle'
LEFT JOIN public.profiles pr
  ON pr.id = d.approuve_par;
