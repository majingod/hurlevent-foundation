-- Phase 2 M3bc : colonne statut pour dormants (sorts/prieres).
-- 'achete' = actif/visible ; 'cree' = dormant (orphelin de gate, invisible, reactivable).
-- Idempotente.
ALTER TABLE public.personnage_sorts   ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'achete';
ALTER TABLE public.personnage_prieres ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'achete';
ALTER TABLE public.personnage_sorts   DROP CONSTRAINT IF EXISTS personnage_sorts_statut_check;
ALTER TABLE public.personnage_sorts   ADD  CONSTRAINT personnage_sorts_statut_check   CHECK (statut IN ('achete','cree'));
ALTER TABLE public.personnage_prieres DROP CONSTRAINT IF EXISTS personnage_prieres_statut_check;
ALTER TABLE public.personnage_prieres ADD  CONSTRAINT personnage_prieres_statut_check CHECK (statut IN ('achete','cree'));
