-- s373 — Le chokepoint de récompense ne re-photographie pas une inscription qui a déjà
-- sa photo (prise à la confirmation de présence — décision Fred s373). Comportement
-- inchangé pour les présences tardives sur événement clôturé (aucune photo préalable).
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

  -- Décision Fred s373 : la photo se prend à la CONFIRMATION de présence.
  -- Si elle existe déjà pour cette inscription, ne pas re-photographier ici :
  -- la fiche a pu être modifiée (dégel) entre la confirmation et la clôture.
  INSERT INTO public.personnage_compo_photos (
    personnage_id, evenement_id, inscription_id, compo, acteur_id
  )
  SELECT
    v_inscription.personnage_id,
    v_inscription.evenement_id,
    p_inscription_id,
    public.capturer_compo_personnage(v_inscription.personnage_id),
    auth.uid()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.personnage_compo_photos pcp
    WHERE pcp.inscription_id = p_inscription_id
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

REVOKE ALL ON FUNCTION public.attribuer_xp_evenement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attribuer_xp_evenement(uuid) TO postgres, service_role, authenticated;
