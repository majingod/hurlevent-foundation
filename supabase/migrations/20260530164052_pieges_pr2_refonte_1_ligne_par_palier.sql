-- ============================================================
-- PIÈGES PR-2 : refonte personnage_pieges -> 1 ligne par palier
-- (miroir personnage_competences). Remboursement par palier possible.
-- ============================================================

-- 1) Reset données de test (pièges + traces XP) ; trigger trg_sync_xp_personnage resync auto
DELETE FROM historique_xp WHERE piege_id IS NOT NULL AND personnage_id IN (SELECT id FROM personnages WHERE joueur_id='8e63a4a6-0577-48f2-b073-1ec85c9b3e00');
DELETE FROM personnage_pieges WHERE personnage_id IN (SELECT id FROM personnages WHERE joueur_id='8e63a4a6-0577-48f2-b073-1ec85c9b3e00');

-- 2a) Rename niveau_actuel -> niveau_acquis (la vue ne référence pas cette colonne)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='personnage_pieges' AND column_name='niveau_actuel') THEN
    ALTER TABLE public.personnage_pieges RENAME COLUMN niveau_actuel TO niveau_acquis;
  END IF;
END $$;

-- 2b) Recréer vue_artisanat_quotas AVANT le drop des colonnes flags (la vue en dépend)
CREATE OR REPLACE VIEW public.vue_artisanat_quotas AS
 SELECT personnage_id, niveau_alchimie, niveau_forge, niveau_joaillerie, niveau_runes, a_forge_legendaire, a_joaillerie_legendaire,
   CASE WHEN niveau_alchimie>=3 THEN 12 WHEN niveau_alchimie>=2 THEN 9 WHEN niveau_alchimie>=1 THEN 5 ELSE 0 END AS quota_recettes_total,
   CASE WHEN niveau_runes>=3 THEN 5 WHEN niveau_runes>=2 THEN 4 WHEN niveau_runes>=1 THEN 2 ELSE 0 END AS quota_assemblages_total,
   CASE WHEN niveau_alchimie>=1 THEN 5 ELSE 0 END AS quota_alchimie_mineure_total,
   CASE WHEN niveau_alchimie>=2 THEN 4 ELSE 0 END AS quota_alchimie_intermediaire_total,
   CASE WHEN niveau_alchimie>=3 THEN 3 ELSE 0 END AS quota_alchimie_majeure_total,
   COALESCE((SELECT count(*)::int FROM personnage_recettes pr JOIN recettes_alchimie ra ON ra.id=pr.recette_id WHERE pr.personnage_id=e.personnage_id AND pr.est_gratuit=true AND ra.niveau_requis=1),0) AS quota_alchimie_mineure_utilises,
   COALESCE((SELECT count(*)::int FROM personnage_recettes pr JOIN recettes_alchimie ra ON ra.id=pr.recette_id WHERE pr.personnage_id=e.personnage_id AND pr.est_gratuit=true AND ra.niveau_requis=2),0) AS quota_alchimie_intermediaire_utilises,
   COALESCE((SELECT count(*)::int FROM personnage_recettes pr JOIN recettes_alchimie ra ON ra.id=pr.recette_id WHERE pr.personnage_id=e.personnage_id AND pr.est_gratuit=true AND ra.niveau_requis=3),0) AS quota_alchimie_majeure_utilises,
   COALESCE((SELECT count(*)::int FROM personnage_assemblages pa WHERE pa.personnage_id=e.personnage_id AND pa.est_gratuit=true),0) AS quota_assemblages_utilises,
   niveau_pieges,
   CASE WHEN niveau_pieges>=1 THEN 3 ELSE 0 END AS quota_pieges_niv1_total,
   CASE WHEN niveau_pieges>=2 THEN 2 ELSE 0 END AS quota_pieges_amelioration_niv2_total,
   CASE WHEN niveau_pieges>=3 THEN 1 ELSE 0 END AS quota_pieges_amelioration_niv3_total,
   COALESCE((SELECT count(*)::int FROM personnage_pieges pp WHERE pp.personnage_id=e.personnage_id AND pp.niveau_acquis=1 AND pp.est_gratuit=true),0) AS quota_pieges_niv1_utilises,
   COALESCE((SELECT count(*)::int FROM personnage_pieges pp WHERE pp.personnage_id=e.personnage_id AND pp.niveau_acquis=2 AND pp.est_gratuit=true),0) AS quota_pieges_amelioration_niv2_utilises,
   COALESCE((SELECT count(*)::int FROM personnage_pieges pp WHERE pp.personnage_id=e.personnage_id AND pp.niveau_acquis=3 AND pp.est_gratuit=true),0) AS quota_pieges_amelioration_niv3_utilises
 FROM vue_artisanat_etat e;

-- 2c) Drop colonnes flags devenues inutiles (1 est_gratuit par ligne/palier suffit)
ALTER TABLE public.personnage_pieges DROP COLUMN IF EXISTS amelioration_niv2_gratuite;
ALTER TABLE public.personnage_pieges DROP COLUMN IF EXISTS amelioration_niv3_gratuite;

-- 2d) Contraintes : UNIQUE par palier + CHECK borné
ALTER TABLE public.personnage_pieges DROP CONSTRAINT IF EXISTS personnage_pieges_personnage_id_piege_nom_key;
ALTER TABLE public.personnage_pieges DROP CONSTRAINT IF EXISTS personnage_pieges_perso_nom_niveau_key;
ALTER TABLE public.personnage_pieges ADD CONSTRAINT personnage_pieges_perso_nom_niveau_key UNIQUE (personnage_id, piege_nom, niveau_acquis);
ALTER TABLE public.personnage_pieges DROP CONSTRAINT IF EXISTS personnage_pieges_niveau_actuel_check;
ALTER TABLE public.personnage_pieges DROP CONSTRAINT IF EXISTS personnage_pieges_niveau_acquis_check;
ALTER TABLE public.personnage_pieges ADD CONSTRAINT personnage_pieges_niveau_acquis_check CHECK (niveau_acquis>=1 AND niveau_acquis<=3);

-- 3) ameliorer_piege supprimée (une montée = un nouvel achat de palier)
DROP FUNCTION IF EXISTS public.ameliorer_piege(uuid);

-- 4) acheter_piege : achat d'un palier précis (niv 1/2/3) + gate séquentiel
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
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Ce personnage ne peut plus être modifié.')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_piege FROM pieges WHERE id=p_piege_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','piege_introuvable','message','Piège introuvable')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF v_piege.niveau < 1 OR v_piege.niveau > 3 THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','niveau_invalide_acquisition','message','Niveau de piège invalide')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT niveau_pieges INTO v_niveau_pieges FROM vue_artisanat_quotas WHERE personnage_id=p_personnage_id;
  IF v_niveau_pieges IS NULL OR v_niveau_pieges < 1 THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint','message','Compétence « Création et désarmement de piège » requise')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF EXISTS (SELECT 1 FROM personnage_pieges WHERE personnage_id=p_personnage_id AND piege_nom=v_piege.nom AND niveau_acquis=v_piege.niveau) THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','piege_deja_possede','message','Ce palier de piège est déjà acquis')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF v_piege.niveau > 1 AND NOT EXISTS (SELECT 1 FROM personnage_pieges WHERE personnage_id=p_personnage_id AND piege_nom=v_piege.nom AND niveau_acquis=v_piege.niveau-1) THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','palier_precedent_manquant','message','Le palier précédent doit être acquis avant celui-ci')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT CASE v_piege.niveau WHEN 1 THEN quota_pieges_niv1_total WHEN 2 THEN quota_pieges_amelioration_niv2_total ELSE quota_pieges_amelioration_niv3_total END
    INTO v_quota_total FROM vue_artisanat_quotas WHERE personnage_id=p_personnage_id;
  SELECT COUNT(*)::integer INTO v_nb_gratuits FROM personnage_pieges WHERE personnage_id=p_personnage_id AND niveau_acquis=v_piege.niveau AND est_gratuit=true;
  IF v_nb_gratuits < v_quota_total THEN v_est_gratuit:=true; v_cout_xp:=0;
  ELSE v_est_gratuit:=false; v_cout_xp:=v_piege.cout_xp;
    IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  END IF;
  BEGIN
    INSERT INTO personnage_pieges (personnage_id,piege_nom,niveau_acquis,piege_id,xp_depense,est_gratuit)
    VALUES (p_personnage_id,v_piege.nom,v_piege.niveau,p_piege_id,v_cout_xp,v_est_gratuit) RETURNING id INTO v_new_id;
    IF NOT v_est_gratuit AND v_cout_xp>0 THEN
      INSERT INTO historique_xp (personnage_id,type_mouvement,montant,description,piege_id,acteur_id)
      VALUES (p_personnage_id,'depense_piege',-v_cout_xp,'Achat piège « '||v_piege.nom||' » niveau '||v_piege.niveau||' ('||v_cout_xp||' XP)',p_piege_id,v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','contrainte_violee','message',SQLERRM)),'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
  END;
  SELECT xp_total,xp_depense INTO v_xp_total,v_xp_depense FROM personnages WHERE id=p_personnage_id;
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,'donnees',jsonb_build_object('id',v_new_id,'piege_nom',v_piege.nom,'niveau_acquis',v_piege.niveau,'est_gratuit',v_est_gratuit,'xp_depense_palier',v_cout_xp,'xp_total',v_xp_total,'xp_depense',v_xp_depense,'xp_restant',v_xp_total-v_xp_depense));
END; $fn$;

-- 5) desacheter_piege : cascade ascendante (palier N + tous > N), remboursement = somme des paliers payés
CREATE OR REPLACE FUNCTION public.desacheter_piege(p_personnage_piege_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_uid uuid := auth.uid(); v_pp personnage_pieges%ROWTYPE; v_perso personnages%ROWTYPE;
  v_ligne RECORD; v_lignes_supprimees jsonb := '[]'::jsonb;
  v_xp_total_rembourse integer := 0; v_nb_lignes integer := 0; v_xp_total integer; v_xp_depense integer;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_pp FROM personnage_pieges WHERE id=p_personnage_piege_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Ce piège n''existe pas dans le personnage')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_perso FROM personnages WHERE id=v_pp.personnage_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF NOT public.personnage_est_modifiable(v_pp.personnage_id) THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Ce personnage ne peut plus être modifié.')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  FOR v_ligne IN SELECT id,niveau_acquis,xp_depense FROM personnage_pieges
    WHERE personnage_id=v_pp.personnage_id AND piege_nom=v_pp.piege_nom AND niveau_acquis>=v_pp.niveau_acquis ORDER BY niveau_acquis DESC
  LOOP
    v_lignes_supprimees := v_lignes_supprimees || jsonb_build_object('personnage_piege_id',v_ligne.id,'niveau_acquis',v_ligne.niveau_acquis,'xp_rembourse',v_ligne.xp_depense);
    v_xp_total_rembourse := v_xp_total_rembourse + v_ligne.xp_depense; v_nb_lignes := v_nb_lignes + 1;
  END LOOP;
  DELETE FROM personnage_pieges WHERE personnage_id=v_pp.personnage_id AND piege_nom=v_pp.piege_nom AND niveau_acquis>=v_pp.niveau_acquis;
  IF v_xp_total_rembourse>0 THEN
    INSERT INTO historique_xp (personnage_id,type_mouvement,montant,description,piege_id,acteur_id)
    VALUES (v_pp.personnage_id,'remboursement',v_xp_total_rembourse,'Annulation piège « '||v_pp.piege_nom||' » ('||v_nb_lignes::text||' palier(s))',v_pp.piege_id,v_uid);
  END IF;
  SELECT xp_total,xp_depense INTO v_xp_total,v_xp_depense FROM personnages WHERE id=v_pp.personnage_id;
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,'donnees',jsonb_build_object('piege_nom',v_pp.piege_nom,'lignes_supprimees',v_lignes_supprimees,'nb_paliers_supprimes',v_nb_lignes,'xp_rembourse',v_xp_total_rembourse,'xp_total',v_xp_total,'xp_depense',v_xp_depense,'xp_restant',v_xp_total-v_xp_depense));
END; $fn$;
