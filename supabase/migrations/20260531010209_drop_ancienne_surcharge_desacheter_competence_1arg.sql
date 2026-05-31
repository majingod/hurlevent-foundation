-- Hotfix : retire l'ancienne surcharge desacheter_competence(uuid) restée en base.
-- La migration 20260531002024 a fait CREATE OR REPLACE avec une nouvelle signature
-- (ajout de p_dry_run) -> Postgres a créé une 2e fonction au lieu de remplacer.
-- Les deux coexistaient -> PostgREST « Could not choose the best candidate function »
-- sur les appels à 1 argument. On garde uniquement la version (uuid, boolean DEFAULT false),
-- qui couvre aussi les appels à 1 argument (p_dry_run par défaut).
DROP FUNCTION IF EXISTS public.desacheter_competence(uuid);
