-- ============================================================
-- Lot HARD : purge definitive (compte / profil / personnage)
-- Garde : est_admin() STRICT + objet deja BLOQUE.
-- Login (auth.users) CONSERVE banni (decision A, s245).
-- Ordre FK valide par dry-run logique (s245).
-- Retour standard {succes, erreurs, avertissements, donnees}.
-- ============================================================

-- ---------- Helpers internes (SANS garde) ----------
CREATE OR REPLACE FUNCTION public._purger_personnage_interne(p_personnage_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM inscriptions_evenements WHERE personnage_id = p_personnage_id;
  DELETE FROM personnages WHERE id = p_personnage_id; -- CASCADE/SET NULL le reste
END; $$;

CREATE OR REPLACE FUNCTION public._purger_profil_interne(p_profil_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE rpe record;
BEGIN
  FOR rpe IN SELECT id FROM personnages WHERE joueur_id = p_profil_id LOOP
    PERFORM _purger_personnage_interne(rpe.id);
  END LOOP;
  DELETE FROM inscriptions_evenements WHERE joueur_id = p_profil_id;
  -- historique avant banque (FK RESTRICT historique_xp.banque_mouvement_id) : ceinture
  DELETE FROM historique_xp WHERE banque_mouvement_id IN
    (SELECT id FROM banque_xp_mouvements WHERE joueur_id = p_profil_id);
  DELETE FROM banque_xp_mouvements WHERE joueur_id = p_profil_id;
  DELETE FROM notifications WHERE profil_id = p_profil_id;
  DELETE FROM profils_joueur WHERE id = p_profil_id;
END; $$;

CREATE OR REPLACE FUNCTION public._purger_compte_interne(p_compte_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE rp record;
BEGIN
  FOR rp IN SELECT id FROM profils_joueur WHERE compte_id = p_compte_id LOOP
    PERFORM _purger_profil_interne(rp.id);
  END LOOP;
  DELETE FROM notifications WHERE user_id = p_compte_id;
  UPDATE evenements SET created_by = NULL WHERE created_by = p_compte_id;
  UPDATE personnage_races_demandes SET approuve_par = NULL WHERE approuve_par = p_compte_id;
  DELETE FROM profiles WHERE id = p_compte_id; -- CASCADE profils_joueur (deja vides)
  -- auth.users CONSERVE banni (decision A)
END; $$;

REVOKE EXECUTE ON FUNCTION public._purger_personnage_interne(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._purger_profil_interne(uuid)     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._purger_compte_interne(uuid)     FROM PUBLIC;

-- ---------- Apercu (dry-run, lecture seule) ----------
CREATE OR REPLACE FUNCTION public.apercu_purge(p_type text, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v jsonb; v_bloque boolean; v_nom text; v_existe boolean; v_pids uuid[];
BEGIN
  IF NOT est_admin() THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Reserve aux administrateurs.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;

  IF p_type = 'personnage' THEN
    SELECT true, nom, (est_actif IS FALSE) INTO v_existe, v_nom, v_bloque
      FROM personnages WHERE id = p_id;
    IF v_existe IS NULL THEN
      RETURN jsonb_build_object('succes',false,'erreurs',
        jsonb_build_array(jsonb_build_object('code','INTROUVABLE','message','Personnage introuvable.')),
        'avertissements','[]'::jsonb,'donnees',null);
    END IF;
    v := jsonb_build_object('type','personnage','cible_nom',COALESCE(v_nom,'Sans nom'),
      'est_bloque',v_bloque,
      'nb_inscriptions',(SELECT count(*) FROM inscriptions_evenements WHERE personnage_id=p_id));

  ELSIF p_type = 'profil' THEN
    SELECT true, nom, (est_actif IS FALSE) INTO v_existe, v_nom, v_bloque
      FROM profils_joueur WHERE id = p_id;
    IF v_existe IS NULL THEN
      RETURN jsonb_build_object('succes',false,'erreurs',
        jsonb_build_array(jsonb_build_object('code','INTROUVABLE','message','Profil introuvable.')),
        'avertissements','[]'::jsonb,'donnees',null);
    END IF;
    v := jsonb_build_object('type','profil','cible_nom',v_nom,'est_bloque',v_bloque,
      'persos',(SELECT COALESCE(jsonb_agg(jsonb_build_object('nom',COALESCE(nom,'Sans nom'))),'[]'::jsonb)
                FROM personnages WHERE joueur_id=p_id),
      'nb_persos',(SELECT count(*) FROM personnages WHERE joueur_id=p_id),
      'nb_banque',(SELECT count(*) FROM banque_xp_mouvements WHERE joueur_id=p_id),
      'nb_inscriptions',(SELECT count(*) FROM inscriptions_evenements WHERE joueur_id=p_id),
      'nb_notifs',(SELECT count(*) FROM notifications WHERE profil_id=p_id));

  ELSIF p_type = 'compte' THEN
    SELECT true, (is_active IS FALSE) INTO v_existe, v_bloque FROM profiles WHERE id = p_id;
    IF v_existe IS NULL THEN
      RETURN jsonb_build_object('succes',false,'erreurs',
        jsonb_build_array(jsonb_build_object('code','INTROUVABLE','message','Compte introuvable.')),
        'avertissements','[]'::jsonb,'donnees',null);
    END IF;
    SELECT COALESCE(array_agg(id),'{}') INTO v_pids FROM profils_joueur WHERE compte_id=p_id;
    v := jsonb_build_object('type','compte','est_bloque',v_bloque,'login_conserve',true,
      'profils',(SELECT COALESCE(jsonb_agg(jsonb_build_object('nom',nom)),'[]'::jsonb)
                 FROM profils_joueur WHERE compte_id=p_id),
      'nb_profils',(SELECT count(*) FROM profils_joueur WHERE compte_id=p_id),
      'persos',(SELECT COALESCE(jsonb_agg(jsonb_build_object('nom',COALESCE(p.nom,'Sans nom'),'profil',pj.nom)),'[]'::jsonb)
                FROM personnages p JOIN profils_joueur pj ON pj.id=p.joueur_id WHERE pj.compte_id=p_id),
      'nb_persos',(SELECT count(*) FROM personnages p JOIN profils_joueur pj ON pj.id=p.joueur_id WHERE pj.compte_id=p_id),
      'nb_banque',(SELECT count(*) FROM banque_xp_mouvements WHERE joueur_id = ANY(v_pids)),
      'nb_notifs',(SELECT count(*) FROM notifications WHERE user_id=p_id OR profil_id = ANY(v_pids)),
      'nb_events_detaches',(SELECT count(*) FROM evenements WHERE created_by=p_id));
  ELSE
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','TYPE_INVALIDE','message','Type inconnu (personnage|profil|compte).')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;

  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,'donnees',v);
END; $$;

-- ---------- RPC publiques gardees ----------
CREATE OR REPLACE FUNCTION public.purger_personnage(p_personnage_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_perso record;
BEGIN
  IF NOT est_admin() THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Reserve aux administrateurs.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  SELECT id, nom, est_actif INTO v_perso FROM personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','INTROUVABLE','message','Personnage introuvable.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF v_perso.est_actif IS NOT FALSE THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','NON_BLOQUE','message','Le personnage doit etre bloque avant purge.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  PERFORM _purger_personnage_interne(p_personnage_id);
  PERFORM log_audit('personnage', p_personnage_id, 'purger',
    jsonb_build_object('nom', COALESCE(v_perso.nom,'Sans nom')));
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('nom', COALESCE(v_perso.nom,'Sans nom')));
END; $$;

CREATE OR REPLACE FUNCTION public.purger_profil(p_profil_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_profil record; v_nb_persos int;
BEGIN
  IF NOT est_admin() THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Reserve aux administrateurs.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  SELECT id, nom, est_actif INTO v_profil FROM profils_joueur WHERE id = p_profil_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','INTROUVABLE','message','Profil introuvable.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF v_profil.est_actif IS NOT FALSE THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','NON_BLOQUE','message','Le profil doit etre bloque avant purge.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  SELECT count(*) INTO v_nb_persos FROM personnages WHERE joueur_id = p_profil_id;
  PERFORM _purger_profil_interne(p_profil_id);
  PERFORM log_audit('profil', p_profil_id, 'purger',
    jsonb_build_object('nom', v_profil.nom, 'nb_persos', v_nb_persos));
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('nom', v_profil.nom, 'nb_persos', v_nb_persos));
END; $$;

CREATE OR REPLACE FUNCTION public.purger_compte(p_compte_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_compte record; v_nb_profils int; v_nb_persos int; v_nb_events int;
BEGIN
  IF NOT est_admin() THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Reserve aux administrateurs.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  SELECT id, is_active INTO v_compte FROM profiles WHERE id = p_compte_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','INTROUVABLE','message','Compte introuvable.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF v_compte.is_active IS NOT FALSE THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','NON_BLOQUE','message','Le compte doit etre bloque avant purge.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  SELECT count(*) INTO v_nb_profils FROM profils_joueur WHERE compte_id = p_compte_id;
  SELECT count(*) INTO v_nb_persos FROM personnages p JOIN profils_joueur pj ON pj.id=p.joueur_id WHERE pj.compte_id=p_compte_id;
  SELECT count(*) INTO v_nb_events FROM evenements WHERE created_by = p_compte_id;
  PERFORM _purger_compte_interne(p_compte_id);
  PERFORM log_audit('compte', p_compte_id, 'purger',
    jsonb_build_object('nb_profils', v_nb_profils, 'nb_persos', v_nb_persos, 'nb_events_detaches', v_nb_events));
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('nb_profils', v_nb_profils, 'nb_persos', v_nb_persos,
                                  'nb_events_detaches', v_nb_events, 'login_conserve', true));
END; $$;
