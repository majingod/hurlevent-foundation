/**
 * Persistance du BROUILLON VISITEUR (lot P2-a3-i).
 *
 * Un SEUL slot (décision : 1 brouillon visiteur à la fois). Style calqué sur les
 * patterns maison `src/hooks/useEtatPersistant.ts` et
 * `src/components/createur/aide/stockageLocal.ts` : clé préfixée, accès
 * `localStorage` défensif (Safari navigation privée lève sur setItem), codec JSON.
 *
 * Garde de version : un `schemaVersion` inconnu → on JETTE le brouillon
 * (retourne `null`, pas de crash). Un snapshot plus récent que
 * `meta.snapshotGenereLe` → on CHARGE quand même (les gates revalideront en
 * a3-ii) ; `estPerime(b)` est exposé pour l'UI future.
 */

import { getSnapshot } from "@/moteurCreation/snapshot";
import type { BrouillonVisiteur } from "@/moteurCreation/brouillon/types";

/** Clé de stockage unique (slot unique). */
export const CLE_BROUILLON = "hv-brouillon-visiteur";

/** Version de schéma supportée par ce module. */
const SCHEMA_VERSION_SUPPORTEE = 1;

function lireBrut(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireBrut(cle: string, valeur: string): void {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    // Stockage indisponible : l'état reste en mémoire pour la session.
  }
}

function supprimerBrut(cle: string): void {
  try {
    localStorage.removeItem(cle);
  } catch {
    // Ignoré : rien à nettoyer si le stockage est indisponible.
  }
}

/**
 * Charge le brouillon persisté, ou `null` si absent / illisible / schéma inconnu.
 * Le schéma inconnu est JETÉ silencieusement (pas de crash).
 */
export function chargerBrouillon(): BrouillonVisiteur | null {
  const brut = lireBrut(CLE_BROUILLON);
  if (brut === null) return null;

  let parse: unknown;
  try {
    parse = JSON.parse(brut);
  } catch {
    return null; // JSON corrompu → on jette.
  }

  if (
    parse == null ||
    typeof parse !== "object" ||
    (parse as { schemaVersion?: unknown }).schemaVersion !==
      SCHEMA_VERSION_SUPPORTEE
  ) {
    return null; // schéma inconnu → on jette.
  }

  return parse as BrouillonVisiteur;
}

/** Sauve le brouillon (slot unique, écrase le précédent). */
export function sauverBrouillon(b: BrouillonVisiteur): void {
  ecrireBrut(CLE_BROUILLON, JSON.stringify(b));
}

/** Efface le brouillon persisté. */
export function effacerBrouillon(): void {
  supprimerBrut(CLE_BROUILLON);
}

/**
 * Le brouillon a-t-il été créé sur un snapshot plus ancien que le snapshot
 * bundlé courant ? (Pour l'UI future ; ne bloque PAS le chargement.)
 */
export function estPerime(b: BrouillonVisiteur): boolean {
  return b.meta.snapshotGenereLe < getSnapshot().manifest.genere_le;
}
