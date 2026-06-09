-- ÉDITION-ADMIN-WIZARD / JOURNAL-AUDIT — Phase 1
-- (A) Helper de décision de log  (B) swap gate dans les 18 RPC
-- (C) corriger_xp loggue (4a)     (D) trigger notifications profil->compte (issue 2)

-- (A) Helper : log si action admin OU action cross-compte (staff sur perso d'autrui)
CREATE OR REPLACE FUNCTION public.doit_logger_action(p_joueur_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.est_admin() OR NOT public.compte_voit_joueur(p_joueur_id);
END;
$function$;

-- (B) Swap byte-exact du gate de log dans les 18 RPC achat/vente/étape.
--     Source = définition live (pg_get_functiondef), seule la ligne du gate change.
--     Idempotent : après swap, 'compte_voit_joueur' disparaît du corps -> hors filtre.
DO $migrate$
DECLARE r record; v_new text;
BEGIN
  FOR r IN
    SELECT oid, pg_get_functiondef(oid) AS def
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND prosrc ILIKE '%compte_voit_joueur%'
      AND prosrc ILIKE '%log_audit%'
      AND prosrc ~ 'IF NOT public\.compte_voit_joueur'
  LOOP
    v_new := regexp_replace(r.def,
      'IF NOT public\.compte_voit_joueur\(',
      'IF public.doit_logger_action(', 'g');
    IF v_new <> r.def THEN
      EXECUTE v_new;
    END IF;
  END LOOP;
END
$migrate$;

-- (C) corriger_xp_personnage : journalisation inconditionnelle (RPC staff-only)
CREATE OR REPLACE FUNCTION public.corriger_xp_personnage(p_personnage_id uuid, p_montant integer, p_raison text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_perso       RECORD;
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

  INSERT INTO public.notifications (user_id, message)
  VALUES (v_perso.joueur_id,
    format('Correction de %s%s XP appliquée à « %s »%s.',
      CASE WHEN p_montant > 0 THEN '+' ELSE '' END, p_montant,
      COALESCE(v_perso.nom, 'Sans nom'),
      CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0 THEN ' : ' || trim(p_raison) ELSE '' END));

  -- (4a) Journalisation inconditionnelle de la correction
  PERFORM public.log_audit('personnage', p_personnage_id, 'correction_xp',
    jsonb_build_object('montant', p_montant,
      'raison', NULLIF(trim(COALESCE(p_raison,'')), '')));

  v_dispo_apres := v_total_apres - v_perso.xp_depense;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('xp_corrige', p_montant, 'xp_total', v_total_apres, 'xp_disponible', v_dispo_apres));
END;
$function$;

-- (D) Trigger : toute notif ciblant un profils_joueur.id est réécrite vers le compte.
CREATE OR REPLACE FUNCTION public.resoudre_notif_user_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.user_id := COALESCE(
    (SELECT pj.compte_id FROM public.profils_joueur pj WHERE pj.id = NEW.user_id),
    NEW.user_id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_resoudre_notif_user_id ON public.notifications;
CREATE TRIGGER trg_resoudre_notif_user_id
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.resoudre_notif_user_id();
