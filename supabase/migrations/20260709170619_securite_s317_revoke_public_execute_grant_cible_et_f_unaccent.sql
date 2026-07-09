-- s317 — Durcissement défense-en-profondeur : verrouillage des grants EXECUTE
-- sur les fonctions SECURITY DEFINER de public + fix search_path f_unaccent.
--
-- Contexte : advisor Supabase (anon|authenticated)_security_definer_function_executable
-- = 125 fonctions SECDEF exécutables par anon/authenticated (via PUBLIC + grants directs).
-- Aucune brèche active (gardes internes est_admin/auth.uid vérifiées au sol), mais on
-- coupe l'accès en amont, surtout côté anon (public/internet).
--
-- Règle (validée par dry-run BEGIN..ROLLBACK + simulation anon/joueur/admin) :
--   • KEEP anon+auth (17) : helpers lus par policies/vues (est_admin, est_animateur_ou_admin,
--     role_du_profil, compte_voit_joueur, assembler_prerequis_labels, etat_edition_personnage,
--     nom_profil_principal) + consultation publique/visiteur (rechercher_encyclopedie,
--     verifier_prerequis_competences, fixtures_visiteur_*, fixtures_parite_visiteur*). NON touchés.
--   • REVOKE anon+auth (12) : les trigger-functions (jamais appelables en RPC).
--   • REVOKE anon, GARDE auth (96) : tous les autres RPC (joueur + admin ; admin = rôle
--     authenticated). Appelants toujours connectés → aucun casse.
-- postgres & service_role conservent leur grant explicite (prebuild snapshot intact).
--
-- Résultat advisor : anon 125→17, authenticated 125→113.
-- Idempotent (le filtre has_function_privilege('anon',...) ne re-traite que ce qui est encore
-- ouvert) et auto-cicatrisant si une future CREATE OR REPLACE FUNCTION ré-ouvre à PUBLIC.
-- Réversible : GRANT EXECUTE ... TO anon/authenticated pour rétablir.
-- ⚠️ CREATE OR REPLACE FUNCTION réinitialise l'ACL à PUBLIC → re-jouer ce lot après toute
--    recréation d'une de ces fonctions.
DO $$
DECLARE
  v_keep_anon text[] := ARRAY[
    'assembler_prerequis_labels','compte_voit_joueur','est_admin','est_animateur_ou_admin',
    'etat_edition_personnage','nom_profil_principal','role_du_profil',
    'rechercher_encyclopedie','verifier_prerequis_competences',
    'fixtures_visiteur_assemblages','fixtures_visiteur_pieges','fixtures_visiteur_prieres',
    'fixtures_visiteur_recettes','fixtures_visiteur_sorts','fixtures_visiteur_traits_raciaux',
    'fixtures_parite_visiteur','fixtures_parite_visiteur_type'];
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname, (p.prorettype='trigger'::regtype) AS is_trg
    FROM pg_proc p
    WHERE p.pronamespace='public'::regnamespace AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    IF r.proname = ANY(v_keep_anon) THEN
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    IF NOT r.is_trg THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
  END LOOP;
END $$;

-- Fix advisor function_search_path_mutable : f_unaccent (corps pleinement qualifié → '' sûr)
ALTER FUNCTION public.f_unaccent(text) SET search_path = '';
