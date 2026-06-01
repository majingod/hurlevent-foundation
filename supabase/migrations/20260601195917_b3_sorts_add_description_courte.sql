-- B3 SORTS — Étape 1 : ajout de la colonne description_courte (mode « Fiche »)
-- description (verbatim « Manuel ») reste intacte. Fallback + câblage toggle = session frontend ultérieure.
ALTER TABLE public.sorts ADD COLUMN IF NOT EXISTS description_courte text;
