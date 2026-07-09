-- LOT 2 (s318): drop description_courte (races/classes/sorts/prieres)
-- + swap recherche -> resume_condense (canon abrege) dans rechercher_encyclopedie + races.recherche_tsv
-- + 4 vues recreees AVEC security_invoker=on (anti-fuite s315) + re-verrouillage EXECUTE (A37)
-- Archive de securite des 272 textes. NE TOUCHE PAS competences.niveaux[].description_courte.

CREATE OR REPLACE FUNCTION public.rechercher_encyclopedie(p_terme text)
 RETURNS TABLE(type text, id uuid, titre text, sous_titre text, categorie text, snippet text, rang real)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_t text; v_pat text;
BEGIN
  IF p_terme IS NULL OR length(trim(p_terme)) < 3 THEN RETURN; END IF;
  v_t := public.f_unaccent(trim(p_terme));
  v_pat := '%' || replace(replace(replace(v_t, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  RETURN QUERY
  ( SELECT 'lore'::text AS type, l.id AS id, l.nom AS titre, l.sous_titre AS sous_titre, l.categorie AS categorie, public._snip_contient(g.c, v_t) AS snippet, (CASE WHEN public.f_unaccent(l.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real AS rang
    FROM lore l, LATERAL (SELECT coalesce(l.nom,'')||' '||coalesce(l.sous_titre,'')||' '||coalesce(l.description,'') AS c) g WHERE l.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL ( SELECT 'bestiaire'::text, b.id, b.nom, NULL::text, b.categorie, public._snip_contient(g.c, v_t), (CASE WHEN public.f_unaccent(b.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM bestiaire b, LATERAL (SELECT coalesce(b.nom,'')||' '||coalesce(b.categorie,'')||' '||coalesce(b.description,'')||' '||coalesce(b.immunites,'')||' '||coalesce(b.capacites_speciales,'') AS c) g WHERE b.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL ( SELECT 'religion'::text, r.id, r.nom, r.dirigeant, 'religion'::text, public._snip_contient(g.c, v_t), (CASE WHEN public.f_unaccent(r.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM religions r, LATERAL (SELECT coalesce(r.nom,'')||' '||coalesce(r.dirigeant,'')||' '||coalesce(r.fondateur,'')||' '||coalesce(r.description,'')||' '||coalesce(r.lore_fiche,'')||' '||coalesce(r.description_longue,'')||' '||coalesce(r.lore_manuel,'')||' '||coalesce(array_to_string(r.rituels_manuel,' '),'')||' '||coalesce(r.pouvoir_symbole,'') AS c) g WHERE r.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL ( SELECT 'competence'::text, c.id, c.nom, NULL::text, c.categorie, public._snip_contient(g.c, v_t), (CASE WHEN public.f_unaccent(c.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM competences c, LATERAL (SELECT coalesce(c.nom,'')||' '||coalesce(c.categorie,'')||' '||coalesce(c.description,'') AS c) g WHERE c.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL ( SELECT 'sort'::text, s.id, s.nom, s.cercle, s.type_sort, public._snip_contient(g.c, v_t), (CASE WHEN public.f_unaccent(s.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM sorts s, LATERAL (SELECT coalesce(s.nom,'')||' '||coalesce(s.cercle,'')||' '||coalesce(s.type_sort,'')||' '||coalesce(s.description,'') AS c) g WHERE s.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL ( SELECT 'priere'::text, p.id, p.nom, p.domaine, p.type_priere, public._snip_contient(g.c, v_t), (CASE WHEN public.f_unaccent(p.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM prieres p, LATERAL (SELECT coalesce(p.nom,'')||' '||coalesce(p.domaine,'')||' '||coalesce(p.type_priere,'')||' '||coalesce(p.description,'') AS c) g WHERE p.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL ( SELECT 'regle'::text, sr.id, sr.titre, sr.categorie, 'regle'::text, public._snip_contient(g.c, v_t), (CASE WHEN public.f_unaccent(sr.titre) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM sections_regles sr, LATERAL (SELECT coalesce(sr.titre,'')||' '||coalesce(sr.categorie,'')||' '||coalesce(sr.contenu,'') AS c) g WHERE sr.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL ( SELECT 'race'::text, ra.id, ra.nom, NULL::text, 'race'::text, public._snip_contient(g.c, v_t), (CASE WHEN public.f_unaccent(ra.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM races ra, LATERAL (SELECT coalesce(ra.nom,'')||' '||coalesce(ra.description,'')||' '||coalesce(ra.resume_condense,'') AS c) g WHERE ra.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL ( SELECT 'trait_racial'::text, tr.id, tr.nom, NULL::text, 'trait_racial'::text, public._snip_contient(g.c, v_t), (CASE WHEN public.f_unaccent(tr.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM traits_raciaux tr, LATERAL (SELECT coalesce(tr.nom,'')||' '||coalesce(tr.description,'') AS c) g WHERE tr.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL ( SELECT 'classe'::text, cl.id, cl.nom, cl.role_combat, 'classe'::text, public._snip_contient(g.c, v_t), (CASE WHEN public.f_unaccent(cl.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM classes cl, LATERAL (SELECT coalesce(cl.nom,'')||' '||coalesce(cl.description,'')||' '||coalesce(cl.role_combat,'') AS c) g WHERE cl.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL ( SELECT 'forge'::text, f.id, f.nom, f.type, 'forge'::text, public._snip_contient(g.c, v_t), (CASE WHEN public.f_unaccent(f.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM objets_forge f, LATERAL (SELECT coalesce(f.nom,'')||' '||coalesce(f.description,'')||' '||coalesce(f.effet,'')||' '||coalesce(f.type,'') AS c) g WHERE f.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL ( SELECT 'joaillerie'::text, j.id, j.nom, NULL::text, 'joaillerie'::text, public._snip_contient(g.c, v_t), (CASE WHEN public.f_unaccent(j.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM objets_joaillerie j, LATERAL (SELECT coalesce(j.nom,'')||' '||coalesce(j.description,'')||' '||coalesce(j.effet,'') AS c) g WHERE j.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL ( SELECT 'alchimie'::text, al.id, al.nom, al.type, 'alchimie'::text, public._snip_contient(g.c, v_t), (CASE WHEN public.f_unaccent(al.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM recettes_alchimie al, LATERAL (SELECT coalesce(al.nom,'')||' '||coalesce(al.description,'')||' '||coalesce(al.effet,'')||' '||coalesce(al.formule,'') AS c) g WHERE al.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL ( SELECT 'assemblages'::text, asr.id, asr.nom, asr.cible, 'assemblages'::text, public._snip_contient(g.c, v_t), (CASE WHEN public.f_unaccent(asr.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real
    FROM assemblages_runes asr, LATERAL (SELECT coalesce(asr.nom,'')||' '||coalesce(asr.description,'')||' '||coalesce(asr.effet,'')||' '||coalesce(asr.cible,'') AS c) g WHERE asr.est_actif AND public.f_unaccent(g.c) ILIKE v_pat )
  UNION ALL ( SELECT d.type, d.id, d.titre, d.sous_titre, d.categorie, d.snippet, d.rang FROM (
      SELECT DISTINCT ON (pg.nom) 'pieges'::text AS type, pg.id AS id, pg.nom AS titre, pg.type_piege AS sous_titre, 'pieges'::text AS categorie, public._snip_contient(g.c, v_t) AS snippet, (CASE WHEN public.f_unaccent(pg.nom) ILIKE v_pat THEN 1.0 ELSE 0.5 END)::real AS rang
      FROM pieges pg, LATERAL (SELECT coalesce(pg.nom,'')||' '||coalesce(pg.effets,'')||' '||coalesce(pg.effet_generique,'')||' '||coalesce(pg.type_piege,'')||' '||coalesce(pg.cible,'') AS c) g WHERE pg.est_actif AND public.f_unaccent(g.c) ILIKE v_pat ORDER BY pg.nom ) d )
  ORDER BY rang DESC, titre LIMIT 50;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.rechercher_encyclopedie(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rechercher_encyclopedie(text) TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.archive_description_courte_legacy (table_source text NOT NULL, record_id uuid NOT NULL, nom text, description_courte text, archive_le timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (table_source, record_id));
ALTER TABLE public.archive_description_courte_legacy ENABLE ROW LEVEL SECURITY;
DO $arch$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='races' AND column_name='description_courte') THEN
    INSERT INTO public.archive_description_courte_legacy (table_source, record_id, nom, description_courte) SELECT 'races', id, nom, description_courte FROM public.races WHERE description_courte IS NOT NULL ON CONFLICT (table_source, record_id) DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='classes' AND column_name='description_courte') THEN
    INSERT INTO public.archive_description_courte_legacy (table_source, record_id, nom, description_courte) SELECT 'classes', id, nom, description_courte FROM public.classes WHERE description_courte IS NOT NULL ON CONFLICT (table_source, record_id) DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sorts' AND column_name='description_courte') THEN
    INSERT INTO public.archive_description_courte_legacy (table_source, record_id, nom, description_courte) SELECT 'sorts', id, nom, description_courte FROM public.sorts WHERE description_courte IS NOT NULL ON CONFLICT (table_source, record_id) DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='prieres' AND column_name='description_courte') THEN
    INSERT INTO public.archive_description_courte_legacy (table_source, record_id, nom, description_courte) SELECT 'prieres', id, nom, description_courte FROM public.prieres WHERE description_courte IS NOT NULL ON CONFLICT (table_source, record_id) DO NOTHING;
  END IF;
END
$arch$;

DROP VIEW IF EXISTS public.vue_personnage_creation_complet;
DROP VIEW IF EXISTS public.vue_sorts_personnage;
DROP VIEW IF EXISTS public.vue_prieres_personnage;
DROP VIEW IF EXISTS public.vue_fiche_personnage;
DROP INDEX IF EXISTS public.idx_races_recherche_tsv;
ALTER TABLE public.races DROP COLUMN IF EXISTS recherche_tsv;
ALTER TABLE public.races DROP COLUMN IF EXISTS description_courte;
ALTER TABLE public.classes DROP COLUMN IF EXISTS description_courte;
ALTER TABLE public.sorts DROP COLUMN IF EXISTS description_courte;
ALTER TABLE public.prieres DROP COLUMN IF EXISTS description_courte;

ALTER TABLE public.races ADD COLUMN IF NOT EXISTS recherche_tsv tsvector GENERATED ALWAYS AS (setweight(to_tsvector('french'::regconfig, public.f_unaccent(COALESCE(nom, ''::text))), 'A') || setweight(to_tsvector('french'::regconfig, public.f_unaccent((COALESCE(description, ''::text) || ' '::text) || COALESCE(resume_condense, ''::text))), 'B')) STORED;
CREATE INDEX IF NOT EXISTS idx_races_recherche_tsv ON public.races USING gin (recherche_tsv);

CREATE VIEW public.vue_sorts_personnage WITH (security_invoker = on) AS
 SELECT ps.id, ps.personnage_id, ps.nom_personnalise, ps.formule_magique, ps.niveau_sort, ps.zone_choisie, ps.portee_choisie, ps.duree_choisie, s.cercle, s.cout_xp_base, s.nom AS sort_nom_base, s.description AS sort_description, s.paliers, s.description_tronc, s.bonus_niveau, s.effet_instance, s.type_sort, s.resume_condense AS sort_resume_condense
   FROM personnage_sorts ps JOIN sorts s ON s.id = ps.sort_id WHERE ps.statut = 'achete'::text;
CREATE VIEW public.vue_prieres_personnage WITH (security_invoker = on) AS
 SELECT pp.id, pp.personnage_id, pp.nom_personnalise, pp.niveau_priere, pp.zone_choisie, pp.portee_choisie, pp.duree_choisie, pr.domaine, pr.description AS priere_description, pr.duree_incantation, pr.cout_xp_base, pp.duree_incantation_calculee, pr.paliers, pr.description_tronc, pr.bonus_niveau, pr.effet_instance, pr.type_priere, pr.resume_condense AS priere_resume_condense
   FROM personnage_prieres pp JOIN prieres pr ON pr.id = pp.priere_id WHERE pp.statut = 'achete'::text;
CREATE VIEW public.vue_fiche_personnage WITH (security_invoker = on) AS
 SELECT p.id, p.nom, p.niveau, p.xp_total, p.xp_depense, p.pv_max, p.ps_max, p.historique, p.ame_personnage, p.joueur_id, p.race_id, p.classe_id, p.religion_id, p.gn_completes, p.mini_gn_completes, p.ouvertures_terrain,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', tr.id, 'nom', tr.nom, 'description', tr.description, 'cout_xp', tr.cout_xp, 'xp_depense', (t.value ->> 'xp_depense'::text)::integer, 'est_gratuit', (t.value ->> 'est_gratuit'::text)::boolean, 'resume_condense', tr.resume_condense, 'texte_manuel', tr.texte_manuel) ORDER BY tr.nom) AS jsonb_agg FROM jsonb_array_elements(p.traits_raciaux_choisis) t(value) LEFT JOIN traits_raciaux tr ON tr.id = ((t.value ->> 'trait_id'::text)::uuid)), '[]'::jsonb) AS traits_raciaux_choisis,
    p.est_actif, p.est_mort, r.nom AS race_nom, r.nom_latin AS race_nom_latin, c.nom AS classe_nom, rel.nom AS religion_nom, r.emoji AS race_emoji, r.description AS race_description, r.esperance_vie AS race_esperance_vie, r.exigences_costume AS race_exigences_costume, r.image_url AS race_image_url, c.emoji AS classe_emoji, c.description AS classe_description, c.role_combat AS classe_role_combat, r.resume_condense AS race_resume_condense, c.resume_condense AS classe_resume_condense
   FROM personnages p LEFT JOIN races r ON r.id = p.race_id LEFT JOIN classes c ON c.id = p.classe_id LEFT JOIN religions rel ON rel.id = p.religion_id;
CREATE VIEW public.vue_personnage_creation_complet WITH (security_invoker = on) AS
 SELECT p.id, p.joueur_id, p.nom, p.niveau, p.etape_creation, p.est_verrouille, p.est_actif, p.est_mort,
    COALESCE(p.est_verrouille = true AND (r.est_jouable = true OR r.est_jouable = false AND demande_active.statut = 'approuvee'::text), false) AS peut_sinscrire_evenement,
    p.xp_total, p.xp_depense, COALESCE(p.xp_total, 0) - COALESCE(p.xp_depense, 0) AS xp_disponible, p.race_id, r.nom AS race_nom, r.nom_latin AS race_nom_latin, r.xp_depart AS race_xp_depart, r.est_jouable AS race_est_jouable, p.sous_type_chimeride, demande_active.statut AS demande_race_statut, demande_active.background AS demande_race_background, p.classe_id, c1.nom AS classe_nom, c1.pv_depart AS classe_pv_depart, c1.ps_depart AS classe_ps_depart, p.classe_secondaire_id, c2.nom AS classe_secondaire_nom, p.est_croyant, p.religion_id, rel.nom AS religion_nom, p.pv_max, p.ps_max, p.a_forge_legendaire, p.a_joaillerie_legendaire, p.historique, p.ame_personnage, p.gn_completes, p.mini_gn_completes, p.ouvertures_terrain, p.created_at, p.updated_at,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('trait_id', (elem.value ->> 'trait_id'::text)::uuid, 'est_gratuit', (elem.value ->> 'est_gratuit'::text)::boolean, 'xp_depense', COALESCE((elem.value ->> 'xp_depense'::text)::integer, 0), 'trait_nom', tr.nom, 'trait_description', tr.description, 'cout_xp', tr.cout_xp)) AS jsonb_agg FROM jsonb_array_elements(COALESCE(p.traits_raciaux_choisis, '[]'::jsonb)) elem(value) LEFT JOIN traits_raciaux tr ON tr.id = ((elem.value ->> 'trait_id'::text)::uuid)), '[]'::jsonb) AS traits_raciaux,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', vcp.id, 'niveau_acquis', vcp.niveau_acquis, 'xp_depense', vcp.xp_depense, 'choix_achat', vcp.choix_achat, 'appris_via_maitre', vcp.appris_via_maitre, 'nom_maitre', vcp.nom_maitre, 'statut_maitre', vcp.statut_maitre, 'nom', vcp.nom, 'categorie', vcp.categorie, 'competence_description', vcp.competence_description)) AS jsonb_agg FROM vue_competences_personnage vcp WHERE vcp.personnage_id = p.id), '[]'::jsonb) AS competences,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', vsp.id, 'nom_personnalise', vsp.nom_personnalise, 'formule_magique', vsp.formule_magique, 'niveau_sort', vsp.niveau_sort, 'zone_choisie', vsp.zone_choisie, 'portee_choisie', vsp.portee_choisie, 'duree_choisie', vsp.duree_choisie, 'cercle', vsp.cercle, 'cout_xp_base', vsp.cout_xp_base, 'sort_nom_base', vsp.sort_nom_base, 'sort_description', vsp.sort_description)) AS jsonb_agg FROM vue_sorts_personnage vsp WHERE vsp.personnage_id = p.id), '[]'::jsonb) AS sorts,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', vpp.id, 'nom_personnalise', vpp.nom_personnalise, 'niveau_priere', vpp.niveau_priere, 'zone_choisie', vpp.zone_choisie, 'portee_choisie', vpp.portee_choisie, 'duree_choisie', vpp.duree_choisie, 'domaine', vpp.domaine, 'priere_description', vpp.priere_description, 'duree_incantation', vpp.duree_incantation, 'cout_xp_base', vpp.cout_xp_base)) AS jsonb_agg FROM vue_prieres_personnage vpp WHERE vpp.personnage_id = p.id), '[]'::jsonb) AS prieres,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', vrp.id, 'xp_depense', vrp.xp_depense, 'nom', vrp.nom, 'type', vrp.type, 'niveau_requis', vrp.niveau_requis, 'description', vrp.description, 'effet', vrp.effet)) AS jsonb_agg FROM vue_recettes_personnage vrp WHERE vrp.personnage_id = p.id), '[]'::jsonb) AS recettes,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', vap.id, 'xp_depense', vap.xp_depense, 'nom', vap.nom, 'cible', vap.cible, 'cout_ps', vap.cout_ps, 'description', vap.description, 'effet', vap.effet, 'runes_requises', vap.runes_requises)) AS jsonb_agg FROM vue_assemblages_personnage vap WHERE vap.personnage_id = p.id), '[]'::jsonb) AS assemblages,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', of2.id, 'nom', of2.nom, 'description', of2.description, 'type', of2.type, 'stats', of2.stats, 'temps_fabrication_minutes', of2.temps_fabrication_minutes, 'materiaux_communs', of2.materiaux_communs, 'materiaux_rares', of2.materiaux_rares)) AS jsonb_agg FROM objets_forge of2 WHERE of2.est_actif = true AND (EXISTS ( SELECT 1 FROM vue_artisanat_etat vae WHERE vae.personnage_id = p.id AND vae.niveau_forge >= 1))), '[]'::jsonb) AS objets_forge,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', oj.id, 'nom', oj.nom, 'description', oj.description, 'effet', oj.effet, 'temps_fabrication_minutes', oj.temps_fabrication_minutes, 'temps_rare_minutes', oj.temps_rare_minutes, 'materiaux_communs', oj.materiaux_communs, 'materiaux_rares', oj.materiaux_rares)) AS jsonb_agg FROM objets_joaillerie oj WHERE oj.est_actif = true AND (EXISTS ( SELECT 1 FROM vue_artisanat_etat vae WHERE vae.personnage_id = p.id AND vae.niveau_joaillerie >= 1))), '[]'::jsonb) AS objets_joaillerie,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('cercle', vcd.cercle, 'niveau_max_sorts', vcd.niveau_max_sorts)) AS jsonb_agg FROM vue_cercles_disponibles vcd WHERE vcd.personnage_id = p.id), '[]'::jsonb) AS cercles_acquis,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('domaine', vdd.domaine, 'niveau_max_prieres', vdd.niveau_max_prieres)) AS jsonb_agg FROM vue_domaines_disponibles vdd WHERE vdd.personnage_id = p.id), '[]'::jsonb) AS domaines_acquis,
    ( SELECT to_jsonb(vaq.*) - 'personnage_id'::text FROM vue_artisanat_quotas vaq WHERE vaq.personnage_id = p.id) AS quotas_artisanat,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', rf.id, 'nom_affichage', rf.nom_affichage, 'categorie', rf.categorie, 'temps_minutes', rf.temps_minutes, 'temps_rare_minutes', rf.temps_rare_minutes, 'materiaux', rf.materiaux, 'materiaux_rares', rf.materiaux_rares, 'notes', rf.notes)) AS jsonb_agg FROM reparations_forge rf WHERE rf.est_actif = true AND (EXISTS ( SELECT 1 FROM vue_artisanat_etat vae WHERE vae.personnage_id = p.id AND vae.niveau_forge >= 1))), '[]'::jsonb) AS reparations_forge
   FROM personnages p LEFT JOIN races r ON r.id = p.race_id LEFT JOIN classes c1 ON c1.id = p.classe_id LEFT JOIN classes c2 ON c2.id = p.classe_secondaire_id LEFT JOIN religions rel ON rel.id = p.religion_id LEFT JOIN LATERAL ( SELECT prd.statut, prd.background FROM personnage_races_demandes prd WHERE prd.personnage_id = p.id ORDER BY prd.created_at DESC NULLS LAST LIMIT 1) demande_active ON true;

GRANT ALL ON public.vue_sorts_personnage TO anon, authenticated, service_role;
GRANT ALL ON public.vue_prieres_personnage TO anon, authenticated, service_role;
GRANT ALL ON public.vue_fiche_personnage TO anon, authenticated, service_role;
GRANT ALL ON public.vue_personnage_creation_complet TO anon, authenticated, service_role;
