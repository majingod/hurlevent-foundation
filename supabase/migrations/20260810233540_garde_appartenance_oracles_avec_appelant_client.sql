-- s391 · Garde d'appartenance sur les 3 oracles de lecture qui ont un appelant client
--
-- Ces 3 fonctions sont appelees par le client (mesure au SHA 803fe39 :
-- etat_edition_personnage 3 appels .rpc(, verifier_prerequis_competences 1,
-- derniere_photo_compo 1) : les fermer par ACL casserait la creation. Le
-- correctif va donc DANS LE CORPS, contrairement aux 12 de 20260810211708.
--
-- PREDICAT RETENU : celui de la RLS de lecture des tables lues
--   personnages            : compte_voit_joueur(joueur_id) OR est_animateur_ou_admin()
--   personnage_compo_photos: idem
-- et NON peut_editer_personnage (= compte_voit_joueur OR est_admin), qui
-- REFUSERAIT LES ANIMATEURS alors que la table, elle, les laisse lire. Une
-- fonction qui lit une table ne doit dire ni moins ni plus que sa policy.
--
-- REFUS = RETURN NULL, jamais une exception : gate_edition_personnage traite
-- deja le cas ((v_etat->>'etat') IS NULL -> personnage_introuvable) et le front
-- fait (data ?? null). Un NULL ne divulgue pas non plus l'existence du perso.
--
-- FORME : RENAME + ENVELOPPE pour les deux grosses (C80 applique par prudence
-- et non par taille) : aucun octet des corps metier n'est retape
-- (3 717 + 5 514 o preserves). derniere_photo_compo (199 o) est reecrite.
-- ACL re-posee explicitement apres chaque CREATE OR REPLACE (C102).

-- 1) derniere_photo_compo (199 o) -----------------------------------------
CREATE OR REPLACE FUNCTION public.derniere_photo_compo(p_personnage_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_joueur uuid; v_compo jsonb;
BEGIN
  SELECT joueur_id INTO v_joueur FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT (public.compte_voit_joueur(v_joueur) OR public.est_animateur_ou_admin()) THEN
    RETURN NULL;
  END IF;
  SELECT compo INTO v_compo
  FROM public.personnage_compo_photos
  WHERE personnage_id = p_personnage_id
  ORDER BY created_at DESC
  LIMIT 1;
  RETURN v_compo;
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.derniere_photo_compo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.derniere_photo_compo(uuid) TO authenticated, service_role;

-- 2) etat_edition_personnage (3 717 o, corps INTACT) -----------------------
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'etat_edition_personnage_noyau') THEN
    ALTER FUNCTION public.etat_edition_personnage(uuid) RENAME TO etat_edition_personnage_noyau;
  END IF;
END
$do$;

CREATE OR REPLACE FUNCTION public.etat_edition_personnage(p_personnage_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_joueur uuid;
BEGIN
  SELECT joueur_id INTO v_joueur FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT (public.compte_voit_joueur(v_joueur) OR public.est_animateur_ou_admin()) THEN
    RETURN NULL;
  END IF;
  RETURN public.etat_edition_personnage_noyau(p_personnage_id);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.etat_edition_personnage_noyau(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.etat_edition_personnage_noyau(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.etat_edition_personnage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.etat_edition_personnage(uuid) TO authenticated, service_role;

-- 3) verifier_prerequis_competences (5 514 o, corps INTACT) ----------------
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'verifier_prerequis_competences_noyau') THEN
    ALTER FUNCTION public.verifier_prerequis_competences(uuid) RENAME TO verifier_prerequis_competences_noyau;
  END IF;
END
$do$;

CREATE OR REPLACE FUNCTION public.verifier_prerequis_competences(p_personnage_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_joueur uuid;
BEGIN
  SELECT joueur_id INTO v_joueur FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT (public.compte_voit_joueur(v_joueur) OR public.est_animateur_ou_admin()) THEN
    RETURN NULL;
  END IF;
  RETURN public.verifier_prerequis_competences_noyau(p_personnage_id);
END;
$fn$;
REVOKE EXECUTE ON FUNCTION public.verifier_prerequis_competences_noyau(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verifier_prerequis_competences_noyau(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.verifier_prerequis_competences(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verifier_prerequis_competences(uuid) TO authenticated, service_role;
