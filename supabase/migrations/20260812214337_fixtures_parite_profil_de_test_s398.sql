-- s398 · les fixtures de parité ne tirent plus que du profil de test
--
-- TROIS DÉFAUTS FERMÉS ENSEMBLE (ils touchent les mêmes lignes) :
--
-- ⓪ ELLES ÉTAIENT MORTES. Les 7 fonctions filtraient par gate_edition_personnage(),
--    dont l'enveloppe exige compte_voit_joueur() OR est_animateur_ou_admin().
--    Depuis #760 (20260808203940) seul service_role a EXECUTE — et service_role ne
--    satisfait ni l'un ni l'autre : la gate rendait personnage_introuvable sur 116/116,
--    donc 0 candidat, donc RAISE. Mesuré par appel réel en s398.
--    Le NOYAU etat_edition_personnage_noyau() mesure l'ÉTAT sans lire d'identité (C117)
--    et il est déjà granté à service_role : 116 éditables contre 0.
--    ⭐ Il est aussi PLUS JUSTE : l'override est_admin() de la gate rend NULL même pour
--    un personnage gelé ou mort, donc le filtre était INERTE en position admin.
--
-- ② LA FLAQUE. Les contextes publiés au dépôt public portaient la fiche complète des
--    joueurs les plus avancés (C128 : ORDER BY <richesse> DESC). La source est tarie :
--    seul le profil ZZ-Fixtures alimente désormais les fixtures.
--
-- ③ LA CLÉ `niveau` AVAIT DISPARU. pariteSorts.json et paritePrieres.json (19 juillet)
--    la portent ; les corps du 3 juillet ne l'émettent pas. pariteMagie.test.ts:81 et
--    pariteVisiteur.test.ts:172/203 la LISENT, et le plafond de sort dépend du NIVEAU.
--    Régénérer sans elle rendait 96 cas verts à vide (C99). Elle est reposée.
--
-- ⚠️ Le message d'erreur disait « fenetre de gel ? » : il n'y avait AUCUN gelé
--    (campagne 41 · remodelage_libre 39 · brouillon 36). Il dit maintenant la vraie cause.
--
-- Corps NON RETAPÉS : extraits verbatim de 20260703182920 / 20260703233219 / 20260703233421
-- (md5 prouvés identiques à la base), puis 23 substitutions assertées une à une.
-- ACL : identique à #760 — service_role SEUL, anon et authenticated révoqués NOMMÉMENT (C102).
--
-- REPLI, deux gestes : ré-appliquer 20260703182920 + 20260703233219 + 20260703233421,
-- puis 20260808203940 pour les ACL. Et DROP FUNCTION public.profil_fixtures_id().

CREATE OR REPLACE FUNCTION public.profil_fixtures_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fx_profil$
  SELECT id FROM public.profils_joueur WHERE nom = 'ZZ-Fixtures' AND est_actif LIMIT 1;
$fx_profil$;

REVOKE ALL ON FUNCTION public.profil_fixtures_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profil_fixtures_id() TO service_role;

CREATE OR REPLACE FUNCTION public.fixtures_parite_visiteur()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_contextes jsonb := '[]'::jsonb;
  v_cas jsonb := '[]'::jsonb;
  v_ref integer := 0;
  p record;
  d record;
BEGIN
  FOR p IN
    WITH candidats AS (
      SELECT pe.id, cl.nom AS classe_nom, pe.race_id,
             public.personnage_inapte_magie(pe.id) AS inapte,
             (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0)) AS xp_dispo,
             COALESCE(pe.ps_max,0) AS ps_max,
             count(pc.id) AS nb_comp
      FROM personnages pe
      JOIN classes cl ON cl.id = pe.classe_id
      LEFT JOIN personnage_competences pc ON pc.personnage_id = pe.id
      WHERE pe.est_actif = true AND pe.est_mort = false
        AND pe.joueur_id = public.profil_fixtures_id()
      GROUP BY pe.id, cl.nom, pe.race_id, pe.xp_total, pe.xp_depense, pe.ps_max
    )
    SELECT DISTINCT ON (classe_nom, inapte) *
    FROM candidats
    WHERE (public.etat_edition_personnage_noyau(id)->>'peut_ajouter')::boolean
    ORDER BY classe_nom, inapte, nb_comp DESC, id
  LOOP
    v_ref := v_ref + 1;
    v_contextes := v_contextes || jsonb_build_array(jsonb_build_object(
      'ref', v_ref,
      'classe_nom', p.classe_nom,
      'race_id', p.race_id,
      'race_inapte_magie', p.inapte,
      'xp_dispo', p.xp_dispo,
      'ps_max', p.ps_max,
      'competences_acquises', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'competence_id', pc.competence_id,
          'competence_nom', c.nom,
          'categorie', c.categorie,
          'niveau_acquis', pc.niveau_acquis,
          'choix_achat', pc.choix_achat)
          ORDER BY c.nom, pc.niveau_acquis, pc.choix_achat), '[]'::jsonb)
        FROM personnage_competences pc
        JOIN competences c ON c.id = pc.competence_id
        WHERE pc.personnage_id = p.id)
    ));
    FOR d IN
      (SELECT c.id, c.nom, 1 AS niv, NULL::text AS choix, 1 AS ordre
       FROM (SELECT DISTINCT ON (type_achat) id, nom FROM competences WHERE est_actif = true ORDER BY type_achat, nom, id) c)
      UNION ALL
      (SELECT c.id, c.nom, 1, 'FIXTURE-CHOIX'::text, 2
       FROM (SELECT DISTINCT ON (type_achat) id, nom FROM competences WHERE est_actif = true ORDER BY type_achat, nom, id) c)
      UNION ALL
      (SELECT c2.id, c2.nom, pc2.niveau_acquis, pc2.choix_achat, 3
       FROM (SELECT pc.competence_id, pc.niveau_acquis, pc.choix_achat
             FROM personnage_competences pc WHERE pc.personnage_id = p.id
             ORDER BY pc.competence_id, pc.niveau_acquis LIMIT 3) pc2
       JOIN competences c2 ON c2.id = pc2.competence_id)
      UNION ALL
      (SELECT c2.id, c2.nom, LEAST(pc2.niveau_acquis + 1, 3), pc2.choix_achat, 4
       FROM (SELECT pc.competence_id, pc.niveau_acquis, pc.choix_achat
             FROM personnage_competences pc WHERE pc.personnage_id = p.id
             ORDER BY pc.competence_id, pc.niveau_acquis LIMIT 3) pc2
       JOIN competences c2 ON c2.id = pc2.competence_id)
      UNION ALL
      (SELECT c.id, c.nom, 3, NULL::text, 5
       FROM competences c
       WHERE c.est_actif = true AND c.est_general = false
         AND c.categorie IS DISTINCT FROM (CASE p.classe_nom
              WHEN 'Guerrier' THEN 'guerrier' WHEN 'Voleur' THEN 'voleur'
              WHEN 'Mage' THEN 'mage' WHEN 'Prêtre' THEN 'pretre' END)
       ORDER BY c.nom, c.id LIMIT 1)
      UNION ALL
      (SELECT c.id, c.nom, 1, NULL::text, 6
       FROM competences c
       WHERE c.nom IN ('Développement Spirituel','Développement Spirituel Supérieur') AND c.est_actif = true)
      UNION ALL
      (SELECT c.id, c.nom, n.n, NULL::text, 7
       FROM competences c CROSS JOIN (VALUES (1),(2)) n(n)
       WHERE c.nom = 'Dépeçage' AND c.est_actif = true)
      UNION ALL
      (SELECT ch.id, ch.nom, ch.nivmax, NULL::text, 8
       FROM (SELECT c.id, c.nom,
                    max((e->>'niveau')::int) AS nivmax,
                    max((e->>'cout_xp')::int) AS coutmax
             FROM competences c, jsonb_array_elements(c.niveaux) e
             WHERE c.est_actif = true
             GROUP BY c.id, c.nom
             ORDER BY coutmax DESC, c.nom LIMIT 1) ch)
      ORDER BY ordre, nom, niv
    LOOP
      v_cas := v_cas || jsonb_build_array(jsonb_build_object(
        'ctx', v_ref,
        'demande', jsonb_build_object(
          'competence_id', d.id, 'competence_nom', d.nom,
          'niveau_desire', d.niv, 'choix_achat', d.choix),
        'verdict', public.peut_acheter_competence(p.id, d.id, d.niv, d.choix)));
    END LOOP;
  END LOOP;
  IF v_ref = 0 THEN
    RAISE EXCEPTION 'fixtures_parite_visiteur: aucun personnage editable (profil ZZ-Fixtures vide ou fiches non editables ?)';
  END IF;
  RETURN jsonb_build_object(
    'genere_le', now(),
    'nb_contextes', v_ref,
    'nb_cas', jsonb_array_length(v_cas),
    'contextes', v_contextes,
    'cas', v_cas);
END;
$fn$;

REVOKE ALL ON FUNCTION public.fixtures_parite_visiteur() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fixtures_parite_visiteur() TO service_role;

CREATE OR REPLACE FUNCTION public.fixtures_visiteur_sorts()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fx_sorts$
DECLARE
  v_contextes jsonb := '[]'::jsonb; v_cas jsonb := '[]'::jsonb; v_ref integer := 0;
  p record; d record;
BEGIN
  FOR p IN
    SELECT pe.id, pe.niveau, (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0)) AS xp_dispo
    FROM personnages pe
    WHERE pe.est_actif AND NOT pe.est_mort
      AND (public.etat_edition_personnage_noyau(pe.id)->>'peut_ajouter')::boolean
         AND pe.joueur_id = public.profil_fixtures_id()
      AND EXISTS (SELECT 1 FROM vue_cercles_disponibles v WHERE v.personnage_id = pe.id)
    ORDER BY (SELECT count(*) FROM vue_cercles_disponibles v WHERE v.personnage_id = pe.id) DESC, pe.id
    LIMIT 3
  LOOP
    v_ref := v_ref + 1;
    v_contextes := v_contextes || jsonb_build_array(jsonb_build_object(
      'ref', v_ref, 'xp_dispo', p.xp_dispo, 'niveau', p.niveau,
      'competences_acquises', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'competence_id', pc.competence_id, 'competence_nom', c.nom, 'categorie', c.categorie,
          'niveau_acquis', pc.niveau_acquis, 'choix_achat', pc.choix_achat)
          ORDER BY c.nom, pc.niveau_acquis, pc.choix_achat), '[]'::jsonb)
        FROM personnage_competences pc JOIN competences c ON c.id = pc.competence_id
        WHERE pc.personnage_id = p.id)));
    FOR d IN
      (SELECT s.id AS sort_id, s.nom, v.cercle, 1 AS niveau,
              'Personnelle'::text AS zone, 'Toucher'::text AS portee, 'Instantanée'::text AS duree, 1 AS ordre
       FROM vue_cercles_disponibles v
       JOIN LATERAL (SELECT id, nom FROM sorts WHERE cercle = v.cercle ORDER BY cout_xp_base ASC, nom, id LIMIT 1) s ON true
       WHERE v.personnage_id = p.id)
      UNION ALL
      (SELECT s.id, s.nom, v.cercle, v.niveau_max_sorts,
              'Rayon 50 pieds', 'À vue', '60 Minutes', 2
       FROM vue_cercles_disponibles v
       JOIN LATERAL (SELECT id, nom FROM sorts WHERE cercle = v.cercle ORDER BY cout_xp_base DESC, nom, id LIMIT 1) s ON true
       WHERE v.personnage_id = p.id)
      UNION ALL
      (SELECT s.id, s.nom, v.cercle, v.niveau_max_sorts + 1,
              '1 Cible', 'Toucher', 'Instantanée', 3
       FROM vue_cercles_disponibles v
       JOIN LATERAL (SELECT id, nom FROM sorts WHERE cercle = v.cercle ORDER BY cout_xp_base ASC, nom, id LIMIT 1) s ON true
       WHERE v.personnage_id = p.id)
      UNION ALL
      (SELECT s.id, s.nom, s.cercle, 1, '1 Cible', 'Toucher', 'Instantanée', 4
       FROM sorts s
       WHERE NOT EXISTS (SELECT 1 FROM vue_cercles_disponibles v WHERE v.personnage_id = p.id AND v.cercle = s.cercle)
       ORDER BY s.nom, s.id LIMIT 1)
      UNION ALL
      (SELECT '00000000-0000-0000-0000-000000000000'::uuid, 'INEXISTANT', NULL, 1, '1 Cible', 'Toucher', 'Instantanée', 5)
      ORDER BY ordre, cercle, nom, niveau
    LOOP
      v_cas := v_cas || jsonb_build_array(jsonb_build_object(
        'ctx', v_ref,
        'demande', jsonb_build_object('sort_id', d.sort_id, 'sort_nom', d.nom,
          'niveau_sort', d.niveau, 'zone_choisie', d.zone, 'portee_choisie', d.portee, 'duree_choisie', d.duree),
        'verdict', public.peut_acheter_sort(p.id, d.sort_id, d.niveau, d.zone, d.portee, d.duree)));
    END LOOP;
  END LOOP;
  IF v_ref = 0 THEN
    RAISE EXCEPTION 'fixtures_visiteur_sorts: aucun personnage editable avec cercle (profil ZZ-Fixtures vide ou fiches non editables ?)';
  END IF;
  RETURN jsonb_build_object('type', 'sorts', 'genere_le', now(), 'nb_contextes', v_ref, 'nb_cas', jsonb_array_length(v_cas), 'contextes', v_contextes, 'cas', v_cas);
END;
$fx_sorts$;

REVOKE ALL ON FUNCTION public.fixtures_visiteur_sorts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fixtures_visiteur_sorts() TO service_role;

CREATE OR REPLACE FUNCTION public.fixtures_visiteur_prieres()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fx_prieres$
DECLARE
  v_contextes jsonb := '[]'::jsonb; v_cas jsonb := '[]'::jsonb; v_ref integer := 0;
  p record; d record;
BEGIN
  FOR p IN
    SELECT pe.id, pe.niveau, pe.religion_id, (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0)) AS xp_dispo,
           (r.domaines_proscrits IS NOT NULL) AS a_proscrits
    FROM personnages pe
    LEFT JOIN religions r ON r.id = pe.religion_id
    WHERE pe.est_actif AND NOT pe.est_mort
      AND (public.etat_edition_personnage_noyau(pe.id)->>'peut_ajouter')::boolean
         AND pe.joueur_id = public.profil_fixtures_id()
      AND EXISTS (SELECT 1 FROM vue_domaines_disponibles v WHERE v.personnage_id = pe.id)
    ORDER BY (r.domaines_proscrits IS NOT NULL) DESC,
             (SELECT count(*) FROM vue_domaines_disponibles v WHERE v.personnage_id = pe.id) DESC, pe.id
    LIMIT 3
  LOOP
    v_ref := v_ref + 1;
    v_contextes := v_contextes || jsonb_build_array(jsonb_build_object(
      'ref', v_ref, 'xp_dispo', p.xp_dispo, 'niveau', p.niveau, 'religion_id', p.religion_id,
      'competences_acquises', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'competence_id', pc.competence_id, 'competence_nom', c.nom, 'categorie', c.categorie,
          'niveau_acquis', pc.niveau_acquis, 'choix_achat', pc.choix_achat)
          ORDER BY c.nom, pc.niveau_acquis, pc.choix_achat), '[]'::jsonb)
        FROM personnage_competences pc JOIN competences c ON c.id = pc.competence_id
        WHERE pc.personnage_id = p.id)));
    FOR d IN
      (SELECT pr.id AS priere_id, pr.nom, v.domaine, 1 AS niveau,
              'Personnelle'::text AS zone, 'Toucher'::text AS portee, 'Instantanée'::text AS duree, 1 AS ordre
       FROM vue_domaines_disponibles v
       JOIN LATERAL (SELECT id, nom FROM prieres WHERE domaine = v.domaine ORDER BY cout_xp_base ASC, nom, id LIMIT 1) pr ON true
       WHERE v.personnage_id = p.id)
      UNION ALL
      (SELECT pr.id, pr.nom, v.domaine, v.niveau_max_prieres,
              'Rayon 50 pieds', 'À vue', '60 Minutes', 2
       FROM vue_domaines_disponibles v
       JOIN LATERAL (SELECT id, nom FROM prieres WHERE domaine = v.domaine ORDER BY cout_xp_base DESC, nom, id LIMIT 1) pr ON true
       WHERE v.personnage_id = p.id)
      UNION ALL
      (SELECT pr.id, pr.nom, v.domaine, v.niveau_max_prieres + 1,
              '1 Cible', 'Toucher', 'Instantanée', 3
       FROM vue_domaines_disponibles v
       JOIN LATERAL (SELECT id, nom FROM prieres WHERE domaine = v.domaine ORDER BY cout_xp_base ASC, nom, id LIMIT 1) pr ON true
       WHERE v.personnage_id = p.id)
      UNION ALL
      (SELECT pr.id, pr.nom, pr.domaine, 1, '1 Cible', 'Toucher', 'Instantanée', 4
       FROM prieres pr
       WHERE NOT EXISTS (SELECT 1 FROM vue_domaines_disponibles v WHERE v.personnage_id = p.id AND v.domaine = pr.domaine)
       ORDER BY pr.nom, pr.id LIMIT 1)
      UNION ALL
      (SELECT pr.id, pr.nom, pr.domaine, 1, '1 Cible', 'Toucher', 'Instantanée', 5
       FROM personnages pe2
       JOIN religions r2 ON r2.id = pe2.religion_id
       CROSS JOIN LATERAL (SELECT id, nom, domaine FROM prieres WHERE domaine = ANY(r2.domaines_proscrits) ORDER BY nom, id LIMIT 1) pr
       WHERE pe2.id = p.id AND r2.domaines_proscrits IS NOT NULL)
      UNION ALL
      (SELECT '00000000-0000-0000-0000-000000000000'::uuid, 'INEXISTANT', NULL, 1, '1 Cible', 'Toucher', 'Instantanée', 6)
      ORDER BY ordre, domaine, nom, niveau
    LOOP
      v_cas := v_cas || jsonb_build_array(jsonb_build_object(
        'ctx', v_ref,
        'demande', jsonb_build_object('priere_id', d.priere_id, 'priere_nom', d.nom,
          'niveau_priere', d.niveau, 'zone_choisie', d.zone, 'portee_choisie', d.portee, 'duree_choisie', d.duree),
        'verdict', public.peut_acheter_priere(p.id, d.priere_id, d.niveau, d.zone, d.portee, d.duree)));
    END LOOP;
  END LOOP;
  IF v_ref = 0 THEN
    RAISE EXCEPTION 'fixtures_visiteur_prieres: aucun personnage editable avec domaine (profil ZZ-Fixtures vide ou fiches non editables ?)';
  END IF;
  RETURN jsonb_build_object('type', 'prieres', 'genere_le', now(), 'nb_contextes', v_ref, 'nb_cas', jsonb_array_length(v_cas), 'contextes', v_contextes, 'cas', v_cas);
END;
$fx_prieres$;

REVOKE ALL ON FUNCTION public.fixtures_visiteur_prieres() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fixtures_visiteur_prieres() TO service_role;

CREATE OR REPLACE FUNCTION public.fixtures_visiteur_traits_raciaux()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fx_traits$
DECLARE
  v_contextes jsonb := '[]'::jsonb; v_cas jsonb := '[]'::jsonb; v_ref integer := 0;
  p record; d record;
BEGIN
  FOR p IN
    SELECT DISTINCT ON (u.id) u.id, u.race_id, u.traits, u.xp_dispo FROM (
      (SELECT pe.id, pe.race_id, COALESCE(pe.traits_raciaux_choisis, '[]'::jsonb) AS traits,
              COALESCE(jsonb_array_length(pe.traits_raciaux_choisis), 0) AS nb,
              (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0)) AS xp_dispo
       FROM personnages pe
       WHERE pe.est_actif AND NOT pe.est_mort AND (public.etat_edition_personnage_noyau(pe.id)->>'peut_ajouter')::boolean
         AND pe.joueur_id = public.profil_fixtures_id()
       ORDER BY COALESCE(jsonb_array_length(pe.traits_raciaux_choisis), 0) DESC, pe.id LIMIT 2)
      UNION ALL
      (SELECT pe.id, pe.race_id, COALESCE(pe.traits_raciaux_choisis, '[]'::jsonb),
              COALESCE(jsonb_array_length(pe.traits_raciaux_choisis), 0),
              (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0))
       FROM personnages pe
       WHERE pe.est_actif AND NOT pe.est_mort AND (public.etat_edition_personnage_noyau(pe.id)->>'peut_ajouter')::boolean
         AND pe.joueur_id = public.profil_fixtures_id()
       ORDER BY COALESCE(jsonb_array_length(pe.traits_raciaux_choisis), 0) ASC, pe.id LIMIT 2)
    ) u ORDER BY u.id
  LOOP
    v_ref := v_ref + 1;
    v_contextes := v_contextes || jsonb_build_array(jsonb_build_object(
      'ref', v_ref, 'race_id', p.race_id, 'xp_dispo', p.xp_dispo,
      'traits_raciaux_choisis', p.traits));
    FOR d IN
      (SELECT rt.trait_id, t.nom, p.race_id AS race_cible, NULL::text AS sous_type, 1 AS ordre
       FROM race_traits rt JOIN traits_raciaux t ON t.id = rt.trait_id
       WHERE rt.race_id = p.race_id
         AND NOT (p.traits @> jsonb_build_array(jsonb_build_object('trait_id', rt.trait_id)))
       ORDER BY t.nom, rt.trait_id LIMIT 2)
      UNION ALL
      (SELECT (e.val->>'trait_id')::uuid, 'DEJA-ACQUIS', p.race_id, NULL::text, 2
       FROM jsonb_array_elements(p.traits) e(val)
       WHERE e.val ? 'trait_id'
       ORDER BY e.val->>'trait_id' LIMIT 1)
      UNION ALL
      (SELECT rt.trait_id, t.nom, p.race_id, NULL::text, 3
       FROM race_traits rt JOIN traits_raciaux t ON t.id = rt.trait_id
       WHERE rt.race_id <> p.race_id
         AND NOT EXISTS (SELECT 1 FROM race_traits rt2 WHERE rt2.race_id = p.race_id AND rt2.trait_id = rt.trait_id)
       ORDER BY t.nom, rt.trait_id LIMIT 1)
      UNION ALL
      (SELECT rt.trait_id, t.nom, p.race_id, rt.sous_type, 4
       FROM race_traits rt JOIN traits_raciaux t ON t.id = rt.trait_id
       WHERE rt.race_id = p.race_id AND rt.sous_type IS NOT NULL
       ORDER BY rt.sous_type, t.nom, rt.trait_id LIMIT 1)
      UNION ALL
      (SELECT rt.trait_id, t.nom, p.race_id, 'FIXTURE-SOUS-TYPE'::text, 5
       FROM race_traits rt JOIN traits_raciaux t ON t.id = rt.trait_id
       WHERE rt.race_id = p.race_id
       ORDER BY t.nom, rt.trait_id LIMIT 1)
      UNION ALL
      (SELECT '00000000-0000-0000-0000-000000000000'::uuid, 'INEXISTANT', p.race_id, NULL::text, 6)
      ORDER BY ordre, nom
    LOOP
      v_cas := v_cas || jsonb_build_array(jsonb_build_object(
        'ctx', v_ref,
        'demande', jsonb_build_object('trait_id', d.trait_id, 'trait_nom', d.nom, 'race_id', d.race_cible, 'sous_type', d.sous_type),
        'verdict', public.peut_acheter_trait_racial(p.id, d.trait_id, d.race_cible, d.sous_type)));
    END LOOP;
  END LOOP;
  IF v_ref = 0 THEN
    RAISE EXCEPTION 'fixtures_visiteur_traits_raciaux: aucun personnage editable (profil ZZ-Fixtures vide ou fiches non editables ?)';
  END IF;
  RETURN jsonb_build_object('type', 'traits_raciaux', 'genere_le', now(), 'nb_contextes', v_ref, 'nb_cas', jsonb_array_length(v_cas), 'contextes', v_contextes, 'cas', v_cas);
END;
$fx_traits$;

REVOKE ALL ON FUNCTION public.fixtures_visiteur_traits_raciaux() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fixtures_visiteur_traits_raciaux() TO service_role;

CREATE OR REPLACE FUNCTION public.fixtures_visiteur_pieges()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fx_pieges$
DECLARE
  v_contextes jsonb := '[]'::jsonb; v_cas jsonb := '[]'::jsonb; v_ref integer := 0;
  p record; d record;
BEGIN
  FOR p IN
    SELECT DISTINCT ON (u.id) u.id, u.xp_dispo FROM (
      (SELECT pe.id, (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0)) AS xp_dispo, q.niveau_pieges
       FROM personnages pe JOIN vue_artisanat_quotas q ON q.personnage_id = pe.id
       WHERE pe.est_actif AND NOT pe.est_mort AND (public.etat_edition_personnage_noyau(pe.id)->>'peut_ajouter')::boolean
         AND pe.joueur_id = public.profil_fixtures_id()
         AND q.niveau_pieges >= 1
       ORDER BY q.niveau_pieges DESC, pe.id LIMIT 2)
      UNION ALL
      (SELECT pe.id, (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0)), q.niveau_pieges
       FROM personnages pe JOIN vue_artisanat_quotas q ON q.personnage_id = pe.id
       WHERE pe.est_actif AND NOT pe.est_mort AND (public.etat_edition_personnage_noyau(pe.id)->>'peut_ajouter')::boolean
         AND pe.joueur_id = public.profil_fixtures_id()
         AND q.niveau_pieges = 0
       ORDER BY pe.id LIMIT 1)
    ) u ORDER BY u.id
  LOOP
    v_ref := v_ref + 1;
    v_contextes := v_contextes || jsonb_build_array(jsonb_build_object(
      'ref', v_ref, 'xp_dispo', p.xp_dispo,
      'competences_acquises', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'competence_id', pc.competence_id, 'competence_nom', c.nom, 'categorie', c.categorie,
          'niveau_acquis', pc.niveau_acquis, 'choix_achat', pc.choix_achat)
          ORDER BY c.nom, pc.niveau_acquis, pc.choix_achat), '[]'::jsonb)
        FROM personnage_competences pc JOIN competences c ON c.id = pc.competence_id
        WHERE pc.personnage_id = p.id),
      'pieges_acquis', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'piege_nom', pp.piege_nom, 'niveau_acquis', pp.niveau_acquis, 'est_gratuit', pp.est_gratuit)
          ORDER BY pp.piege_nom, pp.niveau_acquis), '[]'::jsonb)
        FROM personnage_pieges pp WHERE pp.personnage_id = p.id)));
    FOR d IN
      (SELECT pg.id AS piege_id, pg.nom, pg.niveau, 1 AS ordre
       FROM pieges pg
       WHERE pg.niveau = 1
         AND NOT EXISTS (SELECT 1 FROM personnage_pieges pp WHERE pp.personnage_id = p.id AND pp.piege_nom = pg.nom AND pp.niveau_acquis = 1)
       ORDER BY pg.nom, pg.id LIMIT 1)
      UNION ALL
      (SELECT pg.id, pg.nom, pg.niveau, 2
       FROM pieges pg
       WHERE pg.niveau = 2
         AND EXISTS (SELECT 1 FROM personnage_pieges pp WHERE pp.personnage_id = p.id AND pp.piege_nom = pg.nom AND pp.niveau_acquis = 1)
         AND NOT EXISTS (SELECT 1 FROM personnage_pieges pp WHERE pp.personnage_id = p.id AND pp.piege_nom = pg.nom AND pp.niveau_acquis = 2)
       ORDER BY pg.nom, pg.id LIMIT 1)
      UNION ALL
      (SELECT pg.id, pg.nom, pg.niveau, 3
       FROM pieges pg
       WHERE pg.niveau = 2
         AND NOT EXISTS (SELECT 1 FROM personnage_pieges pp WHERE pp.personnage_id = p.id AND pp.piege_nom = pg.nom AND pp.niveau_acquis = 1)
       ORDER BY pg.nom, pg.id LIMIT 1)
      UNION ALL
      (SELECT pg.id, pg.nom, pg.niveau, 4
       FROM personnage_pieges pp
       JOIN pieges pg ON pg.nom = pp.piege_nom AND pg.niveau = pp.niveau_acquis
       WHERE pp.personnage_id = p.id
       ORDER BY pg.nom, pg.id LIMIT 1)
      UNION ALL
      (SELECT '00000000-0000-0000-0000-000000000000'::uuid, 'INEXISTANT', 0, 5)
      ORDER BY ordre, nom
    LOOP
      v_cas := v_cas || jsonb_build_array(jsonb_build_object(
        'ctx', v_ref,
        'demande', jsonb_build_object('piege_id', d.piege_id, 'piege_nom', d.nom, 'niveau', d.niveau),
        'verdict', public.peut_acheter_piege(p.id, d.piege_id)));
    END LOOP;
  END LOOP;
  IF v_ref = 0 THEN
    RAISE EXCEPTION 'fixtures_visiteur_pieges: aucun personnage editable (profil ZZ-Fixtures vide ou fiches non editables ?)';
  END IF;
  RETURN jsonb_build_object('type', 'pieges', 'genere_le', now(), 'nb_contextes', v_ref, 'nb_cas', jsonb_array_length(v_cas), 'contextes', v_contextes, 'cas', v_cas);
END;
$fx_pieges$;

REVOKE ALL ON FUNCTION public.fixtures_visiteur_pieges() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fixtures_visiteur_pieges() TO service_role;

CREATE OR REPLACE FUNCTION public.fixtures_visiteur_recettes()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fx_recettes$
DECLARE
  v_contextes jsonb := '[]'::jsonb; v_cas jsonb := '[]'::jsonb; v_ref integer := 0;
  p record; d record;
BEGIN
  FOR p IN
    SELECT DISTINCT ON (u.id) u.id, u.xp_dispo FROM (
      (SELECT pe.id, (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0)) AS xp_dispo
       FROM personnages pe JOIN vue_artisanat_quotas q ON q.personnage_id = pe.id
       WHERE pe.est_actif AND NOT pe.est_mort AND (public.etat_edition_personnage_noyau(pe.id)->>'peut_ajouter')::boolean
         AND pe.joueur_id = public.profil_fixtures_id()
         AND q.niveau_alchimie >= 1
       ORDER BY q.niveau_alchimie DESC, pe.id LIMIT 2)
      UNION ALL
      (SELECT pe.id, (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0))
       FROM personnages pe JOIN vue_artisanat_quotas q ON q.personnage_id = pe.id
       WHERE pe.est_actif AND NOT pe.est_mort AND (public.etat_edition_personnage_noyau(pe.id)->>'peut_ajouter')::boolean
         AND pe.joueur_id = public.profil_fixtures_id()
         AND q.niveau_alchimie = 0
       ORDER BY pe.id LIMIT 1)
    ) u ORDER BY u.id
  LOOP
    v_ref := v_ref + 1;
    v_contextes := v_contextes || jsonb_build_array(jsonb_build_object(
      'ref', v_ref, 'xp_dispo', p.xp_dispo,
      'competences_acquises', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'competence_id', pc.competence_id, 'competence_nom', c.nom, 'categorie', c.categorie,
          'niveau_acquis', pc.niveau_acquis, 'choix_achat', pc.choix_achat)
          ORDER BY c.nom, pc.niveau_acquis, pc.choix_achat), '[]'::jsonb)
        FROM personnage_competences pc JOIN competences c ON c.id = pc.competence_id
        WHERE pc.personnage_id = p.id),
      'recettes_acquises', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'recette_id', pr.recette_id, 'est_gratuit', pr.est_gratuit)
          ORDER BY pr.recette_id), '[]'::jsonb)
        FROM personnage_recettes pr WHERE pr.personnage_id = p.id)));
    FOR d IN
      (SELECT ra.id AS recette_id, ra.nom, ra.niveau_requis, 1 AS ordre
       FROM recettes_alchimie ra
       WHERE ra.niveau_requis = 1
         AND NOT EXISTS (SELECT 1 FROM personnage_recettes pr WHERE pr.personnage_id = p.id AND pr.recette_id = ra.id)
       ORDER BY ra.nom, ra.id LIMIT 1)
      UNION ALL
      (SELECT ra.id, ra.nom, ra.niveau_requis, 2
       FROM recettes_alchimie ra
       WHERE ra.niveau_requis = 2
         AND NOT EXISTS (SELECT 1 FROM personnage_recettes pr WHERE pr.personnage_id = p.id AND pr.recette_id = ra.id)
       ORDER BY ra.nom, ra.id LIMIT 1)
      UNION ALL
      (SELECT ra.id, ra.nom, ra.niveau_requis, 3
       FROM recettes_alchimie ra
       WHERE ra.niveau_requis = 3
         AND NOT EXISTS (SELECT 1 FROM personnage_recettes pr WHERE pr.personnage_id = p.id AND pr.recette_id = ra.id)
       ORDER BY ra.nom, ra.id LIMIT 1)
      UNION ALL
      (SELECT ra.id, ra.nom, ra.niveau_requis, 4
       FROM personnage_recettes pr JOIN recettes_alchimie ra ON ra.id = pr.recette_id
       WHERE pr.personnage_id = p.id
       ORDER BY ra.nom, ra.id LIMIT 1)
      UNION ALL
      (SELECT '00000000-0000-0000-0000-000000000000'::uuid, 'INEXISTANT', 0, 5)
      ORDER BY ordre, nom
    LOOP
      v_cas := v_cas || jsonb_build_array(jsonb_build_object(
        'ctx', v_ref,
        'demande', jsonb_build_object('recette_id', d.recette_id, 'recette_nom', d.nom, 'niveau_requis', d.niveau_requis),
        'verdict', public.peut_acheter_recette(p.id, d.recette_id)));
    END LOOP;
  END LOOP;
  IF v_ref = 0 THEN
    RAISE EXCEPTION 'fixtures_visiteur_recettes: aucun personnage editable (profil ZZ-Fixtures vide ou fiches non editables ?)';
  END IF;
  RETURN jsonb_build_object('type', 'recettes', 'genere_le', now(), 'nb_contextes', v_ref, 'nb_cas', jsonb_array_length(v_cas), 'contextes', v_contextes, 'cas', v_cas);
END;
$fx_recettes$;

REVOKE ALL ON FUNCTION public.fixtures_visiteur_recettes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fixtures_visiteur_recettes() TO service_role;

CREATE OR REPLACE FUNCTION public.fixtures_visiteur_assemblages()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fx_ass$
DECLARE
  v_contextes jsonb := '[]'::jsonb; v_cas jsonb := '[]'::jsonb; v_ref integer := 0;
  p record; d record;
BEGIN
  FOR p IN
    SELECT DISTINCT ON (u.id) u.id, u.xp_dispo FROM (
      (SELECT pe.id, (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0)) AS xp_dispo
       FROM personnages pe JOIN vue_artisanat_quotas q ON q.personnage_id = pe.id
       WHERE pe.est_actif AND NOT pe.est_mort AND (public.etat_edition_personnage_noyau(pe.id)->>'peut_ajouter')::boolean
         AND pe.joueur_id = public.profil_fixtures_id()
         AND q.niveau_runes >= 1
       ORDER BY q.niveau_runes DESC, pe.id LIMIT 2)
      UNION ALL
      (SELECT pe.id, (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0))
       FROM personnages pe JOIN vue_artisanat_quotas q ON q.personnage_id = pe.id
       WHERE pe.est_actif AND NOT pe.est_mort AND (public.etat_edition_personnage_noyau(pe.id)->>'peut_ajouter')::boolean
         AND pe.joueur_id = public.profil_fixtures_id()
         AND q.niveau_runes = 0
       ORDER BY pe.id LIMIT 1)
    ) u ORDER BY u.id
  LOOP
    v_ref := v_ref + 1;
    v_contextes := v_contextes || jsonb_build_array(jsonb_build_object(
      'ref', v_ref, 'xp_dispo', p.xp_dispo,
      'competences_acquises', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'competence_id', pc.competence_id, 'competence_nom', c.nom, 'categorie', c.categorie,
          'niveau_acquis', pc.niveau_acquis, 'choix_achat', pc.choix_achat)
          ORDER BY c.nom, pc.niveau_acquis, pc.choix_achat), '[]'::jsonb)
        FROM personnage_competences pc JOIN competences c ON c.id = pc.competence_id
        WHERE pc.personnage_id = p.id),
      'assemblages_acquis', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'assemblage_id', pa.assemblage_id, 'est_gratuit', pa.est_gratuit)
          ORDER BY pa.assemblage_id), '[]'::jsonb)
        FROM personnage_assemblages pa WHERE pa.personnage_id = p.id)));
    FOR d IN
      (SELECT ar.id AS assemblage_id, ar.nom, 1 AS ordre
       FROM assemblages_runes ar
       WHERE NOT EXISTS (SELECT 1 FROM personnage_assemblages pa WHERE pa.personnage_id = p.id AND pa.assemblage_id = ar.id)
       ORDER BY ar.cout_xp ASC, ar.nom, ar.id LIMIT 1)
      UNION ALL
      (SELECT ar.id, ar.nom, 2
       FROM assemblages_runes ar
       WHERE NOT EXISTS (SELECT 1 FROM personnage_assemblages pa WHERE pa.personnage_id = p.id AND pa.assemblage_id = ar.id)
       ORDER BY ar.cout_xp DESC, ar.nom, ar.id LIMIT 1)
      UNION ALL
      (SELECT ar.id, ar.nom, 3
       FROM personnage_assemblages pa JOIN assemblages_runes ar ON ar.id = pa.assemblage_id
       WHERE pa.personnage_id = p.id
       ORDER BY ar.nom, ar.id LIMIT 1)
      UNION ALL
      (SELECT '00000000-0000-0000-0000-000000000000'::uuid, 'INEXISTANT', 4)
      ORDER BY ordre, nom
    LOOP
      v_cas := v_cas || jsonb_build_array(jsonb_build_object(
        'ctx', v_ref,
        'demande', jsonb_build_object('assemblage_id', d.assemblage_id, 'assemblage_nom', d.nom),
        'verdict', public.peut_acheter_assemblage(p.id, d.assemblage_id)));
    END LOOP;
  END LOOP;
  IF v_ref = 0 THEN
    RAISE EXCEPTION 'fixtures_visiteur_assemblages: aucun personnage editable (profil ZZ-Fixtures vide ou fiches non editables ?)';
  END IF;
  RETURN jsonb_build_object('type', 'assemblages', 'genere_le', now(), 'nb_contextes', v_ref, 'nb_cas', jsonb_array_length(v_cas), 'contextes', v_contextes, 'cas', v_cas);
END;
$fx_ass$;

REVOKE ALL ON FUNCTION public.fixtures_visiteur_assemblages() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fixtures_visiteur_assemblages() TO service_role;