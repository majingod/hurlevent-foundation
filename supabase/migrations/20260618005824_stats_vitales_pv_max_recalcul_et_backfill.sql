-- Stats vitales — PV max dérivé de la classe (Option 1 : PV = pv_depart, aucun bonus permanent).
-- Réplique le pattern des PS (recalculer_ps_max + trigger sur changement de classe),
-- version simplifiée : le PV ne dépend que de la classe (pas des compétences).

CREATE OR REPLACE FUNCTION public.recalculer_pv_max(p_personnage_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pv_depart integer;
BEGIN
  SELECT COALESCE(c.pv_depart, 4) INTO v_pv_depart
  FROM personnages p
  LEFT JOIN classes c ON c.id = p.classe_id
  WHERE p.id = p_personnage_id;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE personnages SET pv_max = v_pv_depart WHERE id = p_personnage_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_recalculer_pv_max_sur_classe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM recalculer_pv_max(NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_recalculer_pv_max_classe ON public.personnages;
CREATE TRIGGER trg_recalculer_pv_max_classe
AFTER UPDATE OF classe_id ON public.personnages
FOR EACH ROW
WHEN (new.classe_id IS DISTINCT FROM old.classe_id)
EXECUTE FUNCTION trg_recalculer_pv_max_sur_classe();

-- Backfill des persos existants (même logique que la fonction → DRY)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM personnages LOOP
    PERFORM recalculer_pv_max(r.id);
  END LOOP;
END $$;
