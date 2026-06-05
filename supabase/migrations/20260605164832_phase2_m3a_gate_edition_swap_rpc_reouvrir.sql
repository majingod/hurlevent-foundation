-- Phase 2 / M3a : gating d'édition de personnage
-- 1) gate_edition_personnage(uuid, text)  : helper central de garde (modes 'ajout' / 'complet')
-- 2) reouvrir_personnage(uuid)            : RPC de réouverture (remodelage_libre uniquement)
-- 3) swap de la garde de modifiabilité dans 14 RPC achat/désachat
--    (personnage_est_modifiable -> gate_edition_personnage, distinction ajout/complet).
-- personnage_est_modifiable est CONSERVÉ (toujours utilisé par le wizard de création).
-- Corps explicites (CREATE OR REPLACE) — idempotent.

CREATE OR REPLACE FUNCTION public.gate_edition_personnage(p_personnage_id uuid, p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_etat jsonb; v_autorise boolean;
BEGIN
  v_etat := public.etat_edition_personnage(p_personnage_id);
  IF (v_etat->>'etat') IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message', v_etat->>'raison')),
      'avertissements', jsonb_build_array(), 'donnees', NULL);
  END IF;
  v_autorise := CASE p_mode
    WHEN 'ajout'   THEN (v_etat->>'peut_ajouter')::boolean
    WHEN 'complet' THEN (v_etat->>'peut_tout_editer')::boolean
    ELSE false END;
  IF v_autorise THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('succes', false,
    'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille','message', v_etat->>'raison')),
    'avertissements', jsonb_build_array(), 'donnees', NULL);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reouvrir_personnage(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_joueur_id uuid; v_etat jsonb;
BEGIN
  SELECT joueur_id INTO v_joueur_id FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable.')),
      'avertissements', jsonb_build_array(), 'donnees', NULL);
  END IF;
  IF v_joueur_id IS DISTINCT FROM auth.uid() AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_autorise','message','Vous n''êtes pas autorisé à rouvrir ce personnage.')),
      'avertissements', jsonb_build_array(), 'donnees', NULL);
  END IF;
  v_etat := public.etat_edition_personnage(p_personnage_id);
  IF (v_etat->>'etat') IS DISTINCT FROM 'remodelage_libre' THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','reouverture_impossible','message',
        CASE v_etat->>'etat'
          WHEN 'brouillon' THEN 'Ce personnage est déjà en création.'
          WHEN 'gele'      THEN 'Personnage gelé (inscrit à un événement à venir) — réouverture impossible.'
          WHEN 'campagne'  THEN 'Personnage en campagne — réouverture libre impossible (ajouts et améliorations uniquement).'
          WHEN 'mort'      THEN 'Personnage mort — réouverture impossible.'
          ELSE 'Réouverture impossible dans l''état actuel.'
        END)),
      'avertissements', jsonb_build_array(), 'donnees', NULL);
  END IF;
  UPDATE public.personnages SET est_verrouille=false, est_finalise=false, etape_creation=10 WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true, 'erreurs', jsonb_build_array(), 'avertissements', jsonb_build_array(),
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation', 10));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.acheter_competence(p_personnage_id uuid, p_competence_id uuid, p_niveau_desire integer, p_choix_achat text DEFAULT NULL::text, p_appris_via_maitre boolean DEFAULT false, p_nom_maitre text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_check jsonb; v_niveaux jsonb;
  v_cout_xp integer; v_xp_disponible integer;
  v_new_id uuid; v_xp_total integer; v_xp_depense integer; v_statut text;
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
  v_blocage := public.gate_edition_personnage(p_personnage_id, 'ajout');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
  v_check := peut_acheter_competence(p_personnage_id, p_competence_id, p_niveau_desire, p_choix_achat);
  IF NOT (v_check->>'peut_acheter')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_refuse','message', COALESCE(v_check->>'raison','Achat refusé'))),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT niveaux INTO v_niveaux FROM competences WHERE id = p_competence_id;
  IF v_niveaux IS NULL OR jsonb_array_length(v_niveaux) < p_niveau_desire THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de compétence invalide')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_cout_xp := COALESCE((v_niveaux->(p_niveau_desire - 1)->>'cout_xp')::integer, 0);
  v_xp_disponible := v_perso.xp_total - v_perso.xp_depense;
  IF v_xp_disponible < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_statut := CASE WHEN p_appris_via_maitre THEN 'en_attente' ELSE 'non_requis' END;
  BEGIN
    INSERT INTO personnage_competences
      (personnage_id, competence_id, niveau_acquis, appris_via_maitre, xp_depense, nom_maitre, statut_maitre, choix_achat)
    VALUES (p_personnage_id, p_competence_id, p_niveau_desire, p_appris_via_maitre, v_cout_xp, p_nom_maitre, v_statut, p_choix_achat)
    RETURNING id INTO v_new_id;
    UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
     WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, competence_id, acteur_id)
      VALUES (p_personnage_id, 'depense_competence', -v_cout_xp,
              'Achat compétence niveau ' || p_niveau_desire || ' (' || v_cout_xp || ' XP)',
              p_competence_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_competence_id', v_new_id,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.acheter_sort(p_personnage_id uuid, p_sort_id uuid, p_niveau_sort integer, p_zone_choisie text, p_portee_choisie text, p_duree_choisie text, p_nom_personnalise text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
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
  v_blocage := public.gate_edition_personnage(p_personnage_id, 'ajout');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
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
$function$
;

CREATE OR REPLACE FUNCTION public.acheter_priere(p_personnage_id uuid, p_priere_id uuid, p_niveau_priere integer, p_zone_choisie text, p_portee_choisie text, p_duree_choisie text, p_nom_personnalise text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
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
  v_blocage := public.gate_edition_personnage(p_personnage_id, 'ajout');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
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
$function$
;

CREATE OR REPLACE FUNCTION public.acheter_assemblage(p_personnage_id uuid, p_assemblage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid          uuid := auth.uid();
  v_perso        personnages%ROWTYPE;
  v_niveau_runes integer;
  v_quota_total  integer;
  v_cout_xp      integer;
  v_count        integer;
  v_cout_prevu   integer;
  v_new_id       uuid;
  v_ligne        personnage_assemblages%ROWTYPE;
  v_xp_total     integer;
  v_xp_depense   integer;
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

  v_blocage := public.gate_edition_personnage(p_personnage_id, 'ajout');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;

  SELECT cout_xp INTO v_cout_xp FROM assemblages_runes WHERE id = p_assemblage_id;
  IF v_cout_xp IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','assemblage_introuvable','message','Assemblage introuvable ou sans coût défini')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT niveau_runes, quota_assemblages_total INTO v_niveau_runes, v_quota_total
    FROM vue_artisanat_quotas WHERE personnage_id = p_personnage_id;
  IF COALESCE(v_niveau_runes, 0) < 1 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint','message','Compétence Assemblage de Runes requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Coût prévu : la nouvelle ligne arrive en dernier dans le seau
  SELECT count(*)::integer INTO v_count
    FROM personnage_assemblages WHERE personnage_id = p_personnage_id;
  v_cout_prevu := CASE WHEN v_count < COALESCE(v_quota_total, 0) THEN 0 ELSE COALESCE(v_cout_xp, 0) END;

  IF v_cout_prevu > 0 AND (v_perso.xp_total - v_perso.xp_depense) < v_cout_prevu THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  BEGIN
    INSERT INTO personnage_assemblages (personnage_id, assemblage_id, xp_depense, est_gratuit)
    VALUES (p_personnage_id, p_assemblage_id, 0, false)
    RETURNING id INTO v_new_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  PERFORM public.reconcilier_assemblages(p_personnage_id);

  SELECT * INTO v_ligne FROM personnage_assemblages WHERE id = v_new_id;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;

  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('id', v_new_id, 'est_gratuit', v_ligne.est_gratuit,
      'xp_depense_achat', v_ligne.xp_depense,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.acheter_recette(p_personnage_id uuid, p_recette_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid             uuid := auth.uid();
  v_perso           personnages%ROWTYPE;
  v_q               record;
  v_niveau_alchimie integer;
  v_niveau_requis   integer;
  v_cout_xp         integer;
  v_quota_palier    integer;
  v_count_palier    integer;
  v_cout_prevu      integer;
  v_new_id          uuid;
  v_ligne           personnage_recettes%ROWTYPE;
  v_xp_total        integer;
  v_xp_depense      integer;
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

  v_blocage := public.gate_edition_personnage(p_personnage_id, 'ajout');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;

  -- Existence + palier de la recette
  SELECT niveau_requis, cout_xp INTO v_niveau_requis, v_cout_xp
    FROM recettes_alchimie WHERE id = p_recette_id;
  IF v_niveau_requis IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','recette_introuvable','message','Recette introuvable ou sans coût défini')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- Quotas par palier
  SELECT niveau_alchimie,
         quota_alchimie_mineure_total       AS q1,
         quota_alchimie_intermediaire_total AS q2,
         quota_alchimie_majeure_total       AS q3
    INTO v_q
    FROM vue_artisanat_quotas WHERE personnage_id = p_personnage_id;
  v_niveau_alchimie := COALESCE(v_q.niveau_alchimie, 0);

  IF v_niveau_alchimie < 1 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint','message','Compétence Alchimie requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- GARDE-FOU : palier débloqué (niveau_requis <= niveau_alchimie)
  IF v_niveau_requis > v_niveau_alchimie THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint',
        'message', format('Palier de recette non débloqué (niveau Alchimie %s requis)', v_niveau_requis),
        'champ','niveau_requis')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_quota_palier := CASE v_niveau_requis
                      WHEN 1 THEN COALESCE(v_q.q1, 0)
                      WHEN 2 THEN COALESCE(v_q.q2, 0)
                      WHEN 3 THEN COALESCE(v_q.q3, 0)
                      ELSE 0
                    END;

  -- Coût prévu : la nouvelle ligne arrive en dernier dans son palier
  SELECT count(*)::integer INTO v_count_palier
    FROM personnage_recettes pr JOIN recettes_alchimie ra ON ra.id = pr.recette_id
   WHERE pr.personnage_id = p_personnage_id AND ra.niveau_requis = v_niveau_requis;
  v_cout_prevu := CASE WHEN v_count_palier < v_quota_palier THEN 0 ELSE COALESCE(v_cout_xp, 0) END;

  IF v_cout_prevu > 0 AND (v_perso.xp_total - v_perso.xp_depense) < v_cout_prevu THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  -- INSERT brut (le réconciliateur fixe est_gratuit/xp_depense et écrit le ledger)
  BEGIN
    INSERT INTO personnage_recettes (personnage_id, recette_id, xp_depense, est_gratuit)
    VALUES (p_personnage_id, p_recette_id, 0, false)
    RETURNING id INTO v_new_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  PERFORM public.reconcilier_recettes(p_personnage_id);

  SELECT * INTO v_ligne FROM personnage_recettes WHERE id = v_new_id;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;

  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('id', v_new_id, 'est_gratuit', v_ligne.est_gratuit,
      'xp_depense_achat', v_ligne.xp_depense,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.acheter_piege(p_personnage_id uuid, p_piege_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid uuid := auth.uid(); v_perso personnages%ROWTYPE; v_piege pieges%ROWTYPE;
  v_niveau_pieges integer; v_quota_total integer; v_nb_gratuits integer;
  v_est_gratuit boolean; v_cout_xp integer; v_new_id uuid; v_xp_total integer; v_xp_depense integer;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_perso FROM personnages WHERE id=p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  v_blocage := public.gate_edition_personnage(p_personnage_id, 'ajout');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
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
END; $function$
;

CREATE OR REPLACE FUNCTION public.acheter_trait_racial(p_personnage_id uuid, p_trait_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_nb_traits_gratuits_race integer; v_nb_gratuits_acquis integer;
  v_est_gratuit boolean; v_cout_xp integer := 0;
  v_check jsonb; v_xp_total integer; v_xp_depense integer; v_traits jsonb;
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
  v_blocage := public.gate_edition_personnage(p_personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
  v_check := peut_acheter_trait_racial(p_personnage_id, p_trait_id, v_perso.race_id, v_perso.sous_type_chimeride);
  IF NOT (v_check->>'peut_acheter')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_refuse','message', COALESCE(v_check->>'raison','Achat refusé'))),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT nb_traits_raciaux INTO v_nb_traits_gratuits_race FROM races WHERE id = v_perso.race_id;
  v_nb_traits_gratuits_race := COALESCE(v_nb_traits_gratuits_race, 0);
  SELECT COUNT(*)::integer INTO v_nb_gratuits_acquis
    FROM jsonb_array_elements(COALESCE(v_perso.traits_raciaux_choisis, '[]'::jsonb)) elem
   WHERE (elem->>'est_gratuit')::boolean = true;
  IF v_nb_gratuits_acquis < v_nb_traits_gratuits_race THEN
    v_est_gratuit := true; v_cout_xp := 0;
  ELSE
    v_est_gratuit := false;
    SELECT cout_xp INTO v_cout_xp FROM vue_traits_par_race
     WHERE race_id = v_perso.race_id AND trait_id = p_trait_id LIMIT 1;
    v_cout_xp := COALESCE(v_cout_xp, 0);
    IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;
  BEGIN
    UPDATE personnages
       SET traits_raciaux_choisis = COALESCE(traits_raciaux_choisis, '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object(
                'trait_id', p_trait_id, 'est_gratuit', v_est_gratuit, 'xp_depense', v_cout_xp)),
           xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
     WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
      VALUES (p_personnage_id, 'depense_trait', -v_cout_xp,
              'Achat trait racial (' || v_cout_xp || ' XP)', p_trait_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense, traits_raciaux_choisis INTO v_xp_total, v_xp_depense, v_traits
    FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('est_gratuit', v_est_gratuit, 'xp_depense_achat', v_cout_xp,
      'traits_raciaux_choisis', v_traits, 'xp_total', v_xp_total,
      'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.peut_acheter_competence(p_personnage_id uuid, p_competence_id uuid, p_niveau_desire integer, p_choix_achat text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_personnage RECORD; v_competence RECORD;
  v_est_propre_classe boolean; v_classe_normalisee text;
  v_niveau_max_actuel integer; v_niveau_max_autorise integer;
  v_deja_choisi boolean; v_cout_xp integer;
  v_necessite_maitre boolean;
  v_prereq jsonb; v_prereq_item jsonb;
  v_manquants text[]; v_niveau_actuel_pre integer;
  v_nom_lisible text; v_choix_existant text;
BEGIN
  SELECT p.id, p.classe_id, cl.nom AS classe_nom,
         (COALESCE(p.xp_total,0) - COALESCE(p.xp_depense,0)) AS xp_dispo,
         p.ps_max
    INTO v_personnage
    FROM personnages p
    LEFT JOIN classes cl ON cl.id = p.classe_id
   WHERE p.id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Personnage introuvable');
  END IF;
  v_blocage := public.gate_edition_personnage(p_personnage_id, 'ajout');
  IF v_blocage IS NOT NULL THEN RETURN jsonb_build_object('peut_acheter', false, 'raison', v_blocage->'erreurs'->0->>'message'); END IF;
  SELECT * INTO v_competence FROM competences WHERE id = p_competence_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Compétence introuvable');
  END IF;
  IF NOT v_competence.est_actif THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Compétence inactive');
  END IF;
  IF v_competence.classes_requises IS NOT NULL AND array_length(v_competence.classes_requises, 1) > 0 THEN
    v_classe_normalisee := CASE v_personnage.classe_nom
      WHEN 'Guerrier' THEN 'guerrier'
      WHEN 'Voleur'   THEN 'voleur'
      WHEN 'Mage'     THEN 'mage'
      WHEN 'Prêtre'   THEN 'pretre'
      ELSE NULL END;
    IF v_classe_normalisee IS NULL OR NOT (v_classe_normalisee = ANY(v_competence.classes_requises)) THEN
      RETURN jsonb_build_object('peut_acheter', false,
        'raison', format('Classe requise : %s', array_to_string(v_competence.classes_requises, ' ou ')));
    END IF;
  END IF;
  v_est_propre_classe := (
    (v_competence.categorie = 'guerrier' AND v_personnage.classe_nom = 'Guerrier') OR
    (v_competence.categorie = 'voleur'   AND v_personnage.classe_nom = 'Voleur')   OR
    (v_competence.categorie = 'mage'     AND v_personnage.classe_nom = 'Mage')     OR
    (v_competence.categorie = 'pretre'   AND v_personnage.classe_nom = 'Prêtre'));
  IF v_competence.est_general OR v_est_propre_classe THEN
    v_niveau_max_autorise := 3;
  ELSE
    v_niveau_max_autorise := 2;
  END IF;
  IF p_niveau_desire > v_niveau_max_autorise THEN
    RETURN jsonb_build_object('peut_acheter', false,
      'raison', format('Niveau %s inaccessible hors de votre classe (maximum autorisé : %s)', p_niveau_desire, v_niveau_max_autorise));
  END IF;
  IF p_niveau_desire < 1 OR p_niveau_desire > 3 THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Niveau invalide (1 à 3 attendu)');
  END IF;
  IF v_competence.verrouillage_croise THEN
    IF EXISTS (
      SELECT 1 FROM personnage_competences pc2
        JOIN competences c2 ON c2.id = pc2.competence_id
       WHERE pc2.personnage_id = p_personnage_id
         AND c2.nom = v_competence.nom
         AND c2.id <> v_competence.id
    ) THEN
      RETURN jsonb_build_object('peut_acheter', false,
        'raison', format('Vous avez déjà acquis "%s" dans l''autre catégorie', v_competence.nom));
    END IF;
  END IF;
  SELECT COALESCE(max(niveau_acquis), 0) INTO v_niveau_max_actuel
    FROM personnage_competences
   WHERE personnage_id = p_personnage_id AND competence_id = p_competence_id;
  CASE v_competence.type_achat
    WHEN 'simple' THEN
      IF p_niveau_desire <> v_niveau_max_actuel + 1 THEN
        RETURN jsonb_build_object('peut_acheter', false,
          'raison', format('Vous devez d''abord acquérir le niveau %s', v_niveau_max_actuel + 1));
      END IF;
    WHEN 'unique_avec_choix' THEN
      IF v_niveau_max_actuel >= 1 THEN
        SELECT choix_achat INTO v_choix_existant
          FROM personnage_competences
         WHERE personnage_id = p_personnage_id
           AND competence_id = p_competence_id
         LIMIT 1;
        v_nom_lisible := CASE
          WHEN v_competence.type_choix = 'religion' AND v_choix_existant IS NOT NULL
            THEN COALESCE((SELECT nom FROM religions WHERE id::text = v_choix_existant), v_choix_existant)
          WHEN v_competence.type_choix IN ('langue', 'langue_ancienne') AND v_choix_existant IS NOT NULL
            THEN COALESCE((SELECT nom FROM langues WHERE id::text = v_choix_existant), v_choix_existant)
          ELSE NULL END;
        IF v_nom_lisible IS NOT NULL THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', format('Déjà acquis : %s', v_nom_lisible));
        ELSE
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Déjà acquis');
        END IF;
      END IF;
      IF p_niveau_desire <> 1 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Seul le niveau 1 est achetable pour cette compétence');
      END IF;
      IF p_choix_achat IS NULL OR length(trim(p_choix_achat)) = 0 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Un choix est obligatoire');
      END IF;
    WHEN 'multiple_avec_choix_par_niveau' THEN
      IF v_competence.nom = 'Connaissances Criminelles' AND p_niveau_desire = 1 THEN
        IF v_niveau_max_actuel >= 1 THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Déjà acquis au niveau 1');
        END IF;
      ELSE
        IF p_choix_achat IS NULL OR length(trim(p_choix_achat)) = 0 THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Un choix est obligatoire');
        END IF;
        SELECT EXISTS (
          SELECT 1 FROM personnage_competences
           WHERE personnage_id = p_personnage_id
             AND competence_id = p_competence_id
             AND niveau_acquis = p_niveau_desire
             AND choix_achat = p_choix_achat
        ) INTO v_deja_choisi;
        IF v_deja_choisi THEN
          RETURN jsonb_build_object('peut_acheter', false,
            'raison', format('"%s" est déjà acquis au niveau %s', p_choix_achat, p_niveau_desire));
        END IF;
        IF p_niveau_desire >= 2 THEN
          IF v_competence.nom = 'Connaissances Criminelles' AND p_niveau_desire = 2 THEN
            IF v_niveau_max_actuel < 1 THEN
              RETURN jsonb_build_object('peut_acheter', false,
                'raison', 'Vous devez d''abord acquérir Connaissances Criminelles niveau 1');
            END IF;
          ELSE
            IF NOT EXISTS (
              SELECT 1 FROM personnage_competences
               WHERE personnage_id = p_personnage_id
                 AND competence_id = p_competence_id
                 AND niveau_acquis = p_niveau_desire - 1
                 AND choix_achat = p_choix_achat
            ) THEN
              RETURN jsonb_build_object('peut_acheter', false,
                'raison', format('Vous devez d''abord acquérir "%s" niveau %s pour "%s"', v_competence.nom, p_niveau_desire - 1, p_choix_achat));
            END IF;
          END IF;
        END IF;
      END IF;
    WHEN 'multiple_choix_distinct' THEN
      IF p_niveau_desire <> 1 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Seul le niveau 1 est achetable pour cette compétence');
      END IF;
      IF p_choix_achat IS NULL OR length(trim(p_choix_achat)) = 0 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Un choix est obligatoire');
      END IF;
      SELECT EXISTS (
        SELECT 1 FROM personnage_competences
         WHERE personnage_id = p_personnage_id
           AND competence_id = p_competence_id
           AND choix_achat = p_choix_achat
      ) INTO v_deja_choisi;
      IF v_deja_choisi THEN
        v_nom_lisible := CASE
          WHEN v_competence.type_choix IN ('langue', 'langue_ancienne')
            THEN COALESCE((SELECT nom FROM langues WHERE id::text = p_choix_achat), p_choix_achat)
          WHEN v_competence.type_choix = 'religion'
            THEN COALESCE((SELECT nom FROM religions WHERE id::text = p_choix_achat), p_choix_achat)
          ELSE p_choix_achat END;
        RETURN jsonb_build_object('peut_acheter', false, 'raison', format('Vous avez déjà acquis "%s"', v_nom_lisible));
      END IF;
    WHEN 'multiple_sans_choix' THEN
      IF p_niveau_desire <> 1 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Seul le niveau 1 est achetable pour cette compétence');
      END IF;
      IF v_competence.nom = 'Développement Spirituel' THEN
        IF COALESCE(v_personnage.ps_max,0) >= 20 THEN
          RETURN jsonb_build_object('peut_acheter', false,
            'raison', 'Maximum de 20 PS atteint — achetez Développement Spirituel Supérieur');
        END IF;
      ELSIF v_competence.nom = 'Développement Spirituel Supérieur' THEN
        IF COALESCE(v_personnage.ps_max,0) < 20 THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Nécessite 20 PS (achetez d''abord Développement Spirituel)');
        END IF;
        IF v_personnage.ps_max >= 30 THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Maximum absolu atteint (30 PS)');
        END IF;
      END IF;
  END CASE;
  IF v_competence.nom = 'Dépeçage' AND p_niveau_desire = 1 THEN
    IF NOT EXISTS (
      SELECT 1 FROM vue_personnage_etat
       WHERE personnage_id = p_personnage_id
         AND a_connaissance_creatures_1 = true
         AND a_premiers_soins = true
    ) THEN
      RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Prérequis : Connaissances des Créatures niveau 1 ET Premiers Soins');
    END IF;
    IF p_choix_achat IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM personnage_competences pc3
        JOIN competences c3 ON c3.id = pc3.competence_id
       WHERE pc3.personnage_id = p_personnage_id
         AND c3.nom = 'Connaissances des Créatures'
         AND pc3.niveau_acquis >= 1
         AND pc3.choix_achat = p_choix_achat
    ) THEN
      RETURN jsonb_build_object('peut_acheter', false,
        'raison', format('Vous devez d''abord avoir Connaissances des Créatures pour la catégorie "%s"', p_choix_achat));
    END IF;
  END IF;
  IF v_competence.nom = 'Dépeçage' AND p_niveau_desire = 2 THEN
    IF NOT EXISTS (
      SELECT 1 FROM vue_personnage_etat
       WHERE personnage_id = p_personnage_id AND a_connaissance_creatures_2 = true
    ) THEN
      RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Prérequis : Connaissances des Créatures niveau 2');
    END IF;
    IF p_choix_achat IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM personnage_competences pc4
        JOIN competences c4 ON c4.id = pc4.competence_id
       WHERE pc4.personnage_id = p_personnage_id
         AND c4.nom = 'Connaissances des Créatures'
         AND pc4.niveau_acquis >= 2
         AND pc4.choix_achat = p_choix_achat
    ) THEN
      RETURN jsonb_build_object('peut_acheter', false,
        'raison', format('Vous devez d''abord avoir Connaissances des Créatures niveau 2 pour "%s"', p_choix_achat));
    END IF;
  END IF;
  v_prereq := v_competence.prerequis_competences -> p_niveau_desire::text;
  IF v_prereq IS NOT NULL AND jsonb_array_length(v_prereq) > 0 THEN
    v_manquants := ARRAY[]::text[];
    FOR v_prereq_item IN SELECT * FROM jsonb_array_elements(v_prereq) LOOP
      SELECT COALESCE(max(pc.niveau_acquis), 0)
        INTO v_niveau_actuel_pre
        FROM personnage_competences pc
        JOIN competences c ON c.id = pc.competence_id
       WHERE pc.personnage_id = p_personnage_id
         AND c.nom = (v_prereq_item->>'competence_nom');
      IF v_niveau_actuel_pre < (v_prereq_item->>'niveau_min')::integer THEN
        v_manquants := v_manquants || format('%s niveau %s',
          v_prereq_item->>'competence_nom',
          v_prereq_item->>'niveau_min');
      END IF;
    END LOOP;
    IF array_length(v_manquants, 1) > 0 THEN
      RETURN jsonb_build_object('peut_acheter', false,
        'raison', format('Prérequis manquant(s) : %s', array_to_string(v_manquants, ', ')));
    END IF;
  END IF;
  SELECT (elem->>'cout_xp')::integer INTO v_cout_xp
    FROM jsonb_array_elements(v_competence.niveaux) elem
   WHERE (elem->>'niveau')::integer = p_niveau_desire
   LIMIT 1;
  IF v_cout_xp IS NULL THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', format('Niveau %s non défini pour cette compétence', p_niveau_desire));
  END IF;
  IF v_personnage.xp_dispo < v_cout_xp THEN
    RETURN jsonb_build_object('peut_acheter', false,
      'raison', format('XP insuffisant. Requis : %s | Disponible : %s', v_cout_xp, v_personnage.xp_dispo));
  END IF;
  v_necessite_maitre := (
    (v_competence.est_general AND p_niveau_desire = 3) OR
    (v_est_propre_classe       AND p_niveau_desire = 3) OR
    (NOT v_competence.est_general AND NOT v_est_propre_classe AND p_niveau_desire = 2));
  RETURN jsonb_build_object(
    'peut_acheter',        true,
    'raison',              'OK',
    'cout_xp',             v_cout_xp,
    'niveau_actuel',       v_niveau_max_actuel,
    'niveau_desire',       p_niveau_desire,
    'necessite_maitre',    v_necessite_maitre,
    'type_achat',          v_competence.type_achat,
    'type_choix',          v_competence.type_choix,
    'verrouillage_croise', v_competence.verrouillage_croise);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.desacheter_competence(p_personnage_competence_id uuid, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE; v_pc personnage_competences%ROWTYPE; v_comp competences%ROWTYPE;
  v_removal_ids uuid[] := ARRAY[]::uuid[];
  v_prereq jsonb; v_dep RECORD; v_max int; v_changed boolean;
  v_purge_sorts boolean := false; v_purge_prieres boolean := false;
  v_items_comp jsonb := '[]'::jsonb; v_items_sorts jsonb := '[]'::jsonb; v_items_prieres jsonb := '[]'::jsonb; v_items_detail jsonb;
  v_xp_comp int := 0; v_xp_sorts int := 0; v_xp_prieres int := 0; v_xp_rembourse int := 0;
  v_nb_comp int := 0; v_nb_comp_distinct int := 0; v_nb_sorts int := 0; v_nb_prieres int := 0; v_cascade boolean;
  v_xp_total_apres int; v_xp_depense_apres int; v_donnees jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_pc FROM personnage_competences WHERE id = p_personnage_competence_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cet achat de compétence n''existe pas')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_perso FROM personnages WHERE id = v_pc.personnage_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  v_blocage := public.gate_edition_personnage(v_pc.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
  SELECT * INTO v_comp FROM competences WHERE id = v_pc.competence_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','competence_introuvable','message','Compétence introuvable')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF v_pc.xp_depense = 0 AND NOT v_comp.desachat_force THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','competence_gratuite','message','Une compétence acquise gratuitement (de classe) ne peut pas être désachetée')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;

  BEGIN
    IF v_comp.type_achat IN ('simple','unique_avec_choix','multiple_avec_choix_par_niveau') THEN
      v_removal_ids := ARRAY(SELECT id FROM personnage_competences WHERE personnage_id=v_pc.personnage_id AND competence_id=v_pc.competence_id AND niveau_acquis >= v_pc.niveau_acquis AND (v_comp.type_achat <> 'multiple_avec_choix_par_niveau' OR v_pc.choix_achat IS NULL OR choix_achat = v_pc.choix_achat));
      DELETE FROM personnage_competences WHERE personnage_id=v_pc.personnage_id AND competence_id=v_pc.competence_id AND niveau_acquis >= v_pc.niveau_acquis AND (v_comp.type_achat <> 'multiple_avec_choix_par_niveau' OR v_pc.choix_achat IS NULL OR choix_achat = v_pc.choix_achat);
    ELSE
      v_removal_ids := ARRAY[v_pc.id];
      DELETE FROM personnage_competences WHERE id = v_pc.id;
    END IF;
    v_changed := true;
    WHILE v_changed LOOP
      v_changed := false;
      v_prereq := verifier_prerequis_competences(v_pc.personnage_id);
      FOR v_dep IN SELECT pc.competence_id AS cid, max(pc.niveau_acquis) AS niv FROM personnage_competences pc WHERE pc.personnage_id = v_pc.personnage_id GROUP BY pc.competence_id LOOP
        IF v_prereq ? v_dep.cid::text THEN
          v_max := COALESCE((v_prereq -> v_dep.cid::text ->> 'niveau_max_achetable')::int, 3);
          IF v_dep.niv > v_max THEN
            v_removal_ids := v_removal_ids || ARRAY(SELECT id FROM personnage_competences WHERE personnage_id=v_pc.personnage_id AND competence_id=v_dep.cid AND niveau_acquis > v_max);
            DELETE FROM personnage_competences WHERE personnage_id=v_pc.personnage_id AND competence_id=v_dep.cid AND niveau_acquis > v_max;
            v_changed := true;
          END IF;
        END IF;
      END LOOP;
    END LOOP;
    RAISE EXCEPTION 'CASCADE_SIMULE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'CASCADE_SIMULE%' THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','erreur_cascade','message',SQLERRM)),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  END;

  SELECT COALESCE(bool_or(c.nom='Acquisition de Sort'),false), COALESCE(bool_or(c.nom='Acquisition de Prière'),false) INTO v_purge_sorts, v_purge_prieres FROM personnage_competences pc JOIN competences c ON c.id=pc.competence_id WHERE pc.id = ANY(v_removal_ids);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('type','competence','type_label','Compétence','nom',t.nom,'quantite',t.cnt,'xp_unitaire',t.xp_unit,'xp_total',t.xp_total,'niveaux',t.niveaux) ORDER BY t.nom),'[]'::jsonb), COALESCE(SUM(t.xp_total),0)::int, COALESCE(SUM(t.cnt),0)::int, COUNT(*)::int
    INTO v_items_comp, v_xp_comp, v_nb_comp, v_nb_comp_distinct
    FROM (SELECT c.nom, count(*)::int cnt, SUM(pc.xp_depense)::int xp_total, MIN(pc.xp_depense)::int xp_unit, jsonb_agg(pc.niveau_acquis ORDER BY pc.niveau_acquis) AS niveaux FROM personnage_competences pc JOIN competences c ON c.id=pc.competence_id WHERE pc.id = ANY(v_removal_ids) GROUP BY c.nom) t;

  IF v_purge_sorts THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('type','sort','type_label','Sort','nom',COALESCE(ps.nom_personnalise,s.nom),'quantite',1,'xp_unitaire',ps.xp_depense,'xp_total',ps.xp_depense) ORDER BY COALESCE(ps.nom_personnalise,s.nom)),'[]'::jsonb), COUNT(*)::int, COALESCE(SUM(ps.xp_depense),0)::int INTO v_items_sorts, v_nb_sorts, v_xp_sorts FROM personnage_sorts ps JOIN sorts s ON s.id=ps.sort_id WHERE ps.personnage_id=v_pc.personnage_id;
  END IF;
  IF v_purge_prieres THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('type','priere','type_label','Prière','nom',COALESCE(pp.nom_personnalise,pr.nom),'quantite',1,'xp_unitaire',pp.xp_depense,'xp_total',pp.xp_depense) ORDER BY COALESCE(pp.nom_personnalise,pr.nom)),'[]'::jsonb), COUNT(*)::int, COALESCE(SUM(pp.xp_depense),0)::int INTO v_items_prieres, v_nb_prieres, v_xp_prieres FROM personnage_prieres pp JOIN prieres pr ON pr.id=pp.priere_id WHERE pp.personnage_id=v_pc.personnage_id;
  END IF;

  v_items_detail := v_items_comp || v_items_sorts || v_items_prieres;
  v_xp_rembourse := v_xp_comp + v_xp_sorts + v_xp_prieres;
  v_cascade := (v_nb_comp_distinct > 1) OR v_purge_sorts OR v_purge_prieres;
  v_donnees := jsonb_build_object('cascade',v_cascade,'competence_cible',v_comp.nom,'count_competences',v_nb_comp,'count_competences_distinctes',v_nb_comp_distinct,'count_sorts',v_nb_sorts,'count_prieres',v_nb_prieres,'xp_rembourse',v_xp_rembourse,'items_detail',v_items_detail);

  IF p_dry_run THEN RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,'donnees',v_donnees); END IF;

  IF v_purge_sorts THEN
    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, acteur_id, sort_id) SELECT v_pc.personnage_id,'remboursement',ps.xp_depense,format('Désachat en cascade « Acquisition de Sort » — sort « %s »',COALESCE(ps.nom_personnalise,s.nom)),v_uid,ps.sort_id FROM personnage_sorts ps JOIN sorts s ON s.id=ps.sort_id WHERE ps.personnage_id=v_pc.personnage_id AND ps.xp_depense>0;
    DELETE FROM personnage_sorts WHERE personnage_id=v_pc.personnage_id;
  END IF;
  IF v_purge_prieres THEN
    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, acteur_id, priere_id) SELECT v_pc.personnage_id,'remboursement',pp.xp_depense,format('Désachat en cascade « Acquisition de Prière » — prière « %s »',COALESCE(pp.nom_personnalise,pr.nom)),v_uid,pp.priere_id FROM personnage_prieres pp JOIN prieres pr ON pr.id=pp.priere_id WHERE pp.personnage_id=v_pc.personnage_id AND pp.xp_depense>0;
    DELETE FROM personnage_prieres WHERE personnage_id=v_pc.personnage_id;
  END IF;
  INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, competence_id, acteur_id) SELECT v_pc.personnage_id,'remboursement',SUM(pc.xp_depense)::int,format('Désachat en cascade — %s (%s niveau(x))',c.nom,count(*)),pc.competence_id,v_uid FROM personnage_competences pc JOIN competences c ON c.id=pc.competence_id WHERE pc.id = ANY(v_removal_ids) AND pc.xp_depense > 0 GROUP BY pc.competence_id, c.nom;
  DELETE FROM personnage_competences WHERE id = ANY(v_removal_ids);

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres FROM personnages WHERE id = v_pc.personnage_id;
  v_donnees := v_donnees || jsonb_build_object('xp_total',v_xp_total_apres,'xp_depense',v_xp_depense_apres,'xp_restant',v_xp_total_apres - v_xp_depense_apres);
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,'donnees',v_donnees);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.desacheter_sort(p_personnage_sort_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_ps personnage_sorts%ROWTYPE;
  v_xp_total_apres integer;
  v_xp_depense_apres integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_ps FROM personnage_sorts WHERE id = p_personnage_sort_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Ce sort n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_ps.personnage_id FOR UPDATE;
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

  v_blocage := public.gate_edition_personnage(v_ps.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;

  DELETE FROM personnage_sorts WHERE id = p_personnage_sort_id;

  IF v_ps.xp_depense > 0 THEN
    UPDATE personnages
    SET xp_depense = xp_depense - v_ps.xp_depense,
        date_modification = now(),
        updated_at = now()
    WHERE id = v_ps.personnage_id;

    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, sort_id, acteur_id)
    VALUES (v_ps.personnage_id, 'remboursement', v_ps.xp_depense,
      'Remboursement sort (' || v_ps.xp_depense || ' XP)', v_ps.sort_id, v_uid);
  END IF;

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
  FROM personnages WHERE id = v_ps.personnage_id;

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_sort_id', p_personnage_sort_id,
      'sort_id', v_ps.sort_id,
      'xp_rembourse', v_ps.xp_depense,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.desacheter_priere(p_personnage_priere_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_pp personnage_prieres%ROWTYPE;
  v_xp_total_apres integer;
  v_xp_depense_apres integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_pp FROM personnage_prieres WHERE id = p_personnage_priere_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cette prière n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_pp.personnage_id FOR UPDATE;
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

  v_blocage := public.gate_edition_personnage(v_pp.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;

  DELETE FROM personnage_prieres WHERE id = p_personnage_priere_id;

  IF v_pp.xp_depense > 0 THEN
    UPDATE personnages
    SET xp_depense = xp_depense - v_pp.xp_depense,
        date_modification = now(),
        updated_at = now()
    WHERE id = v_pp.personnage_id;

    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, priere_id, acteur_id)
    VALUES (v_pp.personnage_id, 'remboursement', v_pp.xp_depense,
      'Remboursement prière (' || v_pp.xp_depense || ' XP)', v_pp.priere_id, v_uid);
  END IF;

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
  FROM personnages WHERE id = v_pp.personnage_id;

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_priere_id', p_personnage_priere_id,
      'priere_id', v_pp.priere_id,
      'xp_rembourse', v_pp.xp_depense,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.desacheter_assemblage(p_personnage_assemblage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid              uuid := auth.uid();
  v_perso            personnages%ROWTYPE;
  v_pa               personnage_assemblages%ROWTYPE;
  v_xp_total_apres   integer;
  v_xp_depense_apres integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_pa FROM personnage_assemblages WHERE id = p_personnage_assemblage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cet assemblage n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_pa.personnage_id FOR UPDATE;
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

  v_blocage := public.gate_edition_personnage(v_pa.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;

  DELETE FROM personnage_assemblages WHERE id = p_personnage_assemblage_id;

  IF COALESCE(v_pa.xp_depense, 0) > 0 THEN
    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, assemblage_id, acteur_id)
    VALUES (v_pa.personnage_id, 'remboursement', v_pa.xp_depense,
      'Remboursement assemblage de runes (' || v_pa.xp_depense || ' XP)', v_pa.assemblage_id, v_uid);
  END IF;

  PERFORM public.reconcilier_assemblages(v_pa.personnage_id);

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
    FROM personnages WHERE id = v_pa.personnage_id;

  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_assemblage_id', p_personnage_assemblage_id,
      'assemblage_id', v_pa.assemblage_id,
      'etait_gratuit', v_pa.est_gratuit,
      'xp_rembourse', CASE WHEN v_pa.est_gratuit THEN 0 ELSE v_pa.xp_depense END,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.desacheter_recette(p_personnage_recette_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid              uuid := auth.uid();
  v_perso            personnages%ROWTYPE;
  v_pr               personnage_recettes%ROWTYPE;
  v_xp_total_apres   integer;
  v_xp_depense_apres integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_pr FROM personnage_recettes WHERE id = p_personnage_recette_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cette recette n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_pr.personnage_id FOR UPDATE;
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

  v_blocage := public.gate_edition_personnage(v_pr.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;

  DELETE FROM personnage_recettes WHERE id = p_personnage_recette_id;

  -- Compense la ligne supprimée (invisible au réconciliateur après DELETE)
  IF COALESCE(v_pr.xp_depense, 0) > 0 THEN
    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, recette_id, acteur_id)
    VALUES (v_pr.personnage_id, 'remboursement', v_pr.xp_depense,
      'Remboursement recette d''alchimie (' || v_pr.xp_depense || ' XP)', v_pr.recette_id, v_uid);
  END IF;

  -- Auto-soin : promeut une éventuelle ligne payante du même palier
  PERFORM public.reconcilier_recettes(v_pr.personnage_id);

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
    FROM personnages WHERE id = v_pr.personnage_id;

  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_recette_id', p_personnage_recette_id,
      'recette_id', v_pr.recette_id,
      'etait_gratuit', v_pr.est_gratuit,
      'xp_rembourse', CASE WHEN v_pr.est_gratuit THEN 0 ELSE v_pr.xp_depense END,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.desacheter_piege(p_personnage_piege_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
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
  v_blocage := public.gate_edition_personnage(v_pp.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
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
END; $function$
;

-- Grants (les 14 RPC existantes conservent leurs grants via CREATE OR REPLACE ;
-- seules les 2 nouvelles fonctions nécessitent un GRANT explicite).
GRANT EXECUTE ON FUNCTION public.gate_edition_personnage(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reouvrir_personnage(uuid) TO authenticated;
