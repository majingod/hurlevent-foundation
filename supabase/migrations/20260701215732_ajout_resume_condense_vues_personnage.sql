-- EXPAND : exposer les colonnes canon abrégé (resume_condense) dans les 5 vues personnage.
-- Nouvelles colonnes en FIN de SELECT (contrainte CREATE OR REPLACE VIEW).
-- Le JSONB traits gagne les clés resume_condense + texte_manuel (contenu JSONB = pas une colonne, sans risque).

CREATE OR REPLACE VIEW vue_fiche_personnage AS
 SELECT p.id,
    p.nom,
    p.niveau,
    p.xp_total,
    p.xp_depense,
    p.pv_max,
    p.ps_max,
    p.historique,
    p.ame_personnage,
    p.joueur_id,
    p.race_id,
    p.classe_id,
    p.religion_id,
    p.gn_completes,
    p.mini_gn_completes,
    p.ouvertures_terrain,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object(
                'id', tr.id,
                'nom', tr.nom,
                'description', tr.description,
                'cout_xp', tr.cout_xp,
                'xp_depense', (t.value ->> 'xp_depense')::integer,
                'est_gratuit', (t.value ->> 'est_gratuit')::boolean,
                'resume_condense', tr.resume_condense,
                'texte_manuel', tr.texte_manuel) ORDER BY tr.nom)
           FROM jsonb_array_elements(p.traits_raciaux_choisis) t(value)
             LEFT JOIN traits_raciaux tr ON tr.id = (t.value ->> 'trait_id')::uuid), '[]'::jsonb) AS traits_raciaux_choisis,
    p.est_actif,
    p.est_mort,
    r.nom AS race_nom,
    r.nom_latin AS race_nom_latin,
    c.nom AS classe_nom,
    rel.nom AS religion_nom,
    r.emoji AS race_emoji,
    r.description AS race_description,
    r.description_courte AS race_description_courte,
    r.esperance_vie AS race_esperance_vie,
    r.exigences_costume AS race_exigences_costume,
    r.image_url AS race_image_url,
    c.emoji AS classe_emoji,
    c.description AS classe_description,
    c.description_courte AS classe_description_courte,
    c.role_combat AS classe_role_combat,
    r.resume_condense AS race_resume_condense,
    c.resume_condense AS classe_resume_condense
   FROM personnages p
     LEFT JOIN races r ON r.id = p.race_id
     LEFT JOIN classes c ON c.id = p.classe_id
     LEFT JOIN religions rel ON rel.id = p.religion_id;

CREATE OR REPLACE VIEW vue_sorts_personnage AS
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
    s.effet_instance,
    s.type_sort,
    s.resume_condense AS sort_resume_condense
   FROM personnage_sorts ps
     JOIN sorts s ON s.id = ps.sort_id
  WHERE ps.statut = 'achete'::text;

CREATE OR REPLACE VIEW vue_prieres_personnage AS
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
    pr.effet_instance,
    pr.type_priere,
    pr.resume_condense AS priere_resume_condense
   FROM personnage_prieres pp
     JOIN prieres pr ON pr.id = pp.priere_id
  WHERE pp.statut = 'achete'::text;

CREATE OR REPLACE VIEW vue_competences_personnage AS
 SELECT pc.id,
    pc.personnage_id,
    pc.niveau_acquis,
    pc.xp_depense,
    pc.choix_achat,
    pc.appris_via_maitre,
    pc.nom_maitre,
    COALESCE(pc.statut_maitre, 'non_requis'::text) AS statut_maitre,
    comp.nom,
    comp.categorie,
    comp.description AS competence_description,
    ( SELECT n.value ->> 'description'
           FROM jsonb_array_elements(comp.niveaux) n(value)
          WHERE (n.value ->> 'niveau')::integer = pc.niveau_acquis
         LIMIT 1) AS description_niveau_acquis,
    pc.competence_id,
    comp.type_achat,
    ( SELECT max((n.value ->> 'niveau')::integer)
           FROM jsonb_array_elements(comp.niveaux) n(value)) AS niveau_max,
    comp.resume_condense AS competence_resume_condense,
    ( SELECT n.value ->> 'description_courte'
           FROM jsonb_array_elements(comp.niveaux) n(value)
          WHERE (n.value ->> 'niveau')::integer = pc.niveau_acquis
         LIMIT 1) AS description_courte_niveau_acquis
   FROM personnage_competences pc
     JOIN competences comp ON comp.id = pc.competence_id;

CREATE OR REPLACE VIEW vue_assemblages_personnage AS
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
    ar.cout_ps_maitrise,
    ar.resume_condense
   FROM personnage_assemblages pa
     JOIN assemblages_runes ar ON ar.id = pa.assemblage_id;
