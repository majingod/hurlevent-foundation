-- Durcit mode_staff_serveur_actif() : ne JAMAIS lever d'exception sur un
-- request.headers vide/absent/invalide (contexte Realtime/walrus, pg_cron,
-- edge service-role). '' ::json levait `invalid input syntax for type json`,
-- ce qui faisait planter la policy RLS "Lecture notifications" lors de
-- l'évaluation par le moteur temps réel sur le lot fan-out staff → événement
-- silencieusement droppé → cloche « Organisation » non incrémentée en direct.
-- Parse défensif : headers vide/invalide → NULL → retour false (= comportement
-- voulu hors HTTP, cf D7). Aucun changement de comportement en contexte HTTP
-- (un vrai JSON parse à l'identique). Signature inchangée (sûr, A2/D7).
CREATE OR REPLACE FUNCTION public.mode_staff_serveur_actif()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_headers json;
BEGIN
  -- Parse tolérant : '' ou JSON invalide → NULL (jamais d'exception).
  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN
    v_headers := NULL;
  END;

  -- Aucun contexte d'en-tête exploitable → pas de canal staff.
  IF v_headers IS NULL THEN
    RETURN false;
  END IF;

  RETURN
    -- (3) canal staff présent
    COALESCE((v_headers ->> 'x-hv-canal') = 'admin', false)
    -- (2) le profil actif (header) est bien le profil principal du compte courant
    AND EXISTS (
      SELECT 1 FROM profils_joueur
      WHERE id = NULLIF(v_headers ->> 'x-hv-profil-actif', '')::uuid
        AND compte_id = auth.uid()
        AND est_principal
    );
END;
$function$;
