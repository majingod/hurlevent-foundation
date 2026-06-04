-- Expose recettes_alchimie.description_verbatim dans la vue lue par la fiche perso.
-- Ajout en FIN de SELECT (contrainte CREATE OR REPLACE VIEW). Idempotent.
CREATE OR REPLACE VIEW public.vue_recettes_personnage AS
SELECT pr.id,
       pr.personnage_id,
       pr.xp_depense,
       ra.nom,
       ra.type,
       ra.niveau_requis,
       ra.description,
       ra.effet,
       ra.formule,
       ra.ingredients,
       ra.description_verbatim
FROM personnage_recettes pr
  JOIN recettes_alchimie ra ON ra.id = pr.recette_id;

