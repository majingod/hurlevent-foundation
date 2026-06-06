-- Phase 2 M3bc : masquer les dormants (statut='cree') dans les vues fiche.
-- vue_sorts_personnage / vue_prieres_personnage ne retournent plus que statut='achete'.
-- Memes colonnes/ordre qu'avant (seul un WHERE est ajoute) -> types.ts inchange.
-- Idempotente (CREATE OR REPLACE).
CREATE OR REPLACE VIEW public.vue_sorts_personnage AS
 SELECT ps.id, ps.personnage_id, ps.nom_personnalise, ps.formule_magique, ps.niveau_sort,
        ps.zone_choisie, ps.portee_choisie, ps.duree_choisie, s.cercle, s.cout_xp_base,
        s.nom AS sort_nom_base, s.description AS sort_description, s.description_courte AS sort_description_courte
   FROM personnage_sorts ps JOIN sorts s ON s.id = ps.sort_id
  WHERE ps.statut = 'achete';

CREATE OR REPLACE VIEW public.vue_prieres_personnage AS
 SELECT pp.id, pp.personnage_id, pp.nom_personnalise, pp.niveau_priere, pp.zone_choisie,
        pp.portee_choisie, pp.duree_choisie, pr.domaine, pr.description AS priere_description,
        pr.duree_incantation, pr.cout_xp_base, pr.description_courte AS priere_description_courte,
        pp.duree_incantation_calculee
   FROM personnage_prieres pp JOIN prieres pr ON pr.id = pp.priere_id
  WHERE pp.statut = 'achete';
