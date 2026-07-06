CREATE OR REPLACE FUNCTION public.verifier_prerequis_competences(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resultat            jsonb := '{}'::jsonb;
  v_competence          RECORD;
  v_niveau              integer;
  v_niveau_max_ok       integer;
  v_raisons             jsonb;
  v_raison_niv          text;
  v_manquants           text[];
  v_ps_max              integer;
  v_a_creat1            boolean;
  v_a_creat2            boolean;
  v_a_ps                boolean;
  v_labels              jsonb;
  v_items_niv           jsonb;
  v_item                jsonb;
  v_prereqs_par_niveau  jsonb;
  v_prereqs_niv         jsonb;
  v_statut              text;
  v_label               text;
  v_niveau_actuel_pre   integer;
  v_competence_id_pre   uuid;
  v_classe_perso        text;
  v_classe_normalisee   text;
BEGIN
  SELECT COALESCE(p.ps_max, 0) INTO v_ps_max FROM personnages p WHERE p.id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('erreur', 'Personnage introuvable');
  END IF;

  SELECT cl.nom INTO v_classe_perso
    FROM personnages p
    LEFT JOIN classes cl ON cl.id = p.classe_id
   WHERE p.id = p_personnage_id;

  v_classe_normalisee := CASE v_classe_perso
    WHEN 'Guerrier' THEN 'guerrier'
    WHEN 'Voleur'   THEN 'voleur'
    WHEN 'Mage'     THEN 'mage'
    WHEN 'Prêtre'   THEN 'pretre'
    ELSE NULL END;

  SELECT a_connaissance_creatures_1, a_connaissance_creatures_2, a_premiers_soins
    INTO v_a_creat1, v_a_creat2, v_a_ps
    FROM vue_personnage_etat
   WHERE personnage_id = p_personnage_id;

  FOR v_competence IN
    SELECT id, nom, classes_requises
      FROM competences
     WHERE est_actif = true
  LOOP
    v_niveau_max_ok      := 3;
    v_raisons            := '{}'::jsonb;
    v_prereqs_par_niveau := '{}'::jsonb;

    v_labels := assembler_prerequis_labels(v_competence.id);

    FOR v_niveau IN 1..3 LOOP
      v_raison_niv  := NULL;
      v_prereqs_niv := '[]'::jsonb;
      v_manquants   := ARRAY[]::text[];

      v_items_niv := v_labels -> v_niveau::text;

      IF v_items_niv IS NOT NULL AND jsonb_array_length(v_items_niv) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_niv) LOOP

          -- Classe : afficher la pastille (vert/rouge) SANS l'ajouter aux manquants.
          -- Le blocage de classe reste geré par le chemin "Réservée/classeBloque"
          -- du wizard + par peut_acheter_competence (on ne touche pas niveau_max_achetable).
          IF (v_item->>'type') = 'classe' THEN
            v_statut := CASE
              WHEN v_classe_normalisee IS NOT NULL
               AND v_competence.classes_requises IS NOT NULL
               AND v_classe_normalisee = ANY (v_competence.classes_requises)
              THEN 'acquis' ELSE 'manquant' END;
            v_prereqs_niv := v_prereqs_niv || jsonb_build_object(
              'label', v_item->>'label', 'statut', v_statut, 'competence_id', NULL);
            CONTINUE;
          END IF;

          v_label := v_item->>'label';
          v_competence_id_pre := NULL;

          IF (v_item->>'type') = 'special' THEN
            v_statut := CASE (v_item->>'special_kind')
              WHEN 'depecage_creat1'    THEN CASE WHEN COALESCE(v_a_creat1, false) THEN 'acquis' ELSE 'manquant' END
              WHEN 'depecage_creat2'    THEN CASE WHEN COALESCE(v_a_creat2, false) THEN 'acquis' ELSE 'manquant' END
              WHEN 'depecage_ps'        THEN CASE WHEN COALESCE(v_a_ps, false)     THEN 'acquis' ELSE 'manquant' END
              WHEN 'dev_spirituel_20ps' THEN CASE WHEN v_ps_max >= 20             THEN 'acquis' ELSE 'manquant' END
              ELSE 'manquant'
            END;

          ELSE  -- type = 'competence'
            SELECT c.id INTO v_competence_id_pre
              FROM competences c
             WHERE c.nom = (v_item->>'competence_nom')
             LIMIT 1;

            SELECT COALESCE(max(pc.niveau_acquis), 0)
              INTO v_niveau_actuel_pre
              FROM personnage_competences pc
              JOIN competences c ON c.id = pc.competence_id
             WHERE pc.personnage_id = p_personnage_id
               AND c.nom = (v_item->>'competence_nom');

            v_statut := CASE
              WHEN v_niveau_actuel_pre >= (v_item->>'niveau_min')::integer THEN 'acquis'
              ELSE 'manquant'
            END;
          END IF;

          v_prereqs_niv := v_prereqs_niv || jsonb_build_object('label', v_label, 'statut', v_statut, 'competence_id', v_competence_id_pre);
          IF v_statut = 'manquant' THEN
            v_manquants := v_manquants || v_label;
          END IF;
        END LOOP;
      END IF;

      IF jsonb_array_length(v_prereqs_niv) > 0 THEN
        v_prereqs_par_niveau := v_prereqs_par_niveau || jsonb_build_object(v_niveau::text, v_prereqs_niv);
      END IF;

      IF array_length(v_manquants, 1) > 0 THEN
        v_raison_niv := format('Prérequis manquant(s) : %s', array_to_string(v_manquants, ', '));
      END IF;

      IF v_raison_niv IS NOT NULL THEN
        IF v_niveau_max_ok = 3 THEN
          v_niveau_max_ok := v_niveau - 1;
        END IF;
        v_raisons := v_raisons || jsonb_build_object(v_niveau::text, v_raison_niv);
      END IF;
    END LOOP;

    IF v_niveau_max_ok < 3 OR v_prereqs_par_niveau <> '{}'::jsonb THEN
      v_resultat := v_resultat || jsonb_build_object(
        v_competence.id::text,
        jsonb_build_object(
          'niveau_max_achetable', v_niveau_max_ok,
          'raisons_par_niveau',   v_raisons,
          'prereqs_par_niveau',   v_prereqs_par_niveau
        )
      );
    END IF;
  END LOOP;

  RETURN v_resultat;
END;
$function$;
