-- Système de pièges — couche DB (Session 59)
-- Table personnage_pieges + colonne/contraintes historique_xp + 3 vues (append) + 3 RPCs.

-- 1. Table personnage_pieges
CREATE TABLE IF NOT EXISTS public.personnage_pieges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnage_id uuid NOT NULL REFERENCES public.personnages(id) ON DELETE CASCADE,
  piege_nom text NOT NULL,
  niveau_actuel integer NOT NULL DEFAULT 1 CHECK (niveau_actuel BETWEEN 1 AND 3),
  piege_id uuid NOT NULL REFERENCES public.pieges(id),
  xp_depense integer NOT NULL DEFAULT 0,
  est_gratuit boolean NOT NULL DEFAULT false,
  amelioration_niv2_gratuite boolean NOT NULL DEFAULT false,
  amelioration_niv3_gratuite boolean NOT NULL DEFAULT false,
  date_acquisition timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (personnage_id, piege_nom)
);
CREATE INDEX IF NOT EXISTS idx_personnage_pieges_personnage ON public.personnage_pieges(personnage_id);
ALTER TABLE public.personnage_pieges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Accès pieges personnage" ON public.personnage_pieges;
CREATE POLICY "Accès pieges personnage" ON public.personnage_pieges FOR ALL
  USING ((auth.uid() IS NOT NULL) AND ((EXISTS (SELECT 1 FROM public.personnages WHERE personnages.id = personnage_pieges.personnage_id AND personnages.joueur_id = auth.uid())) OR est_animateur_ou_admin()))
  WITH CHECK ((auth.uid() IS NOT NULL) AND ((EXISTS (SELECT 1 FROM public.personnages WHERE personnages.id = personnage_pieges.personnage_id AND personnages.joueur_id = auth.uid())) OR est_animateur_ou_admin()));

-- 2. historique_xp : colonne piege_id + extension des 3 contraintes CHECK
ALTER TABLE public.historique_xp ADD COLUMN IF NOT EXISTS piege_id uuid REFERENCES public.pieges(id);
ALTER TABLE public.historique_xp DROP CONSTRAINT IF EXISTS chk_historique_xp_type_valide;
ALTER TABLE public.historique_xp ADD CONSTRAINT chk_historique_xp_type_valide CHECK (
  type_mouvement = ANY (ARRAY['gain_evenement','gain_bonus','gain_correction','remboursement','depense_competence','depense_trait','depense_sort','depense_priere','depense_recette','depense_assemblage','depense_objet_forge','depense_objet_joaillerie','depense_piege']));
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
  OR (type_mouvement = ANY (ARRAY['gain_evenement','gain_bonus','gain_correction'])));
ALTER TABLE public.historique_xp DROP CONSTRAINT IF EXISTS chk_historique_xp_reference_objet;
ALTER TABLE public.historique_xp ADD CONSTRAINT chk_historique_xp_reference_objet CHECK (
  CASE
    WHEN ((type_mouvement ~~ 'depense_%') OR (type_mouvement = 'remboursement')) THEN (
      (CASE WHEN competence_id IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN trait_id IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN sort_id IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN priere_id IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN recette_id IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN assemblage_id IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN objet_forge_id IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN objet_joaillerie_id IS NOT NULL THEN 1 ELSE 0 END
       + CASE WHEN piege_id IS NOT NULL THEN 1 ELSE 0 END) = 1)
    WHEN (type_mouvement = ANY (ARRAY['gain_evenement','gain_bonus','gain_correction'])) THEN (
      competence_id IS NULL AND trait_id IS NULL AND sort_id IS NULL AND priere_id IS NULL
      AND recette_id IS NULL AND assemblage_id IS NULL AND objet_forge_id IS NULL
      AND objet_joaillerie_id IS NULL AND piege_id IS NULL)
    ELSE false
  END);

-- 3. Vues : niveau_pieges propagé + 6 colonnes quotas pièges (APPEND-ONLY)
CREATE OR REPLACE VIEW public.vue_personnage_etat AS
 SELECT p.id AS personnage_id, p.joueur_id,
    COALESCE(p.xp_total,0) - COALESCE(p.xp_depense,0) AS xp_disponible, p.niveau,
    COALESCE(max(CASE WHEN c.nom='Alchimie' THEN pc.niveau_acquis ELSE NULL END),0) AS niveau_alchimie,
    COALESCE(max(CASE WHEN c.nom='Forge' THEN pc.niveau_acquis ELSE NULL END),0) AS niveau_forge,
    COALESCE(max(CASE WHEN c.nom='Joaillerie' THEN pc.niveau_acquis ELSE NULL END),0) AS niveau_joaillerie,
    COALESCE(max(CASE WHEN c.nom='Assemblage de Runes' THEN pc.niveau_acquis ELSE NULL END),0) AS niveau_runes,
    COALESCE(max(CASE WHEN c.nom='Acquisition de Cercle' THEN pc.niveau_acquis ELSE NULL END),0) AS niveau_cercle,
    COALESCE(max(CASE WHEN c.nom='Acquisition de Domaine' THEN pc.niveau_acquis ELSE NULL END),0) AS niveau_domaine,
    COALESCE(bool_or(c.nom='Connaissances des Religions' AND pc.niveau_acquis>=1),false) AS a_connaissance_religions,
    COALESCE(bool_or(c.nom='Premiers Soins' AND pc.niveau_acquis>=1),false) AS a_premiers_soins,
    COALESCE(bool_or(c.nom='Connaissances des Créatures' AND pc.niveau_acquis>=1),false) AS a_connaissance_creatures_1,
    COALESCE(bool_or(c.nom='Connaissances des Créatures' AND pc.niveau_acquis>=2),false) AS a_connaissance_creatures_2,
    COALESCE(max(CASE WHEN c.nom='Création et désarmement de piège' THEN pc.niveau_acquis ELSE NULL END),0) AS niveau_pieges
   FROM personnages p
     LEFT JOIN personnage_competences pc ON pc.personnage_id = p.id
     LEFT JOIN competences c ON c.id = pc.competence_id
  GROUP BY p.id, p.joueur_id, p.xp_total, p.xp_depense, p.niveau;

CREATE OR REPLACE VIEW public.vue_artisanat_etat AS
 SELECT vpe.personnage_id, vpe.niveau_alchimie, vpe.niveau_forge, vpe.niveau_joaillerie, vpe.niveau_runes,
    p.a_forge_legendaire, p.a_joaillerie_legendaire, vpe.niveau_pieges
   FROM vue_personnage_etat vpe JOIN personnages p ON p.id = vpe.personnage_id;

CREATE OR REPLACE VIEW public.vue_artisanat_quotas AS
 SELECT personnage_id, niveau_alchimie, niveau_forge, niveau_joaillerie, niveau_runes,
    a_forge_legendaire, a_joaillerie_legendaire,
    CASE WHEN niveau_alchimie>=3 THEN 12 WHEN niveau_alchimie>=2 THEN 9 WHEN niveau_alchimie>=1 THEN 5 ELSE 0 END AS quota_recettes_total,
    CASE WHEN niveau_runes>=3 THEN 5 WHEN niveau_runes>=2 THEN 4 WHEN niveau_runes>=1 THEN 2 ELSE 0 END AS quota_assemblages_total,
    CASE WHEN niveau_alchimie>=1 THEN 5 ELSE 0 END AS quota_alchimie_mineure_total,
    CASE WHEN niveau_alchimie>=2 THEN 4 ELSE 0 END AS quota_alchimie_intermediaire_total,
    CASE WHEN niveau_alchimie>=3 THEN 3 ELSE 0 END AS quota_alchimie_majeure_total,
    COALESCE((SELECT count(*)::integer FROM personnage_recettes pr JOIN recettes_alchimie ra ON ra.id=pr.recette_id WHERE pr.personnage_id=e.personnage_id AND pr.est_gratuit=true AND ra.niveau_requis=1),0) AS quota_alchimie_mineure_utilises,
    COALESCE((SELECT count(*)::integer FROM personnage_recettes pr JOIN recettes_alchimie ra ON ra.id=pr.recette_id WHERE pr.personnage_id=e.personnage_id AND pr.est_gratuit=true AND ra.niveau_requis=2),0) AS quota_alchimie_intermediaire_utilises,
    COALESCE((SELECT count(*)::integer FROM personnage_recettes pr JOIN recettes_alchimie ra ON ra.id=pr.recette_id WHERE pr.personnage_id=e.personnage_id AND pr.est_gratuit=true AND ra.niveau_requis=3),0) AS quota_alchimie_majeure_utilises,
    COALESCE((SELECT count(*)::integer FROM personnage_assemblages pa WHERE pa.personnage_id=e.personnage_id AND pa.est_gratuit=true),0) AS quota_assemblages_utilises,
    niveau_pieges,
    CASE WHEN niveau_pieges>=1 THEN 3 ELSE 0 END AS quota_pieges_niv1_total,
    CASE WHEN niveau_pieges>=2 THEN 2 ELSE 0 END AS quota_pieges_amelioration_niv2_total,
    CASE WHEN niveau_pieges>=3 THEN 1 ELSE 0 END AS quota_pieges_amelioration_niv3_total,
    COALESCE((SELECT count(*)::integer FROM personnage_pieges pp WHERE pp.personnage_id=e.personnage_id AND pp.est_gratuit=true),0) AS quota_pieges_niv1_utilises,
    COALESCE((SELECT count(*)::integer FROM personnage_pieges pp WHERE pp.personnage_id=e.personnage_id AND pp.amelioration_niv2_gratuite=true),0) AS quota_pieges_amelioration_niv2_utilises,
    COALESCE((SELECT count(*)::integer FROM personnage_pieges pp WHERE pp.personnage_id=e.personnage_id AND pp.amelioration_niv3_gratuite=true),0) AS quota_pieges_amelioration_niv3_utilises
   FROM vue_artisanat_etat e;

-- 4. RPC acheter_piege
CREATE OR REPLACE FUNCTION public.acheter_piege(p_personnage_id uuid, p_piege_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_uid uuid := auth.uid(); v_perso personnages%ROWTYPE; v_piege pieges%ROWTYPE;
  v_niveau_pieges integer; v_quota_total integer; v_nb_gratuits integer;
  v_est_gratuit boolean; v_cout_xp integer; v_new_id uuid; v_xp_total integer; v_xp_depense integer;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_perso FROM personnages WHERE id=p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_piege FROM pieges WHERE id=p_piege_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','piege_introuvable','message','Piège introuvable')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF v_piege.niveau <> 1 THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','niveau_invalide_acquisition','message','L''acquisition d''un piège se fait toujours au niveau 1')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT niveau_pieges, quota_pieges_niv1_total INTO v_niveau_pieges, v_quota_total FROM vue_artisanat_quotas WHERE personnage_id=p_personnage_id;
  IF v_niveau_pieges IS NULL OR v_niveau_pieges < 1 THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint','message','Compétence « Création et désarmement de piège » requise')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF EXISTS (SELECT 1 FROM personnage_pieges WHERE personnage_id=p_personnage_id AND piege_nom=v_piege.nom) THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','piege_deja_possede','message','Ce piège est déjà connu par le personnage')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT COUNT(*)::integer INTO v_nb_gratuits FROM personnage_pieges WHERE personnage_id=p_personnage_id AND est_gratuit=true;
  IF v_nb_gratuits < v_quota_total THEN v_est_gratuit:=true; v_cout_xp:=0;
  ELSE
    v_est_gratuit:=false; v_cout_xp:=v_piege.cout_xp;
    IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  END IF;
  BEGIN
    INSERT INTO personnage_pieges (personnage_id,piege_nom,niveau_actuel,piege_id,xp_depense,est_gratuit)
    VALUES (p_personnage_id,v_piege.nom,1,p_piege_id,v_cout_xp,v_est_gratuit) RETURNING id INTO v_new_id;
    IF NOT v_est_gratuit AND v_cout_xp > 0 THEN
      UPDATE personnages SET xp_depense=xp_depense+v_cout_xp, date_modification=now(), updated_at=now() WHERE id=p_personnage_id;
      INSERT INTO historique_xp (personnage_id,type_mouvement,montant,description,piege_id,acteur_id)
      VALUES (p_personnage_id,'depense_piege',-v_cout_xp,'Achat piège « '||v_piege.nom||' » niveau 1 ('||v_cout_xp||' XP)',p_piege_id,v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','contrainte_violee','message',SQLERRM)),'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
  END;
  SELECT xp_total,xp_depense INTO v_xp_total,v_xp_depense FROM personnages WHERE id=p_personnage_id;
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,'donnees',jsonb_build_object('id',v_new_id,'piege_nom',v_piege.nom,'niveau_actuel',1,'est_gratuit',v_est_gratuit,'xp_depense_achat',v_cout_xp,'xp_total',v_xp_total,'xp_depense',v_xp_depense,'xp_restant',v_xp_total-v_xp_depense));
END; $fn$;

-- 5. RPC ameliorer_piege
CREATE OR REPLACE FUNCTION public.ameliorer_piege(p_personnage_piege_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_uid uuid := auth.uid(); v_pp personnage_pieges%ROWTYPE; v_perso personnages%ROWTYPE;
  v_target integer; v_tp pieges%ROWTYPE; v_niveau_pieges integer; v_quota_total integer; v_nb_gratuits integer;
  v_est_gratuit boolean; v_cout_xp integer; v_xp_total integer; v_xp_depense integer;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_pp FROM personnage_pieges WHERE id=p_personnage_piege_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Ce piège n''existe pas dans le personnage')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_perso FROM personnages WHERE id=v_pp.personnage_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF NOT public.personnage_est_modifiable(v_pp.personnage_id) THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF v_pp.niveau_actuel >= 3 THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','piege_niveau_max','message','Ce piège est déjà au niveau maximal (3)')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  v_target := v_pp.niveau_actuel + 1;
  SELECT * INTO v_tp FROM pieges WHERE nom=v_pp.piege_nom AND niveau=v_target;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','palier_introuvable','message','Palier de piège introuvable')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT niveau_pieges INTO v_niveau_pieges FROM vue_artisanat_quotas WHERE personnage_id=v_pp.personnage_id;
  IF v_niveau_pieges IS NULL OR v_niveau_pieges < 1 THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint','message','Compétence « Création et désarmement de piège » requise')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF v_target = 2 THEN
    SELECT quota_pieges_amelioration_niv2_total, quota_pieges_amelioration_niv2_utilises INTO v_quota_total, v_nb_gratuits FROM vue_artisanat_quotas WHERE personnage_id=v_pp.personnage_id;
  ELSE
    SELECT quota_pieges_amelioration_niv3_total, quota_pieges_amelioration_niv3_utilises INTO v_quota_total, v_nb_gratuits FROM vue_artisanat_quotas WHERE personnage_id=v_pp.personnage_id;
  END IF;
  IF v_nb_gratuits < v_quota_total THEN v_est_gratuit:=true; v_cout_xp:=0;
  ELSE
    v_est_gratuit:=false; v_cout_xp:=v_tp.cout_xp;
    IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  END IF;
  BEGIN
    UPDATE personnage_pieges SET niveau_actuel=v_target, piege_id=v_tp.id, xp_depense=xp_depense+v_cout_xp,
      amelioration_niv2_gratuite = CASE WHEN v_target=2 THEN v_est_gratuit ELSE amelioration_niv2_gratuite END,
      amelioration_niv3_gratuite = CASE WHEN v_target=3 THEN v_est_gratuit ELSE amelioration_niv3_gratuite END,
      updated_at=now() WHERE id=p_personnage_piege_id;
    IF NOT v_est_gratuit AND v_cout_xp > 0 THEN
      UPDATE personnages SET xp_depense=xp_depense+v_cout_xp, date_modification=now(), updated_at=now() WHERE id=v_pp.personnage_id;
      INSERT INTO historique_xp (personnage_id,type_mouvement,montant,description,piege_id,acteur_id)
      VALUES (v_pp.personnage_id,'depense_piege',-v_cout_xp,'Amélioration piège « '||v_pp.piege_nom||' » vers niveau '||v_target||' ('||v_cout_xp||' XP)',v_tp.id,v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','contrainte_violee','message',SQLERRM)),'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
  END;
  SELECT xp_total,xp_depense INTO v_xp_total,v_xp_depense FROM personnages WHERE id=v_pp.personnage_id;
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,'donnees',jsonb_build_object('id',p_personnage_piege_id,'piege_nom',v_pp.piege_nom,'niveau_actuel',v_target,'est_gratuit',v_est_gratuit,'xp_depense_palier',v_cout_xp,'xp_total',v_xp_total,'xp_depense',v_xp_depense,'xp_restant',v_xp_total-v_xp_depense));
END; $fn$;

-- 6. RPC desacheter_piege
CREATE OR REPLACE FUNCTION public.desacheter_piege(p_personnage_piege_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_uid uuid := auth.uid(); v_pp personnage_pieges%ROWTYPE; v_perso personnages%ROWTYPE;
  v_xp_total integer; v_xp_depense integer;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_pp FROM personnage_pieges WHERE id=p_personnage_piege_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Ce piège n''existe pas dans le personnage')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_perso FROM personnages WHERE id=v_pp.personnage_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF NOT public.personnage_est_modifiable(v_pp.personnage_id) THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  DELETE FROM personnage_pieges WHERE id=p_personnage_piege_id;
  IF v_pp.xp_depense > 0 THEN
    UPDATE personnages SET xp_depense=xp_depense - v_pp.xp_depense, date_modification=now(), updated_at=now() WHERE id=v_pp.personnage_id;
    INSERT INTO historique_xp (personnage_id,type_mouvement,montant,description,piege_id,acteur_id)
    VALUES (v_pp.personnage_id,'remboursement',v_pp.xp_depense,'Remboursement piège « '||v_pp.piege_nom||' » ('||v_pp.xp_depense||' XP)',v_pp.piege_id,v_uid);
  END IF;
  SELECT xp_total,xp_depense INTO v_xp_total,v_xp_depense FROM personnages WHERE id=v_pp.personnage_id;
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,'donnees',jsonb_build_object('personnage_piege_id',p_personnage_piege_id,'piege_nom',v_pp.piege_nom,'xp_rembourse',v_pp.xp_depense,'xp_total',v_xp_total,'xp_depense',v_xp_depense,'xp_restant',v_xp_total-v_xp_depense));
END; $fn$;
