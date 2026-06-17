-- Aperçu GROUPÉ du rabais Acquisition de Cercle/Domaine : un seul appel renvoie
-- toutes les lignes (choix, niveau) où le perso a au moins 1 sort/prière éligible.
-- Miroir EXACT du bloc rabais d'acheter_competence (seuils 5/10, statut achete|cree,
-- plancher 0). Ne renvoie QUE les rabais réels (nb>0) ; le front retombe sur le prix
-- de base pour tout cercle/domaine absent. Lecture seule (STABLE).
CREATE OR REPLACE FUNCTION public.apercu_rabais_acquisition_competence(
  p_personnage_id uuid,
  p_competence_id uuid
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
  v_base2 integer;
  v_base3 integer;
  v_res jsonb;
BEGIN
  SELECT joueur_id INTO v_joueur_id FROM personnages WHERE id = p_personnage_id;
  IF v_joueur_id IS NULL OR NOT public.peut_editer_personnage(v_joueur_id) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT niveaux, type_choix INTO v_niveaux, v_type_choix FROM competences WHERE id = p_competence_id;
  IF v_type_choix NOT IN ('cercle','domaine') THEN
    RETURN '[]'::jsonb;
  END IF;

  v_base2 := COALESCE((v_niveaux->1->>'cout_xp')::integer, 0);
  v_base3 := COALESCE((v_niveaux->2->>'cout_xp')::integer, 0);

  IF v_type_choix = 'cercle' THEN
    SELECT COALESCE(jsonb_agg(r.row ORDER BY r.choix, r.niveau), '[]'::jsonb) INTO v_res
    FROM (
      SELECT s.cercle AS choix, lv.niveau AS niveau,
             jsonb_build_object(
               'choix', s.cercle,
               'niveau', lv.niveau,
               'cout_base', CASE WHEN lv.niveau = 2 THEN v_base2 ELSE v_base3 END,
               'nb', count(*),
               'cout_final', GREATEST((CASE WHEN lv.niveau = 2 THEN v_base2 ELSE v_base3 END) - count(*), 0),
               'rabais', (CASE WHEN lv.niveau = 2 THEN v_base2 ELSE v_base3 END)
                          - GREATEST((CASE WHEN lv.niveau = 2 THEN v_base2 ELSE v_base3 END) - count(*), 0)
             ) AS row
      FROM personnage_sorts ps
      JOIN sorts s ON s.id = ps.sort_id
      CROSS JOIN (VALUES (2,5),(3,10)) AS lv(niveau, seuil)
      WHERE ps.personnage_id = p_personnage_id
        AND ps.statut IN ('achete','cree')
        AND s.niveau <= lv.seuil
      GROUP BY s.cercle, lv.niveau
    ) r;
  ELSE
    SELECT COALESCE(jsonb_agg(r.row ORDER BY r.choix, r.niveau), '[]'::jsonb) INTO v_res
    FROM (
      SELECT pr.domaine AS choix, lv.niveau AS niveau,
             jsonb_build_object(
               'choix', pr.domaine,
               'niveau', lv.niveau,
               'cout_base', CASE WHEN lv.niveau = 2 THEN v_base2 ELSE v_base3 END,
               'nb', count(*),
               'cout_final', GREATEST((CASE WHEN lv.niveau = 2 THEN v_base2 ELSE v_base3 END) - count(*), 0),
               'rabais', (CASE WHEN lv.niveau = 2 THEN v_base2 ELSE v_base3 END)
                          - GREATEST((CASE WHEN lv.niveau = 2 THEN v_base2 ELSE v_base3 END) - count(*), 0)
             ) AS row
      FROM personnage_prieres pp
      JOIN prieres pr ON pr.id = pp.priere_id
      CROSS JOIN (VALUES (2,5),(3,10)) AS lv(niveau, seuil)
      WHERE pp.personnage_id = p_personnage_id
        AND pp.statut IN ('achete','cree')
        AND pr.niveau <= lv.seuil
      GROUP BY pr.domaine, lv.niveau
    ) r;
  END IF;

  RETURN v_res;
END;
$function$;
