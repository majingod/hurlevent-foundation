-- Dette technique : élargir bestiaire_categorie_check
-- Découvert session 12, traité session 13
-- La contrainte précédente forçait categorie = 'mort_vivant' sur toutes les lignes,
-- bloquant toute extension future du bestiaire.

ALTER TABLE public.bestiaire
  DROP CONSTRAINT IF EXISTS bestiaire_categorie_check;

ALTER TABLE public.bestiaire
  ADD CONSTRAINT bestiaire_categorie_check
  CHECK (categorie IN (
    'mort_vivant',
    'animal',
    'creature_magique',
    'humanoide',
    'demon',
    'esprit',
    'feerique'
  ));
