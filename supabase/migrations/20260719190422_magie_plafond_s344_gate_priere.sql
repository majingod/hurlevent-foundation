CREATE OR REPLACE FUNCTION public.peut_acheter_priere(p_personnage_id uuid, p_priere_id uuid, p_niveau_priere integer, p_zone_choisie text, p_portee_choisie text, p_duree_choisie text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $gate_priere$
DECLARE
  v_perso personnages%ROWTYPE;
  v_priere prieres%ROWTYPE;
  v_cout_xp integer; v_niveau_max integer; v_duree_inc integer;
  v_refus_plafond text;
BEGIN
  SELECT * INTO v_perso FROM personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'personnage_introuvable', 'raison', 'Personnage introuvable');
  END IF;
  SELECT * INTO v_priere FROM prieres WHERE id = p_priere_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'priere_introuvable', 'raison', 'Prière introuvable');
  END IF;
  v_cout_xp := public.calculer_cout_xp_magie(p_zone_choisie, p_portee_choisie, p_duree_choisie, p_niveau_priere, v_priere.cout_xp_base);
  SELECT niveau_max_prieres INTO v_niveau_max FROM vue_domaines_disponibles
   WHERE personnage_id = p_personnage_id AND domaine = v_priere.domaine;
  IF v_niveau_max IS NULL OR p_niveau_priere > v_niveau_max THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'niveau_invalide', 'raison', 'Niveau de prière supérieur au maximum autorisé pour ce domaine');
  END IF;
  -- [MAGIE-PLAFOND] Le manuel plafonne le prix d'une priere a 10 + 10 x niveau du personnage.
  v_refus_plafond := public.refus_plafond_magie('priere', v_perso.niveau, v_cout_xp);
  IF v_refus_plafond IS NOT NULL THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'plafond_depasse', 'raison', v_refus_plafond);
  END IF;

  IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'xp_insuffisant', 'raison', 'XP insuffisant');
  END IF;
  v_duree_inc := public.calculer_duree_incantation_priere(p_portee_choisie, p_zone_choisie, p_duree_choisie, p_niveau_priere);
  RETURN jsonb_build_object('peut_acheter', true, 'raison', 'OK', 'cout_xp', v_cout_xp, 'duree_incantation_calculee', v_duree_inc, 'niveau_max_domaine', v_niveau_max);
END;
$gate_priere$;

REVOKE EXECUTE ON FUNCTION public.peut_acheter_priere(uuid, uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.peut_acheter_priere(uuid, uuid, integer, text, text, text) TO authenticated, service_role;
