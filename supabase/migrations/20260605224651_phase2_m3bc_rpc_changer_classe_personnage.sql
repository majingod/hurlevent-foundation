-- ============================================================================
-- RPC : changer_classe_personnage  (Phase 2 M3bc)
-- Archi C : un seul RPC. Bloc simulation (RAISE CASCADE_SIMULE) capture les
-- arrays ; donnees agrege pour dry_run ; l'application reutilise les memes arrays.
-- Implemente D1 (over-cap + class-locked) / D2 (maitre) / D3 (dormants) /
-- D4 (perte gate transitive) / D5 (gratuites obsoletes) / D6 (payee->offerte).
-- XP pilote par historique_xp (remboursement). Jamais DELETE+rebuild.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.changer_classe_personnage(
  p_personnage_id        uuid,
  p_classe_id            uuid,
  p_choix_par_competence jsonb   DEFAULT NULL,
  p_dry_run              boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid        uuid := auth.uid();
  v_perso      personnages%ROWTYPE;
  v_classe     classes%ROWTYPE;
  v_ancienne   classes%ROWTYPE;
  v_norm_new   text;
  v_blocage    jsonb;

  -- arrays partages dry_run / application
  v_removal_ids uuid[] := ARRAY[]::uuid[];   -- pc a supprimer
  v_maitre_ids  uuid[] := ARRAY[]::uuid[];   -- pc -> statut_maitre 'en_attente'
  v_d6_ids      uuid[] := ARRAY[]::uuid[];   -- pc -> devient gratuite (xp 0) + refund
  v_added       jsonb  := '[]'::jsonb;        -- gratuites a ajouter [{competence_id,nom}]
  v_purge_sorts   boolean := false;
  v_purge_prieres boolean := false;

  -- cascade
  v_prereq jsonb; v_dep RECORD; v_max int; v_changed boolean;

  -- D6 / gratuites loop
  v_grat RECORD; v_choix text; v_pc_id uuid; v_pc_xp int;
  v_have_free boolean; v_have_paid boolean;

  -- agregation
  v_perdues   jsonb := '[]'::jsonb;
  v_dormants  jsonb := '[]'::jsonb;
  v_maitre    jsonb := '[]'::jsonb;
  v_offertes  jsonb := '[]'::jsonb;
  v_avert     jsonb := '[]'::jsonb;
  v_xp_comp int := 0; v_xp_sorts int := 0; v_xp_prieres int := 0; v_xp_d6 int := 0;
  v_xp_rembourse int := 0;
  v_donnees jsonb;
  v_xp_total_apres int; v_xp_depense_apres int;
BEGIN
  -- ===================== Phase 0 : validation =====================
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
  END IF;

  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
  END IF;

  SELECT * INTO v_classe FROM classes WHERE id = p_classe_id;
  IF NOT FOUND OR NOT v_classe.est_actif THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','classe_introuvable','message','Classe cible introuvable ou inactive')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
  END IF;

  IF v_classe.id = v_perso.classe_id THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','classe_identique','message','Le personnage possède déjà cette classe')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
  END IF;

  SELECT * INTO v_ancienne FROM classes WHERE id = v_perso.classe_id;

  -- Gate uniquement sur application reelle (le dry_run est une preview)
  IF NOT p_dry_run THEN
    v_blocage := public.gate_edition_personnage(p_personnage_id, 'complet');
    IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
  END IF;

  v_norm_new := CASE v_classe.nom
    WHEN 'Guerrier' THEN 'guerrier' WHEN 'Voleur' THEN 'voleur'
    WHEN 'Mage' THEN 'mage' WHEN 'Prêtre' THEN 'pretre' ELSE NULL END;

  -- ===================== Phase 1 : simulation (removal_ids + cascade) =====================
  BEGIN
    -- 1a. class-locked : classes_requises defini et nouvelle classe absente
    v_removal_ids := v_removal_ids || ARRAY(
      SELECT pc.id FROM personnage_competences pc JOIN competences c ON c.id=pc.competence_id
      WHERE pc.personnage_id = p_personnage_id
        AND c.classes_requises IS NOT NULL
        AND NOT (v_norm_new = ANY(c.classes_requises)));

    -- 1b. gratuites obsoletes (D5) : dans gratuites ancienne classe, absentes nouvelle classe
    v_removal_ids := v_removal_ids || ARRAY(
      SELECT pc.id FROM personnage_competences pc
      WHERE pc.personnage_id = p_personnage_id
        AND pc.competence_id IN (
          SELECT (g->>'competence_id')::uuid FROM jsonb_array_elements(COALESCE(v_ancienne.competences_gratuites,'[]'::jsonb)) g
          EXCEPT
          SELECT (g->>'competence_id')::uuid FROM jsonb_array_elements(COALESCE(v_classe.competences_gratuites,'[]'::jsonb)) g));

    -- 1c. over-cap (D1) : hors-classe (ni general ni nouvelle classe, classes_requises null), niveau > 2
    v_removal_ids := v_removal_ids || ARRAY(
      SELECT pc.id FROM personnage_competences pc JOIN competences c ON c.id=pc.competence_id
      WHERE pc.personnage_id = p_personnage_id
        AND NOT c.est_general AND c.categorie <> v_norm_new AND c.classes_requises IS NULL
        AND pc.niveau_acquis > 2);

    DELETE FROM personnage_competences WHERE id = ANY(v_removal_ids);

    -- 1d. cascade transitive (prerequis inter-competences, incl. gate magique D4)
    v_changed := true;
    WHILE v_changed LOOP
      v_changed := false;
      v_prereq := verifier_prerequis_competences(p_personnage_id);
      FOR v_dep IN
        SELECT pc.competence_id AS cid, max(pc.niveau_acquis) AS niv
        FROM personnage_competences pc WHERE pc.personnage_id = p_personnage_id
        GROUP BY pc.competence_id
      LOOP
        IF v_prereq ? v_dep.cid::text THEN
          v_max := COALESCE((v_prereq -> v_dep.cid::text ->> 'niveau_max_achetable')::int, 3);
          IF v_dep.niv > v_max THEN
            v_removal_ids := v_removal_ids || ARRAY(
              SELECT id FROM personnage_competences
              WHERE personnage_id=p_personnage_id AND competence_id=v_dep.cid AND niveau_acquis > v_max);
            DELETE FROM personnage_competences
              WHERE personnage_id=p_personnage_id AND competence_id=v_dep.cid AND niveau_acquis > v_max;
            v_changed := true;
          END IF;
        END IF;
      END LOOP;
    END LOOP;

    RAISE EXCEPTION 'CASCADE_SIMULE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'CASCADE_SIMULE%' THEN
      RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','erreur_cascade','message',SQLERRM)),'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
    END IF;
  END;
  -- (les DELETE ci-dessus sont annules par le RAISE ; v_removal_ids est conserve)

  -- declencheurs de dormance (D3) : Acquisition de Sort / Priere parmi les retires
  SELECT COALESCE(bool_or(c.nom='Acquisition de Sort'),false),
         COALESCE(bool_or(c.nom='Acquisition de Prière'),false)
    INTO v_purge_sorts, v_purge_prieres
    FROM personnage_competences pc JOIN competences c ON c.id=pc.competence_id
    WHERE pc.id = ANY(v_removal_ids);

  -- ===================== Phase 2 : maitre (D2) sur le set restant =====================
  -- hors-classe au niveau 2 (plafond) non retire et non deja en attente -> en_attente
  v_maitre_ids := ARRAY(
    SELECT pc.id FROM personnage_competences pc JOIN competences c ON c.id=pc.competence_id
    WHERE pc.personnage_id=p_personnage_id
      AND pc.id <> ALL(v_removal_ids)
      AND NOT c.est_general AND c.categorie <> v_norm_new AND c.classes_requises IS NULL
      AND pc.niveau_acquis = 2
      AND pc.statut_maitre = 'non_requis');

  -- ===================== Phase 3 : gratuites nouvelle classe (D6 + ajout) =====================
  FOR v_grat IN
    SELECT (g->>'competence_id')::uuid AS cid, c.nom, c.type_achat
    FROM jsonb_array_elements(COALESCE(v_classe.competences_gratuites,'[]'::jsonb)) g
    JOIN competences c ON c.id = (g->>'competence_id')::uuid
  LOOP
    v_have_free := EXISTS(SELECT 1 FROM personnage_competences pc
      WHERE pc.personnage_id=p_personnage_id AND pc.competence_id=v_grat.cid
        AND pc.xp_depense=0 AND pc.id <> ALL(v_removal_ids));
    v_have_paid := EXISTS(SELECT 1 FROM personnage_competences pc
      WHERE pc.personnage_id=p_personnage_id AND pc.competence_id=v_grat.cid
        AND pc.xp_depense>0 AND pc.id <> ALL(v_removal_ids));

    IF NOT v_have_free AND NOT v_have_paid THEN
      -- ajout d'une gratuite que le joueur ne possede pas
      v_added := v_added || jsonb_build_object('competence_id', v_grat.cid, 'nom', v_grat.nom);
      v_offertes := v_offertes || jsonb_build_object('nom', v_grat.nom, 'type','ajout', 'xp', 0);
    ELSIF v_have_paid AND NOT v_have_free THEN
      -- D6 : payee -> offerte par la nouvelle classe -> rembourser UNE instance
      v_pc_id := NULL; v_pc_xp := NULL;
      IF v_grat.type_achat = 'multiple_choix_distinct' THEN
        v_choix := p_choix_par_competence ->> v_grat.cid::text;
        IF v_choix IS NOT NULL THEN
          SELECT pc.id, pc.xp_depense INTO v_pc_id, v_pc_xp
          FROM personnage_competences pc
          WHERE pc.personnage_id=p_personnage_id AND pc.competence_id=v_grat.cid
            AND pc.choix_achat = v_choix AND pc.xp_depense>0 AND pc.id <> ALL(v_removal_ids)
          LIMIT 1;
        ELSIF p_dry_run THEN
          -- preview : instance la moins chere
          SELECT pc.id, pc.xp_depense INTO v_pc_id, v_pc_xp
          FROM personnage_competences pc
          WHERE pc.personnage_id=p_personnage_id AND pc.competence_id=v_grat.cid
            AND pc.xp_depense>0 AND pc.id <> ALL(v_removal_ids)
          ORDER BY pc.xp_depense, pc.id LIMIT 1;
        ELSE
          RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','choix_requis','message',format('Choisissez quelle instance de « %s » devient gratuite',v_grat.nom),'champ',v_grat.cid::text)),'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
        END IF;
      ELSE
        -- single : le niveau 1 (offert)
        SELECT pc.id, pc.xp_depense INTO v_pc_id, v_pc_xp
        FROM personnage_competences pc
        WHERE pc.personnage_id=p_personnage_id AND pc.competence_id=v_grat.cid
          AND pc.niveau_acquis=1 AND pc.xp_depense>0 AND pc.id <> ALL(v_removal_ids)
        LIMIT 1;
      END IF;

      IF v_pc_id IS NOT NULL THEN
        v_d6_ids := v_d6_ids || v_pc_id;
        v_xp_d6  := v_xp_d6 + v_pc_xp;
        v_offertes := v_offertes || jsonb_build_object('nom', v_grat.nom, 'type','d6_refund', 'xp', v_pc_xp);
      END IF;
    END IF;
    -- (have_free deja : rien, gratuite deja satisfaite)
  END LOOP;

  -- ===================== Phase 4 : agregation donnees =====================
  -- perdues (retraits) : libelle + niveaux + xp rembourse par competence
  SELECT COALESCE(jsonb_agg(jsonb_build_object('nom',t.nom,'niveaux',t.niveaux,'xp',t.xp) ORDER BY t.nom),'[]'::jsonb),
         COALESCE(SUM(t.xp),0)::int
    INTO v_perdues, v_xp_comp
  FROM (
    SELECT c.nom, jsonb_agg(pc.niveau_acquis ORDER BY pc.niveau_acquis) AS niveaux, SUM(pc.xp_depense)::int AS xp
    FROM personnage_competences pc JOIN competences c ON c.id=pc.competence_id
    WHERE pc.id = ANY(v_removal_ids)
    GROUP BY c.nom
  ) t;

  -- dormants sorts/prieres (statut achete -> cree) + refund
  IF v_purge_sorts THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('type','sort','nom',COALESCE(ps.nom_personnalise,s.nom),'xp',ps.xp_depense) ORDER BY COALESCE(ps.nom_personnalise,s.nom)),'[]'::jsonb),
           COALESCE(SUM(ps.xp_depense),0)::int
      INTO v_dormants, v_xp_sorts
    FROM personnage_sorts ps JOIN sorts s ON s.id=ps.sort_id
    WHERE ps.personnage_id=p_personnage_id AND ps.statut='achete';
  END IF;
  IF v_purge_prieres THEN
    SELECT v_dormants || COALESCE(jsonb_agg(jsonb_build_object('type','priere','nom',COALESCE(pp.nom_personnalise,pr.nom),'xp',pp.xp_depense) ORDER BY COALESCE(pp.nom_personnalise,pr.nom)),'[]'::jsonb),
           COALESCE(SUM(pp.xp_depense),0)::int
      INTO v_dormants, v_xp_prieres
    FROM personnage_prieres pp JOIN prieres pr ON pr.id=pp.priere_id
    WHERE pp.personnage_id=p_personnage_id AND pp.statut='achete';
  END IF;

  -- maitre en attente (libelles + avertissements)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('nom',c.nom,'niveau',pc.niveau_acquis) ORDER BY c.nom),'[]'::jsonb)
    INTO v_maitre
  FROM personnage_competences pc JOIN competences c ON c.id=pc.competence_id
  WHERE pc.id = ANY(v_maitre_ids);

  IF jsonb_array_length(v_maitre) > 0 THEN
    SELECT jsonb_agg(jsonb_build_object('code','maitre_requis','message',
      format('« %s » niveau %s passe hors-classe : approbation d''un maître désormais requise.', e->>'nom', e->>'niveau')))
      INTO v_avert FROM jsonb_array_elements(v_maitre) e;
  END IF;

  v_xp_rembourse := v_xp_comp + v_xp_sorts + v_xp_prieres + v_xp_d6;

  v_donnees := jsonb_build_object(
    'classe_avant', v_ancienne.nom,
    'classe_apres', v_classe.nom,
    'perdues',           v_perdues,
    'dormants',          v_dormants,
    'maitre_en_attente', v_maitre,
    'offertes',          v_offertes,
    'xp_rembourse',      v_xp_rembourse);

  -- ===================== Phase 5 : dry_run -> preview =====================
  IF p_dry_run THEN
    RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements',v_avert,'donnees',v_donnees);
  END IF;

  -- ===================== Phase 6 : application reelle =====================
  -- 6a. refunds historique_xp (AVANT delete / passage gratuit)
  INSERT INTO historique_xp(personnage_id,type_mouvement,montant,description,competence_id,acteur_id)
  SELECT p_personnage_id,'remboursement',SUM(pc.xp_depense)::int,
         format('Changement de classe (%s → %s) — retrait de %s',v_ancienne.nom,v_classe.nom,c.nom),
         pc.competence_id,v_uid
  FROM personnage_competences pc JOIN competences c ON c.id=pc.competence_id
  WHERE pc.id = ANY(v_removal_ids) AND pc.xp_depense>0
  GROUP BY pc.competence_id,c.nom;

  -- D6 : refund de l'instance offerte
  INSERT INTO historique_xp(personnage_id,type_mouvement,montant,description,competence_id,acteur_id)
  SELECT p_personnage_id,'remboursement',pc.xp_depense,
         format('Changement de classe — « %s » désormais offerte par %s',c.nom,v_classe.nom),
         pc.competence_id,v_uid
  FROM personnage_competences pc JOIN competences c ON c.id=pc.competence_id
  WHERE pc.id = ANY(v_d6_ids);

  -- dormants sorts
  IF v_purge_sorts THEN
    INSERT INTO historique_xp(personnage_id,type_mouvement,montant,description,sort_id,acteur_id)
    SELECT p_personnage_id,'remboursement',ps.xp_depense,
           format('Changement de classe — sort « %s » mis en sommeil (réactivable)',COALESCE(ps.nom_personnalise,s.nom)),
           ps.sort_id,v_uid
    FROM personnage_sorts ps JOIN sorts s ON s.id=ps.sort_id
    WHERE ps.personnage_id=p_personnage_id AND ps.statut='achete' AND ps.xp_depense>0;
    UPDATE personnage_sorts SET statut='cree' WHERE personnage_id=p_personnage_id AND statut='achete';
  END IF;
  -- dormants prieres
  IF v_purge_prieres THEN
    INSERT INTO historique_xp(personnage_id,type_mouvement,montant,description,priere_id,acteur_id)
    SELECT p_personnage_id,'remboursement',pp.xp_depense,
           format('Changement de classe — prière « %s » mise en sommeil (réactivable)',COALESCE(pp.nom_personnalise,pr.nom)),
           pp.priere_id,v_uid
    FROM personnage_prieres pp JOIN prieres pr ON pr.id=pp.priere_id
    WHERE pp.personnage_id=p_personnage_id AND pp.statut='achete' AND pp.xp_depense>0;
    UPDATE personnage_prieres SET statut='cree' WHERE personnage_id=p_personnage_id AND statut='achete';
  END IF;

  -- 6b. suppressions
  DELETE FROM personnage_competences WHERE id = ANY(v_removal_ids);

  -- 6c. maitre en attente (D2)
  UPDATE personnage_competences SET statut_maitre='en_attente' WHERE id = ANY(v_maitre_ids);

  -- 6d. D6 : instance offerte devient gratuite (xp 0) -> non desachetable, pas de double refund
  UPDATE personnage_competences SET xp_depense=0 WHERE id = ANY(v_d6_ids);

  -- 6e. ajout des gratuites manquantes (niveau 1, 0 XP)
  INSERT INTO personnage_competences(personnage_id,competence_id,niveau_acquis,xp_depense,appris_via_maitre,statut_maitre)
  SELECT p_personnage_id,(e->>'competence_id')::uuid,1,0,false,'non_requis'
  FROM jsonb_array_elements(v_added) e;

  -- 6f. bascule de classe
  UPDATE personnages SET classe_id = p_classe_id WHERE id = p_personnage_id;

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres FROM personnages WHERE id = p_personnage_id;
  v_donnees := v_donnees || jsonb_build_object(
    'xp_total', v_xp_total_apres, 'xp_depense', v_xp_depense_apres,
    'xp_restant', v_xp_total_apres - v_xp_depense_apres);

  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements',v_avert,'donnees',v_donnees);
END;
$function$;
