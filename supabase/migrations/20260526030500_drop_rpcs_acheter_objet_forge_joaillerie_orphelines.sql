-- Drop RPCs orphelines : acheter_objet_forge et acheter_objet_joaillerie.
-- Confirmees non appelees par le code applicatif (audit grep session 37).
-- Idempotent : DROP IF EXISTS gere le cas ou elles seraient deja supprimees.
-- Resout dette AUDIT-RPC-ACHETER-OBJET-FORGE-JOAILLERIE.

DROP FUNCTION IF EXISTS public.acheter_objet_forge(uuid, uuid);
DROP FUNCTION IF EXISTS public.acheter_objet_joaillerie(uuid, uuid);
