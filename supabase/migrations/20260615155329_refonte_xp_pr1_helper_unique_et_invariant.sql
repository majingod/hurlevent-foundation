-- REFONTE-XP-SOURCE-UNIQUE — PR1 : Fondation
-- Cible (modèle C) : personnages.xp_* devient un cache dérivé, recalculé par UN helper unique.
-- PR1 pose la fondation SANS toucher encore aux 13 RPC d'achat/désachat (PR2+).
--   1) Helper recalculer_xp_valeurs = source unique de la formule (paramétrée → utilisable
--      depuis un trigger BEFORE où NEW n'est pas en table, ET depuis un recompute lisant la table).
--   2) Le trigger et recalculer_xp_personnage délèguent au helper (fin de la divergence qui
--      réintroduisait le bug "remboursement compté comme gain", cf. 20260524031633).
--   3) B2 : resync de tous les persos (corrige le seul dérivé : Muir-Natha 75/75 -> 60/60).
--   4) verifier_invariant_xp() : filet de sécurité (liste les persos où stocké != recompute).

-- 1) HELPER : source unique de vérité de la formule XP
CREATE OR REPLACE FUNCTION public.recalculer_xp_valeurs(
  p_personnage_id uuid, p_race_id uuid,
  p_gn_completes integer, p_mini_gn_completes integer, p_ouvertures_terrain integer
) RETURNS TABLE (xp_total integer, xp_depense integer, niveau integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
  niveau := 1 + COALESCE(p_gn_completes,0);
  RETURN NEXT;
END; $$;

-- 2a) Trigger : délègue au helper (valeurs NEW)
CREATE OR REPLACE FUNCTION public.recalculer_xp_complet_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v record;
BEGIN
  SELECT * INTO v FROM public.recalculer_xp_valeurs(
    NEW.id, NEW.race_id, NEW.gn_completes, NEW.mini_gn_completes, NEW.ouvertures_terrain);
  NEW.xp_total := v.xp_total; NEW.xp_depense := v.xp_depense; NEW.niveau := v.niveau;
  RETURN NEW;
END; $$;

-- 2b) recalculer_xp_personnage : délègue au helper (signature + retour jsonb INCHANGÉS)
CREATE OR REPLACE FUNCTION public.recalculer_xp_personnage(p_personnage_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE v_race uuid; v_gn int; v_mini int; v_ouv int; v record;
BEGIN
  SELECT p.race_id, COALESCE(p.gn_completes,0), COALESCE(p.mini_gn_completes,0), COALESCE(p.ouvertures_terrain,0)
    INTO v_race, v_gn, v_mini, v_ouv FROM personnages p WHERE p.id = p_personnage_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('xp_total',0,'xp_depense',0,'niveau',1); END IF;
  SELECT * INTO v FROM public.recalculer_xp_valeurs(p_personnage_id, v_race, v_gn, v_mini, v_ouv);
  RETURN jsonb_build_object('xp_total',v.xp_total,'xp_depense',v.xp_depense,'niveau',v.niveau);
END; $$;

-- 3) B2 : resync de TOUS les persos (no-op sur les corrects, corrige Muir-Natha)
WITH calc AS (
  SELECT p.id, v.xp_total, v.xp_depense, v.niveau
  FROM personnages p
  CROSS JOIN LATERAL public.recalculer_xp_valeurs(
    p.id, p.race_id, p.gn_completes, p.mini_gn_completes, p.ouvertures_terrain) v)
UPDATE personnages p
SET xp_total = calc.xp_total, xp_depense = calc.xp_depense, niveau = calc.niveau
FROM calc WHERE calc.id = p.id
  AND (p.xp_total IS DISTINCT FROM calc.xp_total
    OR p.xp_depense IS DISTINCT FROM calc.xp_depense
    OR p.niveau IS DISTINCT FROM calc.niveau);

-- 4) Vérificateur d'invariant : filet de sécurité pour les PR de convergence
CREATE OR REPLACE FUNCTION public.verifier_invariant_xp()
RETURNS TABLE (
  personnage_id uuid, nom text,
  xp_total_stocke int, xp_total_calc int,
  xp_depense_stocke int, xp_depense_calc int,
  niveau_stocke int, niveau_calc int
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.nom, p.xp_total, v.xp_total, p.xp_depense, v.xp_depense, p.niveau, v.niveau
  FROM personnages p
  CROSS JOIN LATERAL public.recalculer_xp_valeurs(
    p.id, p.race_id, p.gn_completes, p.mini_gn_completes, p.ouvertures_terrain) v
  WHERE p.xp_total   IS DISTINCT FROM v.xp_total
     OR p.xp_depense IS DISTINCT FROM v.xp_depense
     OR p.niveau     IS DISTINCT FROM v.niveau;
$$;
