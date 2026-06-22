-- JOURNAL-AUDIT PR2 : 22 RPC d'action-joueur
--   (1) gate d'autorisation : compte_voit_joueur(X) AND NOT est_animateur_ou_admin()
--       -> peut_editer_personnage(X)   [retire le droit d'edition aux animateurs ; impersonation = admin only]
--   (2) logging d'audit via log_audit() :
--       - 18 RPC conditionnels (achats/desachats/wizard) : log SI impersonation admin (NOT compte_voit_joueur)
--       - 4 RPC cycle de vie (valider/reouvrir/changer_classe/creer_demande_race) : log inconditionnel
-- details enrichis : cout_xp (achats) / xp_rembourse (desachats, changer_classe).
-- Transformation deterministe par regexp depuis pg_get_functiondef de l'etat post-PR1 (socle).
-- Rejouable : sur un replay sequentiel, s'execute une fois contre l'etat pre-PR2.
DO $outer$
DECLARE r record;
BEGIN
  FOR r IN
    WITH cfg(fn, is_cond, perso_expr, joueur_expr, details_sql, is_special) AS (VALUES
      ('acheter_assemblage',   true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('assemblage_id', p_assemblage_id, 'cout_xp', v_ligne.xp_depense)$x$, false),
      ('acheter_competence',   true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('competence_id', p_competence_id, 'niveau', p_niveau_desire, 'cout_xp', v_cout_xp)$x$, false),
      ('acheter_piege',        true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('piege_id', p_piege_id, 'cout_xp', v_cout_xp)$x$, false),
      ('acheter_priere',       true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('priere_id', p_priere_id, 'niveau', p_niveau_priere, 'cout_xp', v_cout_xp)$x$, false),
      ('acheter_recette',      true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('recette_id', p_recette_id, 'cout_xp', v_ligne.xp_depense)$x$, false),
      ('acheter_sort',         true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('sort_id', p_sort_id, 'niveau', p_niveau_sort, 'cout_xp', v_cout_xp)$x$, false),
      ('acheter_trait_racial', true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('trait_id', p_trait_id, 'cout_xp', v_cout_xp)$x$, false),
      ('desacheter_assemblage',true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('personnage_assemblage_id', p_personnage_assemblage_id, 'xp_rembourse', CASE WHEN v_pa.est_gratuit THEN 0 ELSE v_pa.xp_depense END)$x$, false),
      ('desacheter_competence',true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('personnage_competence_id', p_personnage_competence_id, 'xp_rembourse', v_xp_rembourse)$x$, false),
      ('desacheter_piege',     true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('personnage_piege_id', p_personnage_piege_id, 'xp_rembourse', v_xp_total_rembourse)$x$, false),
      ('desacheter_priere',    true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('personnage_priere_id', p_personnage_priere_id, 'xp_rembourse', v_pp.xp_depense)$x$, false),
      ('desacheter_recette',   true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('personnage_recette_id', p_personnage_recette_id, 'xp_rembourse', CASE WHEN v_pr.est_gratuit THEN 0 ELSE v_pr.xp_depense END)$x$, false),
      ('desacheter_sort',      true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('personnage_sort_id', p_personnage_sort_id, 'xp_rembourse', v_ps.xp_depense)$x$, false),
      ('sauvegarder_etape_1',  true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('etape', 1)$x$, false),
      ('sauvegarder_etape_2',  true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('etape', 2)$x$, false),
      ('sauvegarder_etape_3',  true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('etape', 3)$x$, false),
      ('sauvegarder_etape_4',  true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('etape', 4)$x$, false),
      ('avancer_etape',        true, 'v_perso.id','v_perso.joueur_id', $x$jsonb_build_object('etape_courante', p_etape_courante)$x$, false),
      ('reouvrir_personnage',  false,'p_personnage_id',NULL, $x$'{}'::jsonb$x$, false),
      ('changer_classe_personnage', false,'p_personnage_id',NULL, $x$jsonb_build_object('classe_id', p_classe_id, 'classe_avant', v_ancienne.nom, 'classe_apres', v_classe.nom, 'xp_rembourse', v_xp_rembourse)$x$, false),
      ('creer_demande_race',   false,'p_personnage_id',NULL, $x$jsonb_build_object('race_id', v_personnage.race_id, 'demande_id', v_demande_id)$x$, false),
      ('valider_personnage_final', false,'p_personnage_id',NULL, $x$'{}'::jsonb$x$, true)
    ),
    src AS (SELECT p.proname AS fn, pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname IN (SELECT fn FROM cfg)),
    swapped AS (SELECT s.fn, regexp_replace(s.def,'NOT public\.compte_voit_joueur\(([^)]*)\) AND NOT (public\.)?est_animateur_ou_admin\(\)','NOT public.peut_editer_personnage(\1)') AS def FROM src s),
    block AS (
      SELECT c.fn, c.is_special,
        CASE WHEN c.is_cond
          THEN format(E'IF NOT public.compte_voit_joueur(%s) THEN\n    PERFORM public.log_audit(''personnage'', %s, ''%s'', %s);\n  END IF;', c.joueur_expr, c.perso_expr, c.fn, c.details_sql)
          ELSE format(E'PERFORM public.log_audit(''personnage'', %s, ''%s'', %s);', c.perso_expr, c.fn, c.details_sql)
        END AS logblock
      FROM cfg c
    ),
    logged AS (
      SELECT w.fn,
        CASE WHEN b.is_special THEN
          regexp_replace(w.def, E'(\\n[ ]+)(RETURN jsonb_build_object\\(''valide'', true)', E'\\1' || b.logblock || E'\\1\\2')
        ELSE
          regexp_replace(w.def, E'(\\n[ ]+RETURN [^;]+;)(\\s*END;\\s*\\$function\\$)', E'\n  ' || b.logblock || E'\\1\\2')
        END AS def
      FROM swapped w JOIN block b ON b.fn=w.fn
    )
    SELECT fn, def FROM logged
  LOOP
    EXECUTE r.def;
  END LOOP;
END $outer$;
