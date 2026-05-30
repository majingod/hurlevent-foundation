-- =====================================================================
-- UNIFICATION PRÉREQUIS — Phase 3
-- 1) Réassembleur : libellé DSS neutre (« 20 PS via Développement Spirituel »)
--    => bénéficie aussi à l'encyclopédie (vue_competences_encyclopedie).
-- 2) verifier_prerequis_competences : délègue les LIBELLÉS au réassembleur
--    (source unique) et n'ajoute QUE le statut acquis/manquant par-dessus.
--    Contrat de sortie inchangé : {niveau_max_achetable, raisons_par_niveau,
--    prereqs_par_niveau[].label/.statut}. Le type 'classe' est filtré
--    (géré par BlocClasses côté wizard).
-- =====================================================================

-- 1) RÉASSEMBLEUR — libellé DSS neutre ----------------------------------
CREATE OR REPLACE FUNCTION public.assembler_prerequis_labels(p_competence_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nom            text;
  v_classes        text[];
  v_prereq_struct  jsonb;
  v_niveaux        jsonb;
  v_nb_niveaux     integer;
  v_classe_label   text;
  v_resultat       jsonb := '{}'::jsonb;
  v_niveau         integer;
  v_items          jsonb;
  v_prereq_niv     jsonb;
  v_prereq_item    jsonb;
BEGIN
  SELECT nom, classes_requises, prerequis_competences, niveaux
    INTO v_nom, v_classes, v_prereq_struct, v_niveaux
    FROM competences
   WHERE id = p_competence_id;

  IF NOT FOUND THEN
    RETURN '{}'::jsonb;
  END IF;

  v_nb_niveaux   := COALESCE(jsonb_array_length(v_niveaux), 0);
  v_classe_label := formater_classes_requises_label(v_classes);

  FOR v_niveau IN 1..GREATEST(v_nb_niveaux, 1) LOOP
    v_items := '[]'::jsonb;

    -- Classe : attachée au niveau 1 uniquement (restriction de toute la compétence)
    IF v_niveau = 1 AND v_classe_label IS NOT NULL THEN
      v_items := v_items || jsonb_build_object('type', 'classe', 'label', v_classe_label);
    END IF;

    -- ===== CAS SPÉCIAUX (même périmètre que verifier_prerequis_competences) =====
    IF v_nom = 'Dépeçage' AND v_niveau = 1 THEN
      v_items := v_items
        || jsonb_build_object('type','special','special_kind','depecage_creat1',
             'label', formater_prereq_label('Connaissances des Créatures', 1) || ' (famille appropriée)')
        || jsonb_build_object('type','special','special_kind','depecage_ps',
             'label', formater_prereq_label('Premiers Soins', 1));

    ELSIF v_nom = 'Dépeçage' AND v_niveau = 2 THEN
      v_items := v_items
        || jsonb_build_object('type','special','special_kind','depecage_creat2',
             'label', formater_prereq_label('Connaissances des Créatures', 2) || ' (famille appropriée)');

    ELSIF v_nom = 'Développement Spirituel Supérieur' AND v_niveau = 1 THEN
      v_items := v_items
        || jsonb_build_object('type','special','special_kind','dev_spirituel_20ps',
             'label', '20 PS via Développement Spirituel');

    -- ===== CAS GÉNÉRAL : prérequis structurés du niveau =====
    ELSE
      v_prereq_niv := v_prereq_struct -> v_niveau::text;
      IF v_prereq_niv IS NOT NULL AND jsonb_array_length(v_prereq_niv) > 0 THEN
        FOR v_prereq_item IN SELECT * FROM jsonb_array_elements(v_prereq_niv) LOOP
          v_items := v_items || jsonb_build_object(
            'type',           'competence',
            'competence_nom', v_prereq_item->>'competence_nom',
            'niveau_min',     (v_prereq_item->>'niveau_min')::integer,
            'label',          formater_prereq_label(
                                v_prereq_item->>'competence_nom',
                                (v_prereq_item->>'niveau_min')::integer)
          );
        END LOOP;
      END IF;
    END IF;

    IF jsonb_array_length(v_items) > 0 THEN
      v_resultat := v_resultat || jsonb_build_object(v_niveau::text, v_items);
    END IF;
  END LOOP;

  RETURN v_resultat;
END;
$function$;

-- 2) RPC WIZARD — délègue les libellés au réassembleur ------------------
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
BEGIN
  SELECT COALESCE(p.ps_max, 0) INTO v_ps_max FROM personnages p WHERE p.id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('erreur', 'Personnage introuvable');
  END IF;

  SELECT a_connaissance_creatures_1, a_connaissance_creatures_2, a_premiers_soins
    INTO v_a_creat1, v_a_creat2, v_a_ps
    FROM vue_personnage_etat
   WHERE personnage_id = p_personnage_id;

  FOR v_competence IN
    SELECT id, nom
      FROM competences
     WHERE est_actif = true
  LOOP
    v_niveau_max_ok      := 3;
    v_raisons            := '{}'::jsonb;
    v_prereqs_par_niveau := '{}'::jsonb;

    -- Source unique des libellés
    v_labels := assembler_prerequis_labels(v_competence.id);

    FOR v_niveau IN 1..3 LOOP
      v_raison_niv  := NULL;
      v_prereqs_niv := '[]'::jsonb;
      v_manquants   := ARRAY[]::text[];

      v_items_niv := v_labels -> v_niveau::text;

      IF v_items_niv IS NOT NULL AND jsonb_array_length(v_items_niv) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_items_niv) LOOP

          -- La classe est gérée par BlocClasses côté wizard : on l'exclut du bloc prérequis.
          IF (v_item->>'type') = 'classe' THEN
            CONTINUE;
          END IF;

          v_label := v_item->>'label';

          IF (v_item->>'type') = 'special' THEN
            v_statut := CASE (v_item->>'special_kind')
              WHEN 'depecage_creat1'    THEN CASE WHEN COALESCE(v_a_creat1, false) THEN 'acquis' ELSE 'manquant' END
              WHEN 'depecage_creat2'    THEN CASE WHEN COALESCE(v_a_creat2, false) THEN 'acquis' ELSE 'manquant' END
              WHEN 'depecage_ps'        THEN CASE WHEN COALESCE(v_a_ps, false)     THEN 'acquis' ELSE 'manquant' END
              WHEN 'dev_spirituel_20ps' THEN CASE WHEN v_ps_max >= 20             THEN 'acquis' ELSE 'manquant' END
              ELSE 'manquant'
            END;

          ELSE  -- type = 'competence'
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

          v_prereqs_niv := v_prereqs_niv || jsonb_build_object('label', v_label, 'statut', v_statut);
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
