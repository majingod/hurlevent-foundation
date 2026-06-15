-- PR-B : niveau indépendant de l'XP via niveau_correction (plancher niveau >= 1)

-- 1) Colonne de correction de niveau
ALTER TABLE public.personnages ADD COLUMN IF NOT EXISTS niveau_correction integer NOT NULL DEFAULT 0;

-- 2) recalculer_xp_valeurs : ajout du 6e param niveau_correction (nouvelle surcharge)
CREATE OR REPLACE FUNCTION public.recalculer_xp_valeurs(
  p_personnage_id uuid, p_race_id uuid, p_gn_completes integer,
  p_mini_gn_completes integer, p_ouvertures_terrain integer, p_niveau_correction integer)
 RETURNS TABLE(xp_total integer, xp_depense integer, niveau integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_dep int; v_gn int; v_gains int; v_dep_xp int; v_remb int;
BEGIN
  SELECT COALESCE(r.xp_depart,0) INTO v_dep FROM races r WHERE r.id = p_race_id;
  v_dep := COALESCE(v_dep,0);
  v_gn := COALESCE(p_gn_completes,0)*15 + COALESCE(p_mini_gn_completes,0)*15 + COALESCE(p_ouvertures_terrain,0)*10;
  -- gain_* augmente xp_total ; depense_* augmente xp_depense ; remboursement DIMINUE xp_depense (pas un gain)
  SELECT
    COALESCE(SUM(CASE WHEN type_mouvement LIKE 'gain_%'     THEN  montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_mouvement LIKE 'depense_%'  THEN -montant ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN type_mouvement = 'remboursement' THEN  montant ELSE 0 END),0)
    INTO v_gains, v_dep_xp, v_remb
  FROM historique_xp WHERE personnage_id = p_personnage_id;
  xp_total := v_dep + v_gn + v_gains;
  xp_depense := v_dep_xp - v_remb;
  niveau := 1 + COALESCE(p_gn_completes,0) + COALESCE(p_niveau_correction,0);
  RETURN NEXT;
END; $function$;

-- 3) Appelant trigger BEFORE sur personnages : passe NEW.niveau_correction
CREATE OR REPLACE FUNCTION public.recalculer_xp_complet_trigger()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v record;
BEGIN
  SELECT * INTO v FROM public.recalculer_xp_valeurs(
    NEW.id, NEW.race_id, NEW.gn_completes, NEW.mini_gn_completes, NEW.ouvertures_terrain, NEW.niveau_correction);
  NEW.xp_total := v.xp_total; NEW.xp_depense := v.xp_depense; NEW.niveau := v.niveau;
  RETURN NEW;
END; $function$;

-- 4) recalculer_xp_personnage : lit niveau_correction et le passe
CREATE OR REPLACE FUNCTION public.recalculer_xp_personnage(p_personnage_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE v_race uuid; v_gn int; v_mini int; v_ouv int; v_corr int; v record;
BEGIN
  SELECT p.race_id, COALESCE(p.gn_completes,0), COALESCE(p.mini_gn_completes,0),
         COALESCE(p.ouvertures_terrain,0), COALESCE(p.niveau_correction,0)
    INTO v_race, v_gn, v_mini, v_ouv, v_corr FROM personnages p WHERE p.id = p_personnage_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('xp_total',0,'xp_depense',0,'niveau',1); END IF;
  SELECT * INTO v FROM public.recalculer_xp_valeurs(p_personnage_id, v_race, v_gn, v_mini, v_ouv, v_corr);
  RETURN jsonb_build_object('xp_total',v.xp_total,'xp_depense',v.xp_depense,'niveau',v.niveau);
END; $function$;

-- 5) verifier_invariant_xp : passe p.niveau_correction
CREATE OR REPLACE FUNCTION public.verifier_invariant_xp()
 RETURNS TABLE(personnage_id uuid, nom text, xp_total_stocke integer, xp_total_calc integer, xp_depense_stocke integer, xp_depense_calc integer, niveau_stocke integer, niveau_calc integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.id, p.nom, p.xp_total, v.xp_total, p.xp_depense, v.xp_depense, p.niveau, v.niveau
  FROM personnages p
  CROSS JOIN LATERAL public.recalculer_xp_valeurs(
    p.id, p.race_id, p.gn_completes, p.mini_gn_completes, p.ouvertures_terrain, p.niveau_correction) v
  WHERE p.xp_total   IS DISTINCT FROM v.xp_total
     OR p.xp_depense IS DISTINCT FROM v.xp_depense
     OR p.niveau     IS DISTINCT FROM v.niveau;
$function$;

-- 6) Retrait de l'ancienne surcharge 5-arg (tous les appelants passent désormais 6 args)
DROP FUNCTION IF EXISTS public.recalculer_xp_valeurs(uuid, uuid, integer, integer, integer);

-- 7) RPC corriger_niveau_personnage (plancher niveau >= 1)
CREATE OR REPLACE FUNCTION public.corriger_niveau_personnage(p_personnage_id uuid, p_delta integer, p_raison text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

  -- Plancher : niveau final >= 1
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
  -- le trigger BEFORE recalcule personnages.niveau (xp_total/xp_depense inchangés)

  INSERT INTO public.notifications (user_id, message)
  VALUES (v_compte_id,
    format('Niveau de « %s » ajusté de %s%s (niveau %s → %s)%s.',
      COALESCE(v_perso.nom,'Sans nom'),
      CASE WHEN p_delta > 0 THEN '+' ELSE '' END, p_delta,
      v_niveau_avant, v_niveau_apres,
      CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison))>0 THEN ' : ' || trim(p_raison) ELSE '' END));

  PERFORM public.log_audit('personnage', p_personnage_id, 'correction_niveau',
    jsonb_build_object('delta', p_delta, 'niveau_avant', v_niveau_avant, 'niveau_apres', v_niveau_apres,
      'raison', NULLIF(trim(COALESCE(p_raison,'')), '')));

  RETURN jsonb_build_object('succes', true, 'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('niveau_avant', v_niveau_avant, 'niveau_apres', v_niveau_apres, 'delta', p_delta));
END; $function$;
