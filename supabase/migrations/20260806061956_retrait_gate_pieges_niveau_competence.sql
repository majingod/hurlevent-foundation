-- RETRAIT [GATE-PIEGES-NIVEAU-COMPETENCE] (s378) — Arbitrage Fred, divergence deliberee :
-- le manuel dit « permet d'installer des pieges de niveau N » (regle de TABLE), mais l'ACHAT
-- d'une amelioration de piege (niv 2/3) est LIBRE meme sans la competence au niveau equivalent
-- — chaque piege et chaque niveau a son cout, la chaine par piege (palier precedent requis)
-- et les quotas gratuits par palier suffisent. Les colonnes de vue_artisanat_quotas le
-- disaient : quota_pieges_AMELIORATION_niv2/3. La condition ajoutee par 20260806004649
-- contredisait le jeu voulu (« avant c'etait parfait ») : on la retire, ancree, idempotent.
DO $$
DECLARE
  v_src text;
  v_insert text := $i$
  IF v_piege.niveau > v_niveau_pieges THEN
    RETURN jsonb_build_object('peut_acheter', false, 'code', 'niveau_requis_non_atteint',
      'raison', format('Palier de piège non débloqué (niveau %s de la compétence requis)', v_piege.niveau), 'champ', 'niveau');
  END IF;$i$;
BEGIN
  SELECT prosrc INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'peut_acheter_piege';
  IF v_src IS NULL THEN
    RAISE EXCEPTION 'peut_acheter_piege introuvable';
  END IF;
  IF position(v_insert in v_src) = 0 THEN
    RAISE NOTICE 'condition deja absente, rien a faire';
    RETURN;
  END IF;
  v_src := replace(v_src, v_insert, '');
  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.peut_acheter_piege(p_personnage_id uuid, p_piege_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS %L',
    v_src);
END $$;

-- CREATE OR REPLACE remet l'ACL a PUBLIC : re-poser a l'identique.
REVOKE ALL ON FUNCTION public.peut_acheter_piege(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peut_acheter_piege(uuid, uuid) TO authenticated, service_role;