ALTER TABLE public.sorts ADD COLUMN IF NOT EXISTS effet_instance jsonb;
ALTER TABLE public.prieres ADD COLUMN IF NOT EXISTS effet_instance jsonb;

CREATE OR REPLACE VIEW public.vue_sorts_personnage AS
 SELECT ps.id,
    ps.personnage_id,
    ps.nom_personnalise,
    ps.formule_magique,
    ps.niveau_sort,
    ps.zone_choisie,
    ps.portee_choisie,
    ps.duree_choisie,
    s.cercle,
    s.cout_xp_base,
    s.nom AS sort_nom_base,
    s.description AS sort_description,
    s.description_courte AS sort_description_courte,
    s.paliers,
    s.description_tronc,
    s.bonus_niveau,
    s.effet_instance
   FROM personnage_sorts ps
     JOIN sorts s ON s.id = ps.sort_id
  WHERE ps.statut = 'achete'::text;

CREATE OR REPLACE VIEW public.vue_prieres_personnage AS
 SELECT pp.id,
    pp.personnage_id,
    pp.nom_personnalise,
    pp.niveau_priere,
    pp.zone_choisie,
    pp.portee_choisie,
    pp.duree_choisie,
    pr.domaine,
    pr.description AS priere_description,
    pr.duree_incantation,
    pr.cout_xp_base,
    pr.description_courte AS priere_description_courte,
    pp.duree_incantation_calculee,
    pr.paliers,
    pr.description_tronc,
    pr.bonus_niveau,
    pr.effet_instance
   FROM personnage_prieres pp
     JOIN prieres pr ON pr.id = pp.priere_id
  WHERE pp.statut = 'achete'::text;

UPDATE public.sorts SET effet_instance = $j${"template":"{palier} Pointer le projectile du doigt et dire « Annule ».","paliers_mode":"remplace"}$j$::jsonb
WHERE nom = $n$Globe d'Air$n$ AND cercle = 'Air';

UPDATE public.sorts SET effet_instance = $j${"template":"Bouclier énergétique absorbant **{n} dégât{s:n} de foudre**. Le bouclier disparaît à la fin de la durée.","vars":{"n":{"div":2,"arrondi":"sup"}}}$j$::jsonb
WHERE nom = 'Bouclier de Vent' AND cercle = 'Air';

UPDATE public.sorts SET effet_instance = $j${"template":"Repousse chaque cible au sol, dans le sens opposé au lanceur, sur **{n} pieds**. Annonce : « Repoussé {n} ».","vars":{"n":{"div":2,"arrondi":"sup","plus":3}}}$j$::jsonb
WHERE nom = 'Bourrasque' AND cercle = 'Air';

UPDATE public.sorts SET effet_instance = $j${"template":"Chaque cible obtient **un trait racial** d'une race au choix du lanceur ; costume associé requis.{paliers}","paliers_mode":"cumule"}$j$::jsonb
WHERE nom = $n$Altération du Corps$n$ AND cercle = $n$Altération$n$;

UPDATE public.sorts SET effet_instance = $j${"template":"L'objet ciblé **ne peut plus être soulevé**. Si l'objet est porté, le **niveau {niveau}** du sort s'oppose au niveau du porteur.{paliers}","paliers_mode":"cumule"}$j$::jsonb
WHERE nom = 'Augmentation du poids' AND cercle = $n$Altération$n$;

UPDATE public.sorts SET effet_instance = $j${"template":"Les cibles deviennent **amicales** envers le lanceur : elles cessent de l'attaquer (sans risquer leur vie pour lui). Prend fin s'il se montre hostile."}$j$::jsonb
WHERE nom = $n$Amitié$n$ AND cercle = 'Charmes';

UPDATE public.sorts SET effet_instance = $j${"template":"{palier}","paliers_mode":"remplace"}$j$::jsonb
WHERE nom = 'Domination' AND cercle = 'Charmes';
