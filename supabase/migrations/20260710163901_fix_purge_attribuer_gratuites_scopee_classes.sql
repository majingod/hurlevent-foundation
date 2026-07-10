-- FIX s322 (1/2) : purge d'attribuer_competences_gratuites_classe scopee aux
-- gratuites de classe — protege les achats a cout nul (Acquisition niv 1 = 0 XP).
-- Idempotent, rejouable a froid.

CREATE OR REPLACE FUNCTION public.attribuer_competences_gratuites_classe(p_personnage_id uuid, p_choix_par_competence jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
  v_religion_uuid  uuid;
  v_nb_purgees     integer := 0;
BEGIN
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.classe_id IS NULL THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','classe_manquante','message','Le personnage n''a pas de classe.')),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_classe FROM public.classes WHERE id = v_perso.classe_id;
  v_gratuites := COALESCE(v_classe.competences_gratuites, '[]'::jsonb);

  -- NOUVEAU : Purger les anciennes competences gratuites obsoletes.
  -- Supprime les lignes xp_depense=0 dont le competence_id n'est pas
  -- dans la liste des competences gratuites de la nouvelle classe.
  -- Les lignes payantes (xp_depense > 0) sont conservees pour ne pas
  -- perdre l'XP investi par le joueur.
  WITH nouvelles_gratuites AS (
    SELECT DISTINCT (g->>'competence_id')::uuid AS competence_id
    FROM jsonb_array_elements(v_gratuites) g
    WHERE g ? 'competence_id'
  )
  DELETE FROM public.personnage_competences pc
  WHERE pc.personnage_id = p_personnage_id
    AND pc.xp_depense = 0
    AND NOT EXISTS (
      SELECT 1 FROM nouvelles_gratuites ng
      WHERE ng.competence_id = pc.competence_id
    )
    -- FIX s322 : la purge ne vise QUE les competences offertes par AU MOINS une
    -- classe (gratuites obsoletes d'une ancienne classe). Un ACHAT a cout nul
    -- (ex. Acquisition de Sort/Priere niv 1 = 0 XP au catalogue) a aussi
    -- xp_depense = 0 et ne doit JAMAIS etre purge.
    AND pc.competence_id IN (
      SELECT DISTINCT (g2->>'competence_id')::uuid
      FROM public.classes cl2,
           jsonb_array_elements(COALESCE(cl2.competences_gratuites, '[]'::jsonb)) g2
      WHERE g2 ? 'competence_id'
    );

  GET DIAGNOSTICS v_nb_purgees = ROW_COUNT;

  FOR v_gratuite IN SELECT * FROM jsonb_array_elements(v_gratuites)
  LOOP
    v_competence_id := (v_gratuite->>'competence_id')::uuid;
    v_niveau := COALESCE((v_gratuite->>'niveau')::integer, 1);

    SELECT * INTO v_competence FROM public.competences WHERE id = v_competence_id;
    IF NOT FOUND THEN
      v_erreurs := v_erreurs || jsonb_build_object(
        'code','competence_introuvable',
        'message', format('Compétence gratuite introuvable (id %s)', v_competence_id),
        'competence_id', v_competence_id
      );
      CONTINUE;
    END IF;

    v_choix := p_choix_par_competence->>(v_competence_id::text);

    -- Validation du choix obligatoire selon type_choix
    IF v_competence.type_choix IS NOT NULL AND v_choix IS NULL THEN
      -- Cas spécial religion : fallback sur religion_id du perso s'il en a une
      IF v_competence.type_choix = 'religion' AND v_perso.religion_id IS NOT NULL THEN
        v_choix := v_perso.religion_id::text;
      ELSE
        v_erreurs := v_erreurs || jsonb_build_object(
          'code','choix_manquant',
          'message', format('Un choix de type "%s" est obligatoire pour %s', v_competence.type_choix, v_competence.nom),
          'competence_id', v_competence_id,
          'competence_nom', v_competence.nom,
          'type_choix', v_competence.type_choix
        );
        CONTINUE;
      END IF;
    END IF;

    -- B2 : si type_choix='religion' avec un choix défini, sync personnages
    IF v_competence.type_choix = 'religion' AND v_choix IS NOT NULL THEN
      BEGIN
        v_religion_uuid := v_choix::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        v_erreurs := v_erreurs || jsonb_build_object(
          'code','religion_uuid_invalide',
          'message', format('Le choix de religion fourni n''est pas un UUID valide : %s', v_choix),
          'competence_id', v_competence_id
        );
        CONTINUE;
      END;

      IF NOT EXISTS (SELECT 1 FROM public.religions WHERE id = v_religion_uuid) THEN
        v_erreurs := v_erreurs || jsonb_build_object(
          'code','religion_introuvable',
          'message', format('Religion introuvable : %s', v_choix),
          'competence_id', v_competence_id
        );
        CONTINUE;
      END IF;

      IF v_perso.religion_id IS DISTINCT FROM v_religion_uuid OR v_perso.est_croyant = false THEN
        UPDATE public.personnages
        SET religion_id = v_religion_uuid,
            est_croyant = true
        WHERE id = p_personnage_id;
        v_perso.religion_id := v_religion_uuid;
        v_perso.est_croyant := true;
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
    'donnees', jsonb_build_object(
      'personnage_id', p_personnage_id,
      'nb_competences_gratuites_purgees', v_nb_purgees
    )
  );
END;
$$;


-- Verrouillage ACL (Gotcha A37 : CREATE OR REPLACE remet EXECUTE a PUBLIC).
-- Etat cible = etat courant : fonction INTERNE (appelee via SECURITY DEFINER).
REVOKE ALL ON FUNCTION public.attribuer_competences_gratuites_classe(uuid, jsonb) FROM PUBLIC, anon, authenticated;
