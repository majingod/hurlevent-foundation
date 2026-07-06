-- changer_statut_inscription v2 — consciente de la clôture.
-- Avant : flip naïf du statut, aucune logique de récompense → present post-clôture
-- sans XP (bug 1er GN), absent post-récompense qui garde tout.
-- Après : événement non terminé = flip simple (XP à la clôture, inchangé) ;
-- terminé + →present = délègue au chokepoint attribuer_xp_evenement ;
-- terminé + quitte present récompensé = annulation complète (gain_correction −XP,
-- compteur −1 → niveau via trigger, photo compo retirée, notif joueur, audit),
-- REFUSÉE avec le détail des dépenses si le joueur a déjà dépensé cet XP.
-- Récompenses banque (mini_gn / entretien_terrain) : annulation non supportée v1.
CREATE OR REPLACE FUNCTION public.changer_statut_inscription(p_inscription_id uuid, p_nouveau_statut text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_ins record; v_evt record; v_res jsonb;
  v_xp int; v_gain_date timestamptz; v_detail text;
  v_perso record; v_compte_id uuid;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','acces_refuse','message','Accès refusé.')),
      'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
  END IF;
  IF p_nouveau_statut NOT IN ('en_attente','present','absent','annule') THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','statut_invalide',
        'message', format('Statut invalide. Valeurs acceptées : en_attente, present, absent, annule. Reçu : %s', p_nouveau_statut))),
      'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
  END IF;
  SELECT * INTO v_ins FROM public.inscriptions_evenements WHERE id = p_inscription_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','inscription_introuvable','message','Inscription introuvable.')),
      'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
  END IF;
  SELECT * INTO v_evt FROM public.evenements WHERE id = v_ins.evenement_id;

  -- CAS 1 : événement non terminé → flip simple (XP à la clôture)
  IF v_evt.id IS NULL OR NOT COALESCE(v_evt.est_termine, false) THEN
    UPDATE public.inscriptions_evenements
       SET statut = p_nouveau_statut, updated_at = now(),
           date_confirmation = CASE WHEN p_nouveau_statut='present' THEN COALESCE(date_confirmation, now()) ELSE date_confirmation END
     WHERE id = p_inscription_id;
    RETURN jsonb_build_object('succes', true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
      'donnees', jsonb_build_object('inscription_id',p_inscription_id,'ancien_statut',v_ins.statut,'nouveau_statut',p_nouveau_statut));
  END IF;

  -- CAS 2 : terminé + → present → récompense via le chokepoint unique
  IF p_nouveau_statut = 'present' THEN
    IF COALESCE(v_ins.recompense_distribuee,false) THEN
      UPDATE public.inscriptions_evenements SET statut='present', updated_at=now() WHERE id=p_inscription_id;
      RETURN jsonb_build_object('succes', true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
        'donnees', jsonb_build_object('inscription_id',p_inscription_id,'ancien_statut',v_ins.statut,'nouveau_statut','present','recompense','deja_distribuee'));
    END IF;
    v_res := public.attribuer_xp_evenement(p_inscription_id);
    RETURN v_res;
  END IF;

  -- CAS 3 : terminé + quitte 'present' récompensé → annulation
  IF COALESCE(v_ins.recompense_distribuee,false) THEN
    IF v_evt.type_evenement IN ('mini_gn','entretien_terrain') THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','annulation_banque_non_supportee',
          'message','La récompense de cet événement est allée en banque XP — annulation automatique non supportée, à traiter manuellement.')),
        'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
    END IF;
    v_xp := COALESCE(NULLIF(v_ins.xp_attribue,0), v_evt.xp_recompense, 0);
    SELECT p.* INTO v_perso FROM public.personnages p WHERE p.id = v_ins.personnage_id;
    -- Garde invariant : le joueur a-t-il déjà dépensé cet XP ?
    IF v_perso.xp_total - v_xp < v_perso.xp_depense THEN
      SELECT h.created_at INTO v_gain_date FROM public.historique_xp h
       WHERE h.inscription_id = p_inscription_id AND h.type_mouvement='gain_evenement'
       ORDER BY h.created_at DESC LIMIT 1;
      SELECT string_agg(format('%s (%s XP, %s)', h.description, abs(h.montant), to_char(h.created_at,'DD/MM HH24:MI')), ' · ' ORDER BY h.created_at)
        INTO v_detail
      FROM public.historique_xp h
      WHERE h.personnage_id = v_ins.personnage_id
        AND h.type_mouvement LIKE 'depense_%'
        AND h.created_at >= COALESCE(v_gain_date, now() - interval '100 years');
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','xp_deja_depense',
          'message', format('Impossible de retirer la récompense : il ne reste que %s XP disponibles sur les %s à reprendre. Dépenses depuis la présence : %s — annulez d''abord ces achats, puis réessayez.',
            v_perso.xp_total - v_perso.xp_depense, v_xp, COALESCE(v_detail,'(aucune dépense trouvée)')))),
        'avertissements','[]'::jsonb,
        'donnees', jsonb_build_object('xp_disponible', v_perso.xp_total - v_perso.xp_depense, 'xp_a_reprendre', v_xp));
    END IF;
    IF v_xp > 0 THEN
      INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, evenement_id, inscription_id, acteur_id)
      VALUES (v_ins.personnage_id, 'gain_correction', -v_xp,
        format('Annulation de la présence à « %s » — récompense retirée', COALESCE(v_evt.titre,'Sans titre')),
        v_ins.evenement_id, p_inscription_id, auth.uid());
    END IF;
    UPDATE public.inscriptions_evenements
       SET statut = p_nouveau_statut, recompense_distribuee = false, xp_attribue = 0, updated_at = now()
     WHERE id = p_inscription_id;
    UPDATE public.personnages
       SET gn_completes = GREATEST(0, COALESCE(gn_completes,0) - CASE WHEN v_evt.type_evenement='gn_regulier' THEN 1 ELSE 0 END),
           updated_at = now()
     WHERE id = v_ins.personnage_id;
    DELETE FROM public.personnage_compo_photos WHERE inscription_id = p_inscription_id;
    SELECT compte_id INTO v_compte_id FROM public.profils_joueur WHERE id = v_ins.joueur_id;
    IF v_compte_id IS NOT NULL THEN
      PERFORM public.creer_notification(
        p_message := format('Votre présence à « %s » a été retirée par l''équipe d''animation (−%s XP%s).',
          COALESCE(v_evt.titre,'Sans titre'), v_xp,
          CASE WHEN COALESCE(v_evt.niveaux_recompense,0) > 0 THEN format(', −%s niveau', v_evt.niveaux_recompense) ELSE '' END),
        p_type := 'info', p_profil_id := v_ins.joueur_id, p_reference_id := v_ins.personnage_id);
    END IF;
    PERFORM public.log_audit('personnage', v_ins.personnage_id, 'annulation_recompense_evenement',
      jsonb_build_object('evenement_id', v_ins.evenement_id, 'inscription_id', p_inscription_id,
        'xp_retire', v_xp, 'nouveau_statut', p_nouveau_statut, 'titre', COALESCE(v_evt.titre,'Sans titre')));
    RETURN jsonb_build_object('succes', true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
      'donnees', jsonb_build_object('inscription_id',p_inscription_id,'ancien_statut',v_ins.statut,
        'nouveau_statut',p_nouveau_statut,'xp_retire',v_xp,'annulation',true));
  END IF;

  -- CAS 4 : terminé, aucune récompense en jeu → flip simple
  UPDATE public.inscriptions_evenements SET statut=p_nouveau_statut, updated_at=now() WHERE id=p_inscription_id;
  RETURN jsonb_build_object('succes', true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('inscription_id',p_inscription_id,'ancien_statut',v_ins.statut,'nouveau_statut',p_nouveau_statut));
END; $fn$;
