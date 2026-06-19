CREATE OR REPLACE FUNCTION public.trg_bloquer_desinscription_fenetre_gel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_date timestamptz; v_termine boolean;
BEGIN
  IF auth.uid() IS NULL OR public.est_admin() THEN
    RETURN OLD;
  END IF;
  SELECT date_evenement, est_termine INTO v_date, v_termine
  FROM public.evenements WHERE id = OLD.evenement_id;
  IF v_termine = false AND v_date IS NOT NULL
     AND (v_date - interval '24 hours') <= now()
     AND OLD.statut IN ('en_attente','present') THEN
    RAISE EXCEPTION 'Desinscription impossible : l''evenement commence dans moins de 24 h. Le personnage reste verrouille jusqu''a la confirmation des presences.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$function$;
