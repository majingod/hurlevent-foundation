-- [LOI25 s333] purge_ids dans l'entree de journal du guichet self-service.
-- L'anonymisation 24 mois (anonymiser_journal_purges) s'appuie sur cette liste
-- pour retrouver toutes les entrees de journal des entites purgees.
-- Corps identique a 20260621121438 (md5 cd672c71f73952f6eeded4ac7e2e3ee1) + 4 insertions.
CREATE OR REPLACE FUNCTION public.creer_steles_et_supprimer(
  p_cible text,
  p_id_cible uuid,
  p_demandes jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_avert    jsonb := '[]'::jsonb;
  v_persos   uuid[];
  v_profils  uuid[];
  v_demande  jsonb;
  v_pid      uuid;
  v_epitaphe text;
  v_perso    record;
  v_stele_id uuid;
  v_nb_creees int := 0;
  v_nb_deja   int := 0;
  v_nb_supprimes int := 0;
BEGIN
  -- 1. Cible valide
  IF p_cible NOT IN ('personnage','profil','compte') THEN
    RETURN jsonb_build_object('succes',false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','CIBLE_INVALIDE','message','Cible inconnue.','champ','p_cible')),
      'avertissements','[]'::jsonb,'donnees',null);
  END IF;

  -- 2. Ownership + détermination des persos concernés (= ceux qui seront supprimés)
  IF p_cible = 'personnage' THEN
    SELECT * INTO v_perso FROM personnages WHERE id = p_id_cible;
    IF v_perso IS NULL THEN
      RETURN jsonb_build_object('succes',false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','INTROUVABLE','message','Personnage introuvable.')),
        'avertissements','[]'::jsonb,'donnees',null);
    END IF;
    IF NOT compte_voit_joueur(v_perso.joueur_id) THEN
      RETURN jsonb_build_object('succes',false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Ce personnage ne vous appartient pas.')),
        'avertissements','[]'::jsonb,'donnees',null);
    END IF;
    v_persos := ARRAY[p_id_cible];

  ELSIF p_cible = 'profil' THEN
    IF NOT compte_voit_joueur(p_id_cible) THEN
      RETURN jsonb_build_object('succes',false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Ce profil ne vous appartient pas.')),
        'avertissements','[]'::jsonb,'donnees',null);
    END IF;
    IF EXISTS (SELECT 1 FROM profils_joueur WHERE id = p_id_cible AND est_principal) THEN
      RETURN jsonb_build_object('succes',false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','PROFIL_PRINCIPAL',
          'message','Le profil principal ne peut pas être supprimé seul. Supprimez plutôt le compte entier.')),
        'avertissements','[]'::jsonb,'donnees',null);
    END IF;
    SELECT array_agg(id) INTO v_persos FROM personnages WHERE joueur_id = p_id_cible;

  ELSE -- compte : uniquement le sien
    IF p_id_cible IS DISTINCT FROM auth.uid() THEN
      RETURN jsonb_build_object('succes',false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Vous ne pouvez supprimer que votre propre compte.')),
        'avertissements','[]'::jsonb,'donnees',null);
    END IF;
    SELECT array_agg(p.id) INTO v_persos
      FROM personnages p JOIN profils_joueur pj ON pj.id = p.joueur_id
     WHERE pj.compte_id = p_id_cible;
  END IF;

  v_persos := COALESCE(v_persos, ARRAY[]::uuid[]);

  -- 3. Figer les stèles choisies AVANT toute purge (inscriptions + fiche encore présentes)
  FOR v_demande IN SELECT * FROM jsonb_array_elements(COALESCE(p_demandes,'[]'::jsonb)) LOOP
    v_pid := (v_demande->>'personnage_id')::uuid;
    v_epitaphe := v_demande->>'epitaphe';

    IF NOT (v_pid = ANY(v_persos)) THEN
      v_avert := v_avert || jsonb_build_array(jsonb_build_object('code','HORS_CIBLE',
        'message','Personnage non concerné par cette suppression, ignoré.','champ', v_pid::text));
      CONTINUE;
    END IF;

    SELECT * INTO v_perso FROM personnages WHERE id = v_pid;
    IF v_perso IS NULL THEN CONTINUE; END IF;

    -- déjà au cimetière (mort) ou déjà en attente : stèle existante conservée, pas de double
    IF v_perso.est_mort
       OR EXISTS (SELECT 1 FROM cimetiere WHERE personnage_id_origine = v_pid AND statut='en_attente') THEN
      v_nb_deja := v_nb_deja + 1;
      CONTINUE;
    END IF;

    -- admissibilité = au moins un événement joué (inscription 'present')
    IF NOT EXISTS (SELECT 1 FROM inscriptions_evenements WHERE personnage_id = v_pid AND statut='present') THEN
      v_avert := v_avert || jsonb_build_array(jsonb_build_object('code','NON_ADMISSIBLE',
        'message', format('« %s » n''a participé à aucun événement : supprimé sans stèle.', v_perso.nom),'champ', v_pid::text));
      CONTINUE;
    END IF;

    v_stele_id := _figer_stele(v_pid, v_epitaphe, auth.uid(), 'en_attente', false);
    PERFORM creer_notification_staff(
      p_message := format('⚰️ Nouvelle demande de mort pour le personnage "%s"', v_perso.nom),
      p_type := 'demande_mort_nouvelle', p_reference_id := v_stele_id);
    PERFORM log_audit('personnage', v_pid, 'creer_demande_mort',
      jsonb_build_object('stele_id', v_stele_id, 'nom', v_perso.nom, 'via','suppression'));
    v_nb_creees := v_nb_creees + 1;
  END LOOP;

  v_nb_supprimes := COALESCE(array_length(v_persos,1), 0);

  -- 4. Purger la cible (réutilise les helpers internes -> cascade complète)
  IF p_cible = 'personnage' THEN
    PERFORM _purger_personnage_interne(p_id_cible);
    PERFORM log_audit('personnage', p_id_cible, 'supprimer',
      jsonb_build_object('via','self-service','nb_steles',v_nb_creees,
                         'purge_ids', jsonb_build_array(p_id_cible)));
  ELSIF p_cible = 'profil' THEN
    PERFORM _purger_profil_interne(p_id_cible);
    PERFORM log_audit('profil', p_id_cible, 'supprimer',
      jsonb_build_object('via','self-service','nb_persos',v_nb_supprimes,'nb_steles',v_nb_creees,
                         'purge_ids', to_jsonb(v_persos) || jsonb_build_array(p_id_cible)));
  ELSE -- compte : table rase RGPD (Loi 25)
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_profils
      FROM profils_joueur WHERE compte_id = p_id_cible;
    PERFORM log_audit('compte', p_id_cible, 'supprimer',
      jsonb_build_object('via','self-service-rgpd','nb_persos',v_nb_supprimes,'nb_steles',v_nb_creees,
                         'purge_ids', to_jsonb(v_persos) || to_jsonb(v_profils) || jsonb_build_array(p_id_cible)));
    PERFORM _purger_compte_interne(p_id_cible);
    DELETE FROM auth.users WHERE id = p_id_cible;  -- effacement total du login
  END IF;

  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements',v_avert,
    'donnees', jsonb_build_object(
      'nb_steles_creees', v_nb_creees,
      'nb_steles_existantes', v_nb_deja,
      'nb_persos_supprimes', v_nb_supprimes));
END; $function$;

-- A37 : CREATE OR REPLACE remet l'ACL a PUBLIC -> re-verrouillage
REVOKE ALL ON FUNCTION public.creer_steles_et_supprimer(text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creer_steles_et_supprimer(text, uuid, jsonb) TO authenticated;
