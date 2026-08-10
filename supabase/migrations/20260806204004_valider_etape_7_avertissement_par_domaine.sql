-- s379 · [CERCLES-SECS-VRAIS-JOUEURS] · decision 51 — volet PRIERES.
-- Jumeau de valider_etape_6 : avertissement PAR DOMAINE, calcule AVANT la
-- garde personnage_a_des_prieres (cause mesuree : un personnage, 1 domaine
-- ouvert, 0 priere, pas la competence « Acquisition de Priere »).

CREATE OR REPLACE FUNCTION public.valider_etape_7(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_perso public.personnages%ROWTYPE; v_priere RECORD; v_sec RECORD; v_niveau_max integer;
  v_erreurs jsonb := '[]'::jsonb; v_avertissements jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valide', false, 'ignoree', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb);
  END IF;

  FOR v_sec IN
    SELECT pc.choix_achat AS voie,
           sum(pc.xp_depense) AS xp,
           array_agg(DISTINCT pc.niveau_acquis ORDER BY pc.niveau_acquis) AS niveaux
    FROM public.personnage_competences pc
    JOIN public.competences c ON c.id = pc.competence_id
    WHERE pc.personnage_id = p_personnage_id
      AND c.nom = 'Acquisition de Domaine'
      AND pc.choix_achat IS NOT NULL
    GROUP BY pc.choix_achat
    HAVING sum(pc.xp_depense) > 0
       AND NOT EXISTS (
         SELECT 1 FROM public.personnage_prieres pp
         JOIN public.prieres pr ON pr.id = pp.priere_id
         WHERE pp.personnage_id = p_personnage_id
           AND pr.domaine = pc.choix_achat)
    ORDER BY pc.choix_achat
  LOOP
    v_avertissements := v_avertissements || jsonb_build_object(
      'code', 'info_domaine_sans_priere',
      'voie', v_sec.voie,
      'niveaux', to_jsonb(v_sec.niveaux),
      'xp', v_sec.xp,
      'message', format('Domaine %s (niv %s) : aucune prière achetée dans ce domaine — %s XP dorment.',
                        v_sec.voie, array_to_string(v_sec.niveaux, ', '), v_sec.xp));
  END LOOP;

  IF NOT public.personnage_a_des_prieres(p_personnage_id) THEN
    RETURN jsonb_build_object('valide', true, 'ignoree', true,
      'erreurs', '[]'::jsonb, 'avertissements', v_avertissements);
  END IF;

  FOR v_priere IN
    SELECT pp.priere_id, pp.niveau_priere, pr.domaine, pr.nom AS priere_nom
    FROM public.personnage_prieres pp JOIN public.prieres pr ON pr.id = pp.priere_id
    WHERE pp.personnage_id = p_personnage_id AND pp.statut = 'achete'
  LOOP
    SELECT niveau_max_prieres INTO v_niveau_max FROM public.vue_domaines_disponibles
    WHERE personnage_id = p_personnage_id AND domaine = v_priere.domaine;
    IF NOT FOUND THEN
      v_erreurs := v_erreurs || jsonb_build_object('code','priere_domaine_non_debloque',
        'message', format('La prière %s appartient au domaine %s, non débloqué', v_priere.priere_nom, v_priere.domaine),'champ','personnage_prieres');
    ELSIF v_priere.niveau_priere > v_niveau_max THEN
      v_erreurs := v_erreurs || jsonb_build_object('code','priere_niveau_trop_eleve',
        'message', format('La prière %s (niveau %s) dépasse le max %s du domaine %s', v_priere.priere_nom, v_priere.niveau_priere, v_niveau_max, v_priere.domaine),'champ','personnage_prieres');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('valide', jsonb_array_length(v_erreurs) = 0, 'ignoree', false,
    'erreurs', v_erreurs, 'avertissements', v_avertissements);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.valider_etape_7(uuid) TO PUBLIC, anon, authenticated, service_role;
