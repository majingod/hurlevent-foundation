-- D48-bis (s378) — Cascade pieges alignee sur les runes (arbitrage Fred, option A) :
-- les ameliorations PAYEES restent (achat libre, cf. retrait 20260806061956) ; seuls les
-- GRATUITS hors quota de leur palier tombent, derniers acquis d'abord ; competence a 0 ->
-- tout tombe. Remplace la symetrie stricte de 20260806004038 pour les pieges seulement
-- (alchimie inchangee : la gate d'achat des recettes exige le palier, la symetrie y est juste).
CREATE OR REPLACE FUNCTION public.cascade_artisanat_apres_desachat(p_personnage_id uuid, p_execute boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_niv_alch int := 0; v_niv_runes int := 0; v_niv_pieges int := 0; v_quota_asm int := 0;
  v_quota_p1 int := 0; v_quota_p2 int := 0; v_quota_p3 int := 0;
  v_items jsonb := '[]'::jsonb; v_bloc jsonb; v_xp int := 0; v_xp_bloc int;
  v_ids_rec uuid[] := '{}'; v_ids_asm uuid[] := '{}'; v_ids_pieges uuid[] := '{}';
  v_n_rec int := 0; v_n_asm int := 0; v_n_pieges int := 0;
  r RECORD;
BEGIN
  SELECT COALESCE(niveau_alchimie,0), COALESCE(niveau_runes,0), COALESCE(niveau_pieges,0),
         COALESCE(quota_assemblages_total,0),
         COALESCE(quota_pieges_niv1_total,0),
         COALESCE(quota_pieges_amelioration_niv2_total,0),
         COALESCE(quota_pieges_amelioration_niv3_total,0)
    INTO v_niv_alch, v_niv_runes, v_niv_pieges, v_quota_asm,
         v_quota_p1, v_quota_p2, v_quota_p3
    FROM vue_artisanat_quotas WHERE personnage_id = p_personnage_id;
  -- Personnage absent de la vue -> niveaux/quotas 0 : tout item residuel tombe (voulu).

  -- 1) Recettes d'alchimie : palier au-dessus du niveau restant (la gate d'achat exige le palier).
  SELECT COALESCE(array_agg(t.id), '{}'),
         COALESCE(jsonb_agg(jsonb_build_object('type','recette','type_label','Recette d''alchimie',
           'nom',t.nom,'quantite',1,'xp_unitaire',t.xp_depense,'xp_total',t.xp_depense) ORDER BY t.nom),'[]'::jsonb),
         COALESCE(SUM(t.xp_depense),0)::int, COUNT(*)::int
    INTO v_ids_rec, v_bloc, v_xp_bloc, v_n_rec
    FROM (SELECT pr.id, ra.nom, COALESCE(pr.xp_depense,0) AS xp_depense
            FROM personnage_recettes pr JOIN recettes_alchimie ra ON ra.id = pr.recette_id
           WHERE pr.personnage_id = p_personnage_id AND ra.niveau_requis > v_niv_alch) t;
  v_items := v_items || v_bloc; v_xp := v_xp + v_xp_bloc;

  -- 2) Pieges : competence a 0 -> tout tombe ; sinon seuls les GRATUITS hors quota de leur
  --    palier tombent (derniers acquis d'abord) — les ameliorations PAYEES restent.
  IF v_niv_pieges = 0 THEN
    SELECT COALESCE(array_agg(t.id), '{}'),
           COALESCE(jsonb_agg(jsonb_build_object('type','piege','type_label','Piège',
             'nom',t.nom_affiche,'quantite',1,'xp_unitaire',t.xp_depense,'xp_total',t.xp_depense) ORDER BY t.nom_affiche),'[]'::jsonb),
           COALESCE(SUM(t.xp_depense),0)::int, COUNT(*)::int
      INTO v_ids_pieges, v_bloc, v_xp_bloc, v_n_pieges
      FROM (SELECT pp.id, pp.piege_nom || ' (palier ' || pp.niveau_acquis || ')' AS nom_affiche,
                   COALESCE(pp.xp_depense,0) AS xp_depense
              FROM personnage_pieges pp
             WHERE pp.personnage_id = p_personnage_id) t;
  ELSE
    SELECT COALESCE(array_agg(t.id), '{}'),
           COALESCE(jsonb_agg(jsonb_build_object('type','piege','type_label','Piège',
             'nom',t.nom_affiche,'quantite',1,'xp_unitaire',t.xp_depense,'xp_total',t.xp_depense) ORDER BY t.nom_affiche),'[]'::jsonb),
           COALESCE(SUM(t.xp_depense),0)::int, COUNT(*)::int
      INTO v_ids_pieges, v_bloc, v_xp_bloc, v_n_pieges
      FROM (SELECT s.id, s.piege_nom || ' (palier ' || s.niveau_acquis || ')' AS nom_affiche,
                   s.xp_depense
              FROM (SELECT pp.id, pp.piege_nom, pp.niveau_acquis, COALESCE(pp.xp_depense,0) AS xp_depense,
                           row_number() OVER (PARTITION BY pp.niveau_acquis
                                              ORDER BY pp.date_acquisition ASC, pp.id ASC) AS rang
                      FROM personnage_pieges pp
                     WHERE pp.personnage_id = p_personnage_id AND pp.est_gratuit = true) s
             WHERE s.rang > CASE s.niveau_acquis
                              WHEN 1 THEN v_quota_p1
                              WHEN 2 THEN v_quota_p2
                              WHEN 3 THEN v_quota_p3
                              ELSE 0 END) t;
  END IF;
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

COMMENT ON FUNCTION public.cascade_artisanat_apres_desachat(uuid, boolean) IS
'D48-bis (s378) : recettes palier > niveau alchimie ; pieges = gratuits hors quota de leur palier seulement, payants conserves (arbitrage Fred, achat d''amelioration libre), competence a 0 = tout ; runes 0 = tout sinon gratuits excedentaires. Derniers acquis d''abord. Rembourse xp_depense de la ligne. Purge aussi les orphelins preexistants (annonces).';

-- CREATE OR REPLACE remet l'ACL a PUBLIC : re-poser a l'identique.
REVOKE ALL ON FUNCTION public.cascade_artisanat_apres_desachat(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cascade_artisanat_apres_desachat(uuid, boolean) TO service_role;