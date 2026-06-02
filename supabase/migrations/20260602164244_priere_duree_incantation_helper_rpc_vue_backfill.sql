-- ============================================================
-- PRIERE-DUREE-INCANTATION (chantier 1B, session 92)
-- Hybride variante 1 : DB autoritative + front live preview.
-- Règle manuel 2026 « Construction des sorts de prêtre » :
--   incantation = ceil( (2 + sec_portée + sec_cible + sec_durée + sec_niveau) / 2 )
--   (2 = base domaine ; durées de prière divisées par deux, arrondies à l'unité supérieure)
-- Le coefficient XP n'entre PAS dans la durée d'incantation.
-- ============================================================

-- 1. Helper IMMUTABLE (tables de secondes propres aux prières, ≠ colonnes de coût XP)
CREATE OR REPLACE FUNCTION public.calculer_duree_incantation_priere(
  p_portee_choisie text, p_zone_choisie text, p_duree_choisie text, p_niveau integer
) RETURNS integer
  LANGUAGE plpgsql IMMUTABLE
  SET search_path TO 'pg_catalog','public'
AS $fn$
DECLARE
  v_sec_portee int; v_sec_zone int; v_sec_duree int; v_sec_niveau int;
BEGIN
  v_sec_portee := CASE p_portee_choisie
    WHEN 'Toucher' THEN 1 WHEN '5 Pieds' THEN 2 WHEN '10 Pieds' THEN 3
    WHEN '25 Pieds' THEN 5 WHEN '50 Pieds' THEN 7 WHEN 'À vue' THEN 10 ELSE 0 END;
  v_sec_zone := CASE p_zone_choisie
    WHEN 'Personnelle' THEN 1 WHEN '1 Cible' THEN 2 WHEN '2 Cibles' THEN 3
    WHEN '3 Cibles' THEN 5 WHEN '4 Cibles' THEN 7 WHEN '5 Cibles' THEN 10
    WHEN 'Rayon 3 pieds' THEN 2 WHEN 'Rayon 6 pieds' THEN 4 WHEN 'Rayon 10 pieds' THEN 5
    WHEN 'Rayon 25 pieds' THEN 8 WHEN 'Rayon 50 pieds' THEN 15 ELSE 0 END;
  v_sec_duree := CASE p_duree_choisie
    WHEN 'Instantanée' THEN 1 WHEN '1 Minute' THEN 2 WHEN '5 Minutes' THEN 3
    WHEN '10 Minutes' THEN 4 WHEN '20 Minutes' THEN 5 WHEN '30 Minutes' THEN 6
    WHEN '40 Minutes' THEN 7 WHEN '50 Minutes' THEN 8 WHEN '60 Minutes' THEN 9 ELSE 0 END;
  v_sec_niveau := CASE
    WHEN p_niveau BETWEEN 1 AND 3 THEN 1 WHEN p_niveau BETWEEN 4 AND 6 THEN 2
    WHEN p_niveau BETWEEN 7 AND 9 THEN 3 WHEN p_niveau BETWEEN 10 AND 12 THEN 5
    WHEN p_niveau BETWEEN 13 AND 15 THEN 7 WHEN p_niveau BETWEEN 16 AND 18 THEN 10
    WHEN p_niveau BETWEEN 19 AND 20 THEN 13 ELSE 0 END;
  RETURN ceil((2 + v_sec_portee + v_sec_zone + v_sec_duree + v_sec_niveau)::numeric / 2)::int;
END;
$fn$;

-- 2. RPC d'achat : calcule et stocke duree_incantation_calculee (autoritatif)
CREATE OR REPLACE FUNCTION public.acheter_priere(p_personnage_id uuid, p_priere_id uuid, p_niveau_priere integer, p_zone_choisie text, p_portee_choisie text, p_duree_choisie text, p_nom_personnalise text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_priere prieres%ROWTYPE;
  v_cout_xp integer; v_niveau_max integer; v_xp_disponible integer;
  v_new_id uuid; v_xp_total integer; v_xp_depense integer;
  v_duree_inc integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_perso FROM personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_priere FROM prieres WHERE id = p_priere_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','priere_introuvable','message','Prière introuvable')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  -- FIX session 26 : check religion supprime (cf. religions.domaines_proscrits + vue_domaines_disponibles).
  v_cout_xp := public.calculer_cout_xp_magie(p_zone_choisie, p_portee_choisie, p_duree_choisie, p_niveau_priere, v_priere.cout_xp_base);
  SELECT niveau_max_prieres INTO v_niveau_max FROM vue_domaines_disponibles WHERE personnage_id = p_personnage_id AND domaine = v_priere.domaine;
  IF v_niveau_max IS NULL OR p_niveau_priere > v_niveau_max THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de prière supérieur au maximum autorisé pour ce domaine')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_xp_disponible := v_perso.xp_total - v_perso.xp_depense;
  IF v_xp_disponible < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  -- session 92 : durée d'incantation autoritative (manuel 2026)
  v_duree_inc := public.calculer_duree_incantation_priere(p_portee_choisie, p_zone_choisie, p_duree_choisie, p_niveau_priere);
  BEGIN
    INSERT INTO personnage_prieres (personnage_id, priere_id, niveau_priere, xp_depense, nom_personnalise, zone_choisie, portee_choisie, duree_choisie, duree_incantation_calculee)
    VALUES (p_personnage_id, p_priere_id, p_niveau_priere, v_cout_xp, p_nom_personnalise, p_zone_choisie, p_portee_choisie, p_duree_choisie, v_duree_inc)
    RETURNING id INTO v_new_id;
    UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now() WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, priere_id, acteur_id)
      VALUES (p_personnage_id, 'depense_priere', -v_cout_xp, 'Achat prière niveau ' || p_niveau_priere || ' (' || v_cout_xp || ' XP)', p_priere_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false, 'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)), 'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_priere_id', v_new_id, 'xp_depense_achat', v_cout_xp, 'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense, 'duree_incantation_calculee', v_duree_inc));
END;
$function$;

-- 3. Vue de lecture : exposer duree_incantation_calculee (colonne ajoutée EN FIN, contrainte CREATE OR REPLACE VIEW)
CREATE OR REPLACE VIEW public.vue_prieres_personnage AS
 SELECT pp.id, pp.personnage_id, pp.nom_personnalise, pp.niveau_priere,
    pp.zone_choisie, pp.portee_choisie, pp.duree_choisie,
    pr.domaine, pr.description AS priere_description, pr.duree_incantation,
    pr.cout_xp_base, pr.description_courte AS priere_description_courte,
    pp.duree_incantation_calculee
   FROM personnage_prieres pp
     JOIN prieres pr ON pr.id = pp.priere_id;

-- 4. Backfill idempotent des lignes existantes
UPDATE personnage_prieres
SET duree_incantation_calculee = public.calculer_duree_incantation_priere(portee_choisie, zone_choisie, duree_choisie, niveau_priere)
WHERE duree_incantation_calculee IS NULL
  AND portee_choisie IS NOT NULL AND zone_choisie IS NOT NULL AND duree_choisie IS NOT NULL;
