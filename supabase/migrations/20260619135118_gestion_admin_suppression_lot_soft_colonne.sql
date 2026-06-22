ALTER TABLE public.profils_joueur
  ADD COLUMN IF NOT EXISTS est_actif boolean NOT NULL DEFAULT true;
