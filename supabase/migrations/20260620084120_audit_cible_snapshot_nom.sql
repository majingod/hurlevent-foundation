-- AUDIT-CIBLE (s247) : le journal d'audit affichait « — » en CIBLE pour bloquer/purger.
-- Cause : vue_journal_staff résolvait cible_nom par lookup live uniquement (NULL dès que
-- la cible est supprimée par la purge), et le CASE ne gérait pas le type 'profil'.
-- Fix : snapshot du nom dans details au moment du log + COALESCE(lookup_live, details) dans la vue.

-- 1) purger_compte : capturer nom_affichage AVANT la purge interne et le loguer (details.nom)
CREATE OR REPLACE FUNCTION public.purger_compte(p_compte_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_compte record; v_nb_profils int; v_nb_persos int; v_nb_events int;
BEGIN
  IF NOT est_admin() THEN
    RETURN jsonb_build_object('succes',false,'erreurs',
      jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Reserve aux administrateurs.')),
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
  PERFORM _purger_compte_interne(p_compte_id);
  PERFORM log_audit('compte', p_compte_id, 'purger',
    jsonb_build_object('nom', v_compte.nom_affichage, 'nb_profils', v_nb_profils,
                       'nb_persos', v_nb_persos, 'nb_events_detaches', v_nb_events));
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('nb_profils', v_nb_profils, 'nb_persos', v_nb_persos,
                                  'nb_events_detaches', v_nb_events, 'login_conserve', true));
END; $function$;

-- 2) vue_journal_staff : COALESCE(lookup_live, details.nom, details.libelle) + branche 'profil'
--    (colonne cible_nom existante : on remplace seulement son expression, ordre/type conservés)
CREATE OR REPLACE VIEW public.vue_journal_staff AS
 SELECT id,
    acteur_id,
    acteur_role,
    cible_type,
    cible_id,
    action,
    details,
    created_at,
    nom_profil_principal(acteur_id) AS acteur_nom,
        CASE cible_type
            WHEN 'personnage'::text THEN COALESCE(( SELECT p.nom
               FROM personnages p
              WHERE p.id = j.cible_id), j.details->>'nom', j.details->>'libelle')
            WHEN 'profil'::text THEN COALESCE(( SELECT pj.nom
               FROM profils_joueur pj
              WHERE pj.id = j.cible_id), j.details->>'nom', j.details->>'libelle')
            WHEN 'banque'::text THEN COALESCE(( SELECT pj.nom
               FROM profils_joueur pj
              WHERE pj.id = j.cible_id), j.details->>'nom', j.details->>'libelle')
            WHEN 'compte'::text THEN COALESCE(( SELECT pr.nom_affichage
               FROM profiles pr
              WHERE pr.id = j.cible_id), j.details->>'nom', j.details->>'libelle')
            ELSE NULL::text
        END AS cible_nom
   FROM journal_audit j
  WHERE acteur_role <> 'proprietaire'::text;
