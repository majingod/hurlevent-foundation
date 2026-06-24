-- C1 (s170) : note de jeu sans-formule intégrée au bloc Effets — Retour à la Vie (Nécromancie).
-- Complète le lot 4 (décision C1 couvrant les 2 prières sans-formule). Idempotent.
UPDATE prieres SET effet_instance = jsonb_set(effet_instance,'{template}', to_jsonb(effet_instance->>'template' || ' La durée choisie fixe le délai maximal écoulé depuis la mort.'))
WHERE nom='Retour à la Vie' AND domaine='Nécromancie'
  AND effet_instance->>'template' NOT LIKE '%délai maximal%';
