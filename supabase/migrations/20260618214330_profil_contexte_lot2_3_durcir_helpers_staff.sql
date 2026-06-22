-- PROFIL-CONTEXTE Lot 2.3 — durcir les 2 helpers de capability staff.
-- La barrière « rôle staff par profil » (3 conditions) se propage aux
-- 61 RLS + 27 fonctions qui appellent ces helpers, sans les toucher.
--   (1) capability : profiles.role de auth.uid()
--   (2) profil actif (header x-hv-profil-actif) = profil PRINCIPAL du compte
--   (3) canal staff : header x-hv-canal = 'admin'
-- Conditions (2)+(3) factorisées dans mode_staff_serveur_actif() (source unique).
-- NEUTRE jusqu'ici (front 2.2 envoie déjà les headers) : un staff doit être sur
-- son principal + interrupteur « Mode animation » ON pour exercer ses droits.

-- (Source unique des conditions 2+3)
CREATE OR REPLACE FUNCTION public.mode_staff_serveur_actif()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN
    -- (3) canal staff présent
    COALESCE(
      (current_setting('request.headers', true)::json ->> 'x-hv-canal') = 'admin',
      false
    )
    -- (2) le profil actif (header) est bien le profil principal du compte courant
    AND EXISTS (
      SELECT 1 FROM profils_joueur
      WHERE id = NULLIF(current_setting('request.headers', true)::json ->> 'x-hv-profil-actif', '')::uuid
        AND compte_id = auth.uid()
        AND est_principal
    );
END;
$function$;

-- est_admin : capability admin ∧ canal staff ouvert via le principal
CREATE OR REPLACE FUNCTION public.est_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
     AND public.mode_staff_serveur_actif();
END;
$function$;

-- est_animateur_ou_admin : capability staff ∧ canal staff ouvert via le principal
CREATE OR REPLACE FUNCTION public.est_animateur_ou_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('animateur', 'admin')
    )
    AND public.mode_staff_serveur_actif();
END;
$function$;
