-- Migration : RPCs desacheter_recette et desacheter_assemblage
-- C2 Phase 1 — Uniformisation étapes 8 et 9 (bidirectionnel)
-- Modèle : desacheter_competence (avec même pattern INSERT historique_xp 'remboursement' positif)
-- Note : bug cosmétique connu de recalculer_xp_personnage (gonfle xp_total) — voir dette technique

CREATE OR REPLACE FUNCTION public.desacheter_recette(p_personnage_recette_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_pr personnage_recettes%ROWTYPE;
  v_xp_total_apres integer;
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

  IF NOT v_pr.est_gratuit AND v_pr.xp_depense > 0 THEN
    UPDATE personnages
    SET xp_depense = xp_depense - v_pr.xp_depense,
        date_modification = now(),
        updated_at = now()
    WHERE id = v_pr.personnage_id;

    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, recette_id, acteur_id)
    VALUES (v_pr.personnage_id, 'remboursement', v_pr.xp_depense,
      'Remboursement recette d''alchimie (' || v_pr.xp_depense || ' XP)', v_pr.recette_id, v_uid);
  END IF;

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
  FROM personnages WHERE id = v_pr.personnage_id;

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
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

CREATE OR REPLACE FUNCTION public.desacheter_assemblage(p_personnage_assemblage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_pa personnage_assemblages%ROWTYPE;
  v_xp_total_apres integer;
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

  IF NOT v_pa.est_gratuit AND v_pa.xp_depense > 0 THEN
    UPDATE personnages
    SET xp_depense = xp_depense - v_pa.xp_depense,
        date_modification = now(),
        updated_at = now()
    WHERE id = v_pa.personnage_id;

    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, assemblage_id, acteur_id)
    VALUES (v_pa.personnage_id, 'remboursement', v_pa.xp_depense,
      'Remboursement assemblage de runes (' || v_pa.xp_depense || ' XP)', v_pa.assemblage_id, v_uid);
  END IF;

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
  FROM personnages WHERE id = v_pa.personnage_id;

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
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

GRANT EXECUTE ON FUNCTION public.desacheter_recette(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desacheter_assemblage(uuid) TO authenticated;
