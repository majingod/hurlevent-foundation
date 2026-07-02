-- Défense en profondeur : refuser au niveau table l'acquisition d'un domaine
-- proscrit par la religion du personnage (manuel : « les domaines proscrits ne
-- peuvent être achetés »). Couvre tous les chemins d'insertion (RPC
-- acheter_competence, admin, contournement API). acheter_competence catche déjà
-- check_violation et renvoie une erreur propre au joueur.
CREATE OR REPLACE FUNCTION public.tg_refuser_domaine_proscrit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE v_est_acq_domaine boolean;
BEGIN
  IF NEW.choix_achat IS NULL THEN RETURN NEW; END IF;
  SELECT (c.nom = 'Acquisition de Domaine') INTO v_est_acq_domaine
    FROM competences c WHERE c.id = NEW.competence_id;
  IF COALESCE(v_est_acq_domaine, false) AND EXISTS (
    SELECT 1 FROM personnages p
    JOIN religions r ON r.id = p.religion_id
    WHERE p.id = NEW.personnage_id
      AND NEW.choix_achat = ANY (r.domaines_proscrits)
  ) THEN
    RAISE EXCEPTION 'Le domaine « % » est interdit par la religion du personnage', NEW.choix_achat
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_refuser_domaine_proscrit ON public.personnage_competences;
CREATE TRIGGER trg_refuser_domaine_proscrit
  BEFORE INSERT ON public.personnage_competences
  FOR EACH ROW EXECUTE FUNCTION public.tg_refuser_domaine_proscrit();
