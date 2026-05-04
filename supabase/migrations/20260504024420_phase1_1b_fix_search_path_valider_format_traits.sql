-- ============================================================================
-- PHASE 1.1b — FIX SECURITY: search_path explicite sur valider_format_traits_raciaux
-- ============================================================================
-- Date     : 2026-05-03
-- Contexte : Le linter Supabase signale "function_search_path_mutable" sur
--            la fonction créée en Phase 1.1. On fixe le search_path à
--            'pg_catalog, public' pour respecter les bonnes pratiques de
--            sécurité (impossible pour un user de hijacker la fonction via
--            un schéma plus prioritaire).
-- ============================================================================

ALTER FUNCTION public.valider_format_traits_raciaux(jsonb)
  SET search_path = pg_catalog, public;
