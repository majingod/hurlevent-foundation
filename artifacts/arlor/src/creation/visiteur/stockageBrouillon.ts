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
 *
 * Migration versionnée : un brouillon `1` (forme AVANT l'identité d'instance) est
 * MIGRÉ vers `2` au chargement — chaque acquisition existante reçoit un `instanceId`
 * (uuid local), ordre du tableau conservé, aucune donnée perdue. Un vrai brouillon
 * de curieux déjà sur l'appareil survit donc au déploiement.
 */

import { getSnapshot } from "@/moteurCreation/snapshot";
import type { BrouillonVisiteur } from "@/moteurCreation/brouillon/types";

/** Clé de stockage unique (slot unique). */
export const CLE_BROUILLON = "hv-brouillon-visiteur";

/** Version de schéma supportée par ce module (courante). */
const SCHEMA_VERSION_SUPPORTEE = 2;

/**
 * Migre un brouillon `schemaVersion: 1` (sans `instanceId`) vers `2` : chaque
 * acquisition des 6 familles reçoit un `instanceId` unique, DANS L'ORDRE du
 * tableau (déterministe, aucune ligne perdue ni réordonnée). Fonction pure sur la
 * donnée brute JSON (typée souple : la forme v1 n'a plus de type nommé).
 */
function migrerVersV2(v1: Record<string, unknown>): BrouillonVisiteur {
  const acq = (v1.acquisitions ?? {}) as Record<string, unknown>;
  const avecInstanceId = <T extends object>(liste: unknown): T[] =>
    (Array.isArray(liste) ? liste : []).map((item) => ({
      instanceId: crypto.randomUUID(),
      ...(item as object),
    })) as T[];

  return {
    ...(v1 as unknown as BrouillonVisiteur),
    schemaVersion: 2,
    acquisitions: {
      competences: avecInstanceId(acq.competences),
      sorts: avecInstanceId(acq.sorts),
      prieres: avecInstanceId(acq.prieres),
      pieges: avecInstanceId(acq.pieges),
      recettes: avecInstanceId(acq.recettes),
      assemblages: avecInstanceId(acq.assemblages),
    },
  } as BrouillonVisiteur;
}

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
 * Valide/migre une donnée brute déjà parsée (JSON.parse) en `BrouillonVisiteur`.
 * `null` = forme illisible ou schéma inconnu (jeté silencieusement, pas de crash).
 *
 * Source unique de la garde de version : appelée par `chargerBrouillon` (slot
 * `localStorage`) ET par `interpreterTexteColle` (code de reprise / fichier
 * `.json` collé) — un brouillon v1 est migré dans les deux cas.
 */
export function interpreterBrouillonBrut(parse: unknown): BrouillonVisiteur | null {
  if (parse == null || typeof parse !== "object") {
    return null; // pas un objet → on jette.
  }

  const version = (parse as { schemaVersion?: unknown }).schemaVersion;

  // Brouillon d'une version antérieure : on MIGRE plutôt que jeter (rien perdu).
  if (version === 1) {
    return migrerVersV2(parse as Record<string, unknown>);
  }

  if (version !== SCHEMA_VERSION_SUPPORTEE) {
    return null; // schéma inconnu → on jette.
  }

  return parse as BrouillonVisiteur;
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

  return interpreterBrouillonBrut(parse);
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
