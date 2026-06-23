-- Aperçu du coût réduit (rabais Acquisition de Cercle/Domaine) AVANT achat.
-- Miroir EXACT du bloc rabais d'acheter_competence : -1 XP par sort/prière du
-- cercle/domaine choisi déjà possédé (statut achete|cree) sous le palier
-- débloqué (<=5 niv2, <=10 niv3), plancher 0. Lecture seule (STABLE).
CREATE OR REPLACE FUNCTION public.apercu_rabais_acquisition(
  p_personnage_id uuid,
  p_competence_id uuid,
  p_niveau integer,
  p_choix_achat text
) RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_joueur_id uuid;
  v_niveaux jsonb;
  v_type_choix text;
  v_cout_base integer;
  v_seuil integer;
  v_nb integer := 0;
  v_cout_final integer;
BEGIN
  SELECT joueur_id INTO v_joueur_id FROM personnages WHERE id = p_personnage_id;
  IF v_joueur_id IS NULL OR NOT public.peut_editer_personnage(v_joueur_id) THEN
    RETURN jsonb_build_object('cout_base', 0, 'rabais', 0, 'cout_final', 0, 'nb', 0);
  END IF;

  SELECT niveaux, type_choix INTO v_niveaux, v_type_choix FROM competences WHERE id = p_competence_id;
  v_cout_base := COALESCE((v_niveaux->(p_niveau - 1)->>'cout_xp')::integer, 0);
  v_cout_final := v_cout_base;

  IF p_niveau IN (2,3) AND p_choix_achat IS NOT NULL AND v_type_choix IN ('cercle','domaine') THEN
    v_seuil := CASE WHEN p_niveau = 2 THEN 5 ELSE 10 END;
    IF v_type_choix = 'cercle' THEN
      SELECT COUNT(*) INTO v_nb
        FROM personnage_sorts ps JOIN sorts s ON s.id = ps.sort_id
        WHERE ps.personnage_id = p_personnage_id AND s.cercle = p_choix_achat
          AND s.niveau <= v_seuil AND ps.statut IN ('achete','cree');
    ELSE
      SELECT COUNT(*) INTO v_nb
        FROM personnage_prieres pp JOIN prieres pr ON pr.id = pp.priere_id
        WHERE pp.personnage_id = p_personnage_id AND pr.domaine = p_choix_achat
          AND pr.niveau <= v_seuil AND pp.statut IN ('achete','cree');
    END IF;
    v_cout_final := GREATEST(v_cout_base - v_nb, 0);
  END IF;

  RETURN jsonb_build_object(
    'cout_base', v_cout_base,
    'rabais', v_cout_base - v_cout_final,
    'cout_final', v_cout_final,
    'nb', v_nb
  );
END;
$function$;
