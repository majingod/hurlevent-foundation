CREATE OR REPLACE FUNCTION public.role_du_profil(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_catalog
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id
$$;

DROP POLICY IF EXISTS "Lecture profil" ON public.profiles;
CREATE POLICY "Lecture profil"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND ((auth.uid() = id) OR public.est_animateur_ou_admin()));

DROP POLICY IF EXISTS "Modification profil" ON public.profiles;
CREATE POLICY "Modification profil"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL AND ((auth.uid() = id) OR public.est_animateur_ou_admin()))
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    (auth.uid() = id AND role = public.role_du_profil(auth.uid()))
    OR public.est_animateur_ou_admin()
  )
);