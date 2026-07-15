-- s334 : [CGU-CONSENT] consentement aux conditions d'utilisation, par compte (titulaire adulte).
-- 1. Source unique de la version en vigueur : parametres_jeu.cgu_version_en_vigueur.
-- 2. Trace d'acceptation sur profiles (version + date) — l'historique détaillé va au journal_audit.
-- 3. Trigger d'inscription enrichi : copie l'acceptation transmise dans les métadonnées du signup.
--    NOTE ACL : fonction trigger (RETURNS trigger), inappelable via l'API PostgREST par nature ;
--    ACL par défaut volontairement conservée (ne pas resserrer à l'aveugle un trigger auth qui fonctionne).
-- 4. RPC accepter_cgu(p_version) : guichet pour les comptes existants (modale à la connexion).
--    Patron VIS-5 : auth -> validation -> UPDATE -> audit. ACL verrouillée (A37).
-- Idempotent : ADD COLUMN IF NOT EXISTS, UPDATE conditionnel, CREATE OR REPLACE.

ALTER TABLE public.parametres_jeu ADD COLUMN IF NOT EXISTS cgu_version_en_vigueur text;
UPDATE public.parametres_jeu SET cgu_version_en_vigueur = '2026-07-14' WHERE cgu_version_en_vigueur IS NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cgu_version_acceptee text,
  ADD COLUMN IF NOT EXISTS cgu_acceptee_le timestamptz;

CREATE OR REPLACE FUNCTION public.creer_profil_nouveau_joueur()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, username, nom_affichage, role, is_active, cgu_version_acceptee, cgu_acceptee_le)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'joueur',
    true,
    NEW.raw_user_meta_data->>'cgu_version_acceptee',
    CASE WHEN NEW.raw_user_meta_data->>'cgu_version_acceptee' IS NOT NULL THEN now() END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accepter_cgu(p_version text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_en_vigueur text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','AUTH_REQUISE','message','Connexion requise.')),
      'avertissements', '[]'::jsonb,
      'donnees', NULL
    );
  END IF;

  SELECT cgu_version_en_vigueur INTO v_en_vigueur FROM public.parametres_jeu LIMIT 1;

  IF v_en_vigueur IS NULL THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','CONFIG_MANQUANTE','message','Aucune version des conditions n''est configurée.')),
      'avertissements', '[]'::jsonb,
      'donnees', NULL
    );
  END IF;

  IF p_version IS DISTINCT FROM v_en_vigueur THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','VERSION_OBSOLETE','message','La version acceptée ne correspond pas à la version en vigueur.')),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('version_en_vigueur', v_en_vigueur)
    );
  END IF;

  UPDATE public.profiles
     SET cgu_version_acceptee = p_version,
         cgu_acceptee_le = now()
   WHERE id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','PROFIL_INTROUVABLE','message','Profil de compte introuvable.')),
      'avertissements', '[]'::jsonb,
      'donnees', NULL
    );
  END IF;

  PERFORM public.log_audit('compte', v_uid, 'cgu_acceptees', jsonb_build_object('version', p_version));

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('version', p_version)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.accepter_cgu(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accepter_cgu(text) TO authenticated;
