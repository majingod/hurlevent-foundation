-- [WIZARD-TRAIT-INAPTE-INCOHERENT] — VOLET 3 de [INAPTE-MAGIE-MODELE-INSTANCE] (s370)
--
-- Refuser le trait « Inapte à la magie » à un personnage qui porte DÉJÀ des
-- sorts ou des prières. La garde vit dans la gate SERVEUR (convention VIS-5),
-- pas dans l'écran : elle couvre ainsi le wizard, le générateur, et toute
-- surface future.
--
-- MESURÉ AVANT ÉCRITURE (s370, prod) :
--   · 0 personnage porteur du trait possède sorts ou prières → la garde
--     n'enferme AUCUN joueur vivant (vérifié juste avant application).
--   · personnage_sorts.statut et personnage_prieres.statut ne portent qu'UNE
--     valeur ('achete' : 91 et 48 lignes). La garde ne filtre donc PAS sur
--     statut — filtrer sur une colonne uniforme serait plaquer une grille
--     maison sur les données. À revoir si une seconde valeur apparaît.
--   · Le trait est reconnu par son NOM + est_actif, JAMAIS par son id
--     (même critère que personnage_inapte_magie).
--
-- CE QUE LA GARDE NE COUVRE PAS (nommé, pas déduit) :
--   `sauvegarder_etape_3(..., p_brouillon => true)` PERSISTE sans valider —
--   c'est son contrat, dont le générateur dépend. Un brouillon peut donc
--   encore poser le trait transitoirement : le déclencheur
--   trg_recalculer_stats_traits met alors les PS à 0. L'état est RÉCUPÉRABLE
--   (retirer le trait rejoue le déclencheur et restaure les PS) et l'étape ne
--   peut pas être franchie, valider_etape_3 la refusant.
--
-- IDEMPOTENT : CREATE OR REPLACE + re-pose des GRANTs mesurés avant migration.
-- ⚠️ Fonction NON SECURITY DEFINER et STABLE — les deux sont PRÉSERVÉS.

CREATE OR REPLACE FUNCTION public.valider_etape_3(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
  v_nb_sorts integer;
  v_nb_prieres integer;
  v_detail text;
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

  -- ── VOLET 3 (s370) : le trait « Inapte à la magie » contre la magie déjà acquise.
  -- Reconnaissance par le NOM + est_actif, jamais par l'id.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_traits) AS t
    JOIN public.traits_raciaux tr ON tr.id = (t->>'trait_id')::uuid
    WHERE tr.nom = 'Inapte à la magie'
      AND tr.est_actif = true
  ) THEN
    SELECT count(*) INTO v_nb_sorts
      FROM public.personnage_sorts ps WHERE ps.personnage_id = p_personnage_id;
    SELECT count(*) INTO v_nb_prieres
      FROM public.personnage_prieres pp WHERE pp.personnage_id = p_personnage_id;

    IF (v_nb_sorts + v_nb_prieres) > 0 THEN
      -- Un compte à deux causes se DÉCOMPOSE (Gotcha C78) : le joueur doit lire
      -- ce qu'il possède, pas un total agrégé.
      v_detail := CASE
        WHEN v_nb_sorts > 0 AND v_nb_prieres > 0
          THEN format('%s sort(s) et %s prière(s)', v_nb_sorts, v_nb_prieres)
        WHEN v_nb_sorts > 0 THEN format('%s sort(s)', v_nb_sorts)
        ELSE format('%s prière(s)', v_nb_prieres)
      END;

      v_erreurs := v_erreurs || jsonb_build_object(
        'code','trait_inapte_magie_incoherent',
        'message', format('Ce personnage possède déjà %s : le trait « Inapte à la magie » lui retirerait définitivement tous ses points de spiritualité. Retirez sa magie avant de choisir ce trait.', v_detail),
        'champ','traits_raciaux_choisis');
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

-- ACL : CREATE OR REPLACE peut remettre l'EXECUTE à l'état par défaut.
-- Re-pose EXACTE de l'ACL MESURÉE avant migration (s370) :
--   =X/postgres (PUBLIC) | postgres | anon | authenticated | service_role
GRANT EXECUTE ON FUNCTION public.valider_etape_3(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.valider_etape_3(uuid) TO anon, authenticated, service_role;
