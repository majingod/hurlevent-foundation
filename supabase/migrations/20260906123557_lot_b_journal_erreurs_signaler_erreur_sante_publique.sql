-- s409 · Lot B, moitié base : le filet
--
-- Ferme (avec la moitié front) [UI-SANS-FILET] et [SANTE-NON-SURVEILLEE].
-- Trois objets neufs, aucun RENAME, aucun objet existant touché (C119 : rien à
-- balayer, vérifié — la migration ne fait que créer).
--
-- 1. journal_erreurs — les erreurs que le front rencontre. ⛔ Aucune PII (Loi 25) :
--    ni user_id, ni IP, ni nom. La route perd sa query string, le message perd
--    les courriels, tout est borné. RLS active SANS policy (patron
--    journal_generateur_accueil, s394) : personne ne lit par l'API, seuls
--    postgres et service_role voient la table.
-- 2. signaler_erreur(route, message, version) — SECURITY DEFINER, appelable par
--    anon et authenticated (le mode visiteur plante aussi). Fail-closed contre
--    l'abus : même triplet dans la minute → ignoré ; plus de 120 lignes dans la
--    minute → ignoré. Purge à 30 jours à chaque appel (rétention minimale, sans
--    dépendre d'un cron). Ne renvoie rien : rien à lire côté client.
-- 3. sante_publique() — STABLE, comptes seuls, 0 PII, appelable avec la clé
--    publishable : invariants xp/pv/ps (les vrais verifier_invariant_*), verrous
--    fixtures anon/auth, DEFINER lisant personnages accordées à anon, couples
--    C119, erreurs des 24 h, migrations. Un workflow GitHub quotidien l'appelle.
--
-- Repli : DROP FUNCTION public.sante_publique(); DROP FUNCTION
-- public.signaler_erreur(text,text,text); DROP TABLE public.journal_erreurs;

-- ── 1. journal_erreurs ─────────────────────────────────────────────────────
CREATE TABLE public.journal_erreurs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  route       text        NOT NULL,
  message     text        NOT NULL,
  version     text        NOT NULL DEFAULT '',
  user_agent  text        NOT NULL DEFAULT '',
  CONSTRAINT journal_erreurs_route_len   CHECK (char_length(route)      <= 200),
  CONSTRAINT journal_erreurs_message_len CHECK (char_length(message)    <= 500),
  CONSTRAINT journal_erreurs_version_len CHECK (char_length(version)    <= 40),
  CONSTRAINT journal_erreurs_ua_len      CHECK (char_length(user_agent) <= 200)
);
COMMENT ON TABLE public.journal_erreurs IS
  's409 · erreurs rencontrées par le front. Aucune PII (Loi 25). Écriture par signaler_erreur() seulement ; lecture postgres/service_role seulement. Purge à 30 jours.';

CREATE INDEX journal_erreurs_created_at_idx ON public.journal_erreurs (created_at);

ALTER TABLE public.journal_erreurs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.journal_erreurs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.journal_erreurs TO service_role;

-- ── 2. signaler_erreur ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.signaler_erreur(route text, message text, version text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_route   text;
  v_message text;
  v_version text;
  v_ua      text;
  v_hdrs    json;
BEGIN
  -- bornes et minimisation (Loi 25)
  v_route   := left(split_part(coalesce(route, ''), '?', 1), 200);
  v_message := left(regexp_replace(coalesce(message, ''),
                 '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}', '[courriel]', 'g'), 500);
  v_version := left(coalesce(version, ''), 40);
  BEGIN
    v_hdrs := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    v_hdrs := NULL;
  END;
  v_ua := left(coalesce(v_hdrs ->> 'user-agent', ''), 200);

  IF v_route = '' OR v_message = '' THEN RETURN; END IF;

  -- purge : rétention 30 jours
  DELETE FROM public.journal_erreurs WHERE created_at < now() - interval '30 days';

  -- anti-rafale, fail-closed : on ignore plutôt que de remplir
  IF (SELECT count(*) FROM public.journal_erreurs WHERE created_at > now() - interval '1 minute') >= 120 THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.journal_erreurs je
             WHERE je.created_at > now() - interval '1 minute'
               AND je.route = v_route AND je.message = v_message AND je.version = v_version) THEN
    RETURN;
  END IF;

  INSERT INTO public.journal_erreurs AS je (route, message, version, user_agent)
  VALUES (v_route, v_message, v_version, v_ua);
END
$fn$;

REVOKE ALL ON FUNCTION public.signaler_erreur(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.signaler_erreur(text, text, text) TO anon, authenticated, service_role;

-- ── 3. sante_publique ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sante_publique()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_inv_xp int; v_inv_pv int; v_inv_ps int;
  v_fix_anon int; v_fix_auth int; v_fix_total int;
  v_definer_anon int;
  v_c119 int;
  v_err_24h int;
  v_mig int; v_head text;
BEGIN
  SELECT count(*) INTO v_inv_xp FROM public.verifier_invariant_xp();
  SELECT count(*) INTO v_inv_pv FROM public.verifier_invariant_pv();
  SELECT count(*) INTO v_inv_ps FROM public.verifier_invariant_ps();

  SELECT count(*) FILTER (WHERE has_function_privilege('anon',          p.oid, 'EXECUTE')),
         count(*) FILTER (WHERE has_function_privilege('authenticated', p.oid, 'EXECUTE')),
         count(*)
    INTO v_fix_anon, v_fix_auth, v_fix_total
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname LIKE 'fixtures\_%';

  SELECT count(*) INTO v_definer_anon
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef AND p.prosrc LIKE '%personnages%'
     AND p.proname <> 'sante_publique'   -- son propre corps porte le motif : s'exclure
     AND has_function_privilege('anon', p.oid, 'EXECUTE');

  -- C119 : vues security_invoker lisibles par authenticated qui appellent une
  -- fonction où authenticated n'a pas EXECUTE. Attendu 0.
  SELECT count(*) INTO v_c119 FROM (
    SELECT DISTINCT c.relname, p.proname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_rewrite r ON r.ev_class = c.oid
      JOIN pg_depend d ON d.objid = r.oid AND d.classid = 'pg_rewrite'::regclass
      JOIN pg_proc p ON p.oid = d.refobjid AND d.refclassid = 'pg_proc'::regclass
      JOIN pg_namespace pn ON pn.oid = p.pronamespace AND pn.nspname = 'public'
     WHERE n.nspname = 'public' AND c.relkind = 'v'
       AND EXISTS (SELECT 1 FROM unnest(coalesce(c.reloptions, '{}')) o
                    WHERE o IN ('security_invoker=on', 'security_invoker=true'))
       AND has_table_privilege('authenticated', c.oid, 'SELECT')
       AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) x;

  SELECT count(*) INTO v_err_24h FROM public.journal_erreurs
   WHERE created_at > now() - interval '24 hours';

  SELECT count(*), max(version) INTO v_mig, v_head FROM supabase_migrations.schema_migrations;

  RETURN jsonb_build_object(
    'mesure_le',     now(),
    'invariants',    jsonb_build_object('xp', v_inv_xp, 'pv', v_inv_pv, 'ps', v_inv_ps),
    'fixtures',      jsonb_build_object('anon', v_fix_anon, 'authenticated', v_fix_auth, 'total', v_fix_total),
    'definer_anon',  v_definer_anon,
    'c119_rouges',   v_c119,
    'erreurs_24h',   v_err_24h,
    'migrations',    jsonb_build_object('n', v_mig, 'head', v_head)
  );
END
$fn$;

REVOKE ALL ON FUNCTION public.sante_publique() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sante_publique() TO anon, authenticated, service_role;
