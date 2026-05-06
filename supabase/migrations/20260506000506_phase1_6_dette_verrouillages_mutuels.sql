-- =========================================================================
-- Phase 1.6 — Dette technique loggée en Phase 1.4
-- Verrouillages mutuels entre versions mage/prêtre de 3 compétences :
--   - Assemblage de Runes
--   - Développement Spirituel
--   - Développement Spirituel Supérieur
--
-- + Restriction "version prêtre = croyants uniquement" pour ces 3 compétences
--
-- Implémentation : trigger BEFORE INSERT OR UPDATE OF competence_id sur
-- personnage_competences. Pas de SECURITY DEFINER (le trigger s'exécute
-- dans le contexte de la requête appelante, ce qui est correct ici).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.verifier_verrous_competences()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $func$
DECLARE
  v_competence_nom text;
  v_competence_categorie text;
  v_paire_opposee_id uuid;
  v_paire_opposee_categorie text;
  v_est_croyant boolean;
BEGIN
  -- Récupérer nom + catégorie de la compétence en cours d'achat
  SELECT nom, categorie
    INTO v_competence_nom, v_competence_categorie
  FROM public.competences
  WHERE id = NEW.competence_id;

  -- Hors-périmètre : seules 3 compétences sont concernées par les verrous mutuels
  IF v_competence_nom NOT IN (
    'Assemblage de Runes',
    'Développement Spirituel',
    'Développement Spirituel Supérieur'
  ) THEN
    RETURN NEW;
  END IF;

  -- Identifier la version opposée (même nom, catégorie inverse)
  v_paire_opposee_categorie := CASE
    WHEN v_competence_categorie = 'mage' THEN 'pretre'
    ELSE 'mage'
  END;

  SELECT id INTO v_paire_opposee_id
  FROM public.competences
  WHERE nom = v_competence_nom
    AND categorie = v_paire_opposee_categorie
    AND id <> NEW.competence_id
  LIMIT 1;

  -- Vérif 1 : verrou mutuel — bloquer si la version opposée est déjà possédée
  IF v_paire_opposee_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.personnage_competences
    WHERE personnage_id = NEW.personnage_id
      AND competence_id = v_paire_opposee_id
  ) THEN
    RAISE EXCEPTION 'Cette compétence est incompatible avec « % (%) » que ce personnage possède déjà.',
      v_competence_nom,
      v_paire_opposee_categorie;
  END IF;

  -- Vérif 2 : version prêtre réservée aux croyants
  -- Note : la contrainte CHECK chk_croyant_religion_coherence garantit que
  -- est_croyant = true ⇔ religion_id IS NOT NULL, donc tester est_croyant suffit.
  IF v_competence_categorie = 'pretre' THEN
    SELECT est_croyant INTO v_est_croyant
    FROM public.personnages
    WHERE id = NEW.personnage_id;

    IF NOT COALESCE(v_est_croyant, false) THEN
      RAISE EXCEPTION 'La version prêtre de « % » est réservée aux personnages croyants.',
        v_competence_nom;
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

COMMENT ON FUNCTION public.verifier_verrous_competences() IS
  'Phase 1.6 — Bloque les achats incompatibles entre versions mage et prêtre des compétences Assemblage de Runes, Développement Spirituel et Développement Spirituel Supérieur. Bloque aussi l''achat de la version prêtre par un personnage non-croyant.';

DROP TRIGGER IF EXISTS trg_verifier_verrous_competences ON public.personnage_competences;
CREATE TRIGGER trg_verifier_verrous_competences
  BEFORE INSERT OR UPDATE OF competence_id ON public.personnage_competences
  FOR EACH ROW
  EXECUTE FUNCTION public.verifier_verrous_competences();
