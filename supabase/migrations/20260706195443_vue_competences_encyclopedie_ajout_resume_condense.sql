CREATE OR REPLACE VIEW public.vue_competences_encyclopedie AS
 SELECT id,
    nom,
    description,
    categorie,
    niveaux,
    est_general,
    est_actif,
    type_achat,
    type_choix,
    verrouillage_croise,
    classes_requises,
    prerequis_competences,
    recherche_tsv,
    desachat_force,
    assembler_prerequis_labels(id) AS prerequis_labels,
    resume_condense
   FROM competences c;
