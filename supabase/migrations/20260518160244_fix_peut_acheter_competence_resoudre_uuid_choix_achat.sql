CREATE OR REPLACE FUNCTION public.peut_acheter_competence(p_personnage_id uuid, p_competence_id uuid, p_niveau_desire integer, p_choix_achat text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_personnage          RECORD;
  v_competence          RECORD;
  v_est_propre_classe   boolean;
  v_classe_normalisee   text;
  v_niveau_max_actuel   integer;
  v_niveau_max_autorise integer;
  v_deja_choisi         boolean;
  v_cout_xp             integer;
  v_necessite_maitre    boolean;
  v_prereq              jsonb;
  v_prereq_item         jsonb;
  v_manquants           text[];
  v_niveau_actuel_pre   integer;
  v_nom_lisible         text;
  v_choix_existant      text;
BEGIN
  SELECT p.id, p.classe_id, cl.nom AS classe_nom,
         (COALESCE(p.xp_total,0) - COALESCE(p.xp_depense,0)) AS xp_dispo,
         p.est_verrouille, p.ps_max
    INTO v_personnage
    FROM personnages p
    LEFT JOIN classes cl ON cl.id = p.classe_id
   WHERE p.id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Personnage introuvable');
  END IF;
  IF v_personnage.est_verrouille THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Personnage verrouillé (décédé ou archivé)');
  END IF;

  SELECT * INTO v_competence FROM competences WHERE id = p_competence_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Compétence introuvable');
  END IF;
  IF NOT v_competence.est_actif THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Compétence inactive');
  END IF;

  IF v_competence.classes_requises IS NOT NULL AND array_length(v_competence.classes_requises, 1) > 0 THEN
    v_classe_normalisee := CASE v_personnage.classe_nom
      WHEN 'Guerrier' THEN 'guerrier'
      WHEN 'Voleur'   THEN 'voleur'
      WHEN 'Mage'     THEN 'mage'
      WHEN 'Prêtre'   THEN 'pretre'
      ELSE NULL
    END;
    IF v_classe_normalisee IS NULL OR NOT (v_classe_normalisee = ANY(v_competence.classes_requises)) THEN
      RETURN jsonb_build_object(
        'peut_acheter', false,
        'raison', format('Classe requise : %s', array_to_string(v_competence.classes_requises, ' ou '))
      );
    END IF;
  END IF;

  v_est_propre_classe := (
    (v_competence.categorie = 'guerrier' AND v_personnage.classe_nom = 'Guerrier') OR
    (v_competence.categorie = 'voleur'   AND v_personnage.classe_nom = 'Voleur')   OR
    (v_competence.categorie = 'mage'     AND v_personnage.classe_nom = 'Mage')     OR
    (v_competence.categorie = 'pretre'   AND v_personnage.classe_nom = 'Prêtre')
  );

  IF v_competence.est_general OR v_est_propre_classe THEN
    v_niveau_max_autorise := 3;
  ELSE
    v_niveau_max_autorise := 2;
  END IF;

  IF p_niveau_desire > v_niveau_max_autorise THEN
    RETURN jsonb_build_object(
      'peut_acheter', false,
      'raison', format('Niveau %s inaccessible hors de votre classe (maximum autorisé : %s)', p_niveau_desire, v_niveau_max_autorise)
    );
  END IF;
  IF p_niveau_desire < 1 OR p_niveau_desire > 3 THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Niveau invalide (1 à 3 attendu)');
  END IF;

  IF v_competence.verrouillage_croise THEN
    IF EXISTS (
      SELECT 1 FROM personnage_competences pc2
        JOIN competences c2 ON c2.id = pc2.competence_id
       WHERE pc2.personnage_id = p_personnage_id
         AND c2.nom = v_competence.nom
         AND c2.id <> v_competence.id
    ) THEN
      RETURN jsonb_build_object(
        'peut_acheter', false,
        'raison', format('Vous avez déjà acquis "%s" dans l''autre catégorie', v_competence.nom)
      );
    END IF;
  END IF;

  SELECT COALESCE(max(niveau_acquis), 0) INTO v_niveau_max_actuel
    FROM personnage_competences
   WHERE personnage_id = p_personnage_id AND competence_id = p_competence_id;

  CASE v_competence.type_achat
    WHEN 'simple' THEN
      IF p_niveau_desire <> v_niveau_max_actuel + 1 THEN
        RETURN jsonb_build_object(
          'peut_acheter', false,
          'raison', format('Vous devez d''abord acquérir le niveau %s', v_niveau_max_actuel + 1)
        );
      END IF;

    WHEN 'unique_avec_choix' THEN
      IF v_niveau_max_actuel >= 1 THEN
        SELECT choix_achat INTO v_choix_existant
          FROM personnage_competences
         WHERE personnage_id = p_personnage_id
           AND competence_id = p_competence_id
         LIMIT 1;
        v_nom_lisible := CASE
          WHEN v_competence.type_choix = 'religion' AND v_choix_existant IS NOT NULL
            THEN COALESCE((SELECT nom FROM religions WHERE id::text = v_choix_existant), v_choix_existant)
          WHEN v_competence.type_choix IN ('langue', 'langue_ancienne') AND v_choix_existant IS NOT NULL
            THEN COALESCE((SELECT nom FROM langues WHERE id::text = v_choix_existant), v_choix_existant)
          ELSE NULL
        END;
        IF v_nom_lisible IS NOT NULL THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', format('Déjà acquis : %s', v_nom_lisible));
        ELSE
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Déjà acquis');
        END IF;
      END IF;
      IF p_niveau_desire <> 1 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Seul le niveau 1 est achetable pour cette compétence');
      END IF;
      IF p_choix_achat IS NULL OR length(trim(p_choix_achat)) = 0 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Un choix est obligatoire');
      END IF;

    WHEN 'multiple_avec_choix_par_niveau' THEN
      IF v_competence.nom = 'Connaissances Criminelles' AND p_niveau_desire = 1 THEN
        IF v_niveau_max_actuel >= 1 THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Déjà acquis au niveau 1');
        END IF;
      ELSE
        IF p_choix_achat IS NULL OR length(trim(p_choix_achat)) = 0 THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Un choix est obligatoire');
        END IF;
        SELECT EXISTS (
          SELECT 1 FROM personnage_competences
           WHERE personnage_id = p_personnage_id
             AND competence_id = p_competence_id
             AND niveau_acquis = p_niveau_desire
             AND choix_achat = p_choix_achat
        ) INTO v_deja_choisi;
        IF v_deja_choisi THEN
          RETURN jsonb_build_object(
            'peut_acheter', false,
            'raison', format('"%s" est déjà acquis au niveau %s', p_choix_achat, p_niveau_desire)
          );
        END IF;
        IF p_niveau_desire >= 2 THEN
          IF v_competence.nom = 'Connaissances Criminelles' AND p_niveau_desire = 2 THEN
            IF v_niveau_max_actuel < 1 THEN
              RETURN jsonb_build_object(
                'peut_acheter', false,
                'raison', 'Vous devez d''abord acquérir Connaissances Criminelles niveau 1'
              );
            END IF;
          ELSE
            IF NOT EXISTS (
              SELECT 1 FROM personnage_competences
               WHERE personnage_id = p_personnage_id
                 AND competence_id = p_competence_id
                 AND niveau_acquis = p_niveau_desire - 1
                 AND choix_achat = p_choix_achat
            ) THEN
              RETURN jsonb_build_object(
                'peut_acheter', false,
                'raison', format('Vous devez d''abord acquérir "%s" niveau %s pour "%s"', v_competence.nom, p_niveau_desire - 1, p_choix_achat)
              );
            END IF;
          END IF;
        END IF;
      END IF;

    WHEN 'multiple_langue' THEN
      IF p_niveau_desire <> 1 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Seul le niveau 1 est achetable pour cette compétence');
      END IF;
      IF p_choix_achat IS NULL OR length(trim(p_choix_achat)) = 0 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Un choix est obligatoire');
      END IF;
      SELECT EXISTS (
        SELECT 1 FROM personnage_competences
         WHERE personnage_id = p_personnage_id
           AND competence_id = p_competence_id
           AND choix_achat = p_choix_achat
      ) INTO v_deja_choisi;
      IF v_deja_choisi THEN
        v_nom_lisible := CASE
          WHEN v_competence.type_choix IN ('langue', 'langue_ancienne')
            THEN COALESCE((SELECT nom FROM langues WHERE id::text = p_choix_achat), p_choix_achat)
          WHEN v_competence.type_choix = 'religion'
            THEN COALESCE((SELECT nom FROM religions WHERE id::text = p_choix_achat), p_choix_achat)
          ELSE p_choix_achat
        END;
        RETURN jsonb_build_object('peut_acheter', false, 'raison', format('Vous avez déjà acquis "%s"', v_nom_lisible));
      END IF;

    WHEN 'multiple_sans_choix' THEN
      IF p_niveau_desire <> 1 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Seul le niveau 1 est achetable pour cette compétence');
      END IF;
      IF v_competence.nom = 'Développement Spirituel' THEN
        IF COALESCE(v_personnage.ps_max,0) >= 20 THEN
          RETURN jsonb_build_object(
            'peut_acheter', false,
            'raison', 'Maximum de 20 PS atteint — achetez Développement Spirituel Supérieur'
          );
        END IF;
      ELSIF v_competence.nom = 'Développement Spirituel Supérieur' THEN
        IF COALESCE(v_personnage.ps_max,0) < 20 THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Nécessite 20 PS (achetez d''abord Développement Spirituel)');
        END IF;
        IF v_personnage.ps_max >= 30 THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Maximum absolu atteint (30 PS)');
        END IF;
      END IF;
  END CASE;

  -- 8a. Dépeçage niveau 1
  IF v_competence.nom = 'Dépeçage' AND p_niveau_desire = 1 THEN
    IF NOT EXISTS (
      SELECT 1 FROM vue_personnage_etat
       WHERE personnage_id = p_personnage_id
         AND a_connaissance_creatures_1 = true
         AND a_premiers_soins = true
    ) THEN
      RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Prérequis : Connaissance des Créatures niveau 1 ET Premiers Soins');
    END IF;
    IF p_choix_achat IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM personnage_competences pc3
        JOIN competences c3 ON c3.id = pc3.competence_id
       WHERE pc3.personnage_id = p_personnage_id
         AND c3.nom = 'Connaissance des Créatures'
         AND pc3.niveau_acquis >= 1
         AND pc3.choix_achat = p_choix_achat
    ) THEN
      RETURN jsonb_build_object(
        'peut_acheter', false,
        'raison', format('Vous devez d''abord avoir Connaissance des Créatures pour la catégorie "%s"', p_choix_achat)
      );
    END IF;
  END IF;

  -- 8b. Dépeçage niveau 2
  IF v_competence.nom = 'Dépeçage' AND p_niveau_desire = 2 THEN
    IF NOT EXISTS (
      SELECT 1 FROM vue_personnage_etat
       WHERE personnage_id = p_personnage_id AND a_connaissance_creatures_2 = true
    ) THEN
      RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Prérequis : Connaissance des Créatures niveau 2');
    END IF;
    IF p_choix_achat IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM personnage_competences pc4
        JOIN competences c4 ON c4.id = pc4.competence_id
       WHERE pc4.personnage_id = p_personnage_id
         AND c4.nom = 'Connaissance des Créatures'
         AND pc4.niveau_acquis >= 2
         AND pc4.choix_achat = p_choix_achat
    ) THEN
      RETURN jsonb_build_object(
        'peut_acheter', false,
        'raison', format('Vous devez d''abord avoir Connaissance des Créatures niveau 2 pour "%s"', p_choix_achat)
      );
    END IF;
  END IF;

  -- 8c. Data-driven (Migration 11)
  v_prereq := v_competence.prerequis_competences -> p_niveau_desire::text;
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
        v_manquants := v_manquants || format('%s niveau %s',
          v_prereq_item->>'competence_nom',
          v_prereq_item->>'niveau_min'
        );
      END IF;
    END LOOP;
    IF array_length(v_manquants, 1) > 0 THEN
      RETURN jsonb_build_object(
        'peut_acheter', false,
        'raison', format('Prérequis manquant(s) : %s', array_to_string(v_manquants, ', '))
      );
    END IF;
  END IF;

  SELECT (elem->>'cout_xp')::integer INTO v_cout_xp
    FROM jsonb_array_elements(v_competence.niveaux) elem
   WHERE (elem->>'niveau')::integer = p_niveau_desire
   LIMIT 1;

  IF v_cout_xp IS NULL THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', format('Niveau %s non défini pour cette compétence', p_niveau_desire));
  END IF;

  IF v_personnage.xp_dispo < v_cout_xp THEN
    RETURN jsonb_build_object(
      'peut_acheter', false,
      'raison', format('XP insuffisant. Requis : %s | Disponible : %s', v_cout_xp, v_personnage.xp_dispo)
    );
  END IF;

  v_necessite_maitre := (
    (v_competence.est_general AND p_niveau_desire = 3) OR
    (v_est_propre_classe       AND p_niveau_desire = 3) OR
    (NOT v_competence.est_general AND NOT v_est_propre_classe AND p_niveau_desire = 2)
  );

  RETURN jsonb_build_object(
    'peut_acheter',        true,
    'raison',              'OK',
    'cout_xp',             v_cout_xp,
    'niveau_actuel',       v_niveau_max_actuel,
    'niveau_desire',       p_niveau_desire,
    'necessite_maitre',    v_necessite_maitre,
    'type_achat',          v_competence.type_achat,
    'type_choix',          v_competence.type_choix,
    'verrouillage_croise', v_competence.verrouillage_croise
  );
END;
$function$
;
