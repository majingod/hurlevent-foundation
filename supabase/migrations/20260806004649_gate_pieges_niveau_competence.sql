-- [GATE-PIEGES-NIVEAU-COMPETENCE] (s378) — Alignement gate <-> manuel :
-- « Création et désarmement de piège N : permet d'installer des pièges de niveau N. »
-- La gate autorisait l'achat PAYANT d'un palier superieur au niveau de la competence
-- (0 cas en base, correctif preventif). Insertion ancree dans le prosrc VIVANT :
-- zero retranscription du corps, echec explicite si l'ancre n'est pas unique.
DO $$
DECLARE
  v_src text; v_n int;
  v_anchor text := $a$'raison', 'Compétence « Création et désarmement de piège » requise');
  END IF;$a$;
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
  IF position(v_insert in v_src) > 0 THEN
    RAISE NOTICE 'gate deja patchee, rien a faire';
    RETURN;
  END IF;
  v_n := (length(v_src) - length(replace(v_src, v_anchor, ''))) / length(v_anchor);
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ancre non unique (count=%), migration refusee', v_n;
  END IF;
  v_src := replace(v_src, v_anchor, v_anchor || v_insert);
  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.peut_acheter_piege(p_personnage_id uuid, p_piege_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS %L',
    v_src);
END $$;

-- CREATE OR REPLACE remet l'ACL a PUBLIC : re-poser a l'identique (mesure s378).
REVOKE ALL ON FUNCTION public.peut_acheter_piege(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peut_acheter_piege(uuid, uuid) TO authenticated, service_role;