-- [LOI25 s333] Anonymisation du journal d'audit 24 mois apres une purge.
-- Fondement : art. 23 Loi 25 - conservation limitee a des fins serieuses et
-- legitimes (securite, reglement de differends), puis anonymisation.
-- Volet A : purges marquees (details->purge_ids, poses par les 4 guichets).
-- Volet B : filet legacy - entrees orphelines (cible disparue, sans stele).
-- Delai parametrable (defaut 24 mois) pour testabilite.

CREATE OR REPLACE FUNCTION public.anonymiser_journal_purges(p_delai interval DEFAULT interval '24 months')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cles text[] := ARRAY['nom','personnage_nom','joueur_nom','libelle','raison','description','epitaphe','username','email'];
  v_purge record;
  v_ids uuid[];
  v_nb_liees int := 0;
  v_nb_purges int := 0;
  v_nb_orphelines int := 0;
  v_tmp int;
BEGIN
  -- Volet A : purges marquees purge_ids, plus vieilles que p_delai, non traitees
  FOR v_purge IN
    SELECT id, details FROM journal_audit
    WHERE action IN ('supprimer','purger')
      AND details ? 'purge_ids'
      AND NOT COALESCE((details->>'anonymise')::boolean, false)
      AND created_at < now() - p_delai
  LOOP
    v_ids := ARRAY(SELECT jsonb_array_elements_text(v_purge.details->'purge_ids'))::uuid[];

    UPDATE journal_audit
       SET details = details - v_cles,
           acteur_id = CASE WHEN acteur_id = ANY(v_ids) THEN NULL ELSE acteur_id END
     WHERE (cible_id = ANY(v_ids) OR acteur_id = ANY(v_ids))
       AND id <> v_purge.id;
    GET DIAGNOSTICS v_tmp = ROW_COUNT;
    v_nb_liees := v_nb_liees + v_tmp;

    UPDATE journal_audit
       SET details = (details - v_cles - 'purge_ids') || jsonb_build_object('anonymise', true),
           acteur_id = CASE WHEN acteur_id = ANY(v_ids) THEN NULL ELSE acteur_id END
     WHERE id = v_purge.id;
    v_nb_purges := v_nb_purges + 1;
  END LOOP;

  -- Volet B : entrees orphelines de plus de p_delai (cible disparue partout,
  -- morts au cimetiere exclus : la stele est un memorial choisi par le joueur)
  UPDATE journal_audit j
     SET details = (j.details - v_cles) || jsonb_build_object('anonymise', true),
         acteur_id = CASE WHEN j.acteur_id IS NOT NULL
                           AND NOT EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = j.acteur_id)
                          THEN NULL ELSE j.acteur_id END
   WHERE j.created_at < now() - p_delai
     AND NOT COALESCE((j.details->>'anonymise')::boolean, false)
     AND (
       (j.cible_type = 'personnage'
          AND NOT EXISTS (SELECT 1 FROM personnages p WHERE p.id = j.cible_id)
          AND NOT EXISTS (SELECT 1 FROM cimetiere c WHERE c.personnage_id_origine = j.cible_id))
       OR (j.cible_type = 'profil'
          AND NOT EXISTS (SELECT 1 FROM profils_joueur pj WHERE pj.id = j.cible_id))
       OR (j.cible_type = 'compte'
          AND NOT EXISTS (SELECT 1 FROM profiles pr2 WHERE pr2.id = j.cible_id))
     );
  GET DIAGNOSTICS v_nb_orphelines = ROW_COUNT;

  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'purges_traitees', v_nb_purges,
      'entrees_liees', v_nb_liees,
      'entrees_orphelines', v_nb_orphelines));
END;
$function$;

-- Fonction interne serveur (cron) : jamais exposee aux clients
REVOKE ALL ON FUNCTION public.anonymiser_journal_purges(interval) FROM PUBLIC, anon, authenticated;

-- Planification hebdomadaire (dimanche 04:00 UTC), idempotente
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'anonymiser-journal-purges') THEN
    PERFORM cron.unschedule('anonymiser-journal-purges');
  END IF;
  PERFORM cron.schedule('anonymiser-journal-purges', '0 4 * * 0', 'SELECT public.anonymiser_journal_purges()');
END $do$;
