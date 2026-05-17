-- ============================================================================
-- Migration 5 — Fix Bugs D + E : compétences gratuites de classe
--
-- Avant :
--   - classes.competences_gratuites contenait des noms texte fragiles avec
--     5 erreurs (casse, forme, niveau encodé) → matching impossible côté code
--   - aucune RPC pour attribuer correctement les compétences gratuites avec
--     leur choix obligatoire (langue ancienne pour Décryptage, religion
--     pour Connaissances des Religions)
--   - sauvegarder_etape_4 ne faisait que UPDATE classe_id
--
-- Après :
--   - classes.competences_gratuites au format [{competence_id uuid, niveau int}]
--     (FK virtuelle, niveau structuré)
--   - cleanup de la donnée orpheline de Valerius (entry "Connaissances des
--     Religions" insérée avec xp_depense=4 et choix_achat=null par
--     l'ancien upsert frontend cassé)
--   - Nouvelle RPC attribuer_competences_gratuites_classe(p_perso, p_choix)
--   - sauvegarder_etape_4 étendue avec p_choix_par_competence jsonb (optionnel)
--   - valider_etape_4 vérifie que les choix obligatoires sont remplis
-- ============================================================================

-- 1. Cleanup data : entrée bidon Valerius (Connaissances des Religions à 4 XP, choix null)
DELETE FROM public.personnage_competences
WHERE personnage_id = '9725a08f-672b-4486-84a5-160403e021cb'
  AND competence_id = 'c821b270-d314-4092-9899-2fd80925e873';

-- 2. Migration du format JSONB de classes.competences_gratuites
UPDATE public.classes
SET competences_gratuites = jsonb_build_array(
  jsonb_build_object('competence_id', '70680316-bd7f-4bed-b711-050a2c54161a', 'niveau', 1), -- Bravoure
  jsonb_build_object('competence_id', '7c379b31-0983-49d3-bf35-7cc0225210f5', 'niveau', 1)  -- Compétence d'arme à deux mains
)
WHERE nom = 'Guerrier';

UPDATE public.classes
SET competences_gratuites = jsonb_build_array(
  jsonb_build_object('competence_id', 'c9d9a7b0-145e-48f6-b6fb-0d6811480221', 'niveau', 1), -- Linguistique et Mathématique
  jsonb_build_object('competence_id', '0b0fba09-77d5-4078-946f-9add150f695d', 'niveau', 1)  -- Décryptage
)
WHERE nom = 'Mage';

UPDATE public.classes
SET competences_gratuites = jsonb_build_array(
  jsonb_build_object('competence_id', 'c9d9a7b0-145e-48f6-b6fb-0d6811480221', 'niveau', 1), -- Linguistique et Mathématique
  jsonb_build_object('competence_id', 'b5a7460c-1259-40ca-83cd-098d00d9946d', 'niveau', 1), -- Bénédiction niveau 1
  jsonb_build_object('competence_id', 'c821b270-d314-4092-9899-2fd80925e873', 'niveau', 1)  -- Connaissances des Religions
)
WHERE nom = 'Prêtre';

UPDATE public.classes
SET competences_gratuites = jsonb_build_array(
  jsonb_build_object('competence_id', '420d699f-a0c9-4fee-b046-9dfc1e519c73', 'niveau', 1), -- Crochetage de serrure
  jsonb_build_object('competence_id', 'e7f5cff9-cb41-4fd3-abbc-6be47e7d1436', 'niveau', 1)  -- Estimation
)
WHERE nom = 'Voleur';

-- 3. Nouvelle RPC : attribuer_competences_gratuites_classe
CREATE OR REPLACE FUNCTION public.attribuer_competences_gratuites_classe(
  p_personnage_id uuid,
  p_choix_par_competence jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_perso          public.personnages%ROWTYPE;
  v_classe         public.classes%ROWTYPE;
  v_gratuites      jsonb;
  v_gratuite       jsonb;
  v_competence_id  uuid;
  v_niveau         integer;
  v_competence     public.competences%ROWTYPE;
  v_choix          text;
  v_erreurs        jsonb := '[]'::jsonb;
  v_existe         boolean;
BEGIN
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'personnage_introuvable',
        'message', 'Personnage introuvable'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.classe_id IS NULL THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'classe_manquante',
        'message', 'Le personnage n''a pas de classe.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_classe FROM public.classes WHERE id = v_perso.classe_id;
  v_gratuites := COALESCE(v_classe.competences_gratuites, '[]'::jsonb);

  -- Pour chaque compétence gratuite
  FOR v_gratuite IN SELECT * FROM jsonb_array_elements(v_gratuites)
  LOOP
    v_competence_id := (v_gratuite->>'competence_id')::uuid;
    v_niveau := COALESCE((v_gratuite->>'niveau')::integer, 1);

    SELECT * INTO v_competence FROM public.competences WHERE id = v_competence_id;
    IF NOT FOUND THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code', 'competence_introuvable',
        'message', format('Compétence gratuite introuvable (id %s)', v_competence_id),
        'competence_id', v_competence_id
      );
      CONTINUE;
    END IF;

    -- Récupérer le choix fourni par le client (si applicable)
    v_choix := p_choix_par_competence->>(v_competence_id::text);

    -- Validation du choix obligatoire selon type_choix
    IF v_competence.type_choix IS NOT NULL AND v_choix IS NULL THEN
      -- Cas spécial Connaissances des Religions : tenter d'utiliser la religion du perso
      IF v_competence.type_choix = 'religion' AND v_perso.religion_id IS NOT NULL THEN
        v_choix := v_perso.religion_id::text;
      ELSE
        v_erreurs := v_erreurs || jsonb_build_object(
          'code', 'choix_manquant',
          'message', format('Un choix de type "%s" est obligatoire pour %s', v_competence.type_choix, v_competence.nom),
          'competence_id', v_competence_id,
          'competence_nom', v_competence.nom,
          'type_choix', v_competence.type_choix
        );
        CONTINUE;
      END IF;
    END IF;

    -- INSERT idempotent
    SELECT EXISTS(
      SELECT 1 FROM public.personnage_competences
      WHERE personnage_id = p_personnage_id
        AND competence_id = v_competence_id
        AND niveau_acquis = v_niveau
    ) INTO v_existe;

    IF v_existe THEN
      -- Update du choix uniquement si entrée gratuite (xp_depense = 0)
      UPDATE public.personnage_competences
      SET choix_achat = v_choix
      WHERE personnage_id = p_personnage_id
        AND competence_id = v_competence_id
        AND niveau_acquis = v_niveau
        AND xp_depense = 0;
    ELSE
      INSERT INTO public.personnage_competences (
        personnage_id, competence_id, niveau_acquis,
        xp_depense, appris_via_maitre, statut_maitre, choix_achat
      ) VALUES (
        p_personnage_id, v_competence_id, v_niveau,
        0, false, 'non_requis', v_choix
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'succes', jsonb_array_length(v_erreurs) = 0,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_id', p_personnage_id)
  );
END;
$function$;

-- 4. Étendre sauvegarder_etape_4 avec p_choix_par_competence
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_4(
  p_personnage_id uuid,
  p_classe_id uuid,
  p_choix_par_competence jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_joueur_id    uuid := auth.uid();
  v_perso        public.personnages%ROWTYPE;
  v_validation   jsonb;
  v_attribution  jsonb;
  v_etape_apres  integer;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'non_authentifie',
        'message', 'Authentification requise.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'personnage_introuvable',
        'message', 'Personnage introuvable.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'ownership_refuse',
        'message', 'Ce personnage ne vous appartient pas.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.est_verrouille THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'personnage_verrouille',
        'message', 'Ce personnage est verrouillé et ne peut plus être modifié.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END IF;

  -- UPDATE classe_id
  BEGIN
    UPDATE public.personnages
    SET classe_id = p_classe_id
    WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'contrainte_violee',
        'message', SQLERRM
      )),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END;

  -- Re-charger v_perso (classe_id à jour)
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id;

  -- Attribuer les compétences gratuites de la classe
  v_attribution := public.attribuer_competences_gratuites_classe(
    p_personnage_id,
    COALESCE(p_choix_par_competence, '{}'::jsonb)
  );

  IF NOT (v_attribution->>'succes')::boolean THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', v_attribution->'erreurs',
      'avertissements', v_attribution->'avertissements',
      'donnees', jsonb_build_object(
        'personnage_id', p_personnage_id,
        'etape_creation_apres', v_perso.etape_creation
      )
    );
  END IF;

  -- Valider l'étape 4
  v_validation := public.valider_etape_4(p_personnage_id);

  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object(
        'personnage_id', p_personnage_id,
        'etape_creation_apres', v_perso.etape_creation
      )
    );
  END IF;

  -- Avancer
  IF v_perso.etape_creation = 4 THEN
    UPDATE public.personnages SET etape_creation = 5 WHERE id = p_personnage_id;
    v_etape_apres := 5;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_id', p_personnage_id,
      'etape_creation_apres', v_etape_apres
    )
  );
END;
$function$;

-- 5. Étendre valider_etape_4 pour vérifier les choix obligatoires
CREATE OR REPLACE FUNCTION public.valider_etape_4(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_perso       public.personnages%ROWTYPE;
  v_classe      public.classes%ROWTYPE;
  v_gratuites   jsonb;
  v_gratuite    jsonb;
  v_competence  public.competences%ROWTYPE;
  v_pc_choix    text;
  v_erreurs     jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valide', false, 'ignoree', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  IF v_perso.classe_id IS NULL THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','classe_manquante','message','La classe est obligatoire','champ','classe_id');
  ELSE
    SELECT * INTO v_classe FROM public.classes WHERE id = v_perso.classe_id;
    IF NOT FOUND THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','classe_introuvable','message','La classe sélectionnée n''existe pas','champ','classe_id');
    ELSE
      v_gratuites := COALESCE(v_classe.competences_gratuites, '[]'::jsonb);
      FOR v_gratuite IN SELECT * FROM jsonb_array_elements(v_gratuites)
      LOOP
        SELECT * INTO v_competence
        FROM public.competences
        WHERE id = (v_gratuite->>'competence_id')::uuid;

        IF FOUND AND v_competence.type_choix IS NOT NULL THEN
          SELECT choix_achat INTO v_pc_choix
          FROM public.personnage_competences
          WHERE personnage_id = p_personnage_id
            AND competence_id = v_competence.id
          LIMIT 1;

          IF v_pc_choix IS NULL THEN
            v_erreurs := v_erreurs || jsonb_build_object(
              'code', 'choix_manquant',
              'message', format('Choix de %s manquant pour %s', v_competence.type_choix, v_competence.nom),
              'champ', 'choix_par_competence',
              'competence_id', v_competence.id,
              'competence_nom', v_competence.nom,
              'type_choix', v_competence.type_choix
            );
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb
  );
END;
$function$;
