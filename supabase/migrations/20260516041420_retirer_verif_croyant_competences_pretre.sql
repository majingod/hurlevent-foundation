-- Migration 33 : Retirer la verification "version pretre reservee aux croyants"
-- du trigger `verifier_verrous_competences`.
--
-- Contexte : les Migrations 14 et 32 incluaient une garde qui levait une
-- exception si un personnage non croyant tentait d'acheter la version pretre
-- d'une compétence whitelistee. Cette regle metier etait incorrecte : Canalisation,
-- Developpement Spirituel et Assemblage de Runes (version pretre) sont accessibles
-- a toutes les classes sans contrainte de croyance.
--
-- Developpement Spirituel Superieur reste reserve a la classe Pretre via
-- classes_requises=['pretre'] (les pretres sont implicitement croyants apres
-- l'etape 4 via le sync de `attribuer_competences_gratuites_classe`).
--
-- Le verrou mutuel mage/pretre (Verif 1) est conserve : un personnage ne peut
-- toujours pas acheter les 2 versions d'une meme compétence.

CREATE OR REPLACE FUNCTION public.verifier_verrous_competences()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_competence_nom text;
  v_competence_categorie text;
  v_paire_opposee_id uuid;
  v_paire_opposee_categorie text;
BEGIN
  SELECT nom, categorie
    INTO v_competence_nom, v_competence_categorie
  FROM public.competences
  WHERE id = NEW.competence_id;

  IF v_competence_nom NOT IN (
    'Assemblage de Runes',
    'Canalisation',
    'Développement Spirituel',
    'Développement Spirituel Supérieur'
  ) THEN
    RETURN NEW;
  END IF;

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

  IF v_paire_opposee_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.personnage_competences
    WHERE personnage_id = NEW.personnage_id
      AND competence_id = v_paire_opposee_id
  ) THEN
    RAISE EXCEPTION 'Cette compétence est incompatible avec « % (%) » que ce personnage possède déjà.',
      v_competence_nom,
      v_paire_opposee_categorie;
  END IF;

  RETURN NEW;
END;
$function$;
