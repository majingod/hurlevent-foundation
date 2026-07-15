-- [LOI25 s333] purge_ids dans les entrees de journal des 3 purges admin.
-- Corps identiques a 20260622134555 + capture des ids avant purge.
-- A37 : re-verrouillage ACL apres chaque CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.purger_compte(p_compte_id uuid, p_raison text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_compte record; v_nb_profils int; v_nb_persos int; v_nb_events int;
        v_persos_ids uuid[]; v_profils_ids uuid[];
BEGIN
  IF NOT est_admin() THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Reserve aux administrateurs.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF COALESCE(length(btrim(p_raison)), 0) < 5 THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','RAISON_REQUISE','message','Une raison d''au moins 5 caractères est requise.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  SELECT id, is_active, nom_affichage INTO v_compte FROM profiles WHERE id = p_compte_id;
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
  SELECT COALESCE(array_agg(p.id), ARRAY[]::uuid[]) INTO v_persos_ids
    FROM personnages p JOIN profils_joueur pj ON pj.id=p.joueur_id WHERE pj.compte_id=p_compte_id;
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_profils_ids
    FROM profils_joueur WHERE compte_id = p_compte_id;
  PERFORM _purger_compte_interne(p_compte_id);
  PERFORM log_audit('compte', p_compte_id, 'purger',
    jsonb_build_object('nom', v_compte.nom_affichage, 'nb_profils', v_nb_profils,
                       'nb_persos', v_nb_persos, 'nb_events_detaches', v_nb_events, 'raison', btrim(p_raison),
                       'purge_ids', to_jsonb(v_persos_ids) || to_jsonb(v_profils_ids) || jsonb_build_array(p_compte_id)));
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('nb_profils', v_nb_profils, 'nb_persos', v_nb_persos,
                                  'nb_events_detaches', v_nb_events, 'login_conserve', true));
END;
$function$;

REVOKE ALL ON FUNCTION public.purger_compte(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purger_compte(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.purger_profil(p_profil_id uuid, p_raison text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_profil record; v_nb_persos int; v_persos_ids uuid[];
BEGIN
  IF NOT est_admin() THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Reserve aux administrateurs.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF COALESCE(length(btrim(p_raison)), 0) < 5 THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','RAISON_REQUISE','message','Une raison d''au moins 5 caractères est requise.')),
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
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_persos_ids
    FROM personnages WHERE joueur_id = p_profil_id;
  PERFORM _purger_profil_interne(p_profil_id);
  PERFORM log_audit('profil', p_profil_id, 'purger',
    jsonb_build_object('nom', v_profil.nom, 'nb_persos', v_nb_persos, 'raison', btrim(p_raison),
                       'purge_ids', to_jsonb(v_persos_ids) || jsonb_build_array(p_profil_id)));
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('nom', v_profil.nom, 'nb_persos', v_nb_persos));
END;
$function$;

REVOKE ALL ON FUNCTION public.purger_profil(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purger_profil(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.purger_personnage(p_personnage_id uuid, p_raison text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_perso record;
BEGIN
  IF NOT est_admin() THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Reserve aux administrateurs.')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF COALESCE(length(btrim(p_raison)), 0) < 5 THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','RAISON_REQUISE','message','Une raison d''au moins 5 caractères est requise.')),
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
    jsonb_build_object('nom', COALESCE(v_perso.nom,'Sans nom'), 'raison', btrim(p_raison),
                       'purge_ids', jsonb_build_array(p_personnage_id)));
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('nom', COALESCE(v_perso.nom,'Sans nom')));
END;
$function$;

REVOKE ALL ON FUNCTION public.purger_personnage(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purger_personnage(uuid, text) TO authenticated;
