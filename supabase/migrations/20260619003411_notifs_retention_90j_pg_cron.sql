-- RÉTENTION-NOTIFS : purge auto des notifications LUES de plus de 90 jours.
-- Les non-lues ne sont jamais purgées par le temps (un joueur inactif ne rate rien).
-- Le journal d'audit reste la mémoire permanente des événements.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Fonction de purge (idempotente, signature inchangée -> CREATE OR REPLACE safe).
CREATE OR REPLACE FUNCTION public.purger_notifications_anciennes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nb integer;
BEGIN
  DELETE FROM public.notifications
  WHERE lu = true
    AND created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_nb = ROW_COUNT;
  RETURN v_nb;
END;
$function$;

-- Ne pas exposer la purge aux clients : seul le cron (postgres) la déclenche.
REVOKE EXECUTE ON FUNCTION public.purger_notifications_anciennes() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purger_notifications_anciennes() FROM anon, authenticated;

-- Planification quotidienne (04:17). cron.schedule upsert par nom -> idempotent.
SELECT cron.schedule(
  'purge_notifications_90j',
  '17 4 * * *',
  $cmd$SELECT public.purger_notifications_anciennes();$cmd$
);
