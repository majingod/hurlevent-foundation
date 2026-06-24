-- Bug « -1 non live » (CLOCHE-STAFF-LIVE-TRAITÉ) : approuver/refuser une demande
-- de mort modifie `cimetiere` mais ne touchait JAMAIS la table `notifications`
-- → le temps réel (abonné à `notifications`) ne se déclenchait pas → le badge
-- bouclier « Organisation » restait figé jusqu'à un refresh manuel.
-- Fix : marquer la/les notif(s) staff de la demande `statut='traite'`. Ce simple
-- UPDATE réveille le realtime (filtre user_id) → chaque écran staff réinvalide
-- `notifications-staff` → a_traiter recalculé (cimetiere approuvee/supprimée →
-- false) → badge -1 en direct. a_traiter reste piloté par `cimetiere` (source
-- de vérité) ; le statut de la notif ne sert qu'à réveiller le live. Signatures
-- inchangées (A2).
CREATE OR REPLACE FUNCTION public.approuver_mort_demande(p_stele_id uuid, p_epitaphe_finale text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_s RECORD; v_profil uuid;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Seuls les administrateurs peuvent approuver'); END IF;
  SELECT * INTO v_s FROM public.cimetiere WHERE id = p_stele_id;
  IF v_s IS NULL THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Stèle introuvable'); END IF;
  IF v_s.statut <> 'en_attente' THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Cette stèle n''est pas en attente'); END IF;
  UPDATE public.cimetiere SET statut='approuvee', epitaphe = COALESCE(NULLIF(trim(COALESCE(p_epitaphe_finale,'')),''), epitaphe), date_mort = now() WHERE id = p_stele_id;
  UPDATE public.personnages SET est_mort = true WHERE id = v_s.personnage_id_origine;
  -- réveille la cloche staff temps réel (badge « à traiter » -1 live)
  UPDATE public.notifications SET statut='traite' WHERE reference_id = p_stele_id AND type='demande_mort_nouvelle';
  v_profil := COALESCE((SELECT joueur_id FROM public.personnages WHERE id = v_s.personnage_id_origine), (v_s.snapshot->>'joueur_id')::uuid);
  IF v_profil IS NOT NULL AND EXISTS(SELECT 1 FROM public.profils_joueur WHERE id = v_profil) THEN
    PERFORM public.creer_notification(p_message := format('⚰️ Votre personnage "%s" repose désormais au Cimetière des Héros.', v_s.nom), p_type := 'mort_approuvee', p_profil_id := v_profil, p_reference_id := p_stele_id, p_statut := 'non_traite');
  END IF;
  PERFORM public.log_audit('personnage', v_s.personnage_id_origine, 'approuver_mort', jsonb_build_object('stele_id', p_stele_id, 'nom', v_s.nom));
  RETURN jsonb_build_object('succes', true, 'message', format('"%s" envoyé au Cimetière.', v_s.nom), 'stele_id', p_stele_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.refuser_mort_demande(p_stele_id uuid, p_raison text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_s RECORD; v_profil uuid;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Seuls les administrateurs peuvent refuser'); END IF;
  SELECT * INTO v_s FROM public.cimetiere WHERE id = p_stele_id;
  IF v_s IS NULL THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Stèle introuvable'); END IF;
  IF v_s.statut <> 'en_attente' THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Cette stèle n''est pas en attente'); END IF;
  v_profil := COALESCE((SELECT joueur_id FROM public.personnages WHERE id = v_s.personnage_id_origine), (v_s.snapshot->>'joueur_id')::uuid);
  DELETE FROM public.cimetiere WHERE id = p_stele_id;
  -- réveille la cloche staff temps réel (badge « à traiter » -1 live)
  UPDATE public.notifications SET statut='traite' WHERE reference_id = p_stele_id AND type='demande_mort_nouvelle';
  IF v_profil IS NOT NULL AND EXISTS(SELECT 1 FROM public.profils_joueur WHERE id = v_profil) THEN
    PERFORM public.creer_notification(p_message := format('Votre demande de mort pour "%s" a été refusée.%s', v_s.nom, COALESCE(' Raison : '||NULLIF(trim(COALESCE(p_raison,'')),''), '')), p_type := 'mort_refusee', p_profil_id := v_profil, p_reference_id := v_s.personnage_id_origine, p_statut := 'non_traite');
  END IF;
  PERFORM public.log_audit('personnage', v_s.personnage_id_origine, 'refuser_mort', jsonb_build_object('nom', v_s.nom, 'raison', p_raison));
  RETURN jsonb_build_object('succes', true, 'message', 'Demande refusée.');
END; $function$;