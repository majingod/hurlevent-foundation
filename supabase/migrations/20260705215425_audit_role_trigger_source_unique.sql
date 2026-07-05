-- AUDIT-ROLE-TRIGGER : journalisation universelle des changements de rôle.
-- Source unique = trigger proteger_profile_role (voit RPC, SQL editor, connexions directes).
-- Le RPC changer_role_compte ne journalise plus (évite le doublon).
-- Contexte : incident s308 — promotions admin hors interface invisibles au journal.

-- 1) Schéma journal : acteur inconnu autorisé + rôle 'systeme'
ALTER TABLE public.journal_audit ALTER COLUMN acteur_id DROP NOT NULL;
DO $d$
DECLARE v_con text;
BEGIN
  SELECT conname INTO v_con FROM pg_constraint
  WHERE conrelid='public.journal_audit'::regclass AND contype='c'
    AND pg_get_constraintdef(oid) ILIKE '%acteur_role%';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.journal_audit DROP CONSTRAINT %I', v_con);
  END IF;
  ALTER TABLE public.journal_audit ADD CONSTRAINT journal_audit_acteur_role_check
    CHECK (acteur_role = ANY (ARRAY['proprietaire','admin','animateur','autre','systeme']));
END $d$;

-- 2) Helper de journalisation (source unique)
CREATE OR REPLACE FUNCTION public.journaliser_changement_role(p_acteur uuid, p_cible uuid, p_ancien text, p_nouveau text, p_nom text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  INSERT INTO public.journal_audit (acteur_id, acteur_role, cible_type, cible_id, action, details)
  VALUES (
    p_acteur,
    CASE WHEN p_acteur IS NULL THEN 'systeme'
         ELSE COALESCE((SELECT role FROM public.profiles WHERE id = p_acteur), 'autre') END,
    'compte', p_cible, 'changement_role',
    jsonb_build_object('ancien', p_ancien, 'nouveau', p_nouveau, 'nom', p_nom,
      'origine', CASE WHEN p_acteur IS NULL THEN 'direct_db' ELSE 'application' END)
  );
END;
$fn$;

-- 3) Trigger : protections IDENTIQUES + journalisation de tout changement de rôle
CREATE OR REPLACE FUNCTION public.proteger_profile_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_actor_role text;
  v_acteur uuid := auth.uid();
BEGIN
  IF current_user IN ('postgres','supabase_admin') OR session_user IN ('postgres','supabase_admin') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.role := COALESCE(NEW.role, 'joueur');
      IF NEW.role <> 'joueur' THEN PERFORM public.journaliser_changement_role(v_acteur, NEW.id, NULL, NEW.role, COALESCE(NEW.nom_affichage, NEW.email)); END IF;
    ELSIF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
      PERFORM public.journaliser_changement_role(v_acteur, NEW.id, OLD.role, NEW.role, COALESCE(NEW.nom_affichage, NEW.email));
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_acteur IS NULL OR NEW.id IS DISTINCT FROM v_acteur THEN
      RAISE EXCEPTION 'Création de profil non autorisée' USING ERRCODE = '42501';
    END IF;
    NEW.role := 'joueur';
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Modification de l''identifiant profil non autorisée' USING ERRCODE = '42501';
    END IF;
    SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_acteur;
    IF v_acteur = OLD.id AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Modification de votre propre rôle non autorisée' USING ERRCODE = '42501';
    END IF;
    IF COALESCE(v_actor_role,'joueur') NOT IN ('admin','animateur') AND NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Modification du rôle non autorisée' USING ERRCODE = '42501';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      PERFORM public.journaliser_changement_role(v_acteur, NEW.id, OLD.role, NEW.role, COALESCE(NEW.nom_affichage, NEW.email));
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$fn$;

-- 4) RPC : retire la journalisation (le trigger s'en charge désormais)
CREATE OR REPLACE FUNCTION public.changer_role_compte(p_compte_id uuid, p_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_ancien text;
  v_nom    text;
BEGIN
  IF NOT public.est_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','acces_refuse','message','Action réservée aux administrateurs.')),
      'avertissements','[]'::jsonb,'donnees',NULL);
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('joueur','animateur','admin') THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','role_invalide','message','Rôle invalide (joueur, animateur ou admin).','champ','role')),
      'avertissements','[]'::jsonb,'donnees',NULL);
  END IF;

  SELECT role, COALESCE(nom_affichage, email) INTO v_ancien, v_nom
  FROM public.profiles WHERE id = p_compte_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','compte_introuvable','message','Compte introuvable.')),
      'avertissements','[]'::jsonb,'donnees',NULL);
  END IF;

  IF v_ancien = p_role THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','role_inchange','message','Le compte a déjà ce rôle.')),
      'avertissements','[]'::jsonb,'donnees',NULL);
  END IF;

  UPDATE public.profiles SET role = p_role WHERE id = p_compte_id;

  -- Journalisation : assurée par le trigger proteger_profile_role (source unique).

  PERFORM public.creer_notification(
    p_message  := format('Votre rôle est passé de %s à %s.', v_ancien, p_role),
    p_compte_id := p_compte_id);

  RETURN jsonb_build_object('succes', true, 'erreurs','[]'::jsonb, 'avertissements','[]'::jsonb,
    'donnees', jsonb_build_object('compte_id', p_compte_id, 'ancien', v_ancien, 'nouveau', p_role));
END;
$fn$;
