-- ============================================================================
-- REFONTE 3b — RÉCONCILIATEUR ACHAT/DÉSACHAT ARTISANAT (recettes + assemblages)
-- ----------------------------------------------------------------------------
-- Ferme l'exploit XP par construction (acheter_recette comparait un compteur
-- GLOBAL de gratuites au quota GLOBAL, alors que les recettes ont un quota PAR
-- PALIER 5/4/3). Le réconciliateur devient la SEULE autorité ; est_gratuit et
-- xp_depense ne sont plus que des projections recalculées.
--
-- Ledger A (append-only) : à chaque bascule de statut, on ajoute une ligne
-- compensatoire dont le montant = (coût cible - coût déjà inscrit sur la ligne).
-- => Aucun remboursement fantôme, NO-OP si déjà réconcilié (idempotent).
--
-- Pièges : intacts (non touchés). Portée : recettes + assemblages uniquement.
-- ============================================================================

-- ============================================================
-- 1. RÉCONCILIATEUR RECETTES (3 paliers : niveau_requis 1/2/3)
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconcilier_recettes(p_personnage_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_q     record;
  r       record;
  v_quota integer;
  v_cible integer;
  v_delta integer;
BEGIN
  SELECT quota_alchimie_mineure_total       AS q1,
         quota_alchimie_intermediaire_total AS q2,
         quota_alchimie_majeure_total       AS q3
    INTO v_q
    FROM vue_artisanat_quotas
   WHERE personnage_id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT pr.id,
           pr.xp_depense  AS xp_actuel,
           pr.est_gratuit AS gratuit_actuel,
           pr.recette_id,
           ra.niveau_requis,
           ra.cout_xp,
           row_number() OVER (PARTITION BY ra.niveau_requis
                              ORDER BY pr.date_acquisition ASC, pr.id ASC) AS rang
      FROM personnage_recettes pr
      JOIN recettes_alchimie ra ON ra.id = pr.recette_id
     WHERE pr.personnage_id = p_personnage_id
  LOOP
    v_quota := CASE r.niveau_requis
                 WHEN 1 THEN COALESCE(v_q.q1, 0)
                 WHEN 2 THEN COALESCE(v_q.q2, 0)
                 WHEN 3 THEN COALESCE(v_q.q3, 0)
                 ELSE 0
               END;
    v_cible := CASE WHEN r.rang <= v_quota THEN 0 ELSE COALESCE(r.cout_xp, 0) END;
    v_delta := v_cible - COALESCE(r.xp_actuel, 0);

    IF v_delta > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, recette_id, acteur_id)
      VALUES (p_personnage_id, 'depense_recette', -v_delta,
              'Réconciliation artisanat : recette passée payante (' || v_delta || ' XP)',
              r.recette_id, auth.uid());
    ELSIF v_delta < 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, recette_id, acteur_id)
      VALUES (p_personnage_id, 'remboursement', -v_delta,
              'Réconciliation artisanat : recette passée gratuite (' || (-v_delta) || ' XP remboursés)',
              r.recette_id, auth.uid());
    END IF;

    IF v_delta <> 0 OR r.gratuit_actuel IS DISTINCT FROM (v_cible = 0) THEN
      UPDATE personnage_recettes
         SET xp_depense  = v_cible,
             est_gratuit = (v_cible = 0)
       WHERE id = r.id;
    END IF;
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.reconcilier_recettes(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 2. RÉCONCILIATEUR ASSEMBLAGES (seau unique)
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconcilier_assemblages(p_personnage_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r       record;
  v_quota integer;
  v_cible integer;
  v_delta integer;
BEGIN
  SELECT COALESCE(quota_assemblages_total, 0)
    INTO v_quota
    FROM vue_artisanat_quotas
   WHERE personnage_id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT pa.id,
           pa.xp_depense  AS xp_actuel,
           pa.est_gratuit AS gratuit_actuel,
           pa.assemblage_id,
           ar.cout_xp,
           row_number() OVER (ORDER BY pa.date_acquisition ASC, pa.id ASC) AS rang
      FROM personnage_assemblages pa
      JOIN assemblages_runes ar ON ar.id = pa.assemblage_id
     WHERE pa.personnage_id = p_personnage_id
  LOOP
    v_cible := CASE WHEN r.rang <= v_quota THEN 0 ELSE COALESCE(r.cout_xp, 0) END;
    v_delta := v_cible - COALESCE(r.xp_actuel, 0);

    IF v_delta > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, assemblage_id, acteur_id)
      VALUES (p_personnage_id, 'depense_assemblage', -v_delta,
              'Réconciliation artisanat : assemblage passé payant (' || v_delta || ' XP)',
              r.assemblage_id, auth.uid());
    ELSIF v_delta < 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, assemblage_id, acteur_id)
      VALUES (p_personnage_id, 'remboursement', -v_delta,
              'Réconciliation artisanat : assemblage passé gratuit (' || (-v_delta) || ' XP remboursés)',
              r.assemblage_id, auth.uid());
    END IF;

    IF v_delta <> 0 OR r.gratuit_actuel IS DISTINCT FROM (v_cible = 0) THEN
      UPDATE personnage_assemblages
         SET xp_depense  = v_cible,
             est_gratuit = (v_cible = 0)
       WHERE id = r.id;
    END IF;
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.reconcilier_assemblages(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 3. RPC MINCES — ACHETER RECETTE
-- ============================================================
CREATE OR REPLACE FUNCTION public.acheter_recette(p_personnage_id uuid, p_recette_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid             uuid := auth.uid();
  v_perso           personnages%ROWTYPE;
  v_q               record;
  v_niveau_alchimie integer;
  v_niveau_requis   integer;
  v_cout_xp         integer;
  v_quota_palier    integer;
  v_count_palier    integer;
  v_cout_prevu      integer;
  v_new_id          uuid;
  v_ligne           personnage_recettes%ROWTYPE;
  v_xp_total        integer;
  v_xp_depense      integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Existence + palier de la recette
  SELECT niveau_requis, cout_xp INTO v_niveau_requis, v_cout_xp
    FROM recettes_alchimie WHERE id = p_recette_id;
  IF v_niveau_requis IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','recette_introuvable','message','Recette introuvable ou sans coût défini')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Quotas par palier
  SELECT niveau_alchimie,
         quota_alchimie_mineure_total       AS q1,
         quota_alchimie_intermediaire_total AS q2,
         quota_alchimie_majeure_total       AS q3
    INTO v_q
    FROM vue_artisanat_quotas WHERE personnage_id = p_personnage_id;
  v_niveau_alchimie := COALESCE(v_q.niveau_alchimie, 0);

  IF v_niveau_alchimie < 1 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint','message','Compétence Alchimie requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- GARDE-FOU : palier débloqué (niveau_requis <= niveau_alchimie)
  IF v_niveau_requis > v_niveau_alchimie THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint',
        'message', format('Palier de recette non débloqué (niveau Alchimie %s requis)', v_niveau_requis),
        'champ','niveau_requis')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_quota_palier := CASE v_niveau_requis
                      WHEN 1 THEN COALESCE(v_q.q1, 0)
                      WHEN 2 THEN COALESCE(v_q.q2, 0)
                      WHEN 3 THEN COALESCE(v_q.q3, 0)
                      ELSE 0
                    END;

  -- Coût prévu : la nouvelle ligne arrive en dernier dans son palier
  SELECT count(*)::integer INTO v_count_palier
    FROM personnage_recettes pr JOIN recettes_alchimie ra ON ra.id = pr.recette_id
   WHERE pr.personnage_id = p_personnage_id AND ra.niveau_requis = v_niveau_requis;
  v_cout_prevu := CASE WHEN v_count_palier < v_quota_palier THEN 0 ELSE COALESCE(v_cout_xp, 0) END;

  IF v_cout_prevu > 0 AND (v_perso.xp_total - v_perso.xp_depense) < v_cout_prevu THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- INSERT brut (le réconciliateur fixe est_gratuit/xp_depense et écrit le ledger)
  BEGIN
    INSERT INTO personnage_recettes (personnage_id, recette_id, xp_depense, est_gratuit)
    VALUES (p_personnage_id, p_recette_id, 0, false)
    RETURNING id INTO v_new_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  PERFORM public.reconcilier_recettes(p_personnage_id);

  SELECT * INTO v_ligne FROM personnage_recettes WHERE id = v_new_id;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;

  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('id', v_new_id, 'est_gratuit', v_ligne.est_gratuit,
      'xp_depense_achat', v_ligne.xp_depense,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;

-- ============================================================
-- 4. RPC MINCES — ACHETER ASSEMBLAGE
-- ============================================================
CREATE OR REPLACE FUNCTION public.acheter_assemblage(p_personnage_id uuid, p_assemblage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid          uuid := auth.uid();
  v_perso        personnages%ROWTYPE;
  v_niveau_runes integer;
  v_quota_total  integer;
  v_cout_xp      integer;
  v_count        integer;
  v_cout_prevu   integer;
  v_new_id       uuid;
  v_ligne        personnage_assemblages%ROWTYPE;
  v_xp_total     integer;
  v_xp_depense   integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT cout_xp INTO v_cout_xp FROM assemblages_runes WHERE id = p_assemblage_id;
  IF v_cout_xp IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','assemblage_introuvable','message','Assemblage introuvable ou sans coût défini')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT niveau_runes, quota_assemblages_total INTO v_niveau_runes, v_quota_total
    FROM vue_artisanat_quotas WHERE personnage_id = p_personnage_id;
  IF COALESCE(v_niveau_runes, 0) < 1 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint','message','Compétence Assemblage de Runes requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Coût prévu : la nouvelle ligne arrive en dernier dans le seau
  SELECT count(*)::integer INTO v_count
    FROM personnage_assemblages WHERE personnage_id = p_personnage_id;
  v_cout_prevu := CASE WHEN v_count < COALESCE(v_quota_total, 0) THEN 0 ELSE COALESCE(v_cout_xp, 0) END;

  IF v_cout_prevu > 0 AND (v_perso.xp_total - v_perso.xp_depense) < v_cout_prevu THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  BEGIN
    INSERT INTO personnage_assemblages (personnage_id, assemblage_id, xp_depense, est_gratuit)
    VALUES (p_personnage_id, p_assemblage_id, 0, false)
    RETURNING id INTO v_new_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  PERFORM public.reconcilier_assemblages(p_personnage_id);

  SELECT * INTO v_ligne FROM personnage_assemblages WHERE id = v_new_id;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;

  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('id', v_new_id, 'est_gratuit', v_ligne.est_gratuit,
      'xp_depense_achat', v_ligne.xp_depense,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;

-- ============================================================
-- 5. RPC MINCES — DÉSACHETER RECETTE
-- ============================================================
CREATE OR REPLACE FUNCTION public.desacheter_recette(p_personnage_recette_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid              uuid := auth.uid();
  v_perso            personnages%ROWTYPE;
  v_pr               personnage_recettes%ROWTYPE;
  v_xp_total_apres   integer;
  v_xp_depense_apres integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_pr FROM personnage_recettes WHERE id = p_personnage_recette_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cette recette n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_pr.personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.personnage_est_modifiable(v_pr.personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  DELETE FROM personnage_recettes WHERE id = p_personnage_recette_id;

  -- Compense la ligne supprimée (invisible au réconciliateur après DELETE)
  IF COALESCE(v_pr.xp_depense, 0) > 0 THEN
    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, recette_id, acteur_id)
    VALUES (v_pr.personnage_id, 'remboursement', v_pr.xp_depense,
      'Remboursement recette d''alchimie (' || v_pr.xp_depense || ' XP)', v_pr.recette_id, v_uid);
  END IF;

  -- Auto-soin : promeut une éventuelle ligne payante du même palier
  PERFORM public.reconcilier_recettes(v_pr.personnage_id);

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
    FROM personnages WHERE id = v_pr.personnage_id;

  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_recette_id', p_personnage_recette_id,
      'recette_id', v_pr.recette_id,
      'etait_gratuit', v_pr.est_gratuit,
      'xp_rembourse', CASE WHEN v_pr.est_gratuit THEN 0 ELSE v_pr.xp_depense END,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres));
END;
$function$;

-- ============================================================
-- 6. RPC MINCES — DÉSACHETER ASSEMBLAGE
-- ============================================================
CREATE OR REPLACE FUNCTION public.desacheter_assemblage(p_personnage_assemblage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid              uuid := auth.uid();
  v_perso            personnages%ROWTYPE;
  v_pa               personnage_assemblages%ROWTYPE;
  v_xp_total_apres   integer;
  v_xp_depense_apres integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_pa FROM personnage_assemblages WHERE id = p_personnage_assemblage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cet assemblage n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_pa.personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.personnage_est_modifiable(v_pa.personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  DELETE FROM personnage_assemblages WHERE id = p_personnage_assemblage_id;

  IF COALESCE(v_pa.xp_depense, 0) > 0 THEN
    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, assemblage_id, acteur_id)
    VALUES (v_pa.personnage_id, 'remboursement', v_pa.xp_depense,
      'Remboursement assemblage de runes (' || v_pa.xp_depense || ' XP)', v_pa.assemblage_id, v_uid);
  END IF;

  PERFORM public.reconcilier_assemblages(v_pa.personnage_id);

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
    FROM personnages WHERE id = v_pa.personnage_id;

  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_assemblage_id', p_personnage_assemblage_id,
      'assemblage_id', v_pa.assemblage_id,
      'etait_gratuit', v_pa.est_gratuit,
      'xp_rembourse', CASE WHEN v_pa.est_gratuit THEN 0 ELSE v_pa.xp_depense END,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres));
END;
$function$;

-- ============================================================
-- 7. BACKFILL — réconcilie rétroactivement tous les persos avec artisanat
--    (corrige les exploits existants ; NO-OP sur les persos déjà corrects)
-- ============================================================
DO $backfill$
DECLARE
  p record;
BEGIN
  FOR p IN SELECT DISTINCT personnage_id FROM personnage_recettes LOOP
    PERFORM public.reconcilier_recettes(p.personnage_id);
  END LOOP;
  FOR p IN SELECT DISTINCT personnage_id FROM personnage_assemblages LOOP
    PERFORM public.reconcilier_assemblages(p.personnage_id);
  END LOOP;
END
$backfill$;
