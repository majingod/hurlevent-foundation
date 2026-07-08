import { clientServeur } from "./clientServeur";
import { clientVisiteur } from "./visiteur/clientVisiteur";
import type { ClientCreation } from "./types";

/** Une URL est « visiteur » ssi son pathname commence par `/visiteur`. */
const RE_VISITEUR = /^\/visiteur(\/|$)/;

/**
 * Cible de build hors-ligne (`vite.hors-ligne.config.ts` pose ce flag via
 * `define`). Le HTML autonome sert le wizard sous `HashRouter` : le pathname
 * réel est `/index-hors-ligne.html` (ou un chemin `file://`), jamais
 * `/visiteur` — le routing vit dans le hash. Le regex `RE_VISITEUR` sur le
 * pathname ne matcherait donc jamais → il faut forcer `clientVisiteur`.
 */
const CIBLE_HORS_LIGNE = import.meta.env.VITE_CIBLE_HORS_LIGNE === "1";

/**
 * Pur + testable : quel client pour ce pathname ?
 *
 * En cible hors-ligne (`cibleHorsLigne`) → TOUJOURS `clientVisiteur`, quel que
 * soit le pathname (le HashRouter du build autonome ne l'expose pas).
 * Sinon : `/visiteur` (et tout sous-chemin `/visiteur/...`) → `clientVisiteur`
 * (moteur local, 100 % hors ligne) ; tout le reste → `clientServeur`
 * (passe-plat supabase).
 *
 * `cibleHorsLigne` est un paramètre injectable (défaut = flag de build) pour
 * rester testable sans mocker `import.meta.env`.
 */
export function clientPourPathname(
  pathname: string,
  cibleHorsLigne: boolean = CIBLE_HORS_LIGNE,
): ClientCreation {
  return estModeVisiteur(pathname, cibleHorsLigne) ? clientVisiteur : clientServeur;
}

/** Vrai si le client actif est le visiteur (URL /visiteur ou build autonome). */
export function estModeVisiteur(
  pathname: string = window.location.pathname,
  cibleHorsLigne: boolean = CIBLE_HORS_LIGNE,
): boolean {
  return cibleHorsLigne || RE_VISITEUR.test(pathname);
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
