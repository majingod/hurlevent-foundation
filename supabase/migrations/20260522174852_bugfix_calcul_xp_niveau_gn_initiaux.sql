-- ============================================================================
-- Bugfix : XP de GN initiaux jamais calculés ni persistés en BD
-- ============================================================================
-- Bug : sauvegarder_etape_1 enregistre gn_completes mais aucune logique DB
-- ne convertit ça en XP. recalculer_xp_personnage ignore gn_completes,
-- mini_gn_completes, ouvertures_terrain. Conséquence : tout perso finalisé
-- perd ses XP de création au moment du choix de race (le trigger
-- set_xp_initial_on_race_change écrasait xp_total avec race.xp_depart seul).
-- Confirmé par la dette session 22 "Valerius sans historique_xp".
--
-- Fix : intégrer GN/mini-GN/ouvertures dans toutes les RPC et triggers
-- de calcul XP, et persister aussi le niveau (= 1 + gn_completes).
-- Formules : xp_total = race.xp_depart + 15·gn + 15·mini + 10·ouv + Σ(historique +)
--           niveau   = 1 + gn_completes
--
-- Data fix inclus : UPDATE no-op sur gn_completes pour déclencher le
-- trigger sur tous les persos existants (idempotent).
-- ============================================================================

-- 1. recalculer_xp_personnage : inclure GN + niveau
CREATE OR REPLACE FUNCTION public.recalculer_xp_personnage(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_xp_depart     integer;
  v_xp_gn         integer;
  v_xp_gains      integer;
  v_xp_depenses   integer;
  v_niveau        integer;
  v_gn            integer;
  v_mini          integer;
  v_ouv           integer;
BEGIN
  SELECT
    COALESCE(r.xp_depart, 0),
    COALESCE(p.gn_completes, 0),
    COALESCE(p.mini_gn_completes, 0),
    COALESCE(p.ouvertures_terrain, 0)
  INTO v_xp_depart, v_gn, v_mini, v_ouv
  FROM personnages p
  LEFT JOIN races r ON r.id = p.race_id
  WHERE p.id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('xp_total', 0, 'xp_depense', 0, 'niveau', 1);
  END IF;

  v_xp_gn := (v_gn * 15) + (v_mini * 15) + (v_ouv * 10);
  v_niveau := 1 + v_gn;

  SELECT
    COALESCE(SUM(CASE WHEN montant > 0 THEN montant  ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN montant < 0 THEN -montant ELSE 0 END), 0)
    INTO v_xp_gains, v_xp_depenses
  FROM historique_xp
  WHERE personnage_id = p_personnage_id;

  RETURN jsonb_build_object(
    'xp_total',   v_xp_depart + v_xp_gn + v_xp_gains,
    'xp_depense', v_xp_depenses,
    'niveau',     v_niveau
  );
END;
$function$;


-- 2. Nouvelle fonction trigger : recalcul complet sur changement race ou GN
CREATE OR REPLACE FUNCTION public.recalculer_xp_complet_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_xp_depart    integer;
  v_xp_gn        integer;
  v_xp_gains     integer;
  v_xp_depenses  integer;
BEGIN
  SELECT COALESCE(r.xp_depart, 0)
    INTO v_xp_depart
  FROM races r
  WHERE r.id = NEW.race_id;
  v_xp_depart := COALESCE(v_xp_depart, 0);

  v_xp_gn := (COALESCE(NEW.gn_completes, 0) * 15)
           + (COALESCE(NEW.mini_gn_completes, 0) * 15)
           + (COALESCE(NEW.ouvertures_terrain, 0) * 10);

  SELECT
    COALESCE(SUM(CASE WHEN montant > 0 THEN montant  ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN montant < 0 THEN -montant ELSE 0 END), 0)
    INTO v_xp_gains, v_xp_depenses
  FROM historique_xp
  WHERE personnage_id = NEW.id;

  NEW.xp_total   := v_xp_depart + v_xp_gn + v_xp_gains;
  NEW.xp_depense := v_xp_depenses;
  NEW.niveau     := 1 + COALESCE(NEW.gn_completes, 0);

  RETURN NEW;
END;
$function$;


-- 3. Remplacer l'ancien trigger par le nouveau (couvre race + GN/mini/ouv)
DROP TRIGGER IF EXISTS trg_set_xp_initial ON public.personnages;
DROP TRIGGER IF EXISTS trg_recalculer_xp_complet ON public.personnages;

CREATE TRIGGER trg_recalculer_xp_complet
  BEFORE INSERT OR UPDATE OF race_id, gn_completes, mini_gn_completes, ouvertures_terrain
  ON public.personnages
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculer_xp_complet_trigger();


-- 4. sync_xp_personnage : persister aussi niveau
CREATE OR REPLACE FUNCTION public.sync_xp_personnage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_personnage_id uuid;
  v_calc          jsonb;
BEGIN
  v_personnage_id := COALESCE(NEW.personnage_id, OLD.personnage_id);

  PERFORM 1 FROM public.personnages WHERE id = v_personnage_id;
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_calc := public.recalculer_xp_personnage(v_personnage_id);

  IF (v_calc->>'xp_depense')::integer > (v_calc->>'xp_total')::integer THEN
    RAISE WARNING 'sync_xp_personnage: anomalie pour personnage % — xp_depense=% > xp_total=%',
      v_personnage_id, v_calc->>'xp_depense', v_calc->>'xp_total';
  END IF;

  UPDATE public.personnages
  SET xp_total   = (v_calc->>'xp_total')::integer,
      xp_depense = (v_calc->>'xp_depense')::integer,
      niveau     = (v_calc->>'niveau')::integer
  WHERE id = v_personnage_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;


-- 5. Drop l'ancienne fonction (plus appelée)
DROP FUNCTION IF EXISTS public.set_xp_initial_on_race_change();


-- 6. Data fix : forcer le recalcul sur tous les persos existants
-- (UPDATE no-op qui déclenche le trigger trg_recalculer_xp_complet)
UPDATE public.personnages
SET gn_completes = gn_completes;
