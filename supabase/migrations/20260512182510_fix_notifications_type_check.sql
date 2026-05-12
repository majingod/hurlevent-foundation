-- Migration 3 — Fix Bug A
-- Étend le CHECK notifications_type_check pour autoriser les 3 valeurs
-- émises par creer_demande_race, approuver_race_demande, refuser_race_demande.
-- Idempotent (DROP IF EXISTS).
-- Pré-condition : public.notifications contient 0 ligne (vérifié 2026-05-12).
-- Déjà appliquée en prod via Supabase MCP le 2026-05-12.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'info'::text,
    'validation_race'::text,
    'validation_maitre'::text,
    'xp'::text,
    'evenement'::text,
    'demande_race_nouvelle'::text,
    'race_approuvee'::text,
    'race_refusee'::text
  ]));
