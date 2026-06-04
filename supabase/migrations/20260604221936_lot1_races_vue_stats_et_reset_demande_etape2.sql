-- Lot 1 races (s112)
-- 1) vue_stats_admin : ajout du compteur nb_races_attente (colonne en fin).
-- 2) sauvegarder_etape_2 : la demande de race suit la race courante (Option 2).
--    - nouvelle race speciale + race changee -> on remplace toute demande existante
--    - nouvelle race non speciale + race changee -> nettoyage de la demande orpheline
--    Couvre les cas A (changement entre races speciales), B (vers race normale)
--    et C (joueur refuse qui rechange de race -> reexamine).
-- Idempotent : CREATE OR REPLACE.

CREATE OR REPLACE VIEW public.vue_stats_admin AS
 SELECT ( SELECT count(*) AS count
           FROM profiles
          WHERE profiles.role = 'joueur'::text) AS nb_joueurs,
    ( SELECT count(*) AS count
           FROM personnages
          WHERE personnages.est_actif = true AND personnages.est_mort = false) AS nb_personnages_actifs,
    ( SELECT count(*) AS count
           FROM inscriptions_evenements
          WHERE inscriptions_evenements.statut = 'en_attente'::text) AS nb_presences_attente,
    ( SELECT count(*) AS count
           FROM personnage_competences
          WHERE personnage_competences.statut_maitre = 'en_attente'::text) AS nb_competences_attente,
    ( SELECT evenements.titre
           FROM evenements
          WHERE evenements.est_publie = true AND evenements.date_evenement > now()
          ORDER BY evenements.date_evenement
         LIMIT 1) AS prochain_evenement_titre,
    ( SELECT evenements.date_evenement
           FROM evenements
          WHERE evenements.est_publie = true AND evenements.date_evenement > now()
          ORDER BY evenements.date_evenement
         LIMIT 1) AS prochain_evenement_date,
    ( SELECT count(*) AS count
           FROM personnage_races_demandes
          WHERE personnage_races_demandes.statut = 'en_attente'::text) AS nb_races_attente
   FROM ( SELECT 1 AS "?column?"
          WHERE est_animateur_ou_admin()) garde;

CREATE OR REPLACE FUNCTION public.sauvegarder_etape_2(p_personnage_id uuid, p_race_id uuid, p_sous_type_chimeride text DEFAULT NULL::text, p_justification text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_perso public.personnages%ROWTYPE;
  v_race_nom text;
  v_validation jsonb;
  v_etape_apres integer;
  v_demande_resultat jsonb;
  v_demande_existante boolean;
  v_race_changee boolean;
  v_avertissements jsonb := '[]'::jsonb;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'non_authentifie', 'message', 'Authentification requise.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_introuvable', 'message', 'Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'ownership_refuse', 'message', 'Ce personnage ne vous appartient pas.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_verrouille',
        'message', 'Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END IF;
  v_race_changee := (v_perso.race_id IS DISTINCT FROM p_race_id);
  BEGIN
    UPDATE public.personnages SET race_id = p_race_id, sous_type_chimeride = p_sous_type_chimeride
     WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'contrainte_violee', 'message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END;
  SELECT nom INTO v_race_nom FROM public.races WHERE id = p_race_id;
  -- Demande de race (Option 2, s112) : la demande suit la race courante.
  -- Si la race change, on repart d'une demande fraiche ; si la nouvelle race
  -- n'est pas speciale, on nettoie toute demande devenue obsolete.
  -- p_justification est ignore (compat signature) ; background issu de l historique.
  IF v_race_nom IN ('Chiméride', 'Les Non-Races') THEN
    IF v_race_changee THEN
      DELETE FROM public.personnage_races_demandes WHERE personnage_id = p_personnage_id;
    END IF;
    SELECT EXISTS (SELECT 1 FROM public.personnage_races_demandes WHERE personnage_id = p_personnage_id) INTO v_demande_existante;
    IF NOT v_demande_existante THEN
      v_demande_resultat := public.creer_demande_race(p_personnage_id, v_perso.historique);
      IF NOT COALESCE((v_demande_resultat->>'succes')::boolean, false) THEN
        v_avertissements := v_avertissements || jsonb_build_object(
          'code', 'demande_race_echec',
          'message', COALESCE(v_demande_resultat->>'erreur', 'Création de la demande de race échouée.'));
      END IF;
    END IF;
  ELSIF v_race_changee THEN
    DELETE FROM public.personnage_races_demandes WHERE personnage_id = p_personnage_id;
  END IF;
  v_validation := public.valider_etape_2(p_personnage_id);
  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', (v_validation->'avertissements') || v_avertissements,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
  END IF;
  IF v_perso.etape_creation = 2 THEN
    UPDATE public.personnages SET etape_creation = 3 WHERE id = p_personnage_id;
    v_etape_apres := 3;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', v_avertissements,
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_etape_apres));
END;
$function$;
