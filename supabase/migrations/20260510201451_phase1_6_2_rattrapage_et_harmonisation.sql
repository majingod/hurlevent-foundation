-- ============================================================================
-- MIGRATION : phase1_6_2_rattrapage_et_harmonisation
-- Date     : 2026-05-10
-- Auteur   : Claude principal (apply_migration via Supabase MCP)
--
-- OBJECTIFS :
--   1. Enregistrer dans schema_migrations les éléments ajoutés hors-protocole :
--      - 3 colonnes sur `evenements` (est_termine, adresse_physique, niveaux_recompense)
--      - 3 fonctions OK telles quelles (acheter_competence, sauvegarder_etape_2,
--        sauvegarder_etape_10) — recréées à l'identique pour entrer dans
--        supabase_migrations.schema_migrations.
--
--   2. Harmoniser au format standard `{succes, erreurs, avertissements, donnees}`
--      les 3 RPC admin qui utilisaient le format léger `{succes, message}` :
--      - cloturer_evenement
--      - ajouter_presence_tardive
--      - changer_statut_inscription
--      Et au passage :
--      - corriger l'indentation massacrée (artefact AI)
--      - CORRIGER LE BUG : whitelist statut dans changer_statut_inscription
--        contenait 'inscrit' (inexistant dans le CHECK) au lieu de 'annule'.
--
-- NON INCLUS DANS CETTE MIGRATION :
--   - acheter_trait_racial, acheter_sort, acheter_priere, acheter_recette,
--     acheter_assemblage, acheter_objet_forge, acheter_objet_joaillerie,
--     sauvegarder_etape_3 → migration suivante (patch sécurité, breaking).
--   - sauvegarder_etape_4 (complétion p_classe_secondaire_id) → migration suivante.
--   - sauvegarder_etape_5 à _9 → migration suivante.
--
-- IDEMPOTENCE :
--   - ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--   - CREATE OR REPLACE FUNCTION
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. COLONNES EVENEMENTS (rattrapage hors-protocole)
-- ----------------------------------------------------------------------------

ALTER TABLE public.evenements
  ADD COLUMN IF NOT EXISTS est_termine boolean DEFAULT false;

ALTER TABLE public.evenements
  ADD COLUMN IF NOT EXISTS adresse_physique text;

ALTER TABLE public.evenements
  ADD COLUMN IF NOT EXISTS niveaux_recompense integer DEFAULT 0;


-- ----------------------------------------------------------------------------
-- 2. FONCTIONS OK RATTRAPÉES (CREATE OR REPLACE à l'identique)
-- ----------------------------------------------------------------------------

-- 2.1 acheter_competence (modèle de référence pour les RPC d'achat sécurisées)

CREATE OR REPLACE FUNCTION public.acheter_competence(
  p_personnage_id uuid,
  p_competence_id uuid,
  p_niveau_desire integer,
  p_choix_achat text DEFAULT NULL,
  p_appris_via_maitre boolean DEFAULT false,
  p_nom_maitre text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_check jsonb;
  v_niveaux jsonb;
  v_cout_xp integer;
  v_xp_disponible integer;
  v_new_id uuid;
  v_xp_total integer;
  v_xp_depense integer;
  v_statut text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF v_perso.est_verrouille THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Le personnage est verrouillé')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_check := peut_acheter_competence(p_personnage_id, p_competence_id, p_niveau_desire, p_choix_achat);
  IF NOT (v_check->>'peut_acheter')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_refuse','message', COALESCE(v_check->>'raison','Achat refusé'))),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Coût depuis competences.niveaux (array indexé 0)
  SELECT niveaux INTO v_niveaux FROM competences WHERE id = p_competence_id;
  IF v_niveaux IS NULL OR jsonb_array_length(v_niveaux) < p_niveau_desire THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de compétence invalide')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_cout_xp := COALESCE((v_niveaux->(p_niveau_desire - 1)->>'cout_xp')::integer, 0);

  v_xp_disponible := v_perso.xp_total - v_perso.xp_depense;
  IF v_xp_disponible < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_statut := CASE WHEN p_appris_via_maitre THEN 'en_attente' ELSE 'non_requis' END;

  BEGIN
    INSERT INTO personnage_competences
      (personnage_id, competence_id, niveau_acquis, appris_via_maitre, xp_depense, nom_maitre, statut_maitre, choix_achat)
    VALUES
      (p_personnage_id, p_competence_id, p_niveau_desire, p_appris_via_maitre, v_cout_xp, p_nom_maitre, v_statut, p_choix_achat)
    RETURNING id INTO v_new_id;

    UPDATE personnages
       SET xp_depense = xp_depense + v_cout_xp,
           date_modification = now(),
           updated_at = now()
     WHERE id = p_personnage_id;

    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, competence_id, acteur_id)
      VALUES (p_personnage_id, 'depense_competence', -v_cout_xp,
              'Achat compétence niveau ' || p_niveau_desire || ' (' || v_cout_xp || ' XP)',
              p_competence_id, v_uid);
    END IF;
  EXCEPTION
    WHEN check_violation OR foreign_key_violation THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense
    FROM personnages WHERE id = p_personnage_id;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_competence_id', v_new_id,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense
    )
  );
END;
$function$;


-- 2.2 sauvegarder_etape_2 (avec création demande race spéciale)

CREATE OR REPLACE FUNCTION public.sauvegarder_etape_2(
  p_personnage_id uuid,
  p_race_id uuid,
  p_sous_type_chimeride text DEFAULT NULL,
  p_justification text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_perso public.personnages%ROWTYPE;
  v_race_nom text;
  v_validation jsonb;
  v_etape_apres integer;
  v_demande_resultat jsonb;
  v_demande_existante boolean;
  v_avertissements jsonb := '[]'::jsonb;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'non_authentifie', 'message', 'Authentification requise.')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_introuvable', 'message', 'Personnage introuvable.')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'ownership_refuse', 'message', 'Ce personnage ne vous appartient pas.')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.est_verrouille THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_verrouille', 'message', 'Ce personnage est verrouillé et ne peut plus être modifié.')),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END IF;

  -- UPDATE : race + sous_type_chimeride
  BEGIN
    UPDATE public.personnages
       SET race_id = p_race_id,
           sous_type_chimeride = p_sous_type_chimeride
     WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'contrainte_violee', 'message', SQLERRM)),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END;

  -- Si race spéciale (Chiméride / Les Non-Races), créer la demande si absente.
  SELECT nom INTO v_race_nom FROM public.races WHERE id = p_race_id;

  IF v_race_nom IN ('Chiméride', 'Les Non-Races') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.personnage_races_demandes WHERE personnage_id = p_personnage_id
    ) INTO v_demande_existante;

    IF NOT v_demande_existante THEN
      IF p_justification IS NULL OR char_length(trim(p_justification)) < 100 THEN
        v_avertissements := v_avertissements || jsonb_build_object(
          'code', 'justification_race_speciale_requise',
          'message', 'Cette race nécessite une demande d''approbation avec une justification d''au moins 100 caractères.'
        );
      ELSE
        v_demande_resultat := public.creer_demande_race(p_personnage_id, p_justification);
        IF NOT COALESCE((v_demande_resultat->>'succes')::boolean, false) THEN
          v_avertissements := v_avertissements || jsonb_build_object(
            'code', 'demande_race_echec',
            'message', COALESCE(v_demande_resultat->>'erreur', 'Création de la demande de race échouée.')
          );
        END IF;
      END IF;
    END IF;
  END IF;

  v_validation := public.valider_etape_2(p_personnage_id);

  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', (v_validation->'avertissements') || v_avertissements,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation)
    );
  END IF;

  IF v_perso.etape_creation = 2 THEN
    UPDATE public.personnages SET etape_creation = 3 WHERE id = p_personnage_id;
    v_etape_apres := 3;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', v_avertissements,
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_etape_apres)
  );
END;
$function$;


-- 2.3 sauvegarder_etape_10 (UPDATE historique + ame_personnage, transition 10 → 11)

CREATE OR REPLACE FUNCTION public.sauvegarder_etape_10(
  p_personnage_id uuid,
  p_historique text,
  p_ame_personnage text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_perso public.personnages%ROWTYPE;
  v_validation jsonb;
  v_etape_apres integer;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'non_authentifie', 'message', 'Authentification requise.')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_introuvable', 'message', 'Personnage introuvable.')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'ownership_refuse', 'message', 'Ce personnage ne vous appartient pas.')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.est_verrouille THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_verrouille', 'message', 'Ce personnage est verrouillé et ne peut plus être modifié.')),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END IF;

  BEGIN
    UPDATE public.personnages
       SET historique = p_historique,
           ame_personnage = p_ame_personnage
     WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'contrainte_violee', 'message', SQLERRM)),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END;

  v_validation := public.valider_etape_10(p_personnage_id);

  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation)
    );
  END IF;

  IF v_perso.etape_creation = 10 THEN
    UPDATE public.personnages SET etape_creation = 11 WHERE id = p_personnage_id;
    v_etape_apres := 11;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_etape_apres)
  );
END;
$function$;


-- ----------------------------------------------------------------------------
-- 3. HARMONISATION DES 3 RPC ADMIN AU FORMAT STANDARD
--    {succes, erreurs, avertissements, donnees}
-- ----------------------------------------------------------------------------

-- 3.1 cloturer_evenement (réharmonisée + indentation propre)

CREATE OR REPLACE FUNCTION public.cloturer_evenement(p_evenement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_evt           public.evenements%ROWTYPE;
  v_inscription   record;
  v_xp_montant    integer;
  v_niveaux       integer;
  v_count_present integer := 0;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'acces_refuse', 'message', 'Accès refusé.')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_evt FROM public.evenements WHERE id = p_evenement_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'evenement_introuvable', 'message', 'Événement introuvable.')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_evt.est_termine THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'evenement_deja_termine', 'message', 'Événement déjà terminé.')),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('evenement_id', p_evenement_id)
    );
  END IF;

  v_xp_montant := COALESCE(v_evt.xp_recompense, 0);
  v_niveaux    := COALESCE(v_evt.niveaux_recompense, 0);

  -- Pour chaque inscription marquée présente : attribuer XP + niveaux
  FOR v_inscription IN
    SELECT id, personnage_id
      FROM public.inscriptions_evenements
     WHERE evenement_id = p_evenement_id
       AND statut = 'present'
       AND personnage_id IS NOT NULL
  LOOP
    -- XP via la RPC existante (insère dans historique_xp, idempotent)
    PERFORM public.attribuer_xp_evenement(v_inscription.id, v_xp_montant);

    -- Niveaux ajoutés directement sur le personnage
    IF v_niveaux > 0 THEN
      UPDATE public.personnages
         SET niveau = COALESCE(niveau, 1) + v_niveaux,
             updated_at = now()
       WHERE id = v_inscription.personnage_id;
    END IF;

    v_count_present := v_count_present + 1;
  END LOOP;

  -- Marque l'événement terminé
  UPDATE public.evenements
     SET est_termine = true,
         updated_at = now()
   WHERE id = p_evenement_id;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'evenement_id', p_evenement_id,
      'nb_presences_recompensees', v_count_present,
      'xp_par_presence', v_xp_montant,
      'niveaux_par_presence', v_niveaux
    )
  );
END;
$function$;


-- 3.2 ajouter_presence_tardive (réharmonisée + indentation propre)

CREATE OR REPLACE FUNCTION public.ajouter_presence_tardive(
  p_evenement_id uuid,
  p_personnage_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_evt          public.evenements%ROWTYPE;
  v_joueur_id    uuid;
  v_inscription  uuid;
  v_xp_montant   integer;
  v_niveaux      integer;
  v_existe       boolean;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'acces_refuse', 'message', 'Accès refusé.')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_evt FROM public.evenements WHERE id = p_evenement_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'evenement_introuvable', 'message', 'Événement introuvable.')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  SELECT joueur_id INTO v_joueur_id
    FROM public.personnages
   WHERE id = p_personnage_id;

  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_introuvable', 'message', 'Personnage introuvable.')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  -- Vérifie qu'il n'existe pas déjà une inscription
  SELECT EXISTS (
    SELECT 1 FROM public.inscriptions_evenements
     WHERE evenement_id = p_evenement_id
       AND personnage_id = p_personnage_id
  ) INTO v_existe;

  IF v_existe THEN
    -- Met à jour le statut existant à 'present'
    UPDATE public.inscriptions_evenements
       SET statut = 'present',
           date_confirmation = COALESCE(date_confirmation, now()),
           updated_at = now()
     WHERE evenement_id = p_evenement_id
       AND personnage_id = p_personnage_id
    RETURNING id INTO v_inscription;
  ELSE
    INSERT INTO public.inscriptions_evenements (
      evenement_id, personnage_id, joueur_id, statut, date_inscription, date_confirmation
    )
    VALUES (
      p_evenement_id, p_personnage_id, v_joueur_id, 'present', now(), now()
    )
    RETURNING id INTO v_inscription;
  END IF;

  v_xp_montant := COALESCE(v_evt.xp_recompense, 0);
  v_niveaux    := COALESCE(v_evt.niveaux_recompense, 0);

  -- Attribue XP via la RPC existante (idempotente)
  PERFORM public.attribuer_xp_evenement(v_inscription, v_xp_montant);

  -- Ajoute niveaux le cas échéant
  IF v_niveaux > 0 THEN
    UPDATE public.personnages
       SET niveau = COALESCE(niveau, 1) + v_niveaux,
           updated_at = now()
     WHERE id = p_personnage_id;
  END IF;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'inscription_id', v_inscription,
      'evenement_id', p_evenement_id,
      'personnage_id', p_personnage_id,
      'xp_attribue', v_xp_montant,
      'niveaux_ajoutes', v_niveaux,
      'inscription_existante', v_existe
    )
  );
END;
$function$;


-- 3.3 changer_statut_inscription (réharmonisée + indentation propre + BUG FIX whitelist)
--
-- BUG CORRIGÉ : la whitelist contenait 'inscrit' (inexistant dans le CHECK constraint
-- de la table) et il manquait 'annule'. CHECK = ('en_attente','present','absent','annule').

CREATE OR REPLACE FUNCTION public.changer_statut_inscription(
  p_inscription_id uuid,
  p_nouveau_statut text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ancien_statut text;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'acces_refuse', 'message', 'Accès refusé.')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  -- Whitelist alignée sur le CHECK constraint de la table.
  IF p_nouveau_statut NOT IN ('en_attente', 'present', 'absent', 'annule') THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'statut_invalide',
        'message', format('Statut invalide. Valeurs acceptées : en_attente, present, absent, annule. Reçu : %s', p_nouveau_statut)
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  SELECT statut INTO v_ancien_statut
    FROM public.inscriptions_evenements
   WHERE id = p_inscription_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'inscription_introuvable', 'message', 'Inscription introuvable.')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  UPDATE public.inscriptions_evenements
     SET statut = p_nouveau_statut,
         updated_at = now(),
         date_confirmation = CASE
           WHEN p_nouveau_statut = 'present' THEN COALESCE(date_confirmation, now())
           ELSE date_confirmation
         END
   WHERE id = p_inscription_id;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'inscription_id', p_inscription_id,
      'ancien_statut', v_ancien_statut,
      'nouveau_statut', p_nouveau_statut
    )
  );
END;
$function$;


-- ============================================================================
-- FIN DE LA MIGRATION phase1_6_2_rattrapage_et_harmonisation
-- ============================================================================
