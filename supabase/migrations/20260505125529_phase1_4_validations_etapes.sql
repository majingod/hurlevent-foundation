-- ============================================================================
-- PHASE 1.4 — Fonctions RPC de validation par étape
-- ============================================================================
-- Crée :
--   • 3 helpers de détection (personnage_a_des_sorts / a_des_prieres / est_runiste)
--   • 11 fonctions valider_etape_1 à valider_etape_11
--   • 1 fonction de dispatch valider_etape(p_id, p_etape)
--   • 1 fonction valider_personnage_final (verrouillage transactionnel)
--
-- Format de retour standardisé :
--   { valide: bool, ignoree: bool,
--     erreurs: [{code, message, champ?}],
--     avertissements: [{code, message, champ?}] }
-- ============================================================================

-- ============================================================================
-- HELPERS DE DÉTECTION (STABLE, search_path sécurisé)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.personnage_a_des_sorts(p_personnage_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM personnage_competences pc
    JOIN competences c ON c.id = pc.competence_id
    WHERE pc.personnage_id = p_personnage_id
      AND c.nom = 'Acquisition de Cercle'
  );
$$;

CREATE OR REPLACE FUNCTION public.personnage_a_des_prieres(p_personnage_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM personnage_competences pc
    JOIN competences c ON c.id = pc.competence_id
    WHERE pc.personnage_id = p_personnage_id
      AND c.nom = 'Acquisition de Domaine'
  );
$$;

CREATE OR REPLACE FUNCTION public.personnage_est_runiste(p_personnage_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM personnage_competences pc
    JOIN competences c ON c.id = pc.competence_id
    WHERE pc.personnage_id = p_personnage_id
      AND c.nom = 'Assemblage de Runes'
  );
$$;

-- ============================================================================
-- valider_etape_1 — InfosBase
-- ============================================================================

CREATE OR REPLACE FUNCTION public.valider_etape_1(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_perso public.personnages%ROWTYPE;
  v_erreurs jsonb := '[]'::jsonb;
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

  IF v_perso.nom IS NULL THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','nom_manquant','message','Le nom du personnage est obligatoire','champ','nom');
  ELSIF length(trim(v_perso.nom)) < 2 THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','nom_trop_court','message','Le nom doit contenir au moins 2 caractères','champ','nom');
  END IF;

  IF v_perso.est_croyant = true AND v_perso.religion_id IS NULL THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','religion_manquante','message','Un personnage croyant doit avoir une religion','champ','religion_id');
  ELSIF v_perso.est_croyant = false AND v_perso.religion_id IS NOT NULL THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','religion_incoherente','message','Un personnage non-croyant ne doit pas avoir de religion','champ','religion_id');
  END IF;

  IF COALESCE(v_perso.gn_completes, 0) < 0 THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','gn_completes_negatif','message','Le nombre de GN complétés ne peut pas être négatif','champ','gn_completes');
  END IF;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb
  );
END;
$$;

-- ============================================================================
-- valider_etape_2 — Race
-- ============================================================================

CREATE OR REPLACE FUNCTION public.valider_etape_2(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_perso public.personnages%ROWTYPE;
  v_race_nom text;
  v_demande_statut text;
  v_erreurs jsonb := '[]'::jsonb;
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

  IF v_perso.race_id IS NULL THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','race_manquante','message','La race est obligatoire','champ','race_id');
    RETURN jsonb_build_object(
      'valide', false, 'ignoree', false,
      'erreurs', v_erreurs, 'avertissements', '[]'::jsonb
    );
  END IF;

  SELECT nom INTO v_race_nom FROM public.races WHERE id = v_perso.race_id;

  IF v_race_nom = 'Chiméride' THEN
    IF v_perso.sous_type_chimeride IS NULL THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','sous_type_chimeride_manquant',
        'message','Un Chiméride doit avoir un sous-type (carnivore ou herbivore)',
        'champ','sous_type_chimeride');
    END IF;
  ELSE
    IF v_perso.sous_type_chimeride IS NOT NULL THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','sous_type_chimeride_invalide_pour_race',
        'message','Seuls les Chimérides ont un sous-type',
        'champ','sous_type_chimeride');
    END IF;
  END IF;

  SELECT statut INTO v_demande_statut
  FROM public.personnage_races_demandes
  WHERE personnage_id = p_personnage_id;

  IF FOUND AND v_demande_statut = 'refusee' THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','race_demande_refusee',
      'message','La demande pour cette race a été refusée',
      'champ','race_id');
  END IF;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb
  );
END;
$$;

-- ============================================================================
-- valider_etape_3 — Traits raciaux
-- ============================================================================

CREATE OR REPLACE FUNCTION public.valider_etape_3(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_perso public.personnages%ROWTYPE;
  v_nb_quota integer;
  v_nb_gratuits integer;
  v_traits jsonb;
  v_trait jsonb;
  v_trait_id uuid;
  v_est_gratuit boolean;
  v_xp_depense integer;
  v_cout_xp integer;
  v_trait_existe boolean;
  v_erreurs jsonb := '[]'::jsonb;
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

  IF v_perso.race_id IS NULL THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','race_manquante',
      'message','Sélectionnez une race avant de choisir des traits',
      'champ','race_id');
    RETURN jsonb_build_object(
      'valide', false, 'ignoree', false,
      'erreurs', v_erreurs, 'avertissements', '[]'::jsonb
    );
  END IF;

  SELECT nb_traits_raciaux INTO v_nb_quota FROM public.races WHERE id = v_perso.race_id;
  v_traits := COALESCE(v_perso.traits_raciaux_choisis, '[]'::jsonb);

  SELECT count(*) INTO v_nb_gratuits
  FROM jsonb_array_elements(v_traits) AS t
  WHERE (t->>'est_gratuit')::boolean = true;

  IF v_nb_gratuits <> v_nb_quota THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','traits_gratuits_quota_incorrect',
      'message', format('Vous devez choisir exactement %s trait(s) gratuit(s), pas %s', v_nb_quota, v_nb_gratuits),
      'champ','traits_raciaux_choisis');
  END IF;

  IF EXISTS (
    SELECT (t->>'trait_id')::uuid
    FROM jsonb_array_elements(v_traits) AS t
    GROUP BY (t->>'trait_id')::uuid
    HAVING count(*) > 1
  ) THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','traits_doublon',
      'message','Un même trait apparaît plusieurs fois',
      'champ','traits_raciaux_choisis');
  END IF;

  FOR v_trait IN SELECT * FROM jsonb_array_elements(v_traits) LOOP
    v_trait_id := (v_trait->>'trait_id')::uuid;
    v_est_gratuit := (v_trait->>'est_gratuit')::boolean;
    v_xp_depense := (v_trait->>'xp_depense')::integer;

    SELECT EXISTS (
      SELECT 1 FROM public.race_traits rt
      WHERE rt.race_id = v_perso.race_id
        AND rt.trait_id = v_trait_id
        AND (rt.sous_type IS NULL OR rt.sous_type = v_perso.sous_type_chimeride)
    ) INTO v_trait_existe;

    IF NOT v_trait_existe THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','trait_invalide_pour_race',
        'message', format('Le trait %s n''est pas accessible à cette race', v_trait_id),
        'champ','traits_raciaux_choisis');
    ELSE
      IF v_est_gratuit THEN
        IF v_xp_depense <> 0 THEN
          v_erreurs := v_erreurs || jsonb_build_object(
            'code','trait_gratuit_xp_non_nul',
            'message', format('Le trait %s est gratuit mais a un xp_depense non nul', v_trait_id),
            'champ','traits_raciaux_choisis');
        END IF;
      ELSE
        SELECT cout_xp INTO v_cout_xp FROM public.traits_raciaux WHERE id = v_trait_id;
        IF v_xp_depense <> v_cout_xp THEN
          v_erreurs := v_erreurs || jsonb_build_object(
            'code','trait_payant_xp_incorrect',
            'message', format('Le trait %s coûte %s XP, pas %s', v_trait_id, v_cout_xp, v_xp_depense),
            'champ','traits_raciaux_choisis');
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb
  );
END;
$$;

-- ============================================================================
-- valider_etape_4 — Classe
-- ============================================================================

CREATE OR REPLACE FUNCTION public.valider_etape_4(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_perso public.personnages%ROWTYPE;
  v_erreurs jsonb := '[]'::jsonb;
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
  ELSIF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = v_perso.classe_id) THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','classe_introuvable','message','La classe sélectionnée n''existe pas','champ','classe_id');
  END IF;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb
  );
END;
$$;

-- ============================================================================
-- valider_etape_5 — Compétences
-- ============================================================================

CREATE OR REPLACE FUNCTION public.valider_etape_5(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_avertissements jsonb := '[]'::jsonb;
  v_nb_competences integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.personnages WHERE id = p_personnage_id) THEN
    RETURN jsonb_build_object(
      'valide', false, 'ignoree', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  SELECT count(*) INTO v_nb_competences
  FROM public.personnage_competences
  WHERE personnage_id = p_personnage_id;

  IF v_nb_competences = 0 THEN
    v_avertissements := v_avertissements || jsonb_build_object(
      'code','info_aucune_competence_payante',
      'message','Vous n''avez acheté aucune compétence supplémentaire');
  END IF;

  RETURN jsonb_build_object(
    'valide', true,
    'ignoree', false,
    'erreurs', '[]'::jsonb,
    'avertissements', v_avertissements
  );
END;
$$;

-- ============================================================================
-- valider_etape_6 — Sorts arcaniques (auto-skip si non-mage)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.valider_etape_6(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sort RECORD;
  v_niveau_max integer;
  v_nb_cercles integer;
  v_nb_sorts integer;
  v_erreurs jsonb := '[]'::jsonb;
  v_avertissements jsonb := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.personnages WHERE id = p_personnage_id) THEN
    RETURN jsonb_build_object(
      'valide', false, 'ignoree', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  IF NOT public.personnage_a_des_sorts(p_personnage_id) THEN
    RETURN jsonb_build_object(
      'valide', true, 'ignoree', true,
      'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb
    );
  END IF;

  FOR v_sort IN
    SELECT ps.sort_id, ps.niveau_sort, s.cercle, s.nom AS sort_nom
    FROM public.personnage_sorts ps
    JOIN public.sorts s ON s.id = ps.sort_id
    WHERE ps.personnage_id = p_personnage_id
  LOOP
    SELECT niveau_max_sorts INTO v_niveau_max
    FROM public.vue_cercles_disponibles
    WHERE personnage_id = p_personnage_id AND cercle = v_sort.cercle;

    IF NOT FOUND THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','sort_cercle_non_debloque',
        'message', format('Le sort %s appartient au cercle %s, non débloqué', v_sort.sort_nom, v_sort.cercle),
        'champ','personnage_sorts');
    ELSIF v_sort.niveau_sort > v_niveau_max THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','sort_niveau_trop_eleve',
        'message', format('Le sort %s (niveau %s) dépasse le max %s du cercle %s', v_sort.sort_nom, v_sort.niveau_sort, v_niveau_max, v_sort.cercle),
        'champ','personnage_sorts');
    END IF;
  END LOOP;

  SELECT count(*) INTO v_nb_cercles FROM public.vue_cercles_disponibles WHERE personnage_id = p_personnage_id;
  SELECT count(*) INTO v_nb_sorts FROM public.personnage_sorts WHERE personnage_id = p_personnage_id;

  IF v_nb_cercles > 0 AND v_nb_sorts = 0 THEN
    v_avertissements := v_avertissements || jsonb_build_object(
      'code','info_cercle_sans_sort',
      'message','Vous avez débloqué un ou plusieurs cercles mais n''avez acheté aucun sort');
  END IF;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', v_avertissements
  );
END;
$$;

-- ============================================================================
-- valider_etape_7 — Prières divines (auto-skip si non-prêtre, STRICT religion)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.valider_etape_7(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_perso public.personnages%ROWTYPE;
  v_priere RECORD;
  v_niveau_max integer;
  v_nb_domaines integer;
  v_nb_prieres integer;
  v_erreurs jsonb := '[]'::jsonb;
  v_avertissements jsonb := '[]'::jsonb;
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

  IF NOT public.personnage_a_des_prieres(p_personnage_id) THEN
    RETURN jsonb_build_object(
      'valide', true, 'ignoree', true,
      'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb
    );
  END IF;

  FOR v_priere IN
    SELECT pp.priere_id, pp.niveau_priere, pr.domaine, pr.religion_id, pr.nom AS priere_nom
    FROM public.personnage_prieres pp
    JOIN public.prieres pr ON pr.id = pp.priere_id
    WHERE pp.personnage_id = p_personnage_id
  LOOP
    SELECT niveau_max_prieres INTO v_niveau_max
    FROM public.vue_domaines_disponibles
    WHERE personnage_id = p_personnage_id AND domaine = v_priere.domaine;

    IF NOT FOUND THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','priere_domaine_non_debloque',
        'message', format('La prière %s appartient au domaine %s, non débloqué', v_priere.priere_nom, v_priere.domaine),
        'champ','personnage_prieres');
    ELSIF v_priere.niveau_priere > v_niveau_max THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','priere_niveau_trop_eleve',
        'message', format('La prière %s (niveau %s) dépasse le max %s du domaine %s', v_priere.priere_nom, v_priere.niveau_priere, v_niveau_max, v_priere.domaine),
        'champ','personnage_prieres');
    END IF;

    IF v_priere.religion_id IS DISTINCT FROM v_perso.religion_id THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','priere_religion_incompatible',
        'message', format('La prière %s n''appartient pas à votre religion', v_priere.priere_nom),
        'champ','personnage_prieres');
    END IF;
  END LOOP;

  SELECT count(*) INTO v_nb_domaines FROM public.vue_domaines_disponibles WHERE personnage_id = p_personnage_id;
  SELECT count(*) INTO v_nb_prieres FROM public.personnage_prieres WHERE personnage_id = p_personnage_id;

  IF v_nb_domaines > 0 AND v_nb_prieres = 0 THEN
    v_avertissements := v_avertissements || jsonb_build_object(
      'code','info_domaine_sans_priere',
      'message','Vous avez débloqué un ou plusieurs domaines mais n''avez acheté aucune prière');
  END IF;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', v_avertissements
  );
END;
$$;

-- ============================================================================
-- valider_etape_8 — Artisanat (auto-skip si pas Alchimie/Forge/Joaillerie)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.valider_etape_8(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_a_artisanat boolean;
  v_quotas record;
  v_erreurs jsonb := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.personnages WHERE id = p_personnage_id) THEN
    RETURN jsonb_build_object(
      'valide', false, 'ignoree', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.personnage_competences pc
    JOIN public.competences c ON c.id = pc.competence_id
    WHERE pc.personnage_id = p_personnage_id
      AND c.nom IN ('Alchimie', 'Forge', 'Joaillerie')
  ) INTO v_a_artisanat;

  IF NOT v_a_artisanat THEN
    RETURN jsonb_build_object(
      'valide', true, 'ignoree', true,
      'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb
    );
  END IF;

  SELECT * INTO v_quotas FROM public.vue_artisanat_quotas WHERE personnage_id = p_personnage_id;

  IF v_quotas.quota_alchimie_mineure_utilises > v_quotas.quota_alchimie_mineure_total THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','artisanat_quota_depasse',
      'message', format('Quota recettes alchimie mineure dépassé (%s/%s)', v_quotas.quota_alchimie_mineure_utilises, v_quotas.quota_alchimie_mineure_total),
      'champ','personnage_recettes');
  END IF;

  IF v_quotas.quota_alchimie_intermediaire_utilises > v_quotas.quota_alchimie_intermediaire_total THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','artisanat_quota_depasse',
      'message', format('Quota recettes alchimie intermédiaire dépassé (%s/%s)', v_quotas.quota_alchimie_intermediaire_utilises, v_quotas.quota_alchimie_intermediaire_total),
      'champ','personnage_recettes');
  END IF;

  IF v_quotas.quota_alchimie_majeure_utilises > v_quotas.quota_alchimie_majeure_total THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','artisanat_quota_depasse',
      'message', format('Quota recettes alchimie majeure dépassé (%s/%s)', v_quotas.quota_alchimie_majeure_utilises, v_quotas.quota_alchimie_majeure_total),
      'champ','personnage_recettes');
  END IF;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb
  );
END;
$$;

-- ============================================================================
-- valider_etape_9 — Assemblages de runes (auto-skip si non-runiste)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.valider_etape_9(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_quotas record;
  v_erreurs jsonb := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.personnages WHERE id = p_personnage_id) THEN
    RETURN jsonb_build_object(
      'valide', false, 'ignoree', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  IF NOT public.personnage_est_runiste(p_personnage_id) THEN
    RETURN jsonb_build_object(
      'valide', true, 'ignoree', true,
      'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb
    );
  END IF;

  SELECT * INTO v_quotas FROM public.vue_artisanat_quotas WHERE personnage_id = p_personnage_id;

  IF v_quotas.quota_assemblages_utilises > v_quotas.quota_assemblages_total THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','artisanat_quota_depasse',
      'message', format('Quota assemblages gratuits dépassé (%s/%s)', v_quotas.quota_assemblages_utilises, v_quotas.quota_assemblages_total),
      'champ','personnage_assemblages');
  END IF;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb
  );
END;
$$;

-- ============================================================================
-- valider_etape_10 — Histoire & Âme (aucune contrainte)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.valider_etape_10(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.personnages WHERE id = p_personnage_id) THEN
    RETURN jsonb_build_object(
      'valide', false, 'ignoree', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'valide', true, 'ignoree', false,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb
  );
END;
$$;

-- ============================================================================
-- valider_etape_11 — Récapitulatif (sécurités transversales)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.valider_etape_11(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_perso public.personnages%ROWTYPE;
  v_erreurs jsonb := '[]'::jsonb;
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

  IF COALESCE(v_perso.xp_depense, 0) > COALESCE(v_perso.xp_total, 0) THEN
    v_erreurs := v_erreurs || jsonb_build_object(
      'code','xp_insuffisant',
      'message', format('XP dépensée (%s) supérieure à XP totale (%s)', v_perso.xp_depense, v_perso.xp_total),
      'champ','xp_depense');
  END IF;

  RETURN jsonb_build_object(
    'valide', jsonb_array_length(v_erreurs) = 0,
    'ignoree', false,
    'erreurs', v_erreurs,
    'avertissements', '[]'::jsonb
  );
END;
$$;

-- ============================================================================
-- valider_etape — Dispatch unifié
-- ============================================================================

CREATE OR REPLACE FUNCTION public.valider_etape(p_personnage_id uuid, p_etape integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
BEGIN
  CASE p_etape
    WHEN 1  THEN RETURN public.valider_etape_1(p_personnage_id);
    WHEN 2  THEN RETURN public.valider_etape_2(p_personnage_id);
    WHEN 3  THEN RETURN public.valider_etape_3(p_personnage_id);
    WHEN 4  THEN RETURN public.valider_etape_4(p_personnage_id);
    WHEN 5  THEN RETURN public.valider_etape_5(p_personnage_id);
    WHEN 6  THEN RETURN public.valider_etape_6(p_personnage_id);
    WHEN 7  THEN RETURN public.valider_etape_7(p_personnage_id);
    WHEN 8  THEN RETURN public.valider_etape_8(p_personnage_id);
    WHEN 9  THEN RETURN public.valider_etape_9(p_personnage_id);
    WHEN 10 THEN RETURN public.valider_etape_10(p_personnage_id);
    WHEN 11 THEN RETURN public.valider_etape_11(p_personnage_id);
    ELSE
      RAISE EXCEPTION 'Étape invalide : % (doit être entre 1 et 11)', p_etape
        USING ERRCODE = '22023';
  END CASE;
END;
$$;

-- ============================================================================
-- valider_personnage_final — Verrouillage transactionnel
-- ============================================================================

CREATE OR REPLACE FUNCTION public.valider_personnage_final(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_perso public.personnages%ROWTYPE;
  v_user_id uuid;
  v_etape integer;
  v_resultat jsonb;
  v_erreurs jsonb := '[]'::jsonb;
  v_avertissements jsonb := '[]'::jsonb;
  v_toutes_valides boolean := true;
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valide', false, 'est_verrouille', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  IF v_perso.joueur_id IS DISTINCT FROM v_user_id
     AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object(
      'valide', false, 'est_verrouille', v_perso.est_verrouille,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','non_autorise','message','Vous n''êtes pas autorisé à finaliser ce personnage')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  IF v_perso.est_verrouille = true THEN
    RETURN jsonb_build_object(
      'valide', false, 'est_verrouille', true,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_deja_verrouille','message','Ce personnage est déjà verrouillé')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  FOR v_etape IN 1..11 LOOP
    v_resultat := public.valider_etape(p_personnage_id, v_etape);

    IF (v_resultat->>'valide')::boolean = false THEN
      v_toutes_valides := false;
    END IF;

    v_erreurs := v_erreurs || COALESCE(v_resultat->'erreurs', '[]'::jsonb);
    v_avertissements := v_avertissements || COALESCE(v_resultat->'avertissements', '[]'::jsonb);
  END LOOP;

  IF v_toutes_valides THEN
    UPDATE public.personnages
    SET est_verrouille = true,
        etape_creation = 12
    WHERE id = p_personnage_id;

    RETURN jsonb_build_object(
      'valide', true, 'est_verrouille', true,
      'erreurs', '[]'::jsonb, 'avertissements', v_avertissements
    );
  END IF;

  RETURN jsonb_build_object(
    'valide', false, 'est_verrouille', false,
    'erreurs', v_erreurs, 'avertissements', v_avertissements
  );
END;
$$;

-- ============================================================================
-- GRANT EXECUTE
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.personnage_a_des_sorts(uuid)            TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.personnage_a_des_prieres(uuid)          TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.personnage_est_runiste(uuid)            TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.valider_etape_1(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_etape_2(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_etape_3(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_etape_4(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_etape_5(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_etape_6(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_etape_7(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_etape_8(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_etape_9(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_etape_10(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_etape_11(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_etape(uuid, integer)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.valider_personnage_final(uuid)          TO authenticated;
