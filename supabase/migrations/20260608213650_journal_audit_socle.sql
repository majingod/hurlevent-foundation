-- PR1 JOURNAL-AUDIT : socle DB (table + RLS + helpers + log_audit + 2 vues).
-- Additif, aucun changement de comportement (rien n'appelle log_audit avant PR2).

-- ── Helpers ──
CREATE OR REPLACE FUNCTION public.est_admin()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.peut_editer_personnage(p_joueur_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  RETURN public.compte_voit_joueur(p_joueur_id) OR public.est_admin();
END;
$fn$;

-- ── Table ──
CREATE TABLE IF NOT EXISTS public.journal_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acteur_id   uuid NOT NULL,
  acteur_role text NOT NULL CHECK (acteur_role IN ('proprietaire','admin','animateur','autre')),
  cible_type  text NOT NULL,
  cible_id    uuid NOT NULL,
  action      text NOT NULL,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_audit_cible  ON public.journal_audit (cible_type, cible_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_audit_acteur ON public.journal_audit (acteur_id, created_at DESC);

ALTER TABLE public.journal_audit ENABLE ROW LEVEL SECURITY;

-- ── RLS (lecture seule ; écriture uniquement via log_audit SECURITY DEFINER) ──
DROP POLICY IF EXISTS journal_audit_select_proprietaire ON public.journal_audit;
CREATE POLICY journal_audit_select_proprietaire ON public.journal_audit
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND cible_type = 'personnage'
    AND EXISTS (
      SELECT 1 FROM public.personnages p
      WHERE p.id = journal_audit.cible_id
        AND public.compte_voit_joueur(p.joueur_id)
    )
  );

DROP POLICY IF EXISTS journal_audit_select_staff ON public.journal_audit;
CREATE POLICY journal_audit_select_staff ON public.journal_audit
  FOR SELECT TO authenticated
  USING (public.est_animateur_ou_admin());

GRANT SELECT ON public.journal_audit TO authenticated;

-- ── Helper d'écriture ──
CREATE OR REPLACE FUNCTION public.log_audit(
  p_cible_type text,
  p_cible_id   uuid,
  p_action     text,
  p_details    jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid       uuid := auth.uid();
  v_role      text;
  v_joueur_id uuid;
  v_id        uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;  -- pas d'acteur authentifié → on ne loggue pas
  END IF;

  IF p_cible_type = 'personnage' THEN
    SELECT joueur_id INTO v_joueur_id FROM public.personnages WHERE id = p_cible_id;
    IF v_joueur_id IS NOT NULL AND public.compte_voit_joueur(v_joueur_id) THEN
      v_role := 'proprietaire';
    ELSIF public.est_admin() THEN
      v_role := 'admin';
    ELSIF public.est_animateur_ou_admin() THEN
      v_role := 'animateur';
    ELSE
      v_role := 'autre';
    END IF;
  ELSE
    IF public.est_admin() THEN
      v_role := 'admin';
    ELSIF public.est_animateur_ou_admin() THEN
      v_role := 'animateur';
    ELSE
      v_role := 'autre';
    END IF;
  END IF;

  INSERT INTO public.journal_audit (acteur_id, acteur_role, cible_type, cible_id, action, details)
  VALUES (v_uid, v_role, p_cible_type, p_cible_id, p_action, COALESCE(p_details, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

-- log_audit NON accordé à authenticated : appelé uniquement par d'autres RPC SECURITY DEFINER.
REVOKE EXECUTE ON FUNCTION public.log_audit(text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.est_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.peut_editer_personnage(uuid) TO authenticated;

-- ── Vues (security_invoker → respectent la RLS de la table) ──
CREATE OR REPLACE VIEW public.vue_journal_proprietaire
  WITH (security_invoker = true) AS
  SELECT * FROM public.journal_audit WHERE acteur_role = 'proprietaire';

CREATE OR REPLACE VIEW public.vue_journal_staff
  WITH (security_invoker = true) AS
  SELECT * FROM public.journal_audit WHERE acteur_role <> 'proprietaire';

GRANT SELECT ON public.vue_journal_proprietaire TO authenticated;
GRANT SELECT ON public.vue_journal_staff TO authenticated;
