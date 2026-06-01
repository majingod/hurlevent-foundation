-- Bloc 1 B3 : exposition description_courte (sorts, prieres) + carte race/classe sur la fiche
-- Idempotent (CREATE OR REPLACE). Ordre : vues sources d'abord, puis vpc qui en depend.

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
    s.description_courte AS sort_description_courte
   FROM personnage_sorts ps
     JOIN sorts s ON s.id = ps.sort_id;

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
    pr.description_courte AS priere_description_courte
   FROM personnage_prieres pp
     JOIN prieres pr ON pr.id = pp.priere_id;

CREATE OR REPLACE VIEW public.vue_personnage_creation_complet AS
 SELECT p.id,
    p.joueur_id,
    p.nom,
    p.niveau,
    p.etape_creation,
    p.est_verrouille,
    p.est_actif,
    p.est_mort,
    COALESCE(p.est_verrouille = true AND (r.est_jouable = true OR r.est_jouable = false AND demande_active.statut = 'approuvee'::text), false) AS peut_sinscrire_evenement,
    p.xp_total,
    p.xp_depense,
    COALESCE(p.xp_total, 0) - COALESCE(p.xp_depense, 0) AS xp_disponible,
    p.race_id,
    r.nom AS race_nom,
    r.nom_latin AS race_nom_latin,
    r.xp_depart AS race_xp_depart,
    r.est_jouable AS race_est_jouable,
    p.sous_type_chimeride,
    demande_active.statut AS demande_race_statut,
    demande_active.background AS demande_race_background,
    p.classe_id,
    c1.nom AS classe_nom,
    c1.pv_depart AS classe_pv_depart,
    c1.ps_depart AS classe_ps_depart,
    p.classe_secondaire_id,
    c2.nom AS classe_secondaire_nom,
    p.est_croyant,
    p.religion_id,
    rel.nom AS religion_nom,
    p.pv_max,
    p.ps_max,
    p.a_forge_legendaire,
    p.a_joaillerie_legendaire,
    p.historique,
    p.ame_personnage,
    p.gn_completes,
    p.mini_gn_completes,
    p.ouvertures_terrain,
    p.created_at,
    p.updated_at,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('trait_id', (elem.value ->> 'trait_id'::text)::uuid, 'est_gratuit', (elem.value ->> 'est_gratuit'::text)::boolean, 'xp_depense', COALESCE((elem.value ->> 'xp_depense'::text)::integer, 0), 'trait_nom', tr.nom, 'trait_description', tr.description, 'cout_xp', tr.cout_xp)) AS jsonb_agg
           FROM jsonb_array_elements(COALESCE(p.traits_raciaux_choisis, '[]'::jsonb)) elem(value)
             LEFT JOIN traits_raciaux tr ON tr.id = ((elem.value ->> 'trait_id'::text)::uuid)), '[]'::jsonb) AS traits_raciaux,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', vcp.id, 'niveau_acquis', vcp.niveau_acquis, 'xp_depense', vcp.xp_depense, 'choix_achat', vcp.choix_achat, 'appris_via_maitre', vcp.appris_via_maitre, 'nom_maitre', vcp.nom_maitre, 'statut_maitre', vcp.statut_maitre, 'nom', vcp.nom, 'categorie', vcp.categorie, 'competence_description', vcp.competence_description)) AS jsonb_agg
           FROM vue_competences_personnage vcp
          WHERE vcp.personnage_id = p.id), '[]'::jsonb) AS competences,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', vsp.id, 'nom_personnalise', vsp.nom_personnalise, 'formule_magique', vsp.formule_magique, 'niveau_sort', vsp.niveau_sort, 'zone_choisie', vsp.zone_choisie, 'portee_choisie', vsp.portee_choisie, 'duree_choisie', vsp.duree_choisie, 'cercle', vsp.cercle, 'cout_xp_base', vsp.cout_xp_base, 'sort_nom_base', vsp.sort_nom_base, 'sort_description', vsp.sort_description, 'sort_description_courte', vsp.sort_description_courte)) AS jsonb_agg
           FROM vue_sorts_personnage vsp
          WHERE vsp.personnage_id = p.id), '[]'::jsonb) AS sorts,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', vpp.id, 'nom_personnalise', vpp.nom_personnalise, 'niveau_priere', vpp.niveau_priere, 'zone_choisie', vpp.zone_choisie, 'portee_choisie', vpp.portee_choisie, 'duree_choisie', vpp.duree_choisie, 'domaine', vpp.domaine, 'priere_description', vpp.priere_description, 'priere_description_courte', vpp.priere_description_courte, 'duree_incantation', vpp.duree_incantation, 'cout_xp_base', vpp.cout_xp_base)) AS jsonb_agg
           FROM vue_prieres_personnage vpp
          WHERE vpp.personnage_id = p.id), '[]'::jsonb) AS prieres,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', vrp.id, 'xp_depense', vrp.xp_depense, 'nom', vrp.nom, 'type', vrp.type, 'niveau_requis', vrp.niveau_requis, 'description', vrp.description, 'effet', vrp.effet)) AS jsonb_agg
           FROM vue_recettes_personnage vrp
          WHERE vrp.personnage_id = p.id), '[]'::jsonb) AS recettes,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', vap.id, 'xp_depense', vap.xp_depense, 'nom', vap.nom, 'cible', vap.cible, 'cout_ps', vap.cout_ps, 'description', vap.description, 'effet', vap.effet, 'runes_requises', vap.runes_requises)) AS jsonb_agg
           FROM vue_assemblages_personnage vap
          WHERE vap.personnage_id = p.id), '[]'::jsonb) AS assemblages,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', of2.id, 'nom', of2.nom, 'description', of2.description, 'type', of2.type, 'stats', of2.stats, 'temps_fabrication_minutes', of2.temps_fabrication_minutes, 'materiaux_communs', of2.materiaux_communs, 'materiaux_rares', of2.materiaux_rares)) AS jsonb_agg
           FROM objets_forge of2
          WHERE of2.est_actif = true AND (EXISTS ( SELECT 1
                   FROM vue_artisanat_etat vae
                  WHERE vae.personnage_id = p.id AND vae.niveau_forge >= 1))), '[]'::jsonb) AS objets_forge,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', oj.id, 'nom', oj.nom, 'description', oj.description, 'effet', oj.effet, 'temps_fabrication_minutes', oj.temps_fabrication_minutes, 'temps_rare_minutes', oj.temps_rare_minutes, 'materiaux_communs', oj.materiaux_communs, 'materiaux_rares', oj.materiaux_rares)) AS jsonb_agg
           FROM objets_joaillerie oj
          WHERE oj.est_actif = true AND (EXISTS ( SELECT 1
                   FROM vue_artisanat_etat vae
                  WHERE vae.personnage_id = p.id AND vae.niveau_joaillerie >= 1))), '[]'::jsonb) AS objets_joaillerie,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('cercle', vcd.cercle, 'niveau_max_sorts', vcd.niveau_max_sorts)) AS jsonb_agg
           FROM vue_cercles_disponibles vcd
          WHERE vcd.personnage_id = p.id), '[]'::jsonb) AS cercles_acquis,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('domaine', vdd.domaine, 'niveau_max_prieres', vdd.niveau_max_prieres)) AS jsonb_agg
           FROM vue_domaines_disponibles vdd
          WHERE vdd.personnage_id = p.id), '[]'::jsonb) AS domaines_acquis,
    ( SELECT to_jsonb(vaq.*) - 'personnage_id'::text
           FROM vue_artisanat_quotas vaq
          WHERE vaq.personnage_id = p.id) AS quotas_artisanat,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', rf.id, 'nom_affichage', rf.nom_affichage, 'categorie', rf.categorie, 'temps_minutes', rf.temps_minutes, 'temps_rare_minutes', rf.temps_rare_minutes, 'materiaux', rf.materiaux, 'materiaux_rares', rf.materiaux_rares, 'notes', rf.notes)) AS jsonb_agg
           FROM reparations_forge rf
          WHERE rf.est_actif = true AND (EXISTS ( SELECT 1
                   FROM vue_artisanat_etat vae
                  WHERE vae.personnage_id = p.id AND vae.niveau_forge >= 1))), '[]'::jsonb) AS reparations_forge
   FROM personnages p
     LEFT JOIN races r ON r.id = p.race_id
     LEFT JOIN classes c1 ON c1.id = p.classe_id
     LEFT JOIN classes c2 ON c2.id = p.classe_secondaire_id
     LEFT JOIN religions rel ON rel.id = p.religion_id
     LEFT JOIN LATERAL ( SELECT prd.statut,
            prd.background
           FROM personnage_races_demandes prd
          WHERE prd.personnage_id = p.id
          ORDER BY prd.created_at DESC NULLS LAST
         LIMIT 1) demande_active ON true;

CREATE OR REPLACE VIEW public.vue_fiche_personnage AS
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
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', tr.id, 'nom', tr.nom, 'description', tr.description, 'cout_xp', tr.cout_xp, 'xp_depense', (t.value ->> 'xp_depense'::text)::integer, 'est_gratuit', (t.value ->> 'est_gratuit'::text)::boolean) ORDER BY tr.nom) AS jsonb_agg
           FROM jsonb_array_elements(p.traits_raciaux_choisis) t(value)
             LEFT JOIN traits_raciaux tr ON tr.id = ((t.value ->> 'trait_id'::text)::uuid)), '[]'::jsonb) AS traits_raciaux_choisis,
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
    c.role_combat AS classe_role_combat
   FROM personnages p
     LEFT JOIN races r ON r.id = p.race_id
     LEFT JOIN classes c ON c.id = p.classe_id
     LEFT JOIN religions rel ON rel.id = p.religion_id;
