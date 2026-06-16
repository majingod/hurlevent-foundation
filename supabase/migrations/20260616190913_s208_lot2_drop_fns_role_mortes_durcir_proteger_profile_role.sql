-- s208 LOT 2 : ménage DB rôles
-- 1) DROP 2 fonctions rôle mortes (0 ref DB/front, remplacées par changer_role_compte)
-- 2) Durcir proteger_profile_role() : ajout SET search_path TO 'public' (aucun changement de logique)

DROP FUNCTION IF EXISTS public.changer_role_utilisateur(uuid, text);
DROP FUNCTION IF EXISTS public.update_user_role(uuid, text);

CREATE OR REPLACE FUNCTION public.proteger_profile_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_role text;
BEGIN
  -- Si l'opération est effectuée par le superuser, autoriser sans vérification.
  IF current_user IN ('postgres', 'supabase_admin') OR session_user IN ('postgres', 'supabase_admin') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.role := COALESCE(NEW.role, 'joueur');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL OR NEW.id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Création de profil non autorisée' USING ERRCODE = '42501';
    END IF;
    NEW.role := 'joueur';
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Modification de l''identifiant profil non autorisée' USING ERRCODE = '42501';
    END IF;

    SELECT role INTO v_actor_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF auth.uid() = OLD.id AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Modification de votre propre rôle non autorisée' USING ERRCODE = '42501';
    END IF;

    IF COALESCE(v_actor_role, 'joueur') NOT IN ('admin', 'animateur')
       AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Modification du rôle non autorisée' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;
