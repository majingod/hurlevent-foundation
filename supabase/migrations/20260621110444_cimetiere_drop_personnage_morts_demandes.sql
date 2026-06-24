-- CIMETIÈRE — micro-migration B (contract de l'expand-contract).
-- La table personnage_morts_demandes est désormais sans consommateur (front déployé lit
-- l'état via etat_edition ; RPC/vues réécrites en migration A). Source unique = cimetiere.
DROP TABLE IF EXISTS public.personnage_morts_demandes;
