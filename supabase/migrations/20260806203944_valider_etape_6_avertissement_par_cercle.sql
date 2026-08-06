-- s379 · [CERCLES-SECS-VRAIS-JOUEURS] · decision 51
-- L'avertissement d'acces magique dormant devient PAR CERCLE et PAR DOMAINE,
-- et il n'est plus eteint par la garde « le personnage possede-t-il la
-- competence Acquisition de Sort / de Priere ».
--
-- MESURE EN PROD (2026-08-06) — DEUX causes distinctes, deux corrections :
--   · Melias Stormwild : 4 cercles, 4 sorts, aucun sort de Feu. L'ancien
--     avertissement regardait le TOTAL (v_nb_sorts > 0) et se taisait.
--   · Azaelle Malter : 1 domaine ouvert, 0 priere, mais PAS la competence
--     « Acquisition de Priere » -> l'etape 7 sortait en « ignoree » et ne
--     rendait aucun avertissement.
-- Ne jamais re-fusionner ces deux causes en un seul test global (C78).
--
-- Source des acces : personnage_competences, et NON vue_*_disponibles, qui
-- masque un domaine devenu proscrit par la religion (0 cas au 2026-08-06,
-- mais l'XP y serait morte ET invisible).
-- Seuil : on n'avertit que si sum(xp_depense) > 0 — un acces qui n'a rien
-- coute ne fait dormir aucune XP.
--
-- ACL : ces deux fonctions sont a l'ACL par defaut (PUBLIC + anon +
-- authenticated + service_role). CREATE OR REPLACE la remet a PUBLIC, ce qui
-- est deja l'etat courant : on la re-pose quand meme, a l'identique.

CREATE OR REPLACE FUNCTION public.valider_etape_6(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_sort RECORD; v_sec RECORD; v_niveau_max integer;
  v_erreurs jsonb := '[]'::jsonb; v_avertissements jsonb := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.personnages WHERE id = p_personnage_id) THEN
    RETURN jsonb_build_object('valide', false, 'ignoree', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb);
  END IF;

  -- Acces dormants, calcules AVANT la garde ci-dessous (cause Azaelle).
  FOR v_sec IN
    SELECT pc.choix_achat AS voie,
           sum(pc.xp_depense) AS xp,
           array_agg(DISTINCT pc.niveau_acquis ORDER BY pc.niveau_acquis) AS niveaux
    FROM public.personnage_competences pc
    JOIN public.competences c ON c.id = pc.competence_id
    WHERE pc.personnage_id = p_personnage_id
      AND c.nom = 'Acquisition de Cercle'
      AND pc.choix_achat IS NOT NULL
    GROUP BY pc.choix_achat
    HAVING sum(pc.xp_depense) > 0
       AND NOT EXISTS (
         SELECT 1 FROM public.personnage_sorts ps
         JOIN public.sorts s ON s.id = ps.sort_id
         WHERE ps.personnage_id = p_personnage_id
           AND s.cercle = pc.choix_achat)
    ORDER BY pc.choix_achat
  LOOP
    v_avertissements := v_avertissements || jsonb_build_object(
      'code', 'info_cercle_sans_sort',
      'voie', v_sec.voie,
      'niveaux', to_jsonb(v_sec.niveaux),
      'xp', v_sec.xp,
      'message', format('Cercle %s (niv %s) : aucun sort acheté dans ce cercle — %s XP dorment.',
                        v_sec.voie, array_to_string(v_sec.niveaux, ', '), v_sec.xp));
  END LOOP;

  IF NOT public.personnage_a_des_sorts(p_personnage_id) THEN
    RETURN jsonb_build_object('valide', true, 'ignoree', true,
      'erreurs', '[]'::jsonb, 'avertissements', v_avertissements);
  END IF;

  FOR v_sort IN
    SELECT ps.sort_id, ps.niveau_sort, s.cercle, s.nom AS sort_nom
    FROM public.personnage_sorts ps JOIN public.sorts s ON s.id = ps.sort_id
    WHERE ps.personnage_id = p_personnage_id AND ps.statut = 'achete'
  LOOP
    SELECT niveau_max_sorts INTO v_niveau_max FROM public.vue_cercles_disponibles
    WHERE personnage_id = p_personnage_id AND cercle = v_sort.cercle;
    IF NOT FOUND THEN
      v_erreurs := v_erreurs || jsonb_build_object('code','sort_cercle_non_debloque',
        'message', format('Le sort %s appartient au cercle %s, non débloqué', v_sort.sort_nom, v_sort.cercle),'champ','personnage_sorts');
    ELSIF v_sort.niveau_sort > v_niveau_max THEN
      v_erreurs := v_erreurs || jsonb_build_object('code','sort_niveau_trop_eleve',
        'message', format('Le sort %s (niveau %s) dépasse le max %s du cercle %s', v_sort.sort_nom, v_sort.niveau_sort, v_niveau_max, v_sort.cercle),'champ','personnage_sorts');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('valide', jsonb_array_length(v_erreurs) = 0, 'ignoree', false,
    'erreurs', v_erreurs, 'avertissements', v_avertissements);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.valider_etape_6(uuid) TO PUBLIC, anon, authenticated, service_role;
