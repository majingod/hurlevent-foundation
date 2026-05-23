-- ============================================================
-- A. Helper SQL generer_formule_magique (manuel 2026)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generer_formule_magique(
  p_cercle TEXT,
  p_zone TEXT,
  p_portee TEXT,
  p_duree TEXT,
  p_niveau INTEGER
) RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_mot_cercle TEXT;
  v_mot_portee TEXT;
  v_mot_zone TEXT;
  v_mot_duree TEXT;
  v_mot_niveau TEXT;
BEGIN
  v_mot_cercle := CASE p_cercle
    WHEN 'Air'         THEN 'Xoth'
    WHEN 'Altération'  THEN 'Bedorm'
    WHEN 'Charmes'     THEN 'Veltel'
    WHEN 'Combat'      THEN 'Alagh'
    WHEN 'Divination'  THEN 'Shatur'
    WHEN 'Eau'         THEN 'Zaram'
    WHEN 'Feu'         THEN 'Zarr'
    WHEN 'Illusion'    THEN 'Guerben'
    WHEN 'Magie Noire' THEN 'Notogh'
    WHEN 'Magie Pure'  THEN 'Lelphil'
    WHEN 'Nécromancie' THEN 'Thork'
    WHEN 'Protection' THEN 'Barak'
    WHEN 'Terre'       THEN 'Olor'
    ELSE NULL
  END;
  v_mot_portee := CASE p_portee
    WHEN 'Toucher'  THEN 'Net'
    WHEN '5 Pieds'  THEN 'Norak'
    WHEN '10 Pieds' THEN 'Naramir'
    WHEN '25 Pieds' THEN 'Namojakodi'
    WHEN '50 Pieds' THEN 'Nustamarnaroth'
    WHEN 'À vue'    THEN 'Nestramarnitakodal'
    ELSE NULL
  END;
  v_mot_zone := CASE p_zone
    WHEN 'Personnelle'    THEN 'Val'
    WHEN '1 Cible'        THEN 'Temer'
    WHEN '2 Cibles'       THEN 'Borak'
    WHEN '3 Cibles'       THEN 'Biztalnen'
    WHEN '4 Cibles'       THEN 'Bilnordanfat'
    WHEN '5 Cibles'       THEN 'Burtalinokasen'
    WHEN 'Rayon 3 pieds'  THEN 'Tidartek'
    WHEN 'Rayon 6 pieds'  THEN 'Tazemked'
    WHEN 'Rayon 10 pieds' THEN 'Tozarmanor'
    WHEN 'Rayon 25 pieds' THEN 'Tulzakmineroth'
    WHEN 'Rayon 50 pieds' THEN 'Tezelmaternothas'
    ELSE NULL
  END;
  v_mot_duree := CASE p_duree
    WHEN 'Instantanée' THEN 'Mil'
    WHEN '1 Minute'    THEN 'Meza'
    WHEN '5 Minutes'   THEN 'Monorl'
    WHEN '10 Minutes'  THEN 'Manorlas'
    WHEN '20 Minutes'  THEN 'Mezoltir'
    WHEN '30 Minutes'  THEN 'Motarnos'
    WHEN '40 Minutes'  THEN 'Meriknaski'
    WHEN '50 Minutes'  THEN 'Manorlzerik'
    WHEN '60 Minutes'  THEN 'Meziltanitas'
    ELSE NULL
  END;
  v_mot_niveau := CASE p_niveau
    WHEN  1 THEN 'Zet'              WHEN  2 THEN 'Zal'
    WHEN  3 THEN 'Zul'              WHEN  4 THEN 'Zerat'
    WHEN  5 THEN 'Zaroth'           WHEN  6 THEN 'Zomas'
    WHEN  7 THEN 'Ziternak'         WHEN  8 THEN 'Zurminas'
    WHEN  9 THEN 'Zotharnel'        WHEN 10 THEN 'Zapurnalen'
    WHEN 11 THEN 'Zemaltoran'       WHEN 12 THEN 'Zokanastil'
    WHEN 13 THEN 'Zaernamistren'    WHEN 14 THEN 'Zutramnektozat'
    WHEN 15 THEN 'Zitalomatus'      WHEN 16 THEN 'Zomarnalutak'
    WHEN 17 THEN 'Zuitikmaldorak'   WHEN 18 THEN 'Zuzmanaktalek'
    WHEN 19 THEN 'Zutrantalakmunar' WHEN 20 THEN 'Zomastirelnakosmal'
    ELSE NULL
  END;
  IF v_mot_cercle IS NULL OR v_mot_portee IS NULL OR v_mot_zone IS NULL
     OR v_mot_duree IS NULL OR v_mot_niveau IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN v_mot_cercle || ' ' || v_mot_portee || ' ' || v_mot_zone
         || ' ' || v_mot_duree || ' ' || v_mot_niveau;
END;
$$;

-- ============================================================
-- B. acheter_sort mis a jour : insere formule_magique auto-calculee
-- ============================================================
CREATE OR REPLACE FUNCTION public.acheter_sort(
  p_personnage_id uuid,
  p_sort_id uuid,
  p_niveau_sort integer,
  p_zone_choisie text,
  p_portee_choisie text,
  p_duree_choisie text,
  p_nom_personnalise text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_cercle text; v_cout_xp_base numeric; v_cout_xp integer; v_niveau_max integer;
  v_xp_disponible integer; v_new_id uuid; v_xp_total integer; v_xp_depense integer;
  v_formule_magique text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_perso FROM personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus etre modifie (verrouille par l''animation ou inscrit a un evenement confirme).')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT cercle, cout_xp_base INTO v_cercle, v_cout_xp_base FROM sorts WHERE id = p_sort_id;
  IF v_cercle IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','sort_introuvable','message','Sort introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  -- FIX session 26 : calcul XP via helper, plus de CEIL(cout_xp_base) brut
  v_cout_xp := public.calculer_cout_xp_magie(
    p_zone_choisie, p_portee_choisie, p_duree_choisie, p_niveau_sort, v_cout_xp_base
  );
  -- NEW session 27 : formule magique calculee auto (manuel 2026)
  v_formule_magique := public.generer_formule_magique(
    v_cercle, p_zone_choisie, p_portee_choisie, p_duree_choisie, p_niveau_sort
  );
  SELECT niveau_max_sorts INTO v_niveau_max FROM vue_cercles_disponibles
   WHERE personnage_id = p_personnage_id AND cercle = v_cercle;
  IF v_niveau_max IS NULL OR p_niveau_sort > v_niveau_max THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de sort superieur au maximum autorise pour ce cercle')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_xp_disponible := v_perso.xp_total - v_perso.xp_depense;
  IF v_xp_disponible < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  BEGIN
    INSERT INTO personnage_sorts (personnage_id, sort_id, niveau_sort, xp_depense, nom_personnalise, zone_choisie, portee_choisie, duree_choisie, formule_magique)
    VALUES (p_personnage_id, p_sort_id, p_niveau_sort, v_cout_xp, p_nom_personnalise, p_zone_choisie, p_portee_choisie, p_duree_choisie, v_formule_magique)
    RETURNING id INTO v_new_id;
    UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
     WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, sort_id, acteur_id)
      VALUES (p_personnage_id, 'depense_sort', -v_cout_xp, 'Achat sort niveau ' || p_niveau_sort || ' (' || v_cout_xp || ' XP)', p_sort_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_sort_id', v_new_id, 'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$$;

-- ============================================================
-- C. Data fix idempotent : remplir formule_magique des sorts existants
-- ============================================================
UPDATE personnage_sorts ps
SET formule_magique = public.generer_formule_magique(
  s.cercle,
  ps.zone_choisie,
  ps.portee_choisie,
  ps.duree_choisie,
  ps.niveau_sort
)
FROM sorts s
WHERE ps.sort_id = s.id
  AND ps.formule_magique IS NULL;
