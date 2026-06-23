-- PR3 COMPTES-MULTI-PROFILS — écriture sur le profil actif
-- 1) Familles B : 23 RPC d'écriture — garde d'ownership élargie au compte.
--    La garde "joueur appartient à auth.uid()" devient "joueur appartient à un
--    profil DU COMPTE" via public.compte_voit_joueur(joueur_id) (posée en PR2).
--    Transformation déterministe (regexp) appliquée sur les défs courantes.
--    À cette position de la chaîne, les défs portent encore l'ancienne garde.
DO $mig$
DECLARE r record; v_def text;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f'
      AND p.proname IN (
        'sauvegarder_etape_1','sauvegarder_etape_2','sauvegarder_etape_3','sauvegarder_etape_4',
        'avancer_etape','annuler_etape',
        'acheter_assemblage','acheter_competence','acheter_piege','acheter_priere','acheter_recette','acheter_sort','acheter_trait_racial',
        'desacheter_assemblage','desacheter_competence','desacheter_piege','desacheter_priere','desacheter_recette','desacheter_sort',
        'changer_classe_personnage','creer_demande_race','reouvrir_personnage','valider_personnage_final')
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_def := regexp_replace(v_def,'v_perso\.joueur_id <> v_uid','NOT public.compte_voit_joueur(v_perso.joueur_id)','g');
    v_def := regexp_replace(v_def,'v_perso\.joueur_id <> v_joueur_id','NOT public.compte_voit_joueur(v_perso.joueur_id)','g');
    v_def := regexp_replace(v_def,'v_personnage\.joueur_id != auth\.uid\(\)','NOT public.compte_voit_joueur(v_personnage.joueur_id)','g');
    v_def := regexp_replace(v_def,'v_joueur_id IS DISTINCT FROM auth\.uid\(\)','NOT public.compte_voit_joueur(v_joueur_id)','g');
    v_def := regexp_replace(v_def,'v_perso\.joueur_id IS DISTINCT FROM v_user_id','NOT public.compte_voit_joueur(v_perso.joueur_id)','g');
    EXECUTE v_def;
  END LOOP;
END $mig$;

-- 2) joueur_actif : résolution canonique du profil actif.
--    Param fourni & appartenant au compte -> ce profil ; sinon -> profil principal.
CREATE OR REPLACE FUNCTION public.joueur_actif(p_profil_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $jf$
DECLARE v_id uuid;
BEGIN
  IF p_profil_id IS NOT NULL AND public.compte_voit_joueur(p_profil_id) THEN
    RETURN p_profil_id;
  END IF;
  SELECT id INTO v_id FROM public.profils_joueur
   WHERE compte_id = auth.uid() AND est_principal = true LIMIT 1;
  RETURN v_id;
END;
$jf$;

-- 3) demarrer_creation_personnage : crée sous le profil actif.
--    DROP de l'ancienne signature () pour éviter une surcharge ambiguë ;
--    la nouvelle a p_profil_id DEFAULT NULL -> appel sans arg = profil principal
--    (rétro-compatible avec le front mono-profil).
DROP FUNCTION IF EXISTS public.demarrer_creation_personnage();
CREATE OR REPLACE FUNCTION public.demarrer_creation_personnage(p_profil_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $dc$
DECLARE
  v_joueur_id uuid := public.joueur_actif(p_profil_id);
  v_brouillon_id uuid; v_brouillon_etape integer; v_nouveau_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise pour démarrer la création d''un personnage.')),
      'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
  END IF;
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','profil_introuvable','message','Aucun profil actif valide pour ce compte.')),
      'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
  END IF;
  SELECT id, etape_creation INTO v_brouillon_id, v_brouillon_etape
  FROM public.personnages
  WHERE joueur_id = v_joueur_id AND est_verrouille = false AND est_actif = true AND etape_creation < 11
  LIMIT 1;
  IF v_brouillon_id IS NOT NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','brouillon_existant','message','Vous avez déjà un personnage en cours de création.')),
      'avertissements','[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', v_brouillon_id,'etape_creation', v_brouillon_etape));
  END IF;
  v_nouveau_id := gen_random_uuid();
  INSERT INTO public.personnages (id, joueur_id) VALUES (v_nouveau_id, v_joueur_id);
  RETURN jsonb_build_object('succes', true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('personnage_id', v_nouveau_id,'etape_creation', 1));
END;
$dc$;

-- 4) transferer_banque_vers_personnage : garde élargie + banque résolue sur le
--    JOUEUR propriétaire du perso cible (chaque profil a sa propre banque XP).
--    acteur_id reste auth.uid() (traçabilité au niveau compte, cohérent existant).
CREATE OR REPLACE FUNCTION public.transferer_banque_vers_personnage(p_personnage_cible_id uuid, p_montant integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $tb$
DECLARE v_uid uuid := auth.uid(); v_perso RECORD; v_solde integer; v_banque_id uuid; v_desc text; v_xp_total integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','NON_AUTHENTIFIE','message','Authentification requise.')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','MONTANT_INVALIDE','message','Le montant doit être > 0.','champ','p_montant')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  SELECT id,nom,joueur_id INTO v_perso FROM public.personnages WHERE id=p_personnage_cible_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','PERSONNAGE_INTROUVABLE','message','Personnage introuvable.','champ','p_personnage_cible_id')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF NOT public.compte_voit_joueur(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Ce personnage ne vous appartient pas.','champ','p_personnage_cible_id')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  SELECT COALESCE(SUM(montant),0) INTO v_solde FROM public.banque_xp_mouvements WHERE joueur_id=v_perso.joueur_id;
  IF p_montant > v_solde THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','SOLDE_INSUFFISANT','message',format('Solde insuffisant (%s dispo, %s demandé).',v_solde,p_montant),'champ','p_montant')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  v_desc := format('Versement banque XP vers %s',COALESCE(v_perso.nom,'personnage'));
  INSERT INTO public.banque_xp_mouvements (joueur_id,type_mouvement,montant,personnage_cible_id,acteur_id,description)
  VALUES (v_perso.joueur_id,'transfert_vers_personnage',-p_montant,p_personnage_cible_id,v_uid,v_desc) RETURNING id INTO v_banque_id;
  INSERT INTO public.historique_xp (personnage_id,type_mouvement,montant,description,acteur_id,banque_mouvement_id)
  VALUES (p_personnage_cible_id,'gain_banque',p_montant,v_desc,v_uid,v_banque_id);
  SELECT COALESCE(SUM(montant),0) INTO v_solde FROM public.banque_xp_mouvements WHERE joueur_id=v_perso.joueur_id;
  SELECT xp_total INTO v_xp_total FROM public.personnages WHERE id=p_personnage_cible_id;
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees',jsonb_build_object('xp_verse',p_montant,'nouveau_solde',v_solde,'perso_xp_total',v_xp_total,'banque_mouvement_id',v_banque_id));
END;
$tb$;
