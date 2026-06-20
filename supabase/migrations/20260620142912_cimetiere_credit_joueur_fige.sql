-- C2-b : crédit joueur figé dans la stèle (survit à la purge), éditable par le staff.

-- 1. Colonne figée (autonome, nullable)
ALTER TABLE public.cimetiere ADD COLUMN IF NOT EXISTS joueur_nom text;

-- 2. _figer_stele : capture profils_joueur.nom au moment du figement
CREATE OR REPLACE FUNCTION public._figer_stele(p_personnage_id uuid, p_epitaphe text, p_cree_par uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_snapshot jsonb; v_nom text; v_race text; v_classe text; v_niveau int;
  v_joueur_nom text; v_id uuid;
BEGIN
  SELECT to_jsonb(f.*), f.nom, f.race_nom, f.classe_nom, f.niveau, pj.nom
    INTO v_snapshot, v_nom, v_race, v_classe, v_niveau, v_joueur_nom
    FROM public.vue_fiche_personnage f
    LEFT JOIN public.profils_joueur pj ON pj.id = f.joueur_id
    WHERE f.id = p_personnage_id;
  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Personnage introuvable pour la stele: %', p_personnage_id;
  END IF;

  INSERT INTO public.cimetiere (personnage_id_origine, nom, race, classe, niveau, joueur_nom, epitaphe, snapshot, cree_par)
  VALUES (p_personnage_id, v_nom, v_race, v_classe, v_niveau, v_joueur_nom,
          NULLIF(trim(COALESCE(p_epitaphe,'')),''), v_snapshot, p_cree_par)
  RETURNING id INTO v_id;

  UPDATE public.personnages SET est_mort = true WHERE id = p_personnage_id;
  RETURN v_id;
END;
$function$;

-- 3. modifier_stele : +p_joueur_nom (DROP ancienne signature 3-args puis CREATE 4-args -- pas d'overload DEFAULT pour PostgREST)
DROP FUNCTION IF EXISTS public.modifier_stele(uuid, text, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.modifier_stele(
  p_cimetiere_id uuid,
  p_epitaphe text DEFAULT NULL,
  p_date_mort timestamp with time zone DEFAULT NULL,
  p_joueur_nom text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_s RECORD;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Réservé au staff');
  END IF;
  SELECT * INTO v_s FROM public.cimetiere WHERE id = p_cimetiere_id;
  IF v_s IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Stèle introuvable');
  END IF;

  UPDATE public.cimetiere
    SET epitaphe   = COALESCE(p_epitaphe, epitaphe),
        date_mort  = COALESCE(p_date_mort, date_mort),
        joueur_nom = COALESCE(p_joueur_nom, joueur_nom)
    WHERE id = p_cimetiere_id;

  PERFORM public.log_audit('personnage', v_s.personnage_id_origine, 'modifier_stele',
    jsonb_build_object('cimetiere_id', p_cimetiere_id, 'nom', v_s.nom));

  RETURN jsonb_build_object('succes', true, 'message', 'Stèle mise à jour.');
END;
$function$;

-- 4. vue_cimetiere : append joueur_nom en fin (append-only)
CREATE OR REPLACE VIEW public.vue_cimetiere AS
 SELECT id,
    personnage_id_origine,
    nom,
    race,
    classe,
    niveau,
    date_mort,
    epitaphe,
    snapshot,
    created_at,
    joueur_nom
   FROM public.cimetiere
  ORDER BY date_mort DESC;
