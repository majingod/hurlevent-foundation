-- P1-c MODE-VISITEUR : gates pures ARTISANAT.
-- Extraction verbatim des validations inline de acheter_piege / acheter_recette / acheter_assemblage.
-- Additif, lecture seule, aucune RPC existante modifiée.
-- NB parité stricte : comme les RPC inline, ces gates NE vérifient PAS les doublons
-- recettes/assemblages (le serveur s'appuie sur unique_violation à l'INSERT).
-- Dette post-GN : refactorer les acheter_* pour APPELER ces gates (source unique).

CREATE OR REPLACE FUNCTION public.peut_acheter_piege(p_personnage_id uuid, p_piege_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $gate_piege$
DECLARE
  v_perso personnages%ROWTYPE; v_piege pieges%ROWTYPE;
  v_niveau_pieges integer; v_quota_total integer; v_nb_gratuits integer;
  v_est_gratuit boolean; v_cout_xp integer;
BEGIN
  SELECT * INTO v_perso FROM personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'personnage_introuvable', 'raison', 'Personnage introuvable');
  END IF;
  SELECT * INTO v_piege FROM pieges WHERE id = p_piege_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'piege_introuvable', 'raison', 'Piège introuvable');
  END IF;
  IF v_piege.niveau < 1 OR v_piege.niveau > 3 THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'niveau_invalide_acquisition', 'raison', 'Niveau de piège invalide');
  END IF;
  SELECT niveau_pieges INTO v_niveau_pieges FROM vue_artisanat_quotas WHERE personnage_id = p_personnage_id;
  IF v_niveau_pieges IS NULL OR v_niveau_pieges < 1 THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'niveau_requis_non_atteint', 'raison', 'Compétence « Création et désarmement de piège » requise');
  END IF;
  IF EXISTS (SELECT 1 FROM personnage_pieges WHERE personnage_id = p_personnage_id AND piege_nom = v_piege.nom AND niveau_acquis = v_piege.niveau) THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'piege_deja_possede', 'raison', 'Ce palier de piège est déjà acquis');
  END IF;
  IF v_piege.niveau > 1 AND NOT EXISTS (SELECT 1 FROM personnage_pieges WHERE personnage_id = p_personnage_id AND piege_nom = v_piege.nom AND niveau_acquis = v_piege.niveau - 1) THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'palier_precedent_manquant', 'raison', 'Le palier précédent doit être acquis avant celui-ci');
  END IF;
  SELECT CASE v_piege.niveau WHEN 1 THEN quota_pieges_niv1_total WHEN 2 THEN quota_pieges_amelioration_niv2_total ELSE quota_pieges_amelioration_niv3_total END
    INTO v_quota_total FROM vue_artisanat_quotas WHERE personnage_id = p_personnage_id;
  SELECT COUNT(*)::integer INTO v_nb_gratuits FROM personnage_pieges WHERE personnage_id = p_personnage_id AND niveau_acquis = v_piege.niveau AND est_gratuit = true;
  IF v_nb_gratuits < v_quota_total THEN
    v_est_gratuit := true; v_cout_xp := 0;
  ELSE
    v_est_gratuit := false; v_cout_xp := v_piege.cout_xp;
    IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
      RETURN jsonb_build_object('peut_acheter', false, 'code', 'xp_insuffisant', 'raison', 'XP insuffisant');
    END IF;
  END IF;
  RETURN jsonb_build_object('peut_acheter', true, 'raison', 'OK', 'cout_xp', v_cout_xp, 'est_gratuit', v_est_gratuit);
END;
$gate_piege$;

CREATE OR REPLACE FUNCTION public.peut_acheter_recette(p_personnage_id uuid, p_recette_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $gate_recette$
DECLARE
  v_perso personnages%ROWTYPE; v_q record;
  v_niveau_alchimie integer; v_niveau_requis integer; v_cout_xp integer;
  v_quota_palier integer; v_count_palier integer; v_cout_prevu integer;
BEGIN
  SELECT * INTO v_perso FROM personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'personnage_introuvable', 'raison', 'Personnage introuvable');
  END IF;
  SELECT niveau_requis, cout_xp INTO v_niveau_requis, v_cout_xp FROM recettes_alchimie WHERE id = p_recette_id;
  IF v_niveau_requis IS NULL THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'recette_introuvable', 'raison', 'Recette introuvable ou sans coût défini');
  END IF;
  SELECT niveau_alchimie, quota_alchimie_mineure_total AS q1, quota_alchimie_intermediaire_total AS q2, quota_alchimie_majeure_total AS q3
    INTO v_q FROM vue_artisanat_quotas WHERE personnage_id = p_personnage_id;
  v_niveau_alchimie := COALESCE(v_q.niveau_alchimie, 0);
  IF v_niveau_alchimie < 1 THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'niveau_requis_non_atteint', 'raison', 'Compétence Alchimie requise');
  END IF;
  IF v_niveau_requis > v_niveau_alchimie THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'niveau_requis_non_atteint',
      'raison', format('Palier de recette non débloqué (niveau Alchimie %s requis)', v_niveau_requis), 'champ', 'niveau_requis');
  END IF;
  v_quota_palier := CASE v_niveau_requis WHEN 1 THEN COALESCE(v_q.q1,0) WHEN 2 THEN COALESCE(v_q.q2,0) WHEN 3 THEN COALESCE(v_q.q3,0) ELSE 0 END;
  SELECT count(*)::integer INTO v_count_palier
    FROM personnage_recettes pr JOIN recettes_alchimie ra ON ra.id = pr.recette_id
   WHERE pr.personnage_id = p_personnage_id AND ra.niveau_requis = v_niveau_requis;
  v_cout_prevu := CASE WHEN v_count_palier < v_quota_palier THEN 0 ELSE COALESCE(v_cout_xp, 0) END;
  IF v_cout_prevu > 0 AND (v_perso.xp_total - v_perso.xp_depense) < v_cout_prevu THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'xp_insuffisant', 'raison', 'XP insuffisant');
  END IF;
  RETURN jsonb_build_object('peut_acheter', true, 'raison', 'OK', 'cout_xp', v_cout_prevu, 'est_gratuit', v_cout_prevu = 0);
END;
$gate_recette$;

CREATE OR REPLACE FUNCTION public.peut_acheter_assemblage(p_personnage_id uuid, p_assemblage_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $gate_assemblage$
DECLARE
  v_perso personnages%ROWTYPE;
  v_niveau_runes integer; v_quota_total integer; v_cout_xp integer;
  v_count integer; v_cout_prevu integer;
BEGIN
  SELECT * INTO v_perso FROM personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'personnage_introuvable', 'raison', 'Personnage introuvable');
  END IF;
  SELECT cout_xp INTO v_cout_xp FROM assemblages_runes WHERE id = p_assemblage_id;
  IF v_cout_xp IS NULL THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'assemblage_introuvable', 'raison', 'Assemblage introuvable ou sans coût défini');
  END IF;
  SELECT niveau_runes, quota_assemblages_total INTO v_niveau_runes, v_quota_total
    FROM vue_artisanat_quotas WHERE personnage_id = p_personnage_id;
  IF COALESCE(v_niveau_runes, 0) < 1 THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'niveau_requis_non_atteint', 'raison', 'Compétence Assemblage de Runes requise');
  END IF;
  SELECT count(*)::integer INTO v_count FROM personnage_assemblages WHERE personnage_id = p_personnage_id;
  v_cout_prevu := CASE WHEN v_count < COALESCE(v_quota_total, 0) THEN 0 ELSE COALESCE(v_cout_xp, 0) END;
  IF v_cout_prevu > 0 AND (v_perso.xp_total - v_perso.xp_depense) < v_cout_prevu THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'xp_insuffisant', 'raison', 'XP insuffisant');
  END IF;
  RETURN jsonb_build_object('peut_acheter', true, 'raison', 'OK', 'cout_xp', v_cout_prevu, 'est_gratuit', v_cout_prevu = 0);
END;
$gate_assemblage$;
