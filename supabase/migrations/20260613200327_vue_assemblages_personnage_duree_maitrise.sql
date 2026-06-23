-- Lot B / PR3 — expose duree + effet_maitrise + cout_ps_maitrise sur la vue
-- assemblages de la fiche personnage (déjà appliqué en prod via MCP, prod-first).
-- Additif : 3 colonnes ajoutées EN FIN de liste (CREATE OR REPLACE compatible).
CREATE OR REPLACE VIEW public.vue_assemblages_personnage AS
 SELECT pa.id,
    pa.personnage_id,
    pa.xp_depense,
    ar.nom,
    ar.cible,
    ar.cout_ps,
    ar.description,
    ar.effet,
    ar.runes_requises,
    ar.texte_manuel,
    ar.duree,
    ar.effet_maitrise,
    ar.cout_ps_maitrise
   FROM personnage_assemblages pa
     JOIN assemblages_runes ar ON ar.id = pa.assemblage_id;
