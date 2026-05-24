-- Migration session 34 — fix sauvegarder_etape_3 : respect append-only
--
-- La version precedente faisait un DELETE FROM historique_xp WHERE type_mouvement='depense_trait'
-- puis un re-INSERT a chaque appel, violant la convention "historique_xp append-only"
-- etablie en session 33 (XP-CLEANUP).
--
-- Cette version fait un vrai diff entre l'ancien et le nouveau JSONB traits_raciaux_choisis :
--   - Trait retire du JSONB et etait payant -> INSERT remboursement (FK trait_id)
--   - Trait present dans les deux mais avec coût different (passage gratuit<->payant via reorg FIFO)
--     -> INSERT remboursement de l'ancien + INSERT depense_trait du nouveau (les deux si > 0)
--   - Trait ajoute et payant -> INSERT depense_trait (FK trait_id)
--   - Trait inchange -> aucun INSERT (idempotent)
--
-- Le trigger trg_sync_xp_personnage resynchronise xp_total et xp_depense automatiquement
-- via la nouvelle formule de recalculer_xp_personnage (session 33).
--
-- Signature inchangee : (p_personnage_id uuid, p_traits_raciaux_choisis jsonb) RETURNS jsonb.
-- Frontend Etape3_V2.tsx inchange (RPC consommee de la meme maniere).
-- Pas de regen types.ts requis.

CREATE OR REPLACE FUNCTION public.sauvegarder_etape_3(
  p_personnage_id uuid,
  p_traits_raciaux_choisis jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_perso public.personnages%ROWTYPE;
  v_nb_traits_gratuits_race integer;
  v_old_traits jsonb;
  v_new_traits jsonb := '[]'::jsonb;
  v_validation jsonb;
  v_etape_apres integer;
  v_trait jsonb;
  v_old_elem jsonb;
  v_trait_id uuid;
  v_cout_xp integer;
  v_est_gratuit boolean;
  v_trait_nom text;
  v_index integer := 0;
  v_old_xp_depense integer;
  v_new_xp_depense integer;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Ce personnage ne vous appartient pas.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END IF;

  SELECT nb_traits_raciaux INTO v_nb_traits_gratuits_race FROM public.races WHERE id = v_perso.race_id;
  v_nb_traits_gratuits_race := COALESCE(v_nb_traits_gratuits_race, 0);
  v_old_traits := COALESCE(v_perso.traits_raciaux_choisis, '[]'::jsonb);

  FOR v_trait IN SELECT value FROM jsonb_array_elements(COALESCE(p_traits_raciaux_choisis, '[]'::jsonb))
  LOOP
    v_trait_id := (v_trait->>'trait_id')::uuid;
    IF v_index < v_nb_traits_gratuits_race THEN
      v_est_gratuit := true; v_cout_xp := 0;
    ELSE
      v_est_gratuit := false;
      SELECT cout_xp INTO v_cout_xp FROM public.vue_traits_par_race
       WHERE race_id = v_perso.race_id AND trait_id = v_trait_id LIMIT 1;
      v_cout_xp := COALESCE(v_cout_xp, 0);
    END IF;
    v_new_traits := v_new_traits || jsonb_build_array(jsonb_build_object(
      'trait_id', v_trait_id, 'est_gratuit', v_est_gratuit, 'xp_depense', v_cout_xp));
    v_index := v_index + 1;
  END LOOP;

  BEGIN
    FOR v_old_elem IN SELECT value FROM jsonb_array_elements(v_old_traits)
    LOOP
      v_trait_id := (v_old_elem->>'trait_id')::uuid;
      v_old_xp_depense := COALESCE((v_old_elem->>'xp_depense')::integer, 0);
      v_new_xp_depense := NULL;
      SELECT (elem->>'xp_depense')::integer INTO v_new_xp_depense
        FROM jsonb_array_elements(v_new_traits) elem
        WHERE (elem->>'trait_id')::uuid = v_trait_id LIMIT 1;

      IF v_new_xp_depense IS NULL THEN
        IF v_old_xp_depense > 0 THEN
          SELECT nom INTO v_trait_nom FROM public.traits_raciaux WHERE id = v_trait_id;
          INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
          VALUES (p_personnage_id, 'remboursement', v_old_xp_depense,
                  format('Remboursement trait racial : %s', COALESCE(v_trait_nom, v_trait_id::text)),
                  v_trait_id, v_joueur_id);
        END IF;
      ELSIF v_new_xp_depense <> v_old_xp_depense THEN
        IF v_old_xp_depense > 0 THEN
          SELECT nom INTO v_trait_nom FROM public.traits_raciaux WHERE id = v_trait_id;
          INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
          VALUES (p_personnage_id, 'remboursement', v_old_xp_depense,
                  format('Remboursement trait racial (reorganisation) : %s', COALESCE(v_trait_nom, v_trait_id::text)),
                  v_trait_id, v_joueur_id);
        END IF;
        IF v_new_xp_depense > 0 THEN
          SELECT nom INTO v_trait_nom FROM public.traits_raciaux WHERE id = v_trait_id;
          INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
          VALUES (p_personnage_id, 'depense_trait', -v_new_xp_depense,
                  format('Achat trait racial (reorganisation) : %s', COALESCE(v_trait_nom, v_trait_id::text)),
                  v_trait_id, v_joueur_id);
        END IF;
      END IF;
    END LOOP;

    FOR v_trait IN SELECT value FROM jsonb_array_elements(v_new_traits)
    LOOP
      v_trait_id := (v_trait->>'trait_id')::uuid;
      v_cout_xp := COALESCE((v_trait->>'xp_depense')::integer, 0);
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_old_traits) elem
        WHERE (elem->>'trait_id')::uuid = v_trait_id
      ) THEN
        IF v_cout_xp > 0 THEN
          SELECT nom INTO v_trait_nom FROM public.traits_raciaux WHERE id = v_trait_id;
          INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
          VALUES (p_personnage_id, 'depense_trait', -v_cout_xp,
                  format('Achat trait racial : %s', COALESCE(v_trait_nom, v_trait_id::text)),
                  v_trait_id, v_joueur_id);
        END IF;
      END IF;
    END LOOP;

    UPDATE public.personnages SET traits_raciaux_choisis = v_new_traits WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END;

  v_validation := public.valider_etape_3(p_personnage_id);
  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', v_validation->'erreurs', 'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
  END IF;

  IF v_perso.etape_creation = 3 THEN
    UPDATE public.personnages SET etape_creation = 4 WHERE id = p_personnage_id;
    v_etape_apres := 4;
  ELSE v_etape_apres := v_perso.etape_creation; END IF;

  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_id', p_personnage_id,
      'etape_creation_apres', v_etape_apres,
      'traits_raciaux_choisis', v_new_traits));
END;
$function$;
