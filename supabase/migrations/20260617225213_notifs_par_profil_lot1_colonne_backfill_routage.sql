-- =====================================================================
-- NOTIFS PAR PROFIL — LOT 1 (base de donnees)
-- 1) colonne profil_id (NULL = notif compte-wide : role, moderation admin)
-- 2) backfill des notifs existantes rattachables
-- 3) routage : chaque RPC notif renseigne profil_id explicitement.
--    Le trigger existant trg_resoudre_notif_user_id resout deja user_id
--    (profil -> compte) ; on conserve ce filet et on route profil_id par RPC
--    (la derivation auto serait ambigue : profil principal id == compte_id).
-- Idempotent : ADD COLUMN IF NOT EXISTS, backfill garde profil_id IS NULL,
-- CREATE OR REPLACE.
-- =====================================================================

-- 1) SCHEMA -----------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS profil_id uuid REFERENCES public.profils_joueur(id);

CREATE INDEX IF NOT EXISTS idx_notifications_profil
  ON public.notifications(profil_id);

-- 2) BACKFILL ---------------------------------------------------------
-- a. Notifs race (approuvee/refusee) : reference_id -> demande -> perso -> profil
UPDATE public.notifications n
SET profil_id = p.joueur_id
FROM public.personnage_races_demandes d
JOIN public.personnages p ON p.id = d.personnage_id
WHERE n.reference_id = d.id
  AND n.type IN ('race_approuvee','race_refusee')
  AND n.profil_id IS NULL;

-- b. Comptes mono-profil : toute notif non compte-wide -> l'unique profil
--    (demande_race_nouvelle reste compte-wide : moderation admin)
UPDATE public.notifications n
SET profil_id = pj.id
FROM public.profils_joueur pj
WHERE pj.compte_id = n.user_id
  AND n.profil_id IS NULL
  AND n.type <> 'demande_race_nouvelle'
  AND (SELECT count(*) FROM public.profils_joueur p2 WHERE p2.compte_id = n.user_id) = 1;

-- 3) ROUTAGE DES RPC --------------------------------------------------

-- === Famille A : user_id deja = compte, on ajoute profil_id ===========

CREATE OR REPLACE FUNCTION public.ajuster_banque_xp(p_joueur_id uuid, p_montant integer, p_description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_compte_id uuid;
  v_nom_profil text;
  v_description text;
  v_mouvement_id uuid;
  v_solde_apres integer;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','acces_refuse','message','Action réservée au staff.')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  IF p_montant IS NULL OR p_montant = 0 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','montant_invalide','message','Le montant doit être non nul.','champ','montant')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  v_description := NULLIF(trim(COALESCE(p_description, '')), '');
  IF v_description IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','description_obligatoire','message','Une description est obligatoire.','champ','description')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  SELECT compte_id, nom INTO v_compte_id, v_nom_profil
  FROM public.profils_joueur WHERE id = p_joueur_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','profil_introuvable','message','Profil de jeu introuvable.','champ','joueur_id')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  INSERT INTO public.banque_xp_mouvements
    (joueur_id, type_mouvement, montant, evenement_id, personnage_cible_id, acteur_id, description)
  VALUES
    (p_joueur_id, 'ajustement_admin', p_montant, NULL, NULL, auth.uid(), v_description)
  RETURNING id INTO v_mouvement_id;

  SELECT COALESCE(SUM(montant), 0) INTO v_solde_apres
  FROM public.banque_xp_mouvements WHERE joueur_id = p_joueur_id;

  INSERT INTO public.notifications (user_id, profil_id, type, message)
  VALUES (v_compte_id, p_joueur_id, 'banque',
    format('Ajustement de %s%s XP sur la banque du profil « %s » : %s',
      CASE WHEN p_montant > 0 THEN '+' ELSE '' END, p_montant,
      COALESCE(v_nom_profil, 'Sans nom'), v_description));

  PERFORM public.log_audit('banque', p_joueur_id, 'ajustement_admin',
    jsonb_build_object('montant', p_montant, 'description', v_description,
      'mouvement_id', v_mouvement_id, 'solde_apres', v_solde_apres));

  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('mouvement_id', v_mouvement_id, 'montant', p_montant, 'solde_apres', v_solde_apres));
END;
$function$;

CREATE OR REPLACE FUNCTION public.corriger_xp_personnage(p_personnage_id uuid, p_montant integer, p_raison text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_perso RECORD;
  v_compte_id uuid;
  v_description text;
  v_total_apres integer;
  v_dispo_apres integer;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','acces_refuse','message','Action réservée au staff.')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  IF p_montant IS NULL OR p_montant = 0 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','montant_invalide','message','Le montant doit être non nul.','champ','montant')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  SELECT id, nom, joueur_id, xp_total, xp_depense INTO v_perso
  FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  SELECT compte_id INTO v_compte_id FROM public.profils_joueur WHERE id = v_perso.joueur_id;

  v_total_apres := v_perso.xp_total + p_montant;

  IF v_total_apres < v_perso.xp_depense THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','correction_excessive',
        'message', format('Retrait impossible : %s XP non dépensés seulement. Désacheter des éléments d''abord pour libérer de l''XP.',
          v_perso.xp_total - v_perso.xp_depense),
        'champ','montant')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  v_description := CASE
    WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0 THEN 'Correction : ' || trim(p_raison)
    ELSE 'Correction XP par le staff'
  END;

  INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, acteur_id)
  VALUES (p_personnage_id, 'gain_correction', p_montant, v_description, auth.uid());

  INSERT INTO public.notifications (user_id, profil_id, message, reference_id)
  VALUES (v_compte_id, v_perso.joueur_id,
    format('Correction de %s%s XP appliquée à « %s »%s.',
      CASE WHEN p_montant > 0 THEN '+' ELSE '' END, p_montant,
      COALESCE(v_perso.nom, 'Sans nom'),
      CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0 THEN ' : ' || trim(p_raison) ELSE '' END),
    p_personnage_id);

  PERFORM public.log_audit('personnage', p_personnage_id, 'correction_xp',
    jsonb_build_object('montant', p_montant,
      'raison', NULLIF(trim(COALESCE(p_raison,'')), '')));

  v_dispo_apres := v_total_apres - v_perso.xp_depense;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('xp_corrige', p_montant, 'xp_total', v_total_apres, 'xp_disponible', v_dispo_apres));
END;
$function$;

CREATE OR REPLACE FUNCTION public.corriger_niveau_personnage(p_personnage_id uuid, p_delta integer, p_raison text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_perso RECORD;
  v_compte_id uuid;
  v_niveau_avant int;
  v_niveau_apres int;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','acces_refuse','message','Action réservée au staff.')),
      'avertissements','[]'::jsonb,'donnees',NULL);
  END IF;

  IF p_delta IS NULL OR p_delta = 0 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','delta_invalide','message','Le delta de niveau doit être non nul.','champ','delta')),
      'avertissements','[]'::jsonb,'donnees',NULL);
  END IF;

  SELECT id, nom, joueur_id, niveau,
    COALESCE(gn_completes,0) AS gn_completes,
    COALESCE(niveau_correction,0) AS niveau_correction
    INTO v_perso FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable.')),
      'avertissements','[]'::jsonb,'donnees',NULL);
  END IF;

  v_niveau_avant := v_perso.niveau;
  v_niveau_apres := 1 + v_perso.gn_completes + (v_perso.niveau_correction + p_delta);

  IF v_niveau_apres < 1 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_plancher',
        'message', format('Le niveau ne peut pas descendre sous 1 (résultat demandé : %s).', v_niveau_apres),
        'champ','delta')),
      'avertissements','[]'::jsonb,'donnees',NULL);
  END IF;

  SELECT compte_id INTO v_compte_id FROM public.profils_joueur WHERE id = v_perso.joueur_id;

  UPDATE public.personnages
  SET niveau_correction = niveau_correction + p_delta
  WHERE id = p_personnage_id;

  INSERT INTO public.notifications (user_id, profil_id, message, reference_id)
  VALUES (v_compte_id, v_perso.joueur_id,
    format('Niveau de « %s » ajusté de %s%s (niveau %s → %s)%s.',
      COALESCE(v_perso.nom,'Sans nom'),
      CASE WHEN p_delta > 0 THEN '+' ELSE '' END, p_delta,
      v_niveau_avant, v_niveau_apres,
      CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison))>0 THEN ' : ' || trim(p_raison) ELSE '' END),
    p_personnage_id);

  PERFORM public.log_audit('personnage', p_personnage_id, 'correction_niveau',
    jsonb_build_object('delta', p_delta, 'niveau_avant', v_niveau_avant, 'niveau_apres', v_niveau_apres,
      'raison', NULLIF(trim(COALESCE(p_raison,'')), '')));

  RETURN jsonb_build_object('succes', true, 'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('niveau_avant', v_niveau_avant, 'niveau_apres', v_niveau_apres, 'delta', p_delta));
END;
$function$;

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
    INSERT INTO public.notifications (user_id, profil_id, type, message, reference_id)
    VALUES (
      v_compte_id,
      v_inscription.joueur_id,
      CASE WHEN v_destination = 'banque' THEN 'banque' ELSE 'info' END,
      v_message,
      CASE WHEN v_destination = 'personnage' THEN v_inscription.personnage_id ELSE NULL END
    );
  END IF;

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

-- === Famille B : on resout le COMPTE pour user_id (independant du trigger)
--     + profil_id = le profil concerne ==================================

CREATE OR REPLACE FUNCTION public.archiver_personnage(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_personnage RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
  END IF;

  SELECT id, nom, joueur_id
  INTO v_personnage
  FROM personnages
  WHERE id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable');
  END IF;

  UPDATE personnages SET est_actif = false WHERE id = p_personnage_id;

  INSERT INTO notifications (user_id, profil_id, message)
  VALUES (
    (SELECT compte_id FROM profils_joueur WHERE id = v_personnage.joueur_id),
    v_personnage.joueur_id,
    format('Votre personnage « %s » a été archivé.',
      COALESCE(v_personnage.nom, 'Sans nom'))
  );

  RETURN jsonb_build_object('succes', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.verrouiller_personnage(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_personnage RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
  END IF;

  SELECT id, nom, joueur_id, est_verrouille
  INTO v_personnage
  FROM personnages
  WHERE id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable');
  END IF;

  UPDATE personnages SET est_verrouille = true WHERE id = p_personnage_id;

  INSERT INTO notifications (user_id, profil_id, message)
  VALUES (
    (SELECT compte_id FROM profils_joueur WHERE id = v_personnage.joueur_id),
    v_personnage.joueur_id,
    format('Votre personnage « %s » a été verrouillé par l''équipe d''animation.',
      COALESCE(v_personnage.nom, 'Sans nom'))
  );

  RETURN jsonb_build_object('succes', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.deverrouiller_personnage(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_personnage RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
  END IF;

  SELECT id, nom, joueur_id, est_verrouille
  INTO v_personnage
  FROM personnages
  WHERE id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable');
  END IF;

  UPDATE personnages SET est_verrouille = false WHERE id = p_personnage_id;

  INSERT INTO notifications (user_id, profil_id, message)
  VALUES (
    (SELECT compte_id FROM profils_joueur WHERE id = v_personnage.joueur_id),
    v_personnage.joueur_id,
    format('Votre personnage « %s » a été déverrouillé.',
      COALESCE(v_personnage.nom, 'Sans nom'))
  );

  RETURN jsonb_build_object('succes', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.donner_xp_bonus(p_personnage_id uuid, p_montant integer, p_raison text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_personnage RECORD;
  v_description text;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
  END IF;

  IF p_montant IS NULL OR p_montant <= 0 THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Montant invalide (doit être > 0)');
  END IF;

  SELECT id, nom, joueur_id
  INTO v_personnage
  FROM public.personnages
  WHERE id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Personnage introuvable');
  END IF;

  v_description := CASE
    WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0
    THEN 'Bonus : ' || trim(p_raison)
    ELSE 'Bonus XP attribué par un animateur/admin'
  END;

  INSERT INTO public.historique_xp (
    personnage_id, type_mouvement, montant, description, acteur_id
  ) VALUES (
    p_personnage_id, 'gain_bonus', p_montant, v_description, auth.uid()
  );

  INSERT INTO public.notifications (user_id, profil_id, message, reference_id)
  VALUES (
    (SELECT compte_id FROM public.profils_joueur WHERE id = v_personnage.joueur_id),
    v_personnage.joueur_id,
    format('Vous avez reçu %s XP bonus pour « %s ».%s',
      p_montant,
      COALESCE(v_personnage.nom, 'Sans nom'),
      CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0
        THEN ' ' || p_raison
        ELSE '' END),
    p_personnage_id
  );

  RETURN jsonb_build_object('succes', true, 'xp_ajoute', p_montant);
END;
$function$;

CREATE OR REPLACE FUNCTION public.approuver_maitre_competence(p_personnage_competence_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pc RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
  END IF;

  SELECT pc.id,
    pc.personnage_id,
    pc.statut_maitre,
    pc.niveau_acquis,
    p.joueur_id,
    c.nom AS competence_nom
  INTO v_pc
  FROM personnage_competences pc
  JOIN personnages p ON p.id = pc.personnage_id
  JOIN competences c ON c.id = pc.competence_id
  WHERE pc.id = p_personnage_competence_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Compétence introuvable');
  END IF;

  IF v_pc.statut_maitre <> 'en_attente' THEN
    RETURN jsonb_build_object('succes', false,
      'raison', format('Statut actuel : %s (attendu : en_attente)', v_pc.statut_maitre));
  END IF;

  UPDATE personnage_competences
  SET statut_maitre = 'approuve'
  WHERE id = p_personnage_competence_id;

  INSERT INTO notifications (user_id, profil_id, message)
  VALUES (
    (SELECT compte_id FROM profils_joueur WHERE id = v_pc.joueur_id),
    v_pc.joueur_id,
    format('Votre maître a été approuvé pour %s niveau %s.',
      v_pc.competence_nom, v_pc.niveau_acquis)
  );

  RETURN jsonb_build_object('succes', true, 'competence', v_pc.competence_nom);
END;
$function$;

CREATE OR REPLACE FUNCTION public.refuser_maitre_competence(p_personnage_competence_id uuid, p_raison text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pc RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Accès refusé');
  END IF;

  SELECT pc.id,
    pc.personnage_id,
    pc.statut_maitre,
    pc.niveau_acquis,
    p.joueur_id,
    c.nom AS competence_nom
  INTO v_pc
  FROM personnage_competences pc
  JOIN personnages p ON p.id = pc.personnage_id
  JOIN competences c ON c.id = pc.competence_id
  WHERE pc.id = p_personnage_competence_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'raison', 'Compétence introuvable');
  END IF;

  IF v_pc.statut_maitre <> 'en_attente' THEN
    RETURN jsonb_build_object('succes', false,
      'raison', format('Statut actuel : %s (attendu : en_attente)', v_pc.statut_maitre));
  END IF;

  UPDATE personnage_competences
  SET statut_maitre = 'refuse'
  WHERE id = p_personnage_competence_id;

  INSERT INTO notifications (user_id, profil_id, message)
  VALUES (
    (SELECT compte_id FROM profils_joueur WHERE id = v_pc.joueur_id),
    v_pc.joueur_id,
    format('Votre maître a été refusé pour %s niveau %s.%s',
      v_pc.competence_nom,
      v_pc.niveau_acquis,
      CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0
        THEN ' Raison : ' || p_raison
        ELSE '' END)
  );

  RETURN jsonb_build_object('succes', true, 'competence', v_pc.competence_nom);
END;
$function$;

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

  INSERT INTO public.notifications (user_id, profil_id, type, message, reference_id, statut)
  VALUES (
    (SELECT compte_id FROM public.profils_joueur WHERE id = v_personnage.joueur_id),
    v_personnage.joueur_id,
    'race_approuvee',
    format('✅ Votre demande pour la race "%s" (personnage "%s") a été APPROUVÉE !',
      v_personnage.race_nom, v_personnage.nom),
    p_demande_id,
    'non_traite'
  );

  RETURN jsonb_build_object('succes', true,
    'message', format('Race "%s" approuvée pour %s',
      v_personnage.race_nom, v_personnage.nom));
END;
$function$;

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

  INSERT INTO public.notifications (user_id, profil_id, type, message, reference_id, statut)
  VALUES (
    (SELECT compte_id FROM public.profils_joueur WHERE id = v_personnage.joueur_id),
    v_personnage.joueur_id,
    'race_refusee',
    format('❌ Votre demande pour la race "%s" (personnage "%s") a été REFUSÉE. Raison : %s',
      v_personnage.race_nom, v_personnage.nom, trim(p_raison)),
    p_demande_id,
    'non_traite'
  );

  RETURN jsonb_build_object('succes', true,
    'message', format('Race "%s" refusée pour %s',
      v_personnage.race_nom, v_personnage.nom));
END;
$function$;
