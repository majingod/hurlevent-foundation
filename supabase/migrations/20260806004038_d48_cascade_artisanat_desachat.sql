-- D48 (s378) — Désachat en cascade : l'artisanat suit la compétence mère.
-- Arbitrages Fred (s377/s378) :
--   · La cascade REMBOURSE l'XP des achats payants (xp_depense DE LA LIGNE, jamais le prix catalogue).
--   · Symétrie stricte par palier : recettes d'alchimie (niveau_requis > niveau restant) et
--     paliers de pièges (niveau_acquis > niveau restant ; manuel « permet d'installer des pièges de niveau N »).
--   · Runes : le manuel ne met AUCUN palier sur un assemblage précis (Runes 2 = +2 slots gratuits
--     + usages de table). Seuls les GRATUITS excédentaires tombent, derniers acquis d'abord
--     (date_acquisition, id) ; les payants restent (légitimes dès Runes 1). Runes à 0 → tout tombe.
-- La cascade lit l'état RÉEL post-noyau (décision 34 : re-dériver de l'exécution, jamais de
-- l'intention) — elle purge donc aussi tout orphelin préexistant du personnage (auto-cicatrisant,
-- toujours annoncé dans items_detail). Pas d'appel reconcilier_* : les quotas des paliers
-- conservés ne bougent pas, aucun slot ne se libère (raisonnement s378, cas déroulés).
-- C80 : le noyau (12 515 o, intact) est RENOMMÉ ; l'enveloppe porte l'orchestration.
-- ACL : enveloppe → authenticated + service_role ; noyau + cascade → service_role seul
-- (l'appel client passe par l'enveloppe, SECURITY DEFINER owner postgres).
-- REPLI : DROP FUNCTION public.desacheter_competence(uuid, boolean);
--         ALTER FUNCTION public.desacheter_competence_noyau(uuid, boolean) RENAME TO desacheter_competence;
--         GRANT EXECUTE ... TO authenticated, service_role; (comportement d'avant, cascade artisanat coupée)

CREATE OR REPLACE FUNCTION public.cascade_artisanat_apres_desachat(p_personnage_id uuid, p_execute boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_niv_alch int := 0; v_niv_runes int := 0; v_niv_pieges int := 0; v_quota_asm int := 0;
  v_items jsonb := '[]'::jsonb; v_bloc jsonb; v_xp int := 0; v_xp_bloc int;
  v_ids_rec uuid[] := '{}'; v_ids_asm uuid[] := '{}'; v_ids_pieges uuid[] := '{}';
  v_n_rec int := 0; v_n_asm int := 0; v_n_pieges int := 0;
  r RECORD;
BEGIN
  SELECT COALESCE(niveau_alchimie,0), COALESCE(niveau_runes,0), COALESCE(niveau_pieges,0),
         COALESCE(quota_assemblages_total,0)
    INTO v_niv_alch, v_niv_runes, v_niv_pieges, v_quota_asm
    FROM vue_artisanat_quotas WHERE personnage_id = p_personnage_id;
  -- Personnage absent de la vue -> niveaux 0 : tout item d'artisanat residuel tombe (voulu).

  -- 1) Recettes d'alchimie : palier au-dessus du niveau restant.
  SELECT COALESCE(array_agg(t.id), '{}'),
         COALESCE(jsonb_agg(jsonb_build_object('type','recette','type_label','Recette d''alchimie',
           'nom',t.nom,'quantite',1,'xp_unitaire',t.xp_depense,'xp_total',t.xp_depense) ORDER BY t.nom),'[]'::jsonb),
         COALESCE(SUM(t.xp_depense),0)::int, COUNT(*)::int
    INTO v_ids_rec, v_bloc, v_xp_bloc, v_n_rec
    FROM (SELECT pr.id, ra.nom, COALESCE(pr.xp_depense,0) AS xp_depense
            FROM personnage_recettes pr JOIN recettes_alchimie ra ON ra.id = pr.recette_id
           WHERE pr.personnage_id = p_personnage_id AND ra.niveau_requis > v_niv_alch) t;
  v_items := v_items || v_bloc; v_xp := v_xp + v_xp_bloc;

  -- 2) Paliers de pieges au-dessus du niveau restant de la competence.
  SELECT COALESCE(array_agg(t.id), '{}'),
         COALESCE(jsonb_agg(jsonb_build_object('type','piege','type_label','Piège',
           'nom',t.nom_affiche,'quantite',1,'xp_unitaire',t.xp_depense,'xp_total',t.xp_depense) ORDER BY t.nom_affiche),'[]'::jsonb),
         COALESCE(SUM(t.xp_depense),0)::int, COUNT(*)::int
    INTO v_ids_pieges, v_bloc, v_xp_bloc, v_n_pieges
    FROM (SELECT pp.id, pp.piege_nom || ' (palier ' || pp.niveau_acquis || ')' AS nom_affiche,
                 COALESCE(pp.xp_depense,0) AS xp_depense
            FROM personnage_pieges pp
           WHERE pp.personnage_id = p_personnage_id AND pp.niveau_acquis > v_niv_pieges) t;
  v_items := v_items || v_bloc; v_xp := v_xp + v_xp_bloc;

  -- 3) Assemblages de runes : niveau 0 -> tout ; sinon gratuits excedentaires, derniers acquis d'abord.
  IF v_niv_runes = 0 THEN
    SELECT COALESCE(array_agg(t.id), '{}'),
           COALESCE(jsonb_agg(jsonb_build_object('type','assemblage','type_label','Assemblage de runes',
             'nom',t.nom,'quantite',1,'xp_unitaire',t.xp_depense,'xp_total',t.xp_depense) ORDER BY t.nom),'[]'::jsonb),
           COALESCE(SUM(t.xp_depense),0)::int, COUNT(*)::int
      INTO v_ids_asm, v_bloc, v_xp_bloc, v_n_asm
      FROM (SELECT pa.id, ar.nom, COALESCE(pa.xp_depense,0) AS xp_depense
              FROM personnage_assemblages pa JOIN assemblages_runes ar ON ar.id = pa.assemblage_id
             WHERE pa.personnage_id = p_personnage_id) t;
  ELSE
    SELECT COALESCE(array_agg(t.id), '{}'),
           COALESCE(jsonb_agg(jsonb_build_object('type','assemblage','type_label','Assemblage de runes',
             'nom',t.nom,'quantite',1,'xp_unitaire',t.xp_depense,'xp_total',t.xp_depense) ORDER BY t.nom),'[]'::jsonb),
           COALESCE(SUM(t.xp_depense),0)::int, COUNT(*)::int
      INTO v_ids_asm, v_bloc, v_xp_bloc, v_n_asm
      FROM (SELECT s.id, s.nom, s.xp_depense
              FROM (SELECT pa.id, ar.nom, COALESCE(pa.xp_depense,0) AS xp_depense,
                           row_number() OVER (ORDER BY pa.date_acquisition ASC, pa.id ASC) AS rang
                      FROM personnage_assemblages pa JOIN assemblages_runes ar ON ar.id = pa.assemblage_id
                     WHERE pa.personnage_id = p_personnage_id AND pa.est_gratuit = true) s
             WHERE s.rang > v_quota_asm) t;
  END IF;
  v_items := v_items || v_bloc; v_xp := v_xp + v_xp_bloc;

  IF p_execute THEN
    -- Remboursements (payants seulement : xp_depense > 0), colonne de tracage dediee par table.
    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, recette_id, acteur_id)
    SELECT p_personnage_id, 'remboursement', pr.xp_depense,
           format('Désachat en cascade — artisanat : recette « %s »', ra.nom), pr.recette_id, v_uid
      FROM personnage_recettes pr JOIN recettes_alchimie ra ON ra.id = pr.recette_id
     WHERE pr.id = ANY(v_ids_rec) AND COALESCE(pr.xp_depense,0) > 0;

    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, piege_id, acteur_id)
    SELECT p_personnage_id, 'remboursement', pp.xp_depense,
           format('Désachat en cascade — artisanat : piège « %s » palier %s', pp.piege_nom, pp.niveau_acquis),
           pp.piege_id, v_uid
      FROM personnage_pieges pp
     WHERE pp.id = ANY(v_ids_pieges) AND COALESCE(pp.xp_depense,0) > 0;

    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, assemblage_id, acteur_id)
    SELECT p_personnage_id, 'remboursement', pa.xp_depense,
           format('Désachat en cascade — artisanat : assemblage « %s »', ar.nom), pa.assemblage_id, v_uid
      FROM personnage_assemblages pa JOIN assemblages_runes ar ON ar.id = pa.assemblage_id
     WHERE pa.id = ANY(v_ids_asm) AND COALESCE(pa.xp_depense,0) > 0;

    FOR r IN SELECT it FROM jsonb_array_elements(v_items) AS x(it) LOOP
      PERFORM public.log_audit('personnage', p_personnage_id, 'desachat_cascade_artisanat', r.it);
    END LOOP;

    DELETE FROM personnage_recettes    WHERE id = ANY(v_ids_rec);
    DELETE FROM personnage_pieges      WHERE id = ANY(v_ids_pieges);
    DELETE FROM personnage_assemblages WHERE id = ANY(v_ids_asm);
  END IF;

  RETURN jsonb_build_object('items', v_items, 'xp_rembourse', v_xp,
    'count_recettes', v_n_rec, 'count_assemblages', v_n_asm, 'count_pieges', v_n_pieges);
END;
$fn$;

-- C80 : RENAME garde par l'existence du noyau (rejouable sans renommer l'enveloppe).
DO $$
BEGIN
  IF to_regprocedure('public.desacheter_competence_noyau(uuid, boolean)') IS NULL
     AND to_regprocedure('public.desacheter_competence(uuid, boolean)') IS NOT NULL THEN
    ALTER FUNCTION public.desacheter_competence(uuid, boolean) RENAME TO desacheter_competence_noyau;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.desacheter_competence(p_personnage_competence_id uuid, p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_personnage_id uuid;
  v_res jsonb; v_art jsonb := NULL; v_donnees jsonb; v_sim jsonb;
  v_ok boolean := false;
  v_xt int; v_xd int;
BEGIN
  SELECT personnage_id INTO v_personnage_id
    FROM personnage_competences WHERE id = p_personnage_competence_id;

  v_res := public.desacheter_competence_noyau(p_personnage_competence_id, p_dry_run);
  IF NOT COALESCE((v_res->>'succes')::boolean, false) OR v_personnage_id IS NULL THEN
    RETURN v_res;
  END IF;

  IF p_dry_run THEN
    -- Simulation avortee (motif CASCADE_SIMULE du noyau) : executer le noyau EN REEL puis
    -- collecter l'artisanat sur l'etat post-noyau, et tout annuler. Les variables plpgsql
    -- survivent au rollback de la sous-transaction.
    BEGIN
      v_sim := public.desacheter_competence_noyau(p_personnage_competence_id, false);
      IF COALESCE((v_sim->>'succes')::boolean, false) THEN
        v_art := public.cascade_artisanat_apres_desachat(v_personnage_id, false);
        v_ok := true;
      END IF;
      RAISE EXCEPTION 'CASCADE_SIMULE_ARTISANAT';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'CASCADE_SIMULE_ARTISANAT' THEN
        v_art := NULL; v_ok := false; -- simulation impossible : rapport du noyau seul
      END IF;
    END;
  ELSE
    v_art := public.cascade_artisanat_apres_desachat(v_personnage_id, true);
    v_ok := true;
  END IF;

  IF v_ok AND v_art IS NOT NULL THEN
    v_donnees := COALESCE(v_res->'donnees', '{}'::jsonb);
    v_donnees := jsonb_set(v_donnees, '{items_detail}',
      COALESCE(v_donnees->'items_detail', '[]'::jsonb) || COALESCE(v_art->'items', '[]'::jsonb));
    v_donnees := jsonb_set(v_donnees, '{xp_rembourse}',
      to_jsonb(COALESCE((v_donnees->>'xp_rembourse')::int, 0) + COALESCE((v_art->>'xp_rembourse')::int, 0)));
    v_donnees := v_donnees || jsonb_build_object(
      'count_recettes',    COALESCE((v_art->>'count_recettes')::int, 0),
      'count_assemblages', COALESCE((v_art->>'count_assemblages')::int, 0),
      'count_pieges',      COALESCE((v_art->>'count_pieges')::int, 0));
    IF NOT p_dry_run THEN
      SELECT xp_total, xp_depense INTO v_xt, v_xd FROM personnages WHERE id = v_personnage_id;
      v_donnees := v_donnees || jsonb_build_object('xp_total', v_xt, 'xp_depense', v_xd, 'xp_restant', v_xt - v_xd);
    END IF;
    v_res := jsonb_set(v_res, '{donnees}', v_donnees);
  END IF;

  RETURN v_res;
END;
$fn$;

COMMENT ON FUNCTION public.desacheter_competence(uuid, boolean) IS
'Enveloppe D48 (s378) : delegue au noyau puis cascade l''artisanat depuis l''etat reel post-noyau. Repli : DROP l''enveloppe, RENAME le noyau en desacheter_competence, re-GRANT authenticated.';
COMMENT ON FUNCTION public.cascade_artisanat_apres_desachat(uuid, boolean) IS
'D48 (s378) : recettes palier > niveau alchimie ; pieges palier > niveau competence ; runes 0 = tout, sinon gratuits excedentaires (derniers acquis d''abord, arbitrage Fred). Rembourse xp_depense de la ligne. Purge aussi les orphelins preexistants (annonces).';

REVOKE ALL ON FUNCTION public.desacheter_competence(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.desacheter_competence(uuid, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.desacheter_competence_noyau(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.desacheter_competence_noyau(uuid, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.cascade_artisanat_apres_desachat(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cascade_artisanat_apres_desachat(uuid, boolean) TO service_role;