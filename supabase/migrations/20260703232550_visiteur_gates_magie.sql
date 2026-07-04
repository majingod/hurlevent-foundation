-- P1-c MODE-VISITEUR : gates pures MAGIE.
-- Extraction verbatim des validations inline de acheter_sort / acheter_priere.
-- Additif, lecture seule, aucune RPC existante modifiée.
-- Convention verdict : patron peut_acheter_competence {peut_acheter, code?, raison, ...}.
-- Les gates n'incluent PAS auth/ownership/gel (ces contrôles restent dans acheter_*).
-- Dette post-GN : refactorer acheter_sort/acheter_priere pour APPELER ces gates (source unique).

CREATE OR REPLACE FUNCTION public.peut_acheter_sort(p_personnage_id uuid, p_sort_id uuid, p_niveau_sort integer, p_zone_choisie text, p_portee_choisie text, p_duree_choisie text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $gate_sort$
DECLARE
  v_perso personnages%ROWTYPE;
  v_cercle text; v_cout_xp_base numeric; v_cout_xp integer;
  v_niveau_max integer; v_formule_magique text;
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
  IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'xp_insuffisant', 'raison', 'XP insuffisant');
  END IF;
  RETURN jsonb_build_object('peut_acheter', true, 'raison', 'OK', 'cout_xp', v_cout_xp, 'formule_magique', v_formule_magique, 'niveau_max_cercle', v_niveau_max);
END;
$gate_sort$;

CREATE OR REPLACE FUNCTION public.peut_acheter_priere(p_personnage_id uuid, p_priere_id uuid, p_niveau_priere integer, p_zone_choisie text, p_portee_choisie text, p_duree_choisie text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $gate_priere$
DECLARE
  v_perso personnages%ROWTYPE;
  v_priere prieres%ROWTYPE;
  v_cout_xp integer; v_niveau_max integer; v_duree_inc integer;
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
  IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'xp_insuffisant', 'raison', 'XP insuffisant');
  END IF;
  v_duree_inc := public.calculer_duree_incantation_priere(p_portee_choisie, p_zone_choisie, p_duree_choisie, p_niveau_priere);
  RETURN jsonb_build_object('peut_acheter', true, 'raison', 'OK', 'cout_xp', v_cout_xp, 'duree_incantation_calculee', v_duree_inc, 'niveau_max_domaine', v_niveau_max);
END;
$gate_priere$;
