-- JOURNAL-DETAIL : fige le nom (et le niveau) de l'élément dans journal_audit.details
-- au moment du log, pour les 7 RPC d'achat + 6 RPC de désachat.
-- Durable/immuable : le journal ne dépend plus d'une jointure live (ligne perso supprimée
-- au désachat = id orphelin). Méta-bloc : replace() littéral de la ligne log_audit dans
-- chaque def (pg_get_functiondef) puis EXECUTE. Idempotent (skip si déjà enrichi).
DO $meta$
DECLARE
  r record; v_def text; v_new text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('public.acheter_competence(uuid,uuid,integer,text,boolean,text)',
       $o$jsonb_build_object('competence_id', p_competence_id, 'niveau', p_niveau_desire, 'cout_xp', v_cout_xp)$o$,
       $n$jsonb_build_object('competence_id', p_competence_id, 'nom', (SELECT nom FROM competences WHERE id = p_competence_id), 'niveau', p_niveau_desire, 'cout_xp', v_cout_xp)$n$),
      ('public.acheter_sort(uuid,uuid,integer,text,text,text,text)',
       $o$jsonb_build_object('sort_id', p_sort_id, 'niveau', p_niveau_sort, 'cout_xp', v_cout_xp)$o$,
       $n$jsonb_build_object('sort_id', p_sort_id, 'nom', (SELECT nom FROM sorts WHERE id = p_sort_id), 'niveau', p_niveau_sort, 'cout_xp', v_cout_xp)$n$),
      ('public.acheter_priere(uuid,uuid,integer,text,text,text,text)',
       $o$jsonb_build_object('priere_id', p_priere_id, 'niveau', p_niveau_priere, 'cout_xp', v_cout_xp)$o$,
       $n$jsonb_build_object('priere_id', p_priere_id, 'nom', (SELECT nom FROM prieres WHERE id = p_priere_id), 'niveau', p_niveau_priere, 'cout_xp', v_cout_xp)$n$),
      ('public.acheter_recette(uuid,uuid)',
       $o$jsonb_build_object('recette_id', p_recette_id, 'cout_xp', v_ligne.xp_depense)$o$,
       $n$jsonb_build_object('recette_id', p_recette_id, 'nom', (SELECT nom FROM recettes_alchimie WHERE id = p_recette_id), 'cout_xp', v_ligne.xp_depense)$n$),
      ('public.acheter_assemblage(uuid,uuid)',
       $o$jsonb_build_object('assemblage_id', p_assemblage_id, 'cout_xp', v_ligne.xp_depense)$o$,
       $n$jsonb_build_object('assemblage_id', p_assemblage_id, 'nom', (SELECT nom FROM assemblages_runes WHERE id = p_assemblage_id), 'cout_xp', v_ligne.xp_depense)$n$),
      ('public.acheter_piege(uuid,uuid)',
       $o$jsonb_build_object('piege_id', p_piege_id, 'cout_xp', v_cout_xp)$o$,
       $n$jsonb_build_object('piege_id', p_piege_id, 'nom', (SELECT nom FROM pieges WHERE id = p_piege_id), 'cout_xp', v_cout_xp)$n$),
      ('public.acheter_trait_racial(uuid,uuid)',
       $o$jsonb_build_object('trait_id', p_trait_id, 'cout_xp', v_cout_xp)$o$,
       $n$jsonb_build_object('trait_id', p_trait_id, 'nom', (SELECT nom FROM traits_raciaux WHERE id = p_trait_id), 'cout_xp', v_cout_xp)$n$),
      ('public.desacheter_competence(uuid,boolean)',
       $o$jsonb_build_object('personnage_competence_id', p_personnage_competence_id, 'xp_rembourse', v_xp_rembourse)$o$,
       $n$jsonb_build_object('personnage_competence_id', p_personnage_competence_id, 'nom', (SELECT nom FROM competences WHERE id = v_pc.competence_id), 'niveau', v_pc.niveau_acquis, 'xp_rembourse', v_xp_rembourse)$n$),
      ('public.desacheter_sort(uuid)',
       $o$jsonb_build_object('personnage_sort_id', p_personnage_sort_id, 'xp_rembourse', v_ps.xp_depense)$o$,
       $n$jsonb_build_object('personnage_sort_id', p_personnage_sort_id, 'nom', (SELECT nom FROM sorts WHERE id = v_ps.sort_id), 'niveau', v_ps.niveau_sort, 'xp_rembourse', v_ps.xp_depense)$n$),
      ('public.desacheter_priere(uuid)',
       $o$jsonb_build_object('personnage_priere_id', p_personnage_priere_id, 'xp_rembourse', v_pp.xp_depense)$o$,
       $n$jsonb_build_object('personnage_priere_id', p_personnage_priere_id, 'nom', (SELECT nom FROM prieres WHERE id = v_pp.priere_id), 'niveau', v_pp.niveau_priere, 'xp_rembourse', v_pp.xp_depense)$n$),
      ('public.desacheter_recette(uuid)',
       $o$jsonb_build_object('personnage_recette_id', p_personnage_recette_id, 'xp_rembourse', CASE WHEN v_pr.est_gratuit THEN 0 ELSE v_pr.xp_depense END)$o$,
       $n$jsonb_build_object('personnage_recette_id', p_personnage_recette_id, 'nom', (SELECT nom FROM recettes_alchimie WHERE id = v_pr.recette_id), 'xp_rembourse', CASE WHEN v_pr.est_gratuit THEN 0 ELSE v_pr.xp_depense END)$n$),
      ('public.desacheter_assemblage(uuid)',
       $o$jsonb_build_object('personnage_assemblage_id', p_personnage_assemblage_id, 'xp_rembourse', CASE WHEN v_pa.est_gratuit THEN 0 ELSE v_pa.xp_depense END)$o$,
       $n$jsonb_build_object('personnage_assemblage_id', p_personnage_assemblage_id, 'nom', (SELECT nom FROM assemblages_runes WHERE id = v_pa.assemblage_id), 'xp_rembourse', CASE WHEN v_pa.est_gratuit THEN 0 ELSE v_pa.xp_depense END)$n$),
      ('public.desacheter_piege(uuid)',
       $o$jsonb_build_object('personnage_piege_id', p_personnage_piege_id, 'xp_rembourse', v_xp_total_rembourse)$o$,
       $n$jsonb_build_object('personnage_piege_id', p_personnage_piege_id, 'nom', v_pp.piege_nom, 'niveau', v_pp.niveau_acquis, 'xp_rembourse', v_xp_total_rembourse)$n$)
    ) AS t(sig, old_frag, new_frag)
  LOOP
    v_def := pg_get_functiondef(r.sig::regprocedure);
    IF position(r.old_frag IN v_def) = 0 THEN
      IF position(r.new_frag IN v_def) > 0 THEN CONTINUE; -- déjà enrichi (idempotent)
      ELSE RAISE EXCEPTION 'Forme inattendue (ni old ni new) dans %', r.sig; END IF;
    END IF;
    v_new := replace(v_def, r.old_frag, r.new_frag);
    EXECUTE v_new;
  END LOOP;
END $meta$;
