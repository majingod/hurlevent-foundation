CREATE OR REPLACE FUNCTION public.peut_acheter_sort(p_personnage_id uuid, p_sort_id uuid, p_niveau_sort integer, p_zone_choisie text, p_portee_choisie text, p_duree_choisie text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $gate_sort$
DECLARE
  v_perso personnages%ROWTYPE;
  v_cercle text; v_cout_xp_base numeric; v_cout_xp integer;
  v_niveau_max integer; v_formule_magique text;
  v_refus_plafond text;
BEGIN
  SELECT * INTO v_perso FROM personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'personnage_introuvable', 'raison', 'Personnage introuvable');
  END IF;
  SELECT cercle, cout_xp_base INTO v_cercle, v_cout_xp_base FROM sorts WHERE id = p_sort_id;
  IF v_cercle IS NULL THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'sort_introuvable', 'raison', 'Sort introuvable');
  END IF;
  v_cout_xp := public.calculer_cout_xp_magie(p_zone_choisie, p_portee_choisie, p_duree_choisie, p_niveau_sort, v_cout_xp_base);
  v_formule_magique := public.generer_formule_magique(v_cercle, p_zone_choisie, p_portee_choisie, p_duree_choisie, p_niveau_sort);
  SELECT niveau_max_sorts INTO v_niveau_max FROM vue_cercles_disponibles
   WHERE personnage_id = p_personnage_id AND cercle = v_cercle;
  IF v_niveau_max IS NULL OR p_niveau_sort > v_niveau_max THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'niveau_invalide', 'raison', 'Niveau de sort superieur au maximum autorise pour ce cercle');
  END IF;
  -- [MAGIE-PLAFOND] Le manuel plafonne le prix d'un sort a 10 + 10 x niveau du personnage.
  v_refus_plafond := public.refus_plafond_magie('sort', v_perso.niveau, v_cout_xp);
  IF v_refus_plafond IS NOT NULL THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'plafond_depasse', 'raison', v_refus_plafond);
  END IF;

  IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'xp_insuffisant', 'raison', 'XP insuffisant');
  END IF;
  RETURN jsonb_build_object('peut_acheter', true, 'raison', 'OK', 'cout_xp', v_cout_xp, 'formule_magique', v_formule_magique, 'niveau_max_cercle', v_niveau_max);
END;
$gate_sort$;

REVOKE EXECUTE ON FUNCTION public.peut_acheter_sort(uuid, uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.peut_acheter_sort(uuid, uuid, integer, text, text, text) TO authenticated, service_role;
