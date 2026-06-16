-- ============================================================
-- s205 · NOTIFS-v2 (PR2) — câblage navigation des notifs info/banque
-- Ajoute reference_id (= personnage) aux notifs perso, et type='banque'
-- aux notifs de banque, pour activer la navigation au clic livrée en PR1.
-- Aucune autre logique modifiée. Idempotent (CREATE OR REPLACE).
-- ============================================================

-- 0) Élargir la contrainte de type pour autoriser 'banque' (additif, réversible).
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['info','validation_race','validation_maitre','xp','evenement','demande_race_nouvelle','race_approuvee','race_refusee','banque']));

-- 1) Correction de niveau → fiche perso (reference_id = personnage)
CREATE OR REPLACE FUNCTION public.corriger_niveau_personnage(p_personnage_id uuid, p_delta integer, p_raison text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_perso         RECORD;
  v_compte_id     uuid;
  v_niveau_avant  int;
  v_niveau_apres  int;
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

  INSERT INTO public.notifications (user_id, message, reference_id)
  VALUES (v_compte_id,
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
END; $function$;

-- 2) Correction d'XP → fiche perso (reference_id = personnage)
CREATE OR REPLACE FUNCTION public.corriger_xp_personnage(p_personnage_id uuid, p_montant integer, p_raison text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_perso        RECORD;
  v_compte_id    uuid;
  v_description  text;
  v_total_apres  integer;
  v_dispo_apres  integer;
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

  INSERT INTO public.notifications (user_id, message, reference_id)
  VALUES (v_compte_id,
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

-- 3) Bonus XP → fiche perso (reference_id = personnage). search_path conservé tel quel.
CREATE OR REPLACE FUNCTION public.donner_xp_bonus(p_personnage_id uuid, p_montant integer, p_raison text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_personnage   RECORD;
  v_description  text;
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

  INSERT INTO public.notifications (user_id, message, reference_id)
  VALUES (
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

-- 4) Ajustement de banque → tableau de bord (type='banque')
CREATE OR REPLACE FUNCTION public.ajuster_banque_xp(p_joueur_id uuid, p_montant integer, p_description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_compte_id    uuid;
  v_nom_profil   text;
  v_description  text;
  v_mouvement_id uuid;
  v_solde_apres  integer;
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

  INSERT INTO public.notifications (user_id, type, message)
  VALUES (v_compte_id, 'banque',
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

-- 5) XP d'événement → fiche perso si gain direct ; tableau de bord si banque
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

  IF v_xp > 0 AND v_evenement.type_evenement IN ('mini_gn', 'entretien_terrain') THEN
    v_destination := 'banque';
    v_res_banque := public.crediter_banque_xp(
      v_inscription.joueur_id, v_xp, v_inscription.evenement_id,
      format('%s « %s »',
        CASE v_evenement.type_evenement
          WHEN 'mini_gn'           THEN 'Gain mini-GN'
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
  SET statut                = 'present',
      date_confirmation     = COALESCE(date_confirmation, now()),
      xp_attribue           = v_xp,
      recompense_distribuee = true,
      updated_at            = now()
  WHERE id = p_inscription_id;

  UPDATE public.personnages
  SET niveau             = COALESCE(niveau, 1)             + v_niveaux,
      gn_completes       = COALESCE(gn_completes, 0)       + CASE WHEN v_evenement.type_evenement = 'gn_regulier'       THEN 1 ELSE 0 END,
      mini_gn_completes  = COALESCE(mini_gn_completes, 0)  + CASE WHEN v_evenement.type_evenement = 'mini_gn'           THEN 1 ELSE 0 END,
      ouvertures_terrain = COALESCE(ouvertures_terrain, 0) + CASE WHEN v_evenement.type_evenement = 'entretien_terrain' THEN 1 ELSE 0 END,
      updated_at         = now()
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
        WHEN 'banque'     THEN 'Vous avez reçu ' || v_xp || ' XP en banque pour « ' || COALESCE(v_evenement.titre,'Sans titre') || ' » (utilisables sur n''importe quel personnage)'
        WHEN 'personnage' THEN 'Vous avez reçu ' || v_xp || ' XP pour « ' || COALESCE(v_evenement.titre,'Sans titre') || ' »'
        ELSE 'Votre présence à « ' || COALESCE(v_evenement.titre,'Sans titre') || ' » a été confirmée'
      END
      || CASE WHEN v_niveaux > 0 THEN ' (+' || v_niveaux || ' niveau' || CASE WHEN v_niveaux > 1 THEN 'x' ELSE '' END || ')' ELSE '' END
      || '.';
    INSERT INTO public.notifications (user_id, type, message, reference_id)
    VALUES (
      v_compte_id,
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
