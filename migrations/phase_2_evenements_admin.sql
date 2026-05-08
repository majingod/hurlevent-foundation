-- =============================================================================
-- Phase 2 — Module d'administration des événements
-- =============================================================================
-- Ajoute les colonnes manquantes (`est_termine`, `adresse_physique`,
-- `niveaux_recompense`) et crée les RPC nécessaires :
--   - changer_statut_inscription(p_inscription_id, p_nouveau_statut)
--   - cloturer_evenement(p_evenement_id)
--   - ajouter_presence_tardive(p_evenement_id, p_personnage_id)
--
-- Format de retour standardisé : { succes: bool, message: text }
-- Toutes les fonctions sont SECURITY DEFINER + restreintes aux animateurs/admins.
-- =============================================================================

-- 1) Colonnes manquantes sur evenements --------------------------------------
ALTER TABLE public.evenements
  ADD COLUMN IF NOT EXISTS est_termine boolean NOT NULL DEFAULT false;

ALTER TABLE public.evenements
  ADD COLUMN IF NOT EXISTS adresse_physique text;

ALTER TABLE public.evenements
  ADD COLUMN IF NOT EXISTS niveaux_recompense integer NOT NULL DEFAULT 0;

-- 2) RPC : changer_statut_inscription ----------------------------------------
CREATE OR REPLACE FUNCTION public.changer_statut_inscription(
  p_inscription_id uuid,
  p_nouveau_statut text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'message', 'Accès refusé.');
  END IF;

  IF p_nouveau_statut NOT IN ('inscrit', 'present', 'absent', 'en_attente') THEN
    RETURN jsonb_build_object('succes', false, 'message', 'Statut invalide.');
  END IF;

  UPDATE public.inscriptions_evenements
     SET statut = p_nouveau_statut,
         updated_at = now(),
         date_confirmation = CASE
           WHEN p_nouveau_statut = 'present' THEN COALESCE(date_confirmation, now())
           ELSE date_confirmation
         END
   WHERE id = p_inscription_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'message', 'Inscription introuvable.');
  END IF;

  RETURN jsonb_build_object('succes', true, 'message', 'Statut mis à jour.');
END;
$function$;

-- 3) RPC : cloturer_evenement ------------------------------------------------
CREATE OR REPLACE FUNCTION public.cloturer_evenement(
  p_evenement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_evt           public.evenements%ROWTYPE;
  v_inscription   record;
  v_xp_montant    integer;
  v_niveaux       integer;
  v_count_present integer := 0;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'message', 'Accès refusé.');
  END IF;

  SELECT * INTO v_evt FROM public.evenements WHERE id = p_evenement_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'message', 'Événement introuvable.');
  END IF;

  IF v_evt.est_termine THEN
    RETURN jsonb_build_object('succes', false, 'message', 'Événement déjà terminé.');
  END IF;

  v_xp_montant := COALESCE(v_evt.xp_recompense, 0);
  v_niveaux    := COALESCE(v_evt.niveaux_recompense, 0);

  -- Pour chaque inscription marquée présente : attribuer XP + niveaux
  FOR v_inscription IN
    SELECT id, personnage_id
      FROM public.inscriptions_evenements
     WHERE evenement_id = p_evenement_id
       AND statut = 'present'
       AND personnage_id IS NOT NULL
  LOOP
    -- XP via la RPC existante (insère dans historique_xp)
    PERFORM public.attribuer_xp_evenement(v_inscription.id, v_xp_montant);

    -- Niveaux ajoutés directement sur le personnage
    IF v_niveaux > 0 THEN
      UPDATE public.personnages
         SET niveau = COALESCE(niveau, 1) + v_niveaux,
             updated_at = now()
       WHERE id = v_inscription.personnage_id;
    END IF;

    v_count_present := v_count_present + 1;
  END LOOP;

  -- Marque l'événement terminé
  UPDATE public.evenements
     SET est_termine = true,
         updated_at = now()
   WHERE id = p_evenement_id;

  RETURN jsonb_build_object(
    'succes', true,
    'message', format('Événement terminé. %s présence(s) récompensée(s).', v_count_present)
  );
END;
$function$;

-- 4) RPC : ajouter_presence_tardive -----------------------------------------
CREATE OR REPLACE FUNCTION public.ajouter_presence_tardive(
  p_evenement_id uuid,
  p_personnage_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_evt          public.evenements%ROWTYPE;
  v_joueur_id    uuid;
  v_inscription  uuid;
  v_xp_montant   integer;
  v_niveaux      integer;
  v_existe       boolean;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'message', 'Accès refusé.');
  END IF;

  SELECT * INTO v_evt FROM public.evenements WHERE id = p_evenement_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'message', 'Événement introuvable.');
  END IF;

  SELECT joueur_id INTO v_joueur_id
    FROM public.personnages
   WHERE id = p_personnage_id;

  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'message', 'Personnage introuvable.');
  END IF;

  -- Vérifie qu'il n'existe pas déjà une inscription
  SELECT EXISTS (
    SELECT 1 FROM public.inscriptions_evenements
     WHERE evenement_id = p_evenement_id
       AND personnage_id = p_personnage_id
  ) INTO v_existe;

  IF v_existe THEN
    -- Met à jour le statut existant à 'present'
    UPDATE public.inscriptions_evenements
       SET statut = 'present',
           date_confirmation = COALESCE(date_confirmation, now()),
           updated_at = now()
     WHERE evenement_id = p_evenement_id
       AND personnage_id = p_personnage_id
     RETURNING id INTO v_inscription;
  ELSE
    INSERT INTO public.inscriptions_evenements (
      evenement_id, personnage_id, joueur_id, statut, date_inscription, date_confirmation
    )
    VALUES (
      p_evenement_id, p_personnage_id, v_joueur_id, 'present', now(), now()
    )
    RETURNING id INTO v_inscription;
  END IF;

  v_xp_montant := COALESCE(v_evt.xp_recompense, 0);
  v_niveaux    := COALESCE(v_evt.niveaux_recompense, 0);

  -- Attribue XP via la RPC existante (idempotente : ne re-attribue pas si xp_attribue déjà set)
  PERFORM public.attribuer_xp_evenement(v_inscription, v_xp_montant);

  -- Ajoute niveaux le cas échéant
  IF v_niveaux > 0 THEN
    UPDATE public.personnages
       SET niveau = COALESCE(niveau, 1) + v_niveaux,
           updated_at = now()
     WHERE id = p_personnage_id;
  END IF;

  RETURN jsonb_build_object(
    'succes', true,
    'message', 'Présence tardive ajoutée et XP attribuée.'
  );
END;
$function$;

-- 5) Permissions -------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.changer_statut_inscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cloturer_evenement(uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.ajouter_presence_tardive(uuid, uuid)   TO authenticated;
