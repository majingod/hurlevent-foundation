import { clientServeur } from "./clientServeur";
import type { ClientCreation } from "./types";

/**
 * Point d'injection unique du guichet de création (P2-a2).
 *
 * Tous les écrans du wizard (`components/createur/`, `pages/PersonnageNouveauV2`)
 * importent `clientActif` — jamais `supabase` — pour leurs appels de création.
 *
 * Aujourd'hui l'instance active est `clientServeur` (passe-plat serveur, P2-a1).
 * En P2-a3, l'implémentation « visiteur » adossée à `moteurCreation/` remplacera
 * cette seule ligne : les écrans, eux, ne changeront plus.
 */
export const clientActif: ClientCreation = clientServeur;
