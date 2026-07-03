CREATE OR REPLACE VIEW public.vue_traits_par_race AS
 SELECT rt.id AS race_trait_id,
    rt.race_id,
    rt.trait_id,
    rt.sous_type,
    r.nom AS race_nom,
    tr.nom AS trait_nom,
    tr.description AS trait_description,
    tr.cout_xp,
    tr.est_actif,
    tr.texte_manuel AS trait_texte_manuel,
    tr.resume_condense AS trait_resume_condense
   FROM race_traits rt
     JOIN races r ON r.id = rt.race_id
     JOIN traits_raciaux tr ON tr.id = rt.trait_id
  WHERE tr.est_actif = true
  ORDER BY r.nom, rt.sous_type, tr.nom;
