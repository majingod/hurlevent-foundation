-- Migration 32 : Ajouter Canalisation aux verrous mutuels mage/pretre.
--
-- Contexte : le trigger `verifier_verrous_competences` (Migration 14) ne couvrait que
-- 3 compétences (Assemblage de Runes, Développement Spirituel, Développement Spirituel
-- Supérieur). Canalisation est aussi dupliquée mage/pretre et devait suivre la même
-- regle : verrou mutuel (une seule version achetable) + version pretre reservee aux
-- croyants. Ce trou laissait passer l'achat des 2 versions par un meme personnage.
--
-- Fix : ajout de 'Canalisation' a la liste des compétences soumises au trigger.
-- Aucun rétroactif : ne s'applique qu'aux futurs INSERT/UPDATE.

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
  v_est_croyant boolean;
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
$function$;
