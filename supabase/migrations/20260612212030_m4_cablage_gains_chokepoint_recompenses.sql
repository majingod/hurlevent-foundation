-- M4 — Câblage gains (s174)
-- 1) crediter_banque_xp : validation joueur sur profils_joueur (fix multi-profils)
-- 2) attribuer_xp_evenement(p_inscription_id) : chokepoint UNIQUE présence + récompense
--    · routage par type : gn_regulier / entretien_terrain → XP perso ; mini_gn → banque profil
--    · niveau = niveaux_recompense (colonne, seule source) — fin du +1 codé en dur (CLOTURE-DOUBLE-NIVEAU)
--    · idempotence via inscriptions_evenements.recompense_distribuee (colonne ressuscitée)
--    · notification au COMPTE (profils_joueur.compte_id) — fix FK latent multi-profils
-- 3) cloturer_evenement / ajouter_presence_tardive : appelants minces, zéro logique de récompense
--    · cloturer agrège les échecs en avertissements (fin du PERFORM silencieux)

-- ───────────────────────── 1) crediter_banque_xp ─────────────────────────
CREATE OR REPLACE FUNCTION public.crediter_banque_xp(p_joueur_id uuid, p_montant integer, p_evenement_id uuid, p_description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_desc text; v_id uuid;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Réservé aux animateurs/admins.')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','MONTANT_INVALIDE','message','Le montant doit être > 0.','champ','p_montant')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF p_evenement_id IS NULL THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','EVENEMENT_REQUIS','message','Un événement source est requis.','champ','p_evenement_id')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  -- ⭐ M4 : joueur = profil (profils_joueur), plus le compte (profiles)
  PERFORM 1 FROM public.profils_joueur WHERE id=p_joueur_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','JOUEUR_INTROUVABLE','message','Profil joueur introuvable.','champ','p_joueur_id')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  PERFORM 1 FROM public.evenements WHERE id=p_evenement_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','EVENEMENT_INTROUVABLE','message','Événement introuvable.','champ','p_evenement_id')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  v_desc := COALESCE(NULLIF(trim(p_description),''),'Gain mini-GN');
  INSERT INTO public.banque_xp_mouvements (joueur_id,type_mouvement,montant,evenement_id,acteur_id,description)
  VALUES (p_joueur_id,'gain_mini_gn',p_montant,p_evenement_id,auth.uid(),v_desc) RETURNING id INTO v_id;
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees',jsonb_build_object('mouvement_id',v_id,'montant',p_montant));
END;
$function$;

-- ───────────────────────── 2) attribuer_xp_evenement ─────────────────────────
DROP FUNCTION IF EXISTS public.attribuer_xp_evenement(uuid, integer);

CREATE OR REPLACE FUNCTION public.attribuer_xp_evenement(p_inscription_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inscription  RECORD;
  v_evenement    RECORD;
  v_xp           integer;
  v_niveaux      integer;
  v_destination  text;
  v_res_banque   jsonb;
  v_compte_id    uuid;
  v_description  text;
  v_message      text;
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

  -- Idempotence : une inscription ne peut être récompensée qu'une fois
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

  v_xp      := COALESCE(v_evenement.xp_recompense, 0);
  v_niveaux := COALESCE(v_evenement.niveaux_recompense, 0);

  -- Récompense XP — AVANT toute écriture d'état (un échec banque n'altère rien)
  IF v_xp > 0 AND v_evenement.type_evenement = 'mini_gn' THEN
    v_destination := 'banque';
    v_res_banque := public.crediter_banque_xp(
      v_inscription.joueur_id, v_xp, v_inscription.evenement_id,
      format('Gain mini-GN « %s »', COALESCE(v_evenement.titre, 'Sans titre')));
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
    -- Le trigger trg_sync_xp_personnage met à jour xp_total automatiquement
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

  -- Inscription : statut + traces
  UPDATE public.inscriptions_evenements
  SET statut                = 'present',
      date_confirmation     = COALESCE(date_confirmation, now()),
      xp_attribue           = v_xp,
      recompense_distribuee = true,
      updated_at            = now()
  WHERE id = p_inscription_id;

  -- Personnage : niveau (niveaux_recompense = SEULE source) + compteurs par type
  UPDATE public.personnages
  SET niveau             = COALESCE(niveau, 1)             + v_niveaux,
      gn_completes       = COALESCE(gn_completes, 0)       + CASE WHEN v_evenement.type_evenement = 'gn_regulier'       THEN 1 ELSE 0 END,
      mini_gn_completes  = COALESCE(mini_gn_completes, 0)  + CASE WHEN v_evenement.type_evenement = 'mini_gn'           THEN 1 ELSE 0 END,
      ouvertures_terrain = COALESCE(ouvertures_terrain, 0) + CASE WHEN v_evenement.type_evenement = 'entretien_terrain' THEN 1 ELSE 0 END,
      updated_at         = now()
  WHERE id = v_inscription.personnage_id;

  -- Photo immuable de compo — TOUJOURS après la récompense (journal + gating en dépendent)
  INSERT INTO public.personnage_compo_photos (
    personnage_id, evenement_id, inscription_id, compo, acteur_id
  ) VALUES (
    v_inscription.personnage_id,
    v_inscription.evenement_id,
    p_inscription_id,
    public.capturer_compo_personnage(v_inscription.personnage_id),
    auth.uid()
  );

  -- Notification au COMPTE (notifications.user_id → profiles ; joueur_id → profils_joueur)
  SELECT compte_id INTO v_compte_id FROM public.profils_joueur WHERE id = v_inscription.joueur_id;
  IF v_compte_id IS NOT NULL THEN
    v_message := CASE v_destination
        WHEN 'banque'     THEN 'Vous avez reçu ' || v_xp || ' XP en banque pour « ' || COALESCE(v_evenement.titre,'Sans titre') || ' » (utilisables sur n''importe quel personnage)'
        WHEN 'personnage' THEN 'Vous avez reçu ' || v_xp || ' XP pour « ' || COALESCE(v_evenement.titre,'Sans titre') || ' »'
        ELSE 'Votre présence à « ' || COALESCE(v_evenement.titre,'Sans titre') || ' » a été confirmée'
      END
      || CASE WHEN v_niveaux > 0 THEN ' (+' || v_niveaux || ' niveau' || CASE WHEN v_niveaux > 1 THEN 'x' ELSE '' END || ')' ELSE '' END
      || '.';
    INSERT INTO public.notifications (user_id, message) VALUES (v_compte_id, v_message);
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

-- ───────────────────────── 3a) cloturer_evenement ─────────────────────────
CREATE OR REPLACE FUNCTION public.cloturer_evenement(p_evenement_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_evt public.evenements%ROWTYPE;
  v_inscription record;
  v_absent record;
  v_res jsonb;
  v_count_present integer := 0;
  v_count_deja integer := 0;
  v_count_absent integer := 0;
  v_avertissements jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'acces_refuse', 'message', 'Accès refusé.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_evt FROM public.evenements WHERE id = p_evenement_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'evenement_introuvable', 'message', 'Événement introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF v_evt.est_termine THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'evenement_deja_termine', 'message', 'Événement déjà terminé.')),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('evenement_id', p_evenement_id));
  END IF;

  -- Présences déjà récompensées (ex. présence tardive avant clôture) : comptées, pas re-distribuées
  SELECT count(*) INTO v_count_deja
    FROM public.inscriptions_evenements
   WHERE evenement_id = p_evenement_id AND statut = 'present'
     AND COALESCE(recompense_distribuee, false) = true;

  -- Distribution via le chokepoint unique (toute la logique de récompense y vit)
  FOR v_inscription IN
    SELECT id FROM public.inscriptions_evenements
     WHERE evenement_id = p_evenement_id AND statut = 'present'
       AND personnage_id IS NOT NULL
       AND COALESCE(recompense_distribuee, false) = false
  LOOP
    v_res := public.attribuer_xp_evenement(v_inscription.id);
    IF COALESCE((v_res->>'succes')::boolean, false) THEN
      v_count_present := v_count_present + 1;
    ELSE
      v_avertissements := v_avertissements || jsonb_build_array(jsonb_build_object(
        'code', 'recompense_echouee',
        'message', format('Inscription %s : %s', v_inscription.id,
          COALESCE(v_res->'erreurs'->0->>'message', 'échec inconnu'))));
    END IF;
  END LOOP;

  -- AUDIT-JOUEUR-PHASE2 : inscriptions jamais confirmées → 'absent' + mention au journal,
  -- aucune récompense. Le personnage se dégèle de lui-même (est_termine=true ci-dessous).
  FOR v_absent IN
    SELECT i.id, i.personnage_id, p.nom AS personnage_nom
      FROM public.inscriptions_evenements i
      JOIN public.personnages p ON p.id = i.personnage_id
     WHERE i.evenement_id = p_evenement_id AND i.statut = 'en_attente' AND i.personnage_id IS NOT NULL
  LOOP
    UPDATE public.inscriptions_evenements
       SET statut = 'absent', updated_at = now()
     WHERE id = v_absent.id;
    PERFORM public.log_audit(
      'personnage', v_absent.personnage_id, 'absence_evenement',
      jsonb_build_object(
        'personnage_nom', v_absent.personnage_nom,
        'evenement_id', p_evenement_id,
        'evenement_titre', v_evt.titre,
        'inscription_id', v_absent.id,
        'recompense', 'aucune'
      )
    );
    v_count_absent := v_count_absent + 1;
  END LOOP;

  UPDATE public.evenements SET est_termine = true, updated_at = now() WHERE id = p_evenement_id;

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', v_avertissements,
    'donnees', jsonb_build_object(
      'evenement_id', p_evenement_id,
      'nb_presences_recompensees', v_count_present,
      'nb_deja_recompensees', v_count_deja,
      'nb_absents', v_count_absent,
      'nb_echecs', jsonb_array_length(v_avertissements),
      'xp_par_presence', COALESCE(v_evt.xp_recompense, 0),
      'niveaux_par_presence', COALESCE(v_evt.niveaux_recompense, 0)));
END;
$function$;

-- ───────────────────────── 3b) ajouter_presence_tardive ─────────────────────────
CREATE OR REPLACE FUNCTION public.ajouter_presence_tardive(p_evenement_id uuid, p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_evt public.evenements%ROWTYPE;
  v_joueur_id uuid;
  v_inscription uuid;
  v_existe boolean;
  v_res jsonb;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'acces_refuse', 'message', 'Accès refusé.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_evt FROM public.evenements WHERE id = p_evenement_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'evenement_introuvable', 'message', 'Événement introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT joueur_id INTO v_joueur_id FROM public.personnages WHERE id = p_personnage_id;
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_introuvable', 'message', 'Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.inscriptions_evenements
     WHERE evenement_id = p_evenement_id AND personnage_id = p_personnage_id
  ) INTO v_existe;

  IF v_existe THEN
    SELECT id INTO v_inscription FROM public.inscriptions_evenements
     WHERE evenement_id = p_evenement_id AND personnage_id = p_personnage_id;
  ELSE
    INSERT INTO public.inscriptions_evenements
      (evenement_id, personnage_id, joueur_id, statut, date_inscription, date_confirmation)
    VALUES
      (p_evenement_id, p_personnage_id, v_joueur_id, 'present', now(), now())
    RETURNING id INTO v_inscription;
  END IF;

  -- Toute la récompense (XP/banque, niveau, compteurs, photo, notification, idempotence)
  -- vit dans le chokepoint unique.
  v_res := public.attribuer_xp_evenement(v_inscription);
  IF NOT COALESCE((v_res->>'succes')::boolean, false) THEN
    RETURN v_res;
  END IF;

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', (v_res->'donnees') || jsonb_build_object('inscription_existante', v_existe));
END;
$function$;
