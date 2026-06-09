-- AUDIT-ADMIN-MODE-ROLE (JOURNAL-AUDIT-PHASE2, fix A)
-- Le canal "admin mode" est signale par le header de requete x-hv-canal=admin
-- (pose par le client supabaseAdmin du wizard quand ?admin=1).
-- Effet : une action faite en admin mode sur SON PROPRE perso est taguee
-- acteur_role='admin' (donc visible au feed staff via vue_journal_staff)
-- au lieu de 'proprietaire'. Garde-fou : sans effet si NOT est_admin().
-- details.canal='admin_mode' ajoute pour tracabilite.
CREATE OR REPLACE FUNCTION public.log_audit(p_cible_type text, p_cible_id uuid, p_action text, p_details jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid          uuid := auth.uid();
  v_role         text;
  v_joueur_id    uuid;
  v_id           uuid;
  v_canal_admin  boolean := false;
  v_details      jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;  -- pas d'acteur authentifie -> on ne loggue pas
  END IF;

  -- canal admin via header de requete, valide uniquement si reellement admin
  v_canal_admin := COALESCE(
    (current_setting('request.headers', true)::json ->> 'x-hv-canal') = 'admin',
    false
  ) AND public.est_admin();

  IF p_cible_type = 'personnage' THEN
    SELECT joueur_id INTO v_joueur_id FROM public.personnages WHERE id = p_cible_id;
    IF v_canal_admin THEN
      v_role := 'admin';  -- admin mode prime sur la propriete
    ELSIF v_joueur_id IS NOT NULL AND public.compte_voit_joueur(v_joueur_id) THEN
      v_role := 'proprietaire';
    ELSIF public.est_admin() THEN
      v_role := 'admin';
    ELSIF public.est_animateur_ou_admin() THEN
      v_role := 'animateur';
    ELSE
      v_role := 'autre';
    END IF;
  ELSE
    IF v_canal_admin OR public.est_admin() THEN
      v_role := 'admin';
    ELSIF public.est_animateur_ou_admin() THEN
      v_role := 'animateur';
    ELSE
      v_role := 'autre';
    END IF;
  END IF;

  v_details := COALESCE(p_details, '{}'::jsonb);
  IF v_canal_admin THEN
    v_details := v_details || jsonb_build_object('canal', 'admin_mode');
  END IF;

  INSERT INTO public.journal_audit (acteur_id, acteur_role, cible_type, cible_id, action, details)
  VALUES (v_uid, v_role, p_cible_type, p_cible_id, p_action, v_details)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;
