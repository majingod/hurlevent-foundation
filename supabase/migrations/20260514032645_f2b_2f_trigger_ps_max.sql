-- F2b-2f : Trigger DB pour maintenir personnages.ps_max
--
-- Diagnostic :
--   - personnages.ps_max n'était jamais initialisé (restait à 5, le default)
--     même quand la classe avait ps_depart = 10 (Mage/Prêtre).
--   - Aucun trigger n'incrémentait ps_max à chaque achat de Développement
--     Spirituel ou Développement Spirituel Supérieur.
--   - Conséquence : la RPC peut_acheter_competence vérifiait ps_max >= 20
--     pour capper Dev Spi, mais le cap ne se déclenchait jamais. Et Dev Spi
--     Supérieur (qui exige ps_max >= 20) était toujours refusé.
--
-- Fix :
--   1. Fonction recalculer_ps_max(p_personnage_id uuid)
--      Recalcule ps_max = classes.ps_depart + COUNT(Dev Spi) + COUNT(Dev Spi Sup)
--      pour un personnage donné. Couvre les 2 versions Mage et Prêtre de chaque
--      compétence (filtrage par nom).
--   2. Trigger AFTER INSERT/DELETE sur personnage_competences qui appelle
--      recalculer_ps_max seulement si la compétence concernée est Dev Spi ou Sup.
--   3. Trigger AFTER UPDATE OF classe_id sur personnages qui recalcule à chaque
--      changement de classe (typiquement à l'étape 4 de la création).
--   4. Backfill : recalcule pour tous les personnages existants.
--
-- Note : le backfill peut produire des ps_max > 20 pour les persos qui ont
-- spammé Dev Spi avant ce fix (ex : Valerius avec 14 achats → ps_max = 24).
-- C'est volontaire (reflète l'état réel de la DB). Le joueur peut redescendre
-- via le bouton [-] dans l'UI Etape5.

-- 1. Fonction de recalcul
CREATE OR REPLACE FUNCTION public.recalculer_ps_max(p_personnage_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_ps_depart integer;
  v_nb_dev_spi integer;
  v_nb_dev_spi_sup integer;
BEGIN
  SELECT COALESCE(c.ps_depart, 5) INTO v_ps_depart
  FROM personnages p LEFT JOIN classes c ON c.id = p.classe_id
  WHERE p.id = p_personnage_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_nb_dev_spi
  FROM personnage_competences pc
  JOIN competences c ON c.id = pc.competence_id
  WHERE pc.personnage_id = p_personnage_id AND c.nom = 'Développement Spirituel';

  SELECT COUNT(*) INTO v_nb_dev_spi_sup
  FROM personnage_competences pc
  JOIN competences c ON c.id = pc.competence_id
  WHERE pc.personnage_id = p_personnage_id AND c.nom = 'Développement Spirituel Supérieur';

  UPDATE personnages
  SET ps_max = v_ps_depart + v_nb_dev_spi + v_nb_dev_spi_sup
  WHERE id = p_personnage_id;
END;
$$;

-- 2. Trigger sur achats/désachats de Dev Spi
CREATE OR REPLACE FUNCTION public.trg_recalculer_ps_max_sur_competence()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_nom_comp text;
  v_personnage_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_personnage_id := OLD.personnage_id;
    SELECT nom INTO v_nom_comp FROM competences WHERE id = OLD.competence_id;
  ELSE
    v_personnage_id := NEW.personnage_id;
    SELECT nom INTO v_nom_comp FROM competences WHERE id = NEW.competence_id;
  END IF;
  IF v_nom_comp IN ('Développement Spirituel', 'Développement Spirituel Supérieur') THEN
    PERFORM recalculer_ps_max(v_personnage_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculer_ps_max_competences ON personnage_competences;
CREATE TRIGGER trg_recalculer_ps_max_competences
AFTER INSERT OR DELETE ON personnage_competences
FOR EACH ROW EXECUTE FUNCTION trg_recalculer_ps_max_sur_competence();

-- 3. Trigger sur changement de classe
CREATE OR REPLACE FUNCTION public.trg_recalculer_ps_max_sur_classe()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM recalculer_ps_max(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculer_ps_max_classe ON personnages;
CREATE TRIGGER trg_recalculer_ps_max_classe
AFTER UPDATE OF classe_id ON personnages
FOR EACH ROW
WHEN (NEW.classe_id IS DISTINCT FROM OLD.classe_id)
EXECUTE FUNCTION trg_recalculer_ps_max_sur_classe();

-- 4. Backfill tous les persos existants
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM personnages LOOP
    PERFORM recalculer_ps_max(r.id);
  END LOOP;
END $$;
