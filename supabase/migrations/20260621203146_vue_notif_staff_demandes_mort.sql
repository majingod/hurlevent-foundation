-- vue_notifications_staff comptait « à traiter » UNIQUEMENT pour les demandes
-- de race (LEFT JOIN personnage_races_demandes sur demande_race_nouvelle).
-- Pour une notif demande_mort_nouvelle, aucune source jointe → a_traiter = NULL
-- → le badge bouclier « Organisation » ne comptait JAMAIS les demandes de mort.
-- Une demande de mort vit dans `cimetiere` (statut 'en_attente'/'approuvee' ;
-- supprimée au refus), reference_id = cimetiere.id. On joint donc les DEUX
-- sources selon le type, et a_traiter = (la demande est en_attente).
-- Colonnes/ordre/noms INCHANGÉS (CREATE OR REPLACE VIEW, A17). security_invoker
-- ré-affirmé (A13) : la RLS de cimetiere (en_attente lisible via
-- est_animateur_ou_admin()) s'applique à l'appelant staff.
CREATE OR REPLACE VIEW public.vue_notifications_staff AS
SELECT n.id,
       n.user_id,
       n.message,
       n.type,
       n.lu,
       n.created_at,
       n.reference_id,
       n.profil_id,
       COALESCE(dr.statut, cm.statut)                    AS demande_statut,
       dr.approuve_par                                   AS traite_par_id,
       COALESCE(pr.nom_affichage, pr.username, pr.email) AS traite_par_nom,
       dr.date_approbation                               AS traite_le,
       COALESCE(dr.statut = 'en_attente', cm.statut = 'en_attente', false) AS a_traiter
  FROM notifications n
  LEFT JOIN personnage_races_demandes dr
         ON dr.id = n.reference_id AND n.type = 'demande_race_nouvelle'
  LEFT JOIN cimetiere cm
         ON cm.id = n.reference_id AND n.type = 'demande_mort_nouvelle'
  LEFT JOIN profiles pr
         ON pr.id = dr.approuve_par;

ALTER VIEW public.vue_notifications_staff SET (security_invoker = on);