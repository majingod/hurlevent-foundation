import { clientServeur } from "./clientServeur";
import { clientVisiteur } from "./visiteur/clientVisiteur";
import type { ClientCreation } from "./types";

/** Une URL est « visiteur » ssi son pathname commence par `/visiteur`. */
const RE_VISITEUR = /^\/visiteur(\/|$)/;

/**
 * Pur + testable : quel client pour ce pathname ?
 *
 * `/visiteur` (et tout sous-chemin `/visiteur/...`) → `clientVisiteur` (moteur
 * local, 100 % hors ligne). Tout le reste → `clientServeur` (passe-plat supabase).
 */
export function clientPourPathname(pathname: string): ClientCreation {
  return RE_VISITEUR.test(pathname) ? clientVisiteur : clientServeur;
}

/**
 * Point d'injection unique (P2-b) : Proxy SANS ÉTAT.
 *
 * Chaque appel relit `window.location.pathname` → déterministe, rien à nettoyer,
 * impossible qu'un mode « colle » après navigation. Les méthodes des deux clients
 * ne dépendent pas de `this` (clientServeur lit `supabase` du scope module ;
 * clientVisiteur capture ses deps par closure) — un simple `client[prop]` suffit,
 * pas besoin de rebind.
 */
export const clientActif: ClientCreation = new Proxy({} as ClientCreation, {
  get(_cible, prop) {
    const client = clientPourPathname(window.location.pathname);
    return client[prop as keyof ClientCreation];
  },
});
