CREATE OR REPLACE FUNCTION public.recalculer_xp_personnage(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_xp_depart         integer;
  v_xp_gn             integer;
  v_xp_gains          integer;
  v_xp_depenses       integer;
  v_xp_remboursements integer;
  v_niveau            integer;
  v_gn                integer;
  v_mini              integer;
  v_ouv               integer;
BEGIN
  SELECT
    COALESCE(r.xp_depart, 0),
    COALESCE(p.gn_completes, 0),
    COALESCE(p.mini_gn_completes, 0),
    COALESCE(p.ouvertures_terrain, 0)
  INTO v_xp_depart, v_gn, v_mini, v_ouv
  FROM personnages p
  LEFT JOIN races r ON r.id = p.race_id
  WHERE p.id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('xp_total', 0, 'xp_depense', 0, 'niveau', 1);
  END IF;

  v_xp_gn := (v_gn * 15) + (v_mini * 15) + (v_ouv * 10);
  v_niveau := 1 + v_gn;

  -- Sémantique des 3 sommes :
  --   gain_*        : XP gagné (events, bonus, corrections) → augmente xp_total
  --   depense_*     : XP dépensé pour un achat              → augmente xp_depense
  --   remboursement : XP rendu après désachat               → diminue xp_depense
  -- Bug pré-fix : remboursement était compté comme gain via SUM(montant > 0) sans filtre type.
  SELECT
    COALESCE(SUM(CASE WHEN type_mouvement LIKE 'gain_%'      THEN  montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type_mouvement LIKE 'depense_%'   THEN -montant ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type_mouvement = 'remboursement'  THEN  montant ELSE 0 END), 0)
    INTO v_xp_gains, v_xp_depenses, v_xp_remboursements
  FROM historique_xp
  WHERE personnage_id = p_personnage_id;

  RETURN jsonb_build_object(
    'xp_total',   v_xp_depart + v_xp_gn + v_xp_gains,
    'xp_depense', v_xp_depenses - v_xp_remboursements,
    'niveau',     v_niveau
  );
END;
$function$;
