-- C3b-1 : enrichit verifier_prerequis_competences pour renvoyer prereqs_par_niveau
-- (label + statut acquis/manquant par niveau), couvrant prérequis standard ET cas
-- spéciaux (Dépeçage, Développement Spirituel Supérieur). Enrichissement ADDITIF :
-- niveau_max_achetable et raisons_par_niveau sont conservés à l'identique.
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
  v_prereq              jsonb;
  v_prereq_item         jsonb;
  v_manquants           text[];
  v_niveau_actuel_pre   integer;
  v_ps_max              integer;
  v_a_creat1            boolean;
  v_a_creat2            boolean;
  v_a_ps                boolean;
  v_prereqs_par_niveau  jsonb;
  v_prereqs_niv         jsonb;
  v_statut              text;
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
    SELECT id, nom, prerequis_competences, type_achat
      FROM competences
     WHERE est_actif = true
  LOOP
    v_niveau_max_ok      := 3;
    v_raisons            := '{}'::jsonb;
    v_prereqs_par_niveau := '{}'::jsonb;

    FOR v_niveau IN 1..3 LOOP
      v_raison_niv  := NULL;
      v_prereqs_niv := '[]'::jsonb;

      IF v_competence.nom = 'Dépeçage' AND v_niveau = 1 THEN
        v_statut := CASE WHEN COALESCE(v_a_creat1, false) THEN 'acquis' ELSE 'manquant' END;
        v_prereqs_niv := v_prereqs_niv || jsonb_build_object('label','Connaissances des Créatures niveau 1','statut',v_statut);
        v_statut := CASE WHEN COALESCE(v_a_ps, false) THEN 'acquis' ELSE 'manquant' END;
        v_prereqs_niv := v_prereqs_niv || jsonb_build_object('label','Premiers Soins niveau 1','statut',v_statut);
        IF NOT COALESCE(v_a_creat1, false) OR NOT COALESCE(v_a_ps, false) THEN
          v_raison_niv := 'Prérequis : Connaissances des Créatures niveau 1 ET Premiers Soins';
        END IF;

      ELSIF v_competence.nom = 'Dépeçage' AND v_niveau = 2 THEN
        v_statut := CASE WHEN COALESCE(v_a_creat2, false) THEN 'acquis' ELSE 'manquant' END;
        v_prereqs_niv := v_prereqs_niv || jsonb_build_object('label','Connaissances des Créatures niveau 2','statut',v_statut);
        IF NOT COALESCE(v_a_creat2, false) THEN
          v_raison_niv := 'Prérequis : Connaissances des Créatures niveau 2';
        END IF;

      ELSIF v_competence.nom = 'Développement Spirituel Supérieur' AND v_niveau = 1 THEN
        IF v_ps_max >= 20 THEN
          v_prereqs_niv := v_prereqs_niv || jsonb_build_object('label','20 PS atteint avec Développement Spirituel d''abord','statut','acquis');
        ELSE
          v_prereqs_niv := v_prereqs_niv || jsonb_build_object('label','Atteindre 20 PS avec Développement Spirituel d''abord','statut','manquant');
          v_raison_niv := 'Nécessite 20 PS (achetez d''abord Développement Spirituel)';
        END IF;

      ELSE
        v_prereq := v_competence.prerequis_competences -> v_niveau::text;
        IF v_prereq IS NOT NULL AND jsonb_array_length(v_prereq) > 0 THEN
          v_manquants := ARRAY[]::text[];
          FOR v_prereq_item IN SELECT * FROM jsonb_array_elements(v_prereq) LOOP
            SELECT COALESCE(max(pc.niveau_acquis), 0)
              INTO v_niveau_actuel_pre
              FROM personnage_competences pc
              JOIN competences c ON c.id = pc.competence_id
             WHERE pc.personnage_id = p_personnage_id
               AND c.nom = (v_prereq_item->>'competence_nom');

            IF v_niveau_actuel_pre < (v_prereq_item->>'niveau_min')::integer THEN
              v_statut := 'manquant';
              v_manquants := v_manquants || format('%s niveau %s', v_prereq_item->>'competence_nom', v_prereq_item->>'niveau_min');
            ELSE
              v_statut := 'acquis';
            END IF;

            v_prereqs_niv := v_prereqs_niv || jsonb_build_object(
              'label', format('%s niveau %s', v_prereq_item->>'competence_nom', v_prereq_item->>'niveau_min'),
              'statut', v_statut);
          END LOOP;

          IF array_length(v_manquants, 1) > 0 THEN
            v_raison_niv := format('Prérequis manquant(s) : %s', array_to_string(v_manquants, ', '));
          END IF;
        END IF;
      END IF;

      IF jsonb_array_length(v_prereqs_niv) > 0 THEN
        v_prereqs_par_niveau := v_prereqs_par_niveau || jsonb_build_object(v_niveau::text, v_prereqs_niv);
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
