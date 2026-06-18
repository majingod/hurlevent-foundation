-- ============================================================
-- Lot 2 (Chantier #2 NOTIF/LOG) — Boucher les trous JOURNAL
-- Famille A : 9 RPC qui notifient SANS écrire de trace d'audit.
-- Refactor NEUTRE côté joueur : on ajoute UNIQUEMENT un PERFORM log_audit.
-- Aucune signature changée, aucun comportement de jeu touché.
-- Idempotent (CREATE OR REPLACE).
-- ============================================================

-- 1) approuver_maitre_competence
CREATE OR REPLACE FUNCTION public.approuver_maitre_competence(p_personnage_competence_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_pc RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
  END IF;
  SELECT pc.id, pc.personnage_id, pc.statut_maitre, pc.niveau_acquis, p.joueur_id, c.nom AS competence_nom
  INTO v_pc
  FROM personnage_competences pc
  JOIN personnages p ON p.id = pc.personnage_id
  JOIN competences c ON c.id = pc.competence_id
  WHERE pc.id = p_personnage_competence_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes', false, 'raison', 'Compétence introuvable'); END IF;
  IF v_pc.statut_maitre <> 'en_attente' THEN
    RETURN jsonb_build_object('succes', false, 'raison', format('Statut actuel : %s (attendu : en_attente)', v_pc.statut_maitre));
  END IF;
  UPDATE personnage_competences SET statut_maitre = 'approuve' WHERE id = p_personnage_competence_id;
  PERFORM public.creer_notification(
    p_message := format('Votre maître a été approuvé pour %s niveau %s.', v_pc.competence_nom, v_pc.niveau_acquis),
    p_profil_id := v_pc.joueur_id);
  PERFORM public.log_audit('personnage', v_pc.personnage_id, 'approuver_maitre',
    jsonb_build_object('competence', v_pc.competence_nom, 'niveau', v_pc.niveau_acquis,
      'personnage_competence_id', p_personnage_competence_id));
  RETURN jsonb_build_object('succes', true, 'competence', v_pc.competence_nom);
END;
$function$;

-- 2) refuser_maitre_competence
CREATE OR REPLACE FUNCTION public.refuser_maitre_competence(p_personnage_competence_id uuid, p_raison text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_pc RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé'); END IF;
  SELECT pc.id, pc.personnage_id, pc.statut_maitre, pc.niveau_acquis, p.joueur_id, c.nom AS competence_nom
  INTO v_pc
  FROM personnage_competences pc
  JOIN personnages p ON p.id = pc.personnage_id
  JOIN competences c ON c.id = pc.competence_id
  WHERE pc.id = p_personnage_competence_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes', false, 'raison', 'Compétence introuvable'); END IF;
  IF v_pc.statut_maitre <> 'en_attente' THEN
    RETURN jsonb_build_object('succes', false, 'raison', format('Statut actuel : %s (attendu : en_attente)', v_pc.statut_maitre));
  END IF;
  UPDATE personnage_competences SET statut_maitre = 'refuse' WHERE id = p_personnage_competence_id;
  PERFORM public.creer_notification(
    p_message := format('Votre maître a été refusé pour %s niveau %s.%s',
      v_pc.competence_nom, v_pc.niveau_acquis,
      CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0 THEN ' Raison : ' || p_raison ELSE '' END),
    p_profil_id := v_pc.joueur_id);
  PERFORM public.log_audit('personnage', v_pc.personnage_id, 'refuser_maitre',
    jsonb_build_object('competence', v_pc.competence_nom, 'niveau', v_pc.niveau_acquis,
      'raison', NULLIF(trim(COALESCE(p_raison,'')), ''),
      'personnage_competence_id', p_personnage_competence_id));
  RETURN jsonb_build_object('succes', true, 'competence', v_pc.competence_nom);
END;
$function$;

-- 3) approuver_race_demande
CREATE OR REPLACE FUNCTION public.approuver_race_demande(p_demande_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_demande RECORD;
  v_personnage RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreur', 'Seuls les administrateurs peuvent approuver');
  END IF;

  SELECT * INTO v_demande
  FROM public.personnage_races_demandes
  WHERE id = p_demande_id;

  IF v_demande IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Demande introuvable');
  END IF;

  IF v_demande.statut != 'en_attente' THEN
    RETURN jsonb_build_object('succes', false,
      'erreur', format('Cette demande est déjà %s', v_demande.statut));
  END IF;

  UPDATE public.personnage_races_demandes
  SET statut = 'approuvee',
    approuve_par = auth.uid(),
    date_approbation = now()
  WHERE id = p_demande_id;

  SELECT p.*, r.nom AS race_nom
  INTO v_personnage
  FROM public.personnages p
  JOIN public.races r ON r.id = v_demande.race_id
  WHERE p.id = v_demande.personnage_id;

  PERFORM public.creer_notification(
    p_message := format('✅ Votre demande pour la race "%s" (personnage "%s") a été APPROUVÉE !',
      v_personnage.race_nom, v_personnage.nom),
    p_type := 'race_approuvee',
    p_profil_id := v_personnage.joueur_id,
    p_reference_id := p_demande_id,
    p_statut := 'non_traite');

  PERFORM public.log_audit('personnage', v_demande.personnage_id, 'approuver_race',
    jsonb_build_object('race', v_personnage.race_nom, 'personnage', v_personnage.nom,
      'demande_id', p_demande_id));

  RETURN jsonb_build_object('succes', true,
    'message', format('Race "%s" approuvée pour %s',
      v_personnage.race_nom, v_personnage.nom));
END;
$function$;

-- 4) refuser_race_demande
CREATE OR REPLACE FUNCTION public.refuser_race_demande(p_demande_id uuid, p_raison text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_demande RECORD;
  v_personnage RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreur', 'Seuls les administrateurs peuvent refuser');
  END IF;

  IF p_raison IS NULL OR char_length(trim(p_raison)) < 10 THEN
    RETURN jsonb_build_object('succes', false,
      'erreur', 'Une raison d''au moins 10 caractères est obligatoire');
  END IF;

  SELECT * INTO v_demande
  FROM public.personnage_races_demandes
  WHERE id = p_demande_id;

  IF v_demande IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Demande introuvable');
  END IF;

  IF v_demande.statut != 'en_attente' THEN
    RETURN jsonb_build_object('succes', false,
      'erreur', format('Cette demande est déjà %s', v_demande.statut));
  END IF;

  UPDATE public.personnage_races_demandes
  SET statut = 'refusee',
    raison_refus = trim(p_raison),
    approuve_par = auth.uid(),
    date_approbation = now()
  WHERE id = p_demande_id;

  SELECT p.*, r.nom AS race_nom
  INTO v_personnage
  FROM public.personnages p
  JOIN public.races r ON r.id = v_demande.race_id
  WHERE p.id = v_demande.personnage_id;

  PERFORM public.creer_notification(
    p_message := format('❌ Votre demande pour la race "%s" (personnage "%s") a été REFUSÉE. Raison : %s',
      v_personnage.race_nom, v_personnage.nom, trim(p_raison)),
    p_type := 'race_refusee',
    p_profil_id := v_personnage.joueur_id,
    p_reference_id := p_demande_id,
    p_statut := 'non_traite');

  PERFORM public.log_audit('personnage', v_demande.personnage_id, 'refuser_race',
    jsonb_build_object('race', v_personnage.race_nom, 'personnage', v_personnage.nom,
      'raison', trim(p_raison), 'demande_id', p_demande_id));

  RETURN jsonb_build_object('succes', true,
    'message', format('Race "%s" refusée pour %s',
      v_personnage.race_nom, v_personnage.nom));
END;
$function$;

-- 5) archiver_personnage
CREATE OR REPLACE FUNCTION public.archiver_personnage(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_personnage RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé'); END IF;
  SELECT id, nom, joueur_id INTO v_personnage FROM personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable'); END IF;
  UPDATE personnages SET est_actif = false WHERE id = p_personnage_id;
  PERFORM public.creer_notification(
    p_message := format('Votre personnage « %s » a été archivé.', COALESCE(v_personnage.nom, 'Sans nom')),
    p_profil_id := v_personnage.joueur_id);
  PERFORM public.log_audit('personnage', p_personnage_id, 'archiver',
    jsonb_build_object('nom', COALESCE(v_personnage.nom, 'Sans nom')));
  RETURN jsonb_build_object('succes', true);
END;
$function$;

-- 6) verrouiller_personnage
CREATE OR REPLACE FUNCTION public.verrouiller_personnage(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_personnage RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé'); END IF;
  SELECT id, nom, joueur_id, est_verrouille INTO v_personnage FROM personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable'); END IF;
  UPDATE personnages SET est_verrouille = true WHERE id = p_personnage_id;
  PERFORM public.creer_notification(
    p_message := format('Votre personnage « %s » a été verrouillé par l''équipe d''animation.', COALESCE(v_personnage.nom, 'Sans nom')),
    p_profil_id := v_personnage.joueur_id);
  PERFORM public.log_audit('personnage', p_personnage_id, 'verrouiller',
    jsonb_build_object('nom', COALESCE(v_personnage.nom, 'Sans nom')));
  RETURN jsonb_build_object('succes', true);
END;
$function$;

-- 7) deverrouiller_personnage
CREATE OR REPLACE FUNCTION public.deverrouiller_personnage(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_personnage RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé'); END IF;
  SELECT id, nom, joueur_id, est_verrouille INTO v_personnage FROM personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable'); END IF;
  UPDATE personnages SET est_verrouille = false WHERE id = p_personnage_id;
  PERFORM public.creer_notification(
    p_message := format('Votre personnage « %s » a été déverrouillé.', COALESCE(v_personnage.nom, 'Sans nom')),
    p_profil_id := v_personnage.joueur_id);
  PERFORM public.log_audit('personnage', p_personnage_id, 'deverrouiller',
    jsonb_build_object('nom', COALESCE(v_personnage.nom, 'Sans nom')));
  RETURN jsonb_build_object('succes', true);
END;
$function$;

-- 8) donner_xp_bonus  (NB: search_path d'origine = 'pg_catalog','public' — PRÉSERVÉ tel quel)
CREATE OR REPLACE FUNCTION public.donner_xp_bonus(p_personnage_id uuid, p_montant integer, p_raison text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_personnage RECORD; v_description text;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé'); END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN RETURN jsonb_build_object('succes', false, 'raison', 'Montant invalide (doit être > 0)'); END IF;
  SELECT id, nom, joueur_id INTO v_personnage FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable'); END IF;
  v_description := CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0 THEN 'Bonus : ' || trim(p_raison) ELSE 'Bonus XP attribué par un animateur/admin' END;
  INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, acteur_id)
  VALUES (p_personnage_id, 'gain_bonus', p_montant, v_description, auth.uid());
  PERFORM public.creer_notification(
    p_message := format('Vous avez reçu %s XP bonus pour « %s ».%s',
      p_montant, COALESCE(v_personnage.nom, 'Sans nom'),
      CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0 THEN ' ' || p_raison ELSE '' END),
    p_profil_id := v_personnage.joueur_id,
    p_reference_id := p_personnage_id);
  PERFORM public.log_audit('personnage', p_personnage_id, 'xp_bonus',
    jsonb_build_object('montant', p_montant, 'nom', COALESCE(v_personnage.nom, 'Sans nom'),
      'raison', NULLIF(trim(COALESCE(p_raison,'')), '')));
  RETURN jsonb_build_object('succes', true, 'xp_ajoute', p_montant);
END;
$function$;

-- 9) attribuer_xp_evenement
CREATE OR REPLACE FUNCTION public.attribuer_xp_evenement(p_inscription_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inscription RECORD;
  v_evenement RECORD;
  v_xp integer;
  v_niveaux integer;
  v_destination text;
  v_res_banque jsonb;
  v_compte_id uuid;
  v_description text;
  v_message text;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','acces_refuse','message','Accès refusé.')),
      'avertissements','[]'::jsonb, 'donnees','{}'::jsonb);
  END IF;

  SELECT * INTO v_inscription FROM public.inscriptions_evenements WHERE id = p_inscription_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','inscription_introuvable','message','Inscription introuvable.')),
      'avertissements','[]'::jsonb, 'donnees','{}'::jsonb);
  END IF;

  IF v_inscription.personnage_id IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','inscription_sans_personnage','message','Inscription sans personnage attaché.')),
      'avertissements','[]'::jsonb, 'donnees','{}'::jsonb);
  END IF;

  IF COALESCE(v_inscription.recompense_distribuee, false) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','recompense_deja_distribuee','message','Récompense déjà distribuée pour cette inscription.')),
      'avertissements','[]'::jsonb, 'donnees','{}'::jsonb);
  END IF;

  SELECT * INTO v_evenement FROM public.evenements WHERE id = v_inscription.evenement_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','evenement_introuvable','message','Événement introuvable.')),
      'avertissements','[]'::jsonb, 'donnees','{}'::jsonb);
  END IF;

  v_xp := COALESCE(v_evenement.xp_recompense, 0);
  v_niveaux := COALESCE(v_evenement.niveaux_recompense, 0);

  IF v_xp > 0 AND v_evenement.type_evenement IN ('mini_gn', 'entretien_terrain') THEN
    v_destination := 'banque';
    v_res_banque := public.crediter_banque_xp(
      v_inscription.joueur_id, v_xp, v_inscription.evenement_id,
      format('%s « %s »',
        CASE v_evenement.type_evenement
          WHEN 'mini_gn' THEN 'Gain mini-GN'
          WHEN 'entretien_terrain' THEN 'Gain ouverture de terrain'
          ELSE 'Gain en banque'
        END,
        COALESCE(v_evenement.titre, 'Sans titre')));
    IF NOT COALESCE((v_res_banque->>'succes')::boolean, false) THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', COALESCE(v_res_banque->'erreurs',
          jsonb_build_array(jsonb_build_object('code','banque_echec','message','Échec du crédit banque.'))),
        'avertissements','[]'::jsonb, 'donnees','{}'::jsonb);
    END IF;
  ELSIF v_xp > 0 THEN
    v_destination := 'personnage';
    v_description := format('XP gagné lors de l''événement « %s »%s',
      COALESCE(v_evenement.titre, 'Sans titre'),
      CASE WHEN v_evenement.date_evenement IS NOT NULL
        THEN ' du ' || to_char(v_evenement.date_evenement, 'DD/MM/YYYY')
        ELSE '' END);
    INSERT INTO public.historique_xp (
      personnage_id, type_mouvement, montant, description,
      evenement_id, inscription_id, acteur_id
    ) VALUES (
      v_inscription.personnage_id, 'gain_evenement', v_xp, v_description,
      v_inscription.evenement_id, p_inscription_id, auth.uid()
    );
  ELSE
    v_destination := 'aucune';
  END IF;

  UPDATE public.inscriptions_evenements
  SET statut = 'present',
    date_confirmation = COALESCE(date_confirmation, now()),
    xp_attribue = v_xp,
    recompense_distribuee = true,
    updated_at = now()
  WHERE id = p_inscription_id;

  UPDATE public.personnages
  SET niveau = COALESCE(niveau, 1) + v_niveaux,
    gn_completes = COALESCE(gn_completes, 0) + CASE WHEN v_evenement.type_evenement = 'gn_regulier' THEN 1 ELSE 0 END,
    mini_gn_completes = COALESCE(mini_gn_completes, 0) + CASE WHEN v_evenement.type_evenement = 'mini_gn' THEN 1 ELSE 0 END,
    ouvertures_terrain = COALESCE(ouvertures_terrain, 0) + CASE WHEN v_evenement.type_evenement = 'entretien_terrain' THEN 1 ELSE 0 END,
    updated_at = now()
  WHERE id = v_inscription.personnage_id;

  INSERT INTO public.personnage_compo_photos (
    personnage_id, evenement_id, inscription_id, compo, acteur_id
  ) VALUES (
    v_inscription.personnage_id,
    v_inscription.evenement_id,
    p_inscription_id,
    public.capturer_compo_personnage(v_inscription.personnage_id),
    auth.uid()
  );

  SELECT compte_id INTO v_compte_id FROM public.profils_joueur WHERE id = v_inscription.joueur_id;
  IF v_compte_id IS NOT NULL THEN
    v_message := CASE v_destination
      WHEN 'banque' THEN 'Vous avez reçu ' || v_xp || ' XP en banque pour « ' || COALESCE(v_evenement.titre,'Sans titre') || ' » (utilisables sur n''importe quel personnage)'
      WHEN 'personnage' THEN 'Vous avez reçu ' || v_xp || ' XP pour « ' || COALESCE(v_evenement.titre,'Sans titre') || ' »'
      ELSE 'Votre présence à « ' || COALESCE(v_evenement.titre,'Sans titre') || ' » a été confirmée'
    END
    || CASE WHEN v_niveaux > 0 THEN ' (+' || v_niveaux || ' niveau' || CASE WHEN v_niveaux > 1 THEN 'x' ELSE '' END || ')' ELSE '' END
    || '.';
    PERFORM public.creer_notification(
      p_message := v_message,
      p_type := CASE WHEN v_destination = 'banque' THEN 'banque' ELSE 'info' END,
      p_profil_id := v_inscription.joueur_id,
      p_reference_id := CASE WHEN v_destination = 'personnage' THEN v_inscription.personnage_id ELSE NULL END);
  END IF;

  PERFORM public.log_audit('personnage', v_inscription.personnage_id, 'attribuer_xp_evenement',
    jsonb_build_object('evenement_id', v_inscription.evenement_id, 'inscription_id', p_inscription_id,
      'xp', v_xp, 'destination', v_destination, 'niveaux', v_niveaux,
      'titre', COALESCE(v_evenement.titre, 'Sans titre')));

  RETURN jsonb_build_object('succes', true,
    'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object(
      'inscription_id', p_inscription_id,
      'evenement_id',   v_inscription.evenement_id,
      'personnage_id',  v_inscription.personnage_id,
      'xp',             v_xp,
      'destination',    v_destination,
      'niveaux',        v_niveaux));
END;
$function$;
