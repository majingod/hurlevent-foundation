-- ===== M2 : Banque RPC — écritures (crédit + transfert) =====
-- Colonne back-link historique_xp -> banque_xp_mouvements (réconciliation des 2 ledgers)
ALTER TABLE public.historique_xp ADD COLUMN IF NOT EXISTS banque_mouvement_id uuid;
DO $do1$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='historique_xp_banque_mouvement_id_fkey') THEN
    ALTER TABLE public.historique_xp
      ADD CONSTRAINT historique_xp_banque_mouvement_id_fkey
      FOREIGN KEY (banque_mouvement_id) REFERENCES public.banque_xp_mouvements(id) ON DELETE RESTRICT;
  END IF;
END $do1$;

-- 4 CHECK étendus pour accepter le nouveau type 'gain_banque'
ALTER TABLE public.historique_xp DROP CONSTRAINT IF EXISTS chk_historique_xp_type_valide;
ALTER TABLE public.historique_xp ADD CONSTRAINT chk_historique_xp_type_valide CHECK (
  type_mouvement = ANY (ARRAY['gain_evenement','gain_bonus','gain_correction','gain_banque','remboursement',
    'depense_competence','depense_trait','depense_sort','depense_priere','depense_recette',
    'depense_assemblage','depense_objet_forge','depense_objet_joaillerie','depense_piege']));

ALTER TABLE public.historique_xp DROP CONSTRAINT IF EXISTS chk_historique_xp_signe_coherent;
ALTER TABLE public.historique_xp ADD CONSTRAINT chk_historique_xp_signe_coherent CHECK (
  ((type_mouvement = ANY (ARRAY['gain_evenement','gain_bonus','gain_correction','gain_banque','remboursement'])) AND (montant > 0))
  OR ((type_mouvement LIKE 'depense_%') AND (montant < 0)));

ALTER TABLE public.historique_xp DROP CONSTRAINT IF EXISTS chk_historique_xp_reference_objet;
ALTER TABLE public.historique_xp ADD CONSTRAINT chk_historique_xp_reference_objet CHECK (
CASE
  WHEN (type_mouvement LIKE 'depense_%' OR type_mouvement = 'remboursement') THEN (
    (CASE WHEN competence_id IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN trait_id IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN sort_id IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN priere_id IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN recette_id IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN assemblage_id IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN objet_forge_id IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN objet_joaillerie_id IS NOT NULL THEN 1 ELSE 0 END
     + CASE WHEN piege_id IS NOT NULL THEN 1 ELSE 0 END) = 1)
  WHEN (type_mouvement = ANY (ARRAY['gain_evenement','gain_bonus','gain_correction','gain_banque'])) THEN (
    competence_id IS NULL AND trait_id IS NULL AND sort_id IS NULL AND priere_id IS NULL
    AND recette_id IS NULL AND assemblage_id IS NULL AND objet_forge_id IS NULL
    AND objet_joaillerie_id IS NULL AND piege_id IS NULL)
  ELSE false
END);

ALTER TABLE public.historique_xp DROP CONSTRAINT IF EXISTS chk_historique_xp_type_alignement_fk;
ALTER TABLE public.historique_xp ADD CONSTRAINT chk_historique_xp_type_alignement_fk CHECK (
  ((type_mouvement = 'depense_competence') AND (competence_id IS NOT NULL))
  OR ((type_mouvement = 'depense_trait') AND (trait_id IS NOT NULL))
  OR ((type_mouvement = 'depense_sort') AND (sort_id IS NOT NULL))
  OR ((type_mouvement = 'depense_priere') AND (priere_id IS NOT NULL))
  OR ((type_mouvement = 'depense_recette') AND (recette_id IS NOT NULL))
  OR ((type_mouvement = 'depense_assemblage') AND (assemblage_id IS NOT NULL))
  OR ((type_mouvement = 'depense_objet_forge') AND (objet_forge_id IS NOT NULL))
  OR ((type_mouvement = 'depense_objet_joaillerie') AND (objet_joaillerie_id IS NOT NULL))
  OR ((type_mouvement = 'depense_piege') AND (piege_id IS NOT NULL))
  OR (type_mouvement = 'remboursement')
  OR (type_mouvement = ANY (ARRAY['gain_evenement','gain_bonus','gain_correction','gain_banque'])));

-- CHECK back-link : gain_banque <=> banque_mouvement_id non nul ; sinon NULL
ALTER TABLE public.historique_xp DROP CONSTRAINT IF EXISTS chk_historique_xp_banque_link;
ALTER TABLE public.historique_xp ADD CONSTRAINT chk_historique_xp_banque_link CHECK (
  (type_mouvement = 'gain_banque' AND banque_mouvement_id IS NOT NULL)
  OR (type_mouvement <> 'gain_banque' AND banque_mouvement_id IS NULL));

-- ===== RPC 1 : crediter_banque_xp (admin/animateur) =====
CREATE OR REPLACE FUNCTION public.crediter_banque_xp(
  p_joueur_id uuid, p_montant integer, p_evenement_id uuid, p_description text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public'
AS $fn1$
DECLARE v_desc text; v_id uuid;
BEGIN
  IF NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Réservé aux animateurs/admins.')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','MONTANT_INVALIDE','message','Le montant doit être > 0.','champ','p_montant')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF p_evenement_id IS NULL THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','EVENEMENT_REQUIS','message','Un événement source est requis.','champ','p_evenement_id')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  PERFORM 1 FROM public.profiles WHERE id=p_joueur_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','JOUEUR_INTROUVABLE','message','Joueur introuvable.','champ','p_joueur_id')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  PERFORM 1 FROM public.evenements WHERE id=p_evenement_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','EVENEMENT_INTROUVABLE','message','Événement introuvable.','champ','p_evenement_id')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  v_desc := COALESCE(NULLIF(trim(p_description),''),'Gain mini-GN');
  INSERT INTO public.banque_xp_mouvements (joueur_id,type_mouvement,montant,evenement_id,acteur_id,description)
  VALUES (p_joueur_id,'gain_mini_gn',p_montant,p_evenement_id,auth.uid(),v_desc) RETURNING id INTO v_id;
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees',jsonb_build_object('mouvement_id',v_id,'montant',p_montant));
END;
$fn1$;

-- ===== RPC 2 : transferer_banque_vers_personnage (self-service propriétaire) =====
CREATE OR REPLACE FUNCTION public.transferer_banque_vers_personnage(
  p_personnage_cible_id uuid, p_montant integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public'
AS $fn2$
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
  IF v_perso.joueur_id <> v_uid THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Ce personnage ne vous appartient pas.','champ','p_personnage_cible_id')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  SELECT COALESCE(SUM(montant),0) INTO v_solde FROM public.banque_xp_mouvements WHERE joueur_id=v_uid;
  IF p_montant > v_solde THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','SOLDE_INSUFFISANT','message',format('Solde insuffisant (%s dispo, %s demandé).',v_solde,p_montant),'champ','p_montant')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  v_desc := format('Versement banque XP vers %s',COALESCE(v_perso.nom,'personnage'));
  INSERT INTO public.banque_xp_mouvements (joueur_id,type_mouvement,montant,personnage_cible_id,acteur_id,description)
  VALUES (v_uid,'transfert_vers_personnage',-p_montant,p_personnage_cible_id,v_uid,v_desc) RETURNING id INTO v_banque_id;
  INSERT INTO public.historique_xp (personnage_id,type_mouvement,montant,description,acteur_id,banque_mouvement_id)
  VALUES (p_personnage_cible_id,'gain_banque',p_montant,v_desc,v_uid,v_banque_id);
  SELECT COALESCE(SUM(montant),0) INTO v_solde FROM public.banque_xp_mouvements WHERE joueur_id=v_uid;
  SELECT xp_total INTO v_xp_total FROM public.personnages WHERE id=p_personnage_cible_id;
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees',jsonb_build_object('xp_verse',p_montant,'nouveau_solde',v_solde,'perso_xp_total',v_xp_total,'banque_mouvement_id',v_banque_id));
END;
$fn2$;

GRANT EXECUTE ON FUNCTION public.crediter_banque_xp(uuid,integer,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transferer_banque_vers_personnage(uuid,integer) TO authenticated;
