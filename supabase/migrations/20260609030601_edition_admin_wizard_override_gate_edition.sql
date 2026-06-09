CREATE OR REPLACE FUNCTION public.gate_edition_personnage(p_personnage_id uuid, p_mode text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_etat jsonb; v_autorise boolean;
BEGIN
  v_etat := public.etat_edition_personnage(p_personnage_id);
  IF (v_etat->>'etat') IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message', v_etat->>'raison')),
      'avertissements', jsonb_build_array(), 'donnees', NULL);
  END IF;
  -- ÉDITION-ADMIN-WIZARD : override d'état pour l'admin (audité au niveau des RPC d'achat).
  IF public.est_admin() THEN RETURN NULL; END IF;
  v_autorise := CASE p_mode
    WHEN 'ajout'   THEN (v_etat->>'peut_ajouter')::boolean
    WHEN 'complet' THEN (v_etat->>'peut_tout_editer')::boolean
    ELSE false END;
  IF v_autorise THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('succes', false,
    'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message', v_etat->>'raison')),
    'avertissements', jsonb_build_array(), 'donnees', NULL);
END;
$function$;
