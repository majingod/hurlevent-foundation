-- BUG DOUBLE COMPTAGE XP (frère de CLOTURE-DOUBLE-NIVEAU, M4) :
-- gn_completes×15 (conçu pour les GN déclarés à la création, étape 1 wizard)
-- s'additionnait au gain_evenement +15 du chemin de récompense → 30 XP/GN vécu.
-- Manuel : « Chaque événement offre 15 points d'expérience et donne 1 niveau ».
-- Correctif : colonnes *_declares (source des XP de création) ; les événements
-- VÉCUS paient via historique_xp / banque. Niveau inchangé (compteur total).

-- 1) Colonnes déclarées (création — étape 1 du wizard)
ALTER TABLE public.personnages
  ADD COLUMN IF NOT EXISTS gn_declares integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mini_gn_declares integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ouvertures_declares integer NOT NULL DEFAULT 0;

-- 2) Nouveau moteur : XP = départ + DÉCLARÉS×15/10 + gains historique
DROP FUNCTION IF EXISTS public.recalculer_xp_valeurs(uuid, uuid, integer, integer, integer, integer);
CREATE OR REPLACE FUNCTION public.recalculer_xp_valeurs(
  p_personnage_id uuid, p_race_id uuid,
  p_gn_completes integer, p_mini_gn_completes integer,
  p_ouvertures_terrain integer, p_niveau_correction integer,
  p_gn_declares integer DEFAULT NULL,
  p_mini_gn_declares integer DEFAULT NULL,
  p_ouvertures_declares integer DEFAULT NULL)
 RETURNS TABLE(xp_total integer, xp_depense integer, niveau integer)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_dep int; v_gn int; v_gains int; v_dep_xp int; v_remb int;
  v_gnd int; v_minid int; v_ouvd int;
BEGIN
  SELECT COALESCE(r.xp_depart,0) INTO v_dep FROM races r WHERE r.id = p_race_id;
  v_dep := COALESCE(v_dep,0);
  IF p_gn_declares IS NULL OR p_mini_gn_declares IS NULL OR p_ouvertures_declares IS NULL THEN
    SELECT COALESCE(pe.gn_declares,0), COALESCE(pe.mini_gn_declares,0), COALESCE(pe.ouvertures_declares,0)
      INTO v_gnd, v_minid, v_ouvd
    FROM personnages pe WHERE pe.id = p_personnage_id;
  END IF;
  v_gnd  := COALESCE(p_gn_declares, v_gnd, 0);
  v_minid := COALESCE(p_mini_gn_declares, v_minid, 0);
  v_ouvd := COALESCE(p_ouvertures_declares, v_ouvd, 0);
  -- XP des événements DÉCLARÉS à la création uniquement ;
  -- les événements VÉCUS paient via historique_xp (gain_evenement) ou la banque.
  v_gn := v_gnd*15 + v_minid*15 + v_ouvd*10;
  SELECT
    COALESCE(SUM(CASE WHEN type_mouvement LIKE 'gain_%'     THEN  montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_mouvement LIKE 'depense_%'  THEN -montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_mouvement = 'remboursement' THEN  montant ELSE 0 END),0)
    INTO v_gains, v_dep_xp, v_remb
  FROM historique_xp WHERE personnage_id = p_personnage_id;
  xp_total := v_dep + v_gn + v_gains;
  xp_depense := v_dep_xp - v_remb;
  niveau := 1 + COALESCE(p_gn_completes,0) + COALESCE(p_niveau_correction,0);
  RETURN NEXT;
END; $fn$;

-- 3) Trigger : sync declares↔compteurs AVANT 1ère récompense vécue (INV-4), puis recalc
CREATE OR REPLACE FUNCTION public.recalculer_xp_complet_trigger()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v record;
BEGIN
  IF TG_OP = 'INSERT' OR NOT EXISTS (
    SELECT 1 FROM public.inscriptions_evenements i
    WHERE i.personnage_id = NEW.id AND COALESCE(i.recompense_distribuee, false)
  ) THEN
    NEW.gn_declares := COALESCE(NEW.gn_completes, 0);
    NEW.mini_gn_declares := COALESCE(NEW.mini_gn_completes, 0);
    NEW.ouvertures_declares := COALESCE(NEW.ouvertures_terrain, 0);
  END IF;
  SELECT * INTO v FROM public.recalculer_xp_valeurs(
    NEW.id, NEW.race_id, NEW.gn_completes, NEW.mini_gn_completes,
    NEW.ouvertures_terrain, NEW.niveau_correction,
    NEW.gn_declares, NEW.mini_gn_declares, NEW.ouvertures_declares);
  NEW.xp_total := v.xp_total; NEW.xp_depense := v.xp_depense; NEW.niveau := v.niveau;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_recalculer_xp_complet ON public.personnages;
CREATE TRIGGER trg_recalculer_xp_complet
  BEFORE INSERT OR UPDATE OF race_id, gn_completes, mini_gn_completes,
    ouvertures_terrain, niveau_correction,
    gn_declares, mini_gn_declares, ouvertures_declares
  ON public.personnages FOR EACH ROW
  EXECUTE FUNCTION public.recalculer_xp_complet_trigger();

-- 4) Backfill (déclenche le recalc global via le trigger)
UPDATE public.personnages SET
  gn_declares = COALESCE(gn_completes,0),
  mini_gn_declares = COALESCE(mini_gn_completes,0),
  ouvertures_declares = COALESCE(ouvertures_terrain,0);

WITH vecus AS (
  SELECT i.personnage_id,
    count(*) FILTER (WHERE e.type_evenement='gn_regulier') AS gn_v,
    count(*) FILTER (WHERE e.type_evenement='mini_gn') AS mini_v,
    count(*) FILTER (WHERE e.type_evenement='entretien_terrain') AS ouv_v
  FROM public.inscriptions_evenements i
  JOIN public.evenements e ON e.id = i.evenement_id
  WHERE COALESCE(i.recompense_distribuee,false) AND i.personnage_id IS NOT NULL
  GROUP BY i.personnage_id
)
UPDATE public.personnages pe SET
  gn_declares = GREATEST(0, COALESCE(pe.gn_completes,0) - v.gn_v),
  mini_gn_declares = GREATEST(0, COALESCE(pe.mini_gn_completes,0) - v.mini_v),
  ouvertures_declares = GREATEST(0, COALESCE(pe.ouvertures_terrain,0) - v.ouv_v)
FROM vecus v WHERE v.personnage_id = pe.id;
