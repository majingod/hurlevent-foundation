-- F2b-2b — Fix bug "Classe X" non validée
-- 16 compétences ont "Classe X" dans leur prerequis textuel mais
-- peut_acheter_competence ne le vérifiait pas.
-- Solution : colonne classes_requises text[] + check explicite dans la RPC.

-- 1. Ajout colonne
ALTER TABLE public.competences
  ADD COLUMN IF NOT EXISTS classes_requises text[];

COMMENT ON COLUMN public.competences.classes_requises IS
  'Liste des classes autorisées à acheter cette compétence (noms normalisés en minuscule sans accent : guerrier, voleur, mage, pretre). NULL = toutes classes autorisées.';

-- 2. Data migration : populate les 16 compétences identifiées
UPDATE public.competences SET classes_requises = ARRAY['mage']::text[]                   WHERE nom = 'Bâton de Sorcier';
UPDATE public.competences SET classes_requises = ARRAY['guerrier']::text[]               WHERE nom = 'Bravoure';
UPDATE public.competences SET classes_requises = ARRAY['guerrier']::text[]               WHERE nom = 'Charge';
UPDATE public.competences SET classes_requises = ARRAY['guerrier']::text[]               WHERE nom = 'Compétence d''arme à deux mains';
UPDATE public.competences SET classes_requises = ARRAY['guerrier']::text[]               WHERE nom = 'Désengagement';
UPDATE public.competences SET classes_requises = ARRAY['mage']::text[]                   WHERE nom = 'Développement Spirituel Supérieur' AND categorie = 'mage';
UPDATE public.competences SET classes_requises = ARRAY['pretre']::text[]                 WHERE nom = 'Développement Spirituel Supérieur' AND categorie = 'pretre';
UPDATE public.competences SET classes_requises = ARRAY['voleur']::text[]                 WHERE nom = 'Empoisonnement de projectile';
UPDATE public.competences SET classes_requises = ARRAY['voleur']::text[]                 WHERE nom = 'Falsification';
UPDATE public.competences SET classes_requises = ARRAY['pretre']::text[]                 WHERE nom = 'Formation Théologique';
UPDATE public.competences SET classes_requises = ARRAY['pretre']::text[]                 WHERE nom = 'Imposition des Mains';
UPDATE public.competences SET classes_requises = ARRAY['guerrier','pretre']::text[]      WHERE nom = 'Maniement du bouclier moyen';
UPDATE public.competences SET classes_requises = ARRAY['guerrier']::text[]               WHERE nom = 'Maniement du grand bouclier';
UPDATE public.competences SET classes_requises = ARRAY['guerrier','pretre']::text[]      WHERE nom = 'Port d''armure intermédiaire';
UPDATE public.competences SET classes_requises = ARRAY['guerrier']::text[]               WHERE nom = 'Port d''armure lourde';
UPDATE public.competences SET classes_requises = ARRAY['pretre']::text[]                 WHERE nom = 'Réveil Expéditif';
UPDATE public.competences SET classes_requises = ARRAY['pretre']::text[]                 WHERE nom = 'Rêves';

-- 3. Patch peut_acheter_competence : ajout check classes_requises
--    + reformatage indentation (le code précédent avait une indentation cassée — artefact IA générative)
CREATE OR REPLACE FUNCTION public.peut_acheter_competence(
  p_personnage_id uuid,
  p_competence_id uuid,
  p_niveau_desire integer,
  p_choix_achat text DEFAULT NULL
)
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
BEGIN
  -- 1. Récupérer le personnage + nom de sa classe
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

  -- 2. Récupérer la compétence
  SELECT * INTO v_competence FROM competences WHERE id = p_competence_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Compétence introuvable');
  END IF;
  IF NOT v_competence.est_actif THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Compétence inactive');
  END IF;

  -- 2bis. (NOUVEAU F2b-2b) Vérif classes_requises
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

  -- 3. Déterminer si c'est la propre classe du personnage
  v_est_propre_classe := (
    (v_competence.categorie = 'guerrier' AND v_personnage.classe_nom = 'Guerrier') OR
    (v_competence.categorie = 'voleur'   AND v_personnage.classe_nom = 'Voleur')   OR
    (v_competence.categorie = 'mage'     AND v_personnage.classe_nom = 'Mage')     OR
    (v_competence.categorie = 'pretre'   AND v_personnage.classe_nom = 'Prêtre')
  );

  -- 4. Niveau max autorisé (multiclassage)
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

  -- 5. Verrouillage croisé
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

  -- 6. Niveau max déjà acquis
  SELECT COALESCE(max(niveau_acquis), 0) INTO v_niveau_max_actuel
    FROM personnage_competences
   WHERE personnage_id = p_personnage_id AND competence_id = p_competence_id;

  -- 7. Logique selon type_achat
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
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Déjà acquis');
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
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Un choix de langue est obligatoire');
      END IF;
      SELECT EXISTS (
        SELECT 1 FROM personnage_competences
         WHERE personnage_id = p_personnage_id
           AND competence_id = p_competence_id
           AND choix_achat = p_choix_achat
      ) INTO v_deja_choisi;
      IF v_deja_choisi THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', format('Vous maîtrisez déjà "%s"', p_choix_achat));
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

  -- 8. Prérequis spéciaux
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

  -- 8c. Acquisition de Domaine
  IF v_competence.nom = 'Acquisition de Domaine' THEN
    IF NOT EXISTS (
      SELECT 1 FROM vue_personnage_etat
       WHERE personnage_id = p_personnage_id AND a_connaissance_religions = true
    ) THEN
      RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Prérequis : Connaissances des Religions');
    END IF;
  END IF;

  -- 9. Extraire le coût XP
  SELECT (elem->>'cout_xp')::integer INTO v_cout_xp
    FROM jsonb_array_elements(v_competence.niveaux) elem
   WHERE (elem->>'niveau')::integer = p_niveau_desire
   LIMIT 1;

  IF v_cout_xp IS NULL THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', format('Niveau %s non défini pour cette compétence', p_niveau_desire));
  END IF;

  -- 10. XP suffisant ?
  IF v_personnage.xp_dispo < v_cout_xp THEN
    RETURN jsonb_build_object(
      'peut_acheter', false,
      'raison', format('XP insuffisant. Requis : %s | Disponible : %s', v_cout_xp, v_personnage.xp_dispo)
    );
  END IF;

  -- 11. Maître requis en jeu ?
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
$function$;
