-- =====================================================================
-- CIMETIÈRE DES HÉROS (s248)
-- Table cimetiere (stèle figée autonome) + flux demande-mort (calque demande-race)
-- + RPC + vues + RLS. Idempotent.
-- =====================================================================

-- 0) Élargir le CHECK des types de notification (Gotcha A22) -----------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'info','validation_race','validation_maitre','xp','evenement',
    'demande_race_nouvelle','race_approuvee','race_refusee','banque','rabais_acquisition',
    'demande_mort_nouvelle','mort_approuvee','mort_refusee'
  ]));

-- 1) Table cimetiere (stèle figée, autonome, survit à la purge) --------
CREATE TABLE IF NOT EXISTS public.cimetiere (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnage_id_origine uuid,                       -- info seule, AUCUNE FK dure
  nom                   text NOT NULL,
  race                  text NOT NULL,
  classe                text,
  niveau                int,
  date_mort             timestamptz NOT NULL DEFAULT now(),
  epitaphe              text,
  snapshot              jsonb NOT NULL,
  cree_par              uuid,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- 2) Table personnage_morts_demandes (workflow, calque demande-race) ---
CREATE TABLE IF NOT EXISTS public.personnage_morts_demandes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnage_id    uuid NOT NULL REFERENCES public.personnages(id) ON DELETE CASCADE,
  epitaphe         text,
  statut           text NOT NULL DEFAULT 'en_attente',
  raison_refus     text,
  approuve_par     uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  date_approbation timestamptz
);

-- 1 seule demande en attente par perso
CREATE UNIQUE INDEX IF NOT EXISTS uq_morts_demande_en_attente
  ON public.personnage_morts_demandes (personnage_id)
  WHERE statut = 'en_attente';

-- 3) RLS ---------------------------------------------------------------
ALTER TABLE public.cimetiere ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cimetiere_select_public ON public.cimetiere;
CREATE POLICY cimetiere_select_public ON public.cimetiere
  FOR SELECT TO authenticated USING (true);
-- pas de policy write : tout passe par RPC SECURITY DEFINER

ALTER TABLE public.personnage_morts_demandes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS morts_demandes_select ON public.personnage_morts_demandes;
CREATE POLICY morts_demandes_select ON public.personnage_morts_demandes
  FOR SELECT TO authenticated USING (
    est_animateur_ou_admin()
    OR EXISTS (
      SELECT 1 FROM public.personnages p
      WHERE p.id = personnage_morts_demandes.personnage_id
        AND public.peut_editer_personnage(p.joueur_id)
    )
  );

-- 4) Helper interne : figer la stèle (réutilisable, dont futur avant-purge)
CREATE OR REPLACE FUNCTION public._figer_stele(
  p_personnage_id uuid, p_epitaphe text, p_cree_par uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_snapshot jsonb; v_nom text; v_race text; v_classe text; v_niveau int;
  v_id uuid;
BEGIN
  SELECT to_jsonb(f.*), f.nom, f.race_nom, f.classe_nom, f.niveau
    INTO v_snapshot, v_nom, v_race, v_classe, v_niveau
    FROM public.vue_fiche_personnage f WHERE f.id = p_personnage_id;
  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Personnage introuvable pour la stèle: %', p_personnage_id;
  END IF;

  INSERT INTO public.cimetiere (personnage_id_origine, nom, race, classe, niveau, epitaphe, snapshot, cree_par)
  VALUES (p_personnage_id, v_nom, v_race, v_classe, v_niveau,
          NULLIF(trim(COALESCE(p_epitaphe,'')),''), v_snapshot, p_cree_par)
  RETURNING id INTO v_id;

  UPDATE public.personnages SET est_mort = true WHERE id = p_personnage_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._figer_stele(uuid, text, uuid) FROM PUBLIC;

-- 5) RPC joueur : créer une demande de mort ----------------------------
CREATE OR REPLACE FUNCTION public.creer_demande_mort(
  p_personnage_id uuid, p_epitaphe text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_p RECORD; v_demande_id uuid;
BEGIN
  SELECT * INTO v_p FROM public.personnages WHERE id = p_personnage_id;
  IF v_p IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Personnage introuvable');
  END IF;
  IF NOT public.peut_editer_personnage(v_p.joueur_id) THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Accès refusé');
  END IF;
  IF v_p.est_mort THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Ce personnage est déjà au Cimetière');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inscriptions_evenements
                 WHERE personnage_id = p_personnage_id AND statut = 'present') THEN
    RETURN jsonb_build_object('succes', false,
      'erreur', 'Ce personnage doit avoir participé à au moins un événement');
  END IF;
  IF EXISTS (SELECT 1 FROM public.personnage_morts_demandes
             WHERE personnage_id = p_personnage_id AND statut = 'en_attente') THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Une demande est déjà en attente');
  END IF;

  INSERT INTO public.personnage_morts_demandes (personnage_id, epitaphe)
  VALUES (p_personnage_id, NULLIF(trim(COALESCE(p_epitaphe,'')),''))
  RETURNING id INTO v_demande_id;

  PERFORM public.creer_notification_staff(
    p_message := format('⚰️ Nouvelle demande de mort pour le personnage "%s"', v_p.nom),
    p_type := 'demande_mort_nouvelle',
    p_reference_id := v_demande_id);

  PERFORM public.log_audit('personnage', p_personnage_id, 'creer_demande_mort',
    jsonb_build_object('demande_id', v_demande_id, 'nom', v_p.nom));

  RETURN jsonb_build_object('succes', true,
    'message', 'Demande envoyée. Le staff va l''examiner.', 'demande_id', v_demande_id);
END;
$$;

-- 6) RPC staff : approuver une demande de mort -------------------------
CREATE OR REPLACE FUNCTION public.approuver_mort_demande(
  p_demande_id uuid, p_epitaphe_finale text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_d RECORD; v_p RECORD; v_epitaphe text; v_cim_id uuid;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Seuls les administrateurs peuvent approuver');
  END IF;
  SELECT * INTO v_d FROM public.personnage_morts_demandes WHERE id = p_demande_id;
  IF v_d IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Demande introuvable');
  END IF;
  IF v_d.statut <> 'en_attente' THEN
    RETURN jsonb_build_object('succes', false, 'erreur', format('Cette demande est déjà %s', v_d.statut));
  END IF;

  SELECT * INTO v_p FROM public.personnages WHERE id = v_d.personnage_id;
  v_epitaphe := COALESCE(NULLIF(trim(COALESCE(p_epitaphe_finale,'')),''), v_d.epitaphe);

  v_cim_id := public._figer_stele(v_d.personnage_id, v_epitaphe, auth.uid());

  UPDATE public.personnage_morts_demandes
    SET statut = 'approuvee', approuve_par = auth.uid(), date_approbation = now(), updated_at = now()
    WHERE id = p_demande_id;

  PERFORM public.creer_notification(
    p_message := format('⚰️ Votre personnage "%s" repose désormais au Cimetière des Héros.', v_p.nom),
    p_type := 'mort_approuvee',
    p_profil_id := v_p.joueur_id,
    p_reference_id := v_cim_id,
    p_statut := 'non_traite');

  PERFORM public.log_audit('personnage', v_d.personnage_id, 'approuver_mort',
    jsonb_build_object('demande_id', p_demande_id, 'cimetiere_id', v_cim_id, 'nom', v_p.nom));

  RETURN jsonb_build_object('succes', true,
    'message', format('"%s" envoyé au Cimetière.', v_p.nom), 'cimetiere_id', v_cim_id);
END;
$$;

-- 7) RPC staff : refuser une demande de mort ---------------------------
CREATE OR REPLACE FUNCTION public.refuser_mort_demande(
  p_demande_id uuid, p_raison text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_d RECORD; v_p RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Seuls les administrateurs peuvent refuser');
  END IF;
  SELECT * INTO v_d FROM public.personnage_morts_demandes WHERE id = p_demande_id;
  IF v_d IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Demande introuvable');
  END IF;
  IF v_d.statut <> 'en_attente' THEN
    RETURN jsonb_build_object('succes', false, 'erreur', format('Cette demande est déjà %s', v_d.statut));
  END IF;

  SELECT * INTO v_p FROM public.personnages WHERE id = v_d.personnage_id;

  UPDATE public.personnage_morts_demandes
    SET statut = 'refusee', raison_refus = NULLIF(trim(COALESCE(p_raison,'')),''),
        approuve_par = auth.uid(), date_approbation = now(), updated_at = now()
    WHERE id = p_demande_id;

  PERFORM public.creer_notification(
    p_message := format('Votre demande de mort pour "%s" a été refusée.%s',
      v_p.nom, COALESCE(' Raison : '||NULLIF(trim(COALESCE(p_raison,'')),''), '')),
    p_type := 'mort_refusee',
    p_profil_id := v_p.joueur_id,
    p_reference_id := p_demande_id,
    p_statut := 'non_traite');

  PERFORM public.log_audit('personnage', v_d.personnage_id, 'refuser_mort',
    jsonb_build_object('demande_id', p_demande_id, 'nom', v_p.nom, 'raison', p_raison));

  RETURN jsonb_build_object('succes', true, 'message', 'Demande refusée.');
END;
$$;

-- 8) RPC staff : créer une stèle directement (D1-B, sans demande) ------
CREATE OR REPLACE FUNCTION public.creer_stele_directe(
  p_personnage_id uuid, p_epitaphe text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_p RECORD; v_cim_id uuid;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Réservé au staff');
  END IF;
  SELECT * INTO v_p FROM public.personnages WHERE id = p_personnage_id;
  IF v_p IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Personnage introuvable');
  END IF;
  IF v_p.est_mort THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Ce personnage est déjà au Cimetière');
  END IF;

  v_cim_id := public._figer_stele(p_personnage_id, p_epitaphe, auth.uid());

  PERFORM public.creer_notification(
    p_message := format('⚰️ Votre personnage "%s" repose désormais au Cimetière des Héros.', v_p.nom),
    p_type := 'mort_approuvee',
    p_profil_id := v_p.joueur_id,
    p_reference_id := v_cim_id,
    p_statut := 'non_traite');

  PERFORM public.log_audit('personnage', p_personnage_id, 'creer_stele_directe',
    jsonb_build_object('cimetiere_id', v_cim_id, 'nom', v_p.nom));

  RETURN jsonb_build_object('succes', true,
    'message', format('"%s" envoyé au Cimetière.', v_p.nom), 'cimetiere_id', v_cim_id);
END;
$$;

-- 9) RPC staff : modifier une stèle ------------------------------------
CREATE OR REPLACE FUNCTION public.modifier_stele(
  p_cimetiere_id uuid, p_epitaphe text DEFAULT NULL, p_date_mort timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_s RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Réservé au staff');
  END IF;
  SELECT * INTO v_s FROM public.cimetiere WHERE id = p_cimetiere_id;
  IF v_s IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Stèle introuvable');
  END IF;

  UPDATE public.cimetiere
    SET epitaphe  = COALESCE(p_epitaphe, epitaphe),
        date_mort = COALESCE(p_date_mort, date_mort)
    WHERE id = p_cimetiere_id;

  PERFORM public.log_audit('personnage', v_s.personnage_id_origine, 'modifier_stele',
    jsonb_build_object('cimetiere_id', p_cimetiere_id, 'nom', v_s.nom));

  RETURN jsonb_build_object('succes', true, 'message', 'Stèle mise à jour.');
END;
$$;

-- 10) RPC staff : supprimer une stèle ----------------------------------
CREATE OR REPLACE FUNCTION public.supprimer_stele(p_cimetiere_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_s RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Réservé au staff');
  END IF;
  SELECT * INTO v_s FROM public.cimetiere WHERE id = p_cimetiere_id;
  IF v_s IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Stèle introuvable');
  END IF;

  DELETE FROM public.cimetiere WHERE id = p_cimetiere_id;

  PERFORM public.log_audit('personnage', v_s.personnage_id_origine, 'supprimer_stele',
    jsonb_build_object('cimetiere_id', p_cimetiere_id, 'nom', v_s.nom));

  RETURN jsonb_build_object('succes', true, 'message', 'Stèle supprimée.');
END;
$$;

-- 11) Vues -------------------------------------------------------------
CREATE OR REPLACE VIEW public.vue_cimetiere AS
  SELECT id, personnage_id_origine, nom, race, classe, niveau, date_mort, epitaphe, snapshot, created_at
  FROM public.cimetiere
  ORDER BY date_mort DESC;
GRANT SELECT ON public.vue_cimetiere TO authenticated;

CREATE OR REPLACE VIEW public.vue_demandes_morts_attente AS
  SELECT d.id, d.personnage_id, d.epitaphe, d.statut, d.created_at,
         p.nom AS personnage_nom, r.nom AS race_nom, c.nom AS classe_nom, p.niveau,
         p.joueur_id
  FROM public.personnage_morts_demandes d
  JOIN public.personnages p ON p.id = d.personnage_id
  LEFT JOIN public.races r   ON r.id = p.race_id
  LEFT JOIN public.classes c ON c.id = p.classe_id
  WHERE d.statut = 'en_attente'
  ORDER BY d.created_at ASC;
GRANT SELECT ON public.vue_demandes_morts_attente TO authenticated;
