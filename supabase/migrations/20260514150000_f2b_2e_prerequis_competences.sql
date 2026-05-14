-- ============================================================================
-- F2b-2e : Prérequis inter-compétences (data-driven)
-- ============================================================================
-- 1. Ajoute competences.prerequis_competences (jsonb, format D1 par niveau cible)
-- 2. Seed les 24 prérequis simples identifiés dans le manuel
-- 3. Patche peut_acheter_competence pour lire cette colonne
--    + corrige le bug Acquisition de Domaine (Lin&Math au lieu de Conn. Religions)
-- 4. Crée verifier_prerequis_competences(p_personnage_id) pour le frontend
--
-- Format prerequis_competences (D1) :
--   { "<niveau_cible>": [ {"competence_nom": "...", "niveau_min": N}, ... ] }
--   ET logique entre les éléments d'une même liste.
--   Les niveaux non listés n'ont pas de prereq spécial (cumulatif avec N-1 intra).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. ADD COLUMN
-- ----------------------------------------------------------------------------
ALTER TABLE competences
  ADD COLUMN IF NOT EXISTS prerequis_competences jsonb;

COMMENT ON COLUMN competences.prerequis_competences IS
  'Map { "niveau_cible": [{"competence_nom": "...", "niveau_min": N}] }. ET logique. NULL = aucun prereq inter-compétences.';

-- ----------------------------------------------------------------------------
-- 2. SEED des 24 prérequis simples
-- ----------------------------------------------------------------------------

-- Générales (4)
UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Connaissances des Herbes Communes", "niveau_min": 1}],
    "2": [{"competence_nom": "Connaissances des Herbes Rares",   "niveau_min": 1}]}'::jsonb
WHERE nom = 'Herbalisme';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Connaissance des Métaux communs", "niveau_min": 1}],
    "2": [{"competence_nom": "Connaissances des Métaux rares",  "niveau_min": 1}]}'::jsonb
WHERE nom = 'Mineur';

-- Guerrier (6)
UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Botte Secrète", "niveau_min": 1}]}'::jsonb
WHERE nom = 'Charge' AND categorie = 'guerrier';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Botte Secrète", "niveau_min": 1}],
    "2": [{"competence_nom": "Botte Secrète", "niveau_min": 2}],
    "3": [{"competence_nom": "Botte Secrète", "niveau_min": 3}]}'::jsonb
WHERE nom = 'Compétence d''arme à la hache';

UPDATE competences SET prerequis_competences =
  '{"3": [{"competence_nom": "Berserk", "niveau_min": 1}]}'::jsonb
WHERE nom = 'Compétence d''arme d''impact';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Connaissance des Métaux communs", "niveau_min": 1}],
    "2": [{"competence_nom": "Connaissances des Métaux rares",  "niveau_min": 1}]}'::jsonb
WHERE nom = 'Forge';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Forge", "niveau_min": 1}],
    "2": [{"competence_nom": "Forge", "niveau_min": 2}]}'::jsonb
WHERE nom = 'Renforcement défensif';

-- Voleur (5)
UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Expertise en toxicologie", "niveau_min": 1}]}'::jsonb
WHERE nom = 'Empoisonnement de projectile';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Alchimie", "niveau_min": 1}]}'::jsonb
WHERE nom = 'Expertise en toxicologie';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Estimation", "niveau_min": 1}]}'::jsonb
WHERE nom = 'Falsification';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Création et désarmement de piège", "niveau_min": 1}]}'::jsonb
WHERE nom = 'Piège sécurisé';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Connaissances Criminelles", "niveau_min": 2}]}'::jsonb
WHERE nom = 'Rumeur';

-- Mage (8)
UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Linguistique et Mathématique", "niveau_min": 1}]}'::jsonb
WHERE nom = 'Acquisition de Cercle';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Connaissances des Herbes Communes", "niveau_min": 1}],
    "2": [{"competence_nom": "Connaissances des Herbes Rares",   "niveau_min": 1}]}'::jsonb
WHERE nom = 'Alchimie';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Connaissance des Runes", "niveau_min": 1},
          {"competence_nom": "Canalisation",            "niveau_min": 1}],
    "3": [{"competence_nom": "Canalisation",            "niveau_min": 2}]}'::jsonb
WHERE nom = 'Assemblage de Runes';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Connaissances des Herbes Communes", "niveau_min": 1},
          {"competence_nom": "Alchimie",                            "niveau_min": 1}],
    "2": [{"competence_nom": "Connaissances des Herbes Rares",    "niveau_min": 1},
          {"competence_nom": "Alchimie",                            "niveau_min": 2}],
    "3": [{"competence_nom": "Alchimie",                            "niveau_min": 3}]}'::jsonb
WHERE nom = 'Identification des Potions';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Création et désarmement de piège", "niveau_min": 1},
          {"competence_nom": "Canalisation",                       "niveau_min": 1}]}'::jsonb
WHERE nom = 'Piège Magique';

-- Prêtre (6)
UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Linguistique et Mathématique", "niveau_min": 1}]}'::jsonb
WHERE nom = 'Acquisition de Domaine';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Connaissances des Religions", "niveau_min": 1}]}'::jsonb
WHERE nom = 'Bénédiction';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Diagnostic",     "niveau_min": 2},
          {"competence_nom": "Premiers Soins", "niveau_min": 2}]}'::jsonb
WHERE nom = 'Chirurgien';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Connaissances des Religions", "niveau_min": 1}]}'::jsonb
WHERE nom = 'Formation Théologique';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Connaissances des Religions", "niveau_min": 1}],
    "2": [{"competence_nom": "Connaissances des Religions", "niveau_min": 1}],
    "3": [{"competence_nom": "Connaissances des Religions", "niveau_min": 1}]}'::jsonb
WHERE nom = 'Grande Messe';

UPDATE competences SET prerequis_competences =
  '{"1": [{"competence_nom": "Premiers Soins", "niveau_min": 1}]}'::jsonb
WHERE nom = 'Réveil Expéditif';

-- ----------------------------------------------------------------------------
-- 3. PATCH peut_acheter_competence
--    - retire le bloc 8c hardcodé Acquisition de Domaine (bug)
--    - ajoute bloc 8d : lecture data-driven de prerequis_competences
--    - garde 8a, 8b (Dépeçage avec choix_achat) et la logique multiple_sans_choix
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.peut_acheter_competence(
  p_personnage_id uuid,
  p_competence_id uuid,
  p_niveau_desire integer,
  p_choix_achat   text DEFAULT NULL
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
  v_prereq              jsonb;
  v_prereq_item         jsonb;
  v_manquants           text[];
  v_niveau_actuel_pre   integer;
BEGIN
  -- 1. Personnage
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

  -- 2. Compétence
  SELECT * INTO v_competence FROM competences WHERE id = p_competence_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Compétence introuvable');
  END IF;
  IF NOT v_competence.est_actif THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Compétence inactive');
  END IF;

  -- 2bis. classes_requises
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

  -- 3. Propre classe ?
  v_est_propre_classe := (
    (v_competence.categorie = 'guerrier' AND v_personnage.classe_nom = 'Guerrier') OR
    (v_competence.categorie = 'voleur'   AND v_personnage.classe_nom = 'Voleur')   OR
    (v_competence.categorie = 'mage'     AND v_personnage.classe_nom = 'Mage')     OR
    (v_competence.categorie = 'pretre'   AND v_personnage.classe_nom = 'Prêtre')
  );

  -- 4. Niveau max autorisé
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

  -- 6. Niveau max actuel
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

  -- 8a. Dépeçage niveau 1 (hardcodé : contrainte sur choix_achat)
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

  -- 8b. Dépeçage niveau 2 (hardcodé : contrainte sur choix_achat)
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

  -- 8c. NOUVEAU : prereq data-driven via competences.prerequis_competences
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

  -- 9. Coût XP
  SELECT (elem->>'cout_xp')::integer INTO v_cout_xp
    FROM jsonb_array_elements(v_competence.niveaux) elem
   WHERE (elem->>'niveau')::integer = p_niveau_desire
   LIMIT 1;

  IF v_cout_xp IS NULL THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', format('Niveau %s non défini pour cette compétence', p_niveau_desire));
  END IF;

  -- 10. XP suffisant
  IF v_personnage.xp_dispo < v_cout_xp THEN
    RETURN jsonb_build_object(
      'peut_acheter', false,
      'raison', format('XP insuffisant. Requis : %s | Disponible : %s', v_cout_xp, v_personnage.xp_dispo)
    );
  END IF;

  -- 11. Maître requis
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

-- ----------------------------------------------------------------------------
-- 4. NOUVELLE FONCTION : verifier_prerequis_competences(p_personnage_id)
--    Retour : { "<competence_id>": { "niveau_max_achetable": int,
--                                    "raisons_par_niveau": { "1": "...", "2": "..." } } }
--    Couvre uniquement les prérequis inter-compétences (hardcodés + data-driven)
--    + plafond PS pour Dév. Spi Supérieur.
--    Ne couvre PAS : classe, XP, niveau N-1 intra (déjà visibles côté UI).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verifier_prerequis_competences(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_resultat        jsonb := '{}'::jsonb;
  v_competence      RECORD;
  v_niveau          integer;
  v_niveau_max_ok   integer;
  v_raisons         jsonb;
  v_raison_niv      text;
  v_prereq          jsonb;
  v_prereq_item     jsonb;
  v_manquants       text[];
  v_niveau_actuel_pre integer;
  v_ps_max          integer;
  v_a_creat1        boolean;
  v_a_creat2        boolean;
  v_a_ps            boolean;
BEGIN
  -- Récup état perso
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
    v_niveau_max_ok := 3;
    v_raisons       := '{}'::jsonb;

    FOR v_niveau IN 1..3 LOOP
      v_raison_niv := NULL;

      -- Cas hardcodé Dépeçage
      IF v_competence.nom = 'Dépeçage' AND v_niveau = 1 THEN
        IF NOT COALESCE(v_a_creat1, false) OR NOT COALESCE(v_a_ps, false) THEN
          v_raison_niv := 'Prérequis : Connaissance des Créatures niveau 1 ET Premiers Soins';
        END IF;
      ELSIF v_competence.nom = 'Dépeçage' AND v_niveau = 2 THEN
        IF NOT COALESCE(v_a_creat2, false) THEN
          v_raison_niv := 'Prérequis : Connaissance des Créatures niveau 2';
        END IF;

      -- Cas hardcodé Dév. Spi Supérieur
      ELSIF v_competence.nom = 'Développement Spirituel Supérieur' AND v_niveau = 1 THEN
        IF v_ps_max < 20 THEN
          v_raison_niv := 'Nécessite 20 PS (achetez d''abord Développement Spirituel)';
        END IF;

      -- Cas data-driven
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
              v_manquants := v_manquants || format('%s niveau %s',
                v_prereq_item->>'competence_nom',
                v_prereq_item->>'niveau_min'
              );
            END IF;
          END LOOP;
          IF array_length(v_manquants, 1) > 0 THEN
            v_raison_niv := format('Prérequis manquant(s) : %s', array_to_string(v_manquants, ', '));
          END IF;
        END IF;
      END IF;

      IF v_raison_niv IS NOT NULL THEN
        IF v_niveau_max_ok = 3 THEN
          v_niveau_max_ok := v_niveau - 1;
        END IF;
        v_raisons := v_raisons || jsonb_build_object(v_niveau::text, v_raison_niv);
      END IF;
    END LOOP;

    -- N'enregistrer que si au moins un niveau est bloqué
    IF v_niveau_max_ok < 3 THEN
      v_resultat := v_resultat || jsonb_build_object(
        v_competence.id::text,
        jsonb_build_object(
          'niveau_max_achetable', v_niveau_max_ok,
          'raisons_par_niveau',   v_raisons
        )
      );
    END IF;
  END LOOP;

  RETURN v_resultat;
END;
$function$;

COMMIT;
