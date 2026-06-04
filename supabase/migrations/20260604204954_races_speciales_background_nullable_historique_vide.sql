-- Correctif : un historique vide (etape 1 ne l impose pas) provoquait une violation
-- NOT NULL sur personnage_races_demandes.background -> exception remontee -> bouton
-- Suivant bloque pour les races speciales. On rend background nullable : une demande
-- (flag de revue admin) est toujours creee, meme sans background. Idempotent.
ALTER TABLE public.personnage_races_demandes
  ALTER COLUMN background DROP NOT NULL;
