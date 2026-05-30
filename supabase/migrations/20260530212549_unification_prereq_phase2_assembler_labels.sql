-- ============================================================================
-- UNIFICATION-SOURCE-PRÉREQUIS — Phase 2, PR-1 : fondation SQL
-- Réassembleur de libellés de prérequis (SANS perso, SANS statut), réutilisé
-- par l'encyclopédie (PR-2) puis par la RPC wizard (PR-3).
-- Réutilise formater_prereq_label (Phase 1) pour le format « Niv N » + mono.
-- Décisions game-design (session 65) :
--   1) auto-progression NON affichée (implicite dans l'ordre des niveaux)
--   2) Dépeçage : « (famille appropriée) » conservé
--   3) Dév. Spirituel Supérieur : « 20 PS atteint avec Développement Spirituel »
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper : libellé de restriction de classe (« Classe Guerrier ou Prêtre »)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.formater_classes_requises_label(p_classes text[])
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_labels text[];
  v_slug   text;
  v_label  text;
BEGIN
  IF p_classes IS NULL OR array_length(p_classes, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  v_labels := ARRAY[]::text[];
  FOREACH v_slug IN ARRAY p_classes LOOP
    v_label := CASE v_slug
      WHEN 'guerrier' THEN 'Guerrier'
      WHEN 'voleur'   THEN 'Voleur'
      WHEN 'mage'     THEN 'Mage'
      WHEN 'pretre'   THEN 'Prêtre'
      ELSE initcap(v_slug)
    END;
    v_labels := v_labels || v_label;
  END LOOP;

  RETURN 'Classe ' || array_to_string(v_labels, ' ou ');
END;
$function$;

-- ----------------------------------------------------------------------------
-- Réassembleur : libellés de prérequis par niveau, depuis la source structurée
-- Retour : { "1": [ {type, label, competence_nom?, niveau_min?, special_kind?} ], "2": [...] }
--   type ∈ 'classe' | 'competence' | 'special'
-- Aucun statut (acquis/manquant) : c'est la RPC wizard qui l'ajoutera en PR-3.
-- ----------------------------------------------------------------------------
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
             'label', '20 PS atteint avec Développement Spirituel');

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
