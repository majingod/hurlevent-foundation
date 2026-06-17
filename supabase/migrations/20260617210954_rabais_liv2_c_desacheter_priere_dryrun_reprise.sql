-- RABAIS liv 2 — migration C
-- desacheter_priere : + paramètre p_dry_run, + reprise du rabais Acquisition de Domaine.
-- Miroir de desacheter_sort. DROP+recreate. Aucun appelant interne (vérifié s219).

DROP FUNCTION IF EXISTS public.desacheter_priere(uuid);

CREATE OR REPLACE FUNCTION public.desacheter_priere(p_personnage_priere_id uuid, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_campagne boolean := false;
  v_photo jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_pp personnage_prieres%ROWTYPE;
  v_xp_total_apres integer;
  v_xp_depense_apres integer;
  v_nom text;
  v_domaine text;
  v_reprises jsonb := '[]'::jsonb;
  v_appliquer jsonb := '[]'::jsonb;
  v_reprise_totale integer := 0;
  v_net integer;
  v_xp_restant_avant integer;
  v_xp_restant_apres integer;
  v_bloque boolean := false;
  v_msg_action text;
  r record;
  v_idx integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_pp FROM personnage_prieres WHERE id = p_personnage_priere_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cette prière n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_pp.personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_blocage := public.gate_edition_personnage(v_pp.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN
    IF (public.etat_edition_personnage(v_pp.personnage_id)->>'etat') = 'campagne' THEN
      v_campagne := true;
    ELSE
      RETURN v_blocage;
    END IF;
  END IF;

  IF v_campagne THEN
    v_photo := public.derniere_photo_compo(v_pp.personnage_id);
    IF v_photo IS NULL OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_photo->'prieres','[]'::jsonb)) e
      WHERE CASE
        WHEN e.value ? 'instance_id'
          THEN (e.value->>'instance_id')::uuid = p_personnage_priere_id
        ELSE (e.value->>'id')::uuid = v_pp.priere_id
      END
    ) THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','acquis_intouchable','message','Cette prière fait partie des acquis du personnage (dernière présence confirmée) — elle ne peut pas être annulée en campagne.')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;

  -- ===== Reprise du rabais : CALCUL (avant toute mutation) =====
  v_nom := (SELECT nom FROM prieres WHERE id = v_pp.priere_id);
  v_domaine := (SELECT domaine FROM prieres WHERE id = v_pp.priere_id);

  FOR r IN
    SELECT pc.id AS pc_id, pc.niveau_acquis, pc.choix_achat, c.nom AS comp_nom,
           COALESCE((c.niveaux->(pc.niveau_acquis-1)->>'cout_xp')::int,0) AS base,
           (SELECT count(*) FROM jsonb_array_elements(pc.rabais_items) it
              WHERE it->>'type' = 'priere'
                AND EXISTS (SELECT 1 FROM personnage_prieres pp2
                            WHERE pp2.id = (it->>'id')::uuid
                              AND pp2.personnage_id = v_pp.personnage_id)
           ) AS l_present
    FROM personnage_competences pc
    JOIN competences c ON c.id = pc.competence_id
    WHERE pc.personnage_id = v_pp.personnage_id
      AND pc.rabais_items @> jsonb_build_array(jsonb_build_object('type','priere','id',p_personnage_priere_id))
  LOOP
    IF r.l_present <= r.base THEN
      v_reprise_totale := v_reprise_totale + 1;
      v_reprises := v_reprises || jsonb_build_object(
        'competence', r.comp_nom, 'niveau', r.niveau_acquis, 'choix', r.choix_achat, 'montant', 1);
      v_appliquer := v_appliquer || jsonb_build_object(
        'pc_id', r.pc_id, 'comp', r.comp_nom, 'niveau', r.niveau_acquis, 'choix', r.choix_achat);
    END IF;
  END LOOP;

  v_xp_restant_avant := v_perso.xp_total - v_perso.xp_depense;
  v_net := v_pp.xp_depense - v_reprise_totale;
  v_xp_restant_apres := v_xp_restant_avant + v_net;
  v_bloque := (v_xp_restant_apres < 0);

  -- ===== GARDE ROUGE (dry-run ET apply) =====
  IF v_bloque THEN
    v_msg_action := 'Supprimer cette prière te ferait passer en XP négatif (il manque ' || (-v_xp_restant_apres) ||
                    ' XP). Retire d''abord une Acquisition de Domaine de niveau supérieur pour le domaine « ' ||
                    COALESCE(v_domaine,'?') || ' » — cela te rendra des XP — puis cette prière.';
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','reprise_rouge','message', v_msg_action)),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('dry_run', p_dry_run, 'type','priere','nom', v_nom, 'domaine', v_domaine,
        'xp_rembourse', v_pp.xp_depense, 'reprises', v_reprises, 'reprise_totale', v_reprise_totale,
        'net', v_net, 'bloque', true, 'message_action', v_msg_action,
        'xp_restant_avant', v_xp_restant_avant, 'xp_restant_apres', v_xp_restant_apres));
  END IF;

  -- ===== DRY-RUN : aucune mutation =====
  IF p_dry_run THEN
    RETURN jsonb_build_object('succes', true, 'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
      'donnees', jsonb_build_object('dry_run', true, 'type','priere','nom', v_nom, 'domaine', v_domaine,
        'xp_rembourse', v_pp.xp_depense, 'reprises', v_reprises, 'reprise_totale', v_reprise_totale,
        'net', v_net, 'bloque', false,
        'xp_restant_avant', v_xp_restant_avant, 'xp_restant_apres', v_xp_restant_apres));
  END IF;

  -- ===== APPLY =====
  DELETE FROM personnage_prieres WHERE id = p_personnage_priere_id;

  IF v_pp.xp_depense > 0 THEN
    UPDATE personnages SET date_modification = now(), updated_at = now() WHERE id = v_pp.personnage_id;
    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, priere_id, acteur_id)
    VALUES (v_pp.personnage_id, 'remboursement', v_pp.xp_depense,
      'Remboursement prière (' || v_pp.xp_depense || ' XP)', v_pp.priere_id, v_uid);
  END IF;

  FOR r IN SELECT value AS item FROM jsonb_array_elements(v_appliquer)
  LOOP
    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, competence_id, acteur_id)
    SELECT v_pp.personnage_id, 'depense_competence', -1,
      'Reprise rabais ' || (r.item->>'comp') || ' niveau ' || (r.item->>'niveau') || ' (domaine ' || (r.item->>'choix') || ')',
      pc.competence_id, v_uid
    FROM personnage_competences pc WHERE pc.id = (r.item->>'pc_id')::uuid;

    SELECT (t.ord - 1) INTO v_idx
    FROM personnage_competences pc
    CROSS JOIN LATERAL jsonb_array_elements(pc.rabais_items) WITH ORDINALITY AS t(elem, ord)
    WHERE pc.id = (r.item->>'pc_id')::uuid
      AND t.elem->>'type' = 'priere' AND (t.elem->>'id')::uuid = p_personnage_priere_id
    ORDER BY t.ord LIMIT 1;

    IF v_idx IS NOT NULL THEN
      UPDATE personnage_competences
      SET rabais_items = rabais_items - v_idx
      WHERE id = (r.item->>'pc_id')::uuid;
    END IF;
  END LOOP;

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
  FROM personnages WHERE id = v_pp.personnage_id;

  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'desacheter_priere', jsonb_build_object('personnage_priere_id', p_personnage_priere_id, 'nom', v_nom, 'niveau', v_pp.niveau_priere, 'xp_rembourse', v_pp.xp_depense, 'reprise_totale', v_reprise_totale));
  END IF;

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_priere_id', p_personnage_priere_id,
      'priere_id', v_pp.priere_id,
      'xp_rembourse', v_pp.xp_depense,
      'reprise_totale', v_reprise_totale,
      'reprises', v_reprises,
      'net', v_net,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres));
END;
$function$;
