/**
 * [VIS-6] Lot 2 — drapeau « reprise ignorée définitivement ».
 *
 * Quand le joueur choisit « Ignorer définitivement » (bannière) OU qu'une reprise
 * a réussi (page de reprise), on pose un drapeau `localStorage` : la bannière de
 * reprise ne revient plus. Le brouillon lui-même reste intact (consultable en
 * mode visiteur) — on masque seulement l'invite. Accès `localStorage` défensif
 * (Safari navigation privée lève sur `setItem`), même style que
 * `stockageBrouillon.ts`.
 */

import { chargerBrouillon } from "../visiteur/stockageBrouillon";

/** Clé du drapeau (posé une fois, jamais nettoyé automatiquement). */
export const CLE_REPRISE_IGNOREE = "hv-reprise-ignoree";

/** La reprise du brouillon a-t-elle été ignorée définitivement ? */
export function estRepriseIgnoree(): boolean {
  try {
    return localStorage.getItem(CLE_REPRISE_IGNOREE) === "1";
  } catch {
    return false;
  }
}

/** Pose le drapeau : la bannière de reprise ne réapparaîtra plus. */
export function ignorerRepriseDefinitivement(): void {
  try {
    localStorage.setItem(CLE_REPRISE_IGNOREE, "1");
  } catch {
    // Stockage indisponible : l'invite réapparaîtra à la prochaine session.
  }
}

/**
 * La bannière de reprise doit-elle s'afficher ? SSI un brouillon existe ET la
 * reprise n'a pas été ignorée définitivement. (Prédicat pur — testable sans DOM.)
 */
export function repriseDisponible(): boolean {
  return !estRepriseIgnoree() && chargerBrouillon() !== null;
}
