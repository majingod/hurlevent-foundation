-- Rabais Acquisition de Cercle/Domaine niv 2/3 (décision Fred s218).
-- Le coût est réduit de 1 XP par sort/prière du cercle/domaine choisi DÉJÀ possédé
-- dont le niveau min est sous le palier débloqué (≤5 pour niv 2, ≤10 pour niv 3),
-- plancher à 0. Les ids comptés sont mémorisés dans personnage_competences.rabais_items
-- (« étiquette ») pour la reprise du rabais au désachat ultérieur du sort/prière (livraison 2).
-- Les achats existants ont rabais_items = NULL (aucune étiquette = aucun rabais, plein tarif).

ALTER TABLE public.personnage_competences ADD COLUMN IF NOT EXISTS rabais_items jsonb;
COMMENT ON COLUMN public.personnage_competences.rabais_items IS
  'Étiquette rabais (Acquisition Cercle/Domaine niv 2/3) : liste des sorts/prières [{type,id}] déjà possédés ayant réduit le coût. NULL = aucun rabais (plein tarif).';

CREATE OR REPLACE FUNCTION public.acheter_competence(p_personnage_id uuid, p_competence_id uuid, p_niveau_desire integer, p_choix_achat text DEFAULT NULL::text, p_appris_via_maitre boolean DEFAULT false, p_nom_maitre text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_check jsonb; v_niveaux jsonb;
  v_cout_xp integer; v_xp_disponible integer;
  v_new_id uuid; v_xp_total integer; v_xp_depense integer; v_statut text;
  v_type_choix text; v_seuil integer; v_cout_base integer;
  v_rabais_n integer := 0; v_rabais_items jsonb := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_perso FROM personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_blocage := public.gate_edition_personnage(p_personnage_id, 'ajout');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
  v_check := peut_acheter_competence(p_personnage_id, p_competence_id, p_niveau_desire, p_choix_achat);
  IF NOT (v_check->>'peut_acheter')::boolean THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','achat_refuse','message', COALESCE(v_check->>'raison','Achat refusé'))), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT niveaux, type_choix INTO v_niveaux, v_type_choix FROM competences WHERE id = p_competence_id;
  IF v_niveaux IS NULL OR jsonb_array_length(v_niveaux) < p_niveau_desire THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de compétence invalide')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_cout_base := COALESCE((v_niveaux->(p_niveau_desire - 1)->>'cout_xp')::integer, 0);
  v_cout_xp := v_cout_base;
  IF p_niveau_desire IN (2,3) AND p_choix_achat IS NOT NULL AND v_type_choix IN ('cercle','domaine') THEN
    v_seuil := CASE WHEN p_niveau_desire = 2 THEN 5 ELSE 10 END;
    IF v_type_choix = 'cercle' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object('type','sort','id',ps.sort_id) ORDER BY ps.sort_id), '[]'::jsonb), COUNT(*)
        INTO v_rabais_items, v_rabais_n
        FROM personnage_sorts ps JOIN sorts s ON s.id = ps.sort_id
        WHERE ps.personnage_id = p_personnage_id AND s.cercle = p_choix_achat AND s.niveau <= v_seuil AND ps.statut IN ('achete','cree');
    ELSE
      SELECT COALESCE(jsonb_agg(jsonb_build_object('type','priere','id',pp.priere_id) ORDER BY pp.priere_id), '[]'::jsonb), COUNT(*)
        INTO v_rabais_items, v_rabais_n
        FROM personnage_prieres pp JOIN prieres pr ON pr.id = pp.priere_id
        WHERE pp.personnage_id = p_personnage_id AND pr.domaine = p_choix_achat AND pr.niveau <= v_seuil AND pp.statut IN ('achete','cree');
    END IF;
    v_cout_xp := GREATEST(v_cout_base - v_rabais_n, 0);
  END IF;
  v_xp_disponible := v_perso.xp_total - v_perso.xp_depense;
  IF v_xp_disponible < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_statut := CASE WHEN p_appris_via_maitre THEN 'en_attente' ELSE 'non_requis' END;
  BEGIN
    INSERT INTO personnage_competences (personnage_id, competence_id, niveau_acquis, appris_via_maitre, xp_depense, nom_maitre, statut_maitre, choix_achat, rabais_items)
    VALUES (p_personnage_id, p_competence_id, p_niveau_desire, p_appris_via_maitre, v_cout_xp, p_nom_maitre, v_statut, p_choix_achat, v_rabais_items)
    RETURNING id INTO v_new_id;
    UPDATE personnages SET date_modification = now(), updated_at = now() WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, competence_id, acteur_id)
      VALUES (p_personnage_id, 'depense_competence', -v_cout_xp, 'Achat compétence niveau ' || p_niveau_desire || ' (' || v_cout_xp || ' XP' || CASE WHEN v_rabais_n > 0 THEN ', rabais -' || v_rabais_n ELSE '' END || ')', p_competence_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'acheter_competence', jsonb_build_object('competence_id', p_competence_id, 'nom', (SELECT nom FROM competences WHERE id = p_competence_id), 'niveau', p_niveau_desire, 'cout_xp', v_cout_xp, 'cout_base', v_cout_base, 'rabais', v_rabais_n));
  END IF;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_competence_id', v_new_id, 'cout_base', v_cout_base, 'rabais', v_rabais_n, 'cout_xp', v_cout_xp, 'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;
