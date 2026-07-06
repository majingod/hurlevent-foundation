/**
 * Applicateurs PURS du BROUILLON VISITEUR (lot P2-a3-i).
 *
 * Chaque fonction `(brouillon, demande) → BrouillonVisiteur` est IMMUABLE :
 * jamais de mutation en place, on renvoie un nouveau brouillon avec `meta.modifieLe`
 * rafraîchi. Un retrait = la liste change, RIEN d'autre (recompute : les gratuités,
 * l'XP, les quotas se re-dérivent d'eux-mêmes au prochain `deriverEtat`).
 *
 * ⚠️ Les applicateurs ne VALIDENT PAS. Aucun appel aux gates ici : l'orchestration
 * gate → appliquer vivra dans `clientVisiteur` (a3-ii). Un applicateur appliqué à
 * une demande invalide produit simplement un brouillon que les gates refuseront
 * ensuite — c'est voulu.
 *
 * TS pur : aucun import React, aucun accès `localStorage`/`window`.
 */

import type { DemandeAchatCompetence } from "../types";
import type {
  BrouillonVisiteur,
  BrouillonEtape1,
  BrouillonEtape2,
  BrouillonEtape3,
  BrouillonEtape4,
  BrouillonSort,
  BrouillonPriere,
} from "./types";

// ============================================================
// Utilitaire immuable commun
// ============================================================

function maintenantIso(): string {
  return new Date().toISOString();
}

/** Renvoie une copie du brouillon avec `modifieLe` rafraîchi + patch appliqué. */
function patch(
  b: BrouillonVisiteur,
  modif: Partial<Omit<BrouillonVisiteur, "schemaVersion" | "meta">>
): BrouillonVisiteur {
  return {
    ...b,
    ...modif,
    meta: { ...b.meta, modifieLe: maintenantIso() },
  };
}

function patchAcquisitions(
  b: BrouillonVisiteur,
  modif: Partial<BrouillonVisiteur["acquisitions"]>
): BrouillonVisiteur {
  return patch(b, { acquisitions: { ...b.acquisitions, ...modif } });
}

// ============================================================
// Compétences
// ============================================================

/** Identité d'une compétence acquise = (competenceId, niveauAcquis, choixAchat). */
function memeCompetence(
  a: { competenceId: string; niveauAcquis: number; choixAchat: string | null },
  b: { competenceId: string; niveauAcquis: number; choixAchat: string | null }
): boolean {
  return (
    a.competenceId === b.competenceId &&
    a.niveauAcquis === b.niveauAcquis &&
    a.choixAchat === b.choixAchat
  );
}

export function appliquerAchatCompetence(
  b: BrouillonVisiteur,
  demande: DemandeAchatCompetence
): BrouillonVisiteur {
  const nouvelle = {
    competenceId: demande.competenceId,
    niveauAcquis: demande.niveauDesire,
    choixAchat: demande.choixAchat,
  };
  return patchAcquisitions(b, {
    competences: [...b.acquisitions.competences, nouvelle],
  });
}

export function retirerCompetence(
  b: BrouillonVisiteur,
  demande: {
    competenceId: string;
    niveauAcquis: number;
    choixAchat: string | null;
  }
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    competences: b.acquisitions.competences.filter(
      (c) => !memeCompetence(c, demande)
    ),
  });
}

// ============================================================
// Sorts
// ============================================================

export function appliquerAchatSort(
  b: BrouillonVisiteur,
  demande: BrouillonSort
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    sorts: [...b.acquisitions.sorts, { ...demande }],
  });
}

export function retirerSort(
  b: BrouillonVisiteur,
  sortId: string
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    sorts: b.acquisitions.sorts.filter((s) => s.sortId !== sortId),
  });
}

/** Remplace les choix zone/portée/durée/niveau d'un sort déjà présent. */
export function modifierSort(
  b: BrouillonVisiteur,
  sortId: string,
  choix: Partial<Omit<BrouillonSort, "sortId">>
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    sorts: b.acquisitions.sorts.map((s) =>
      s.sortId === sortId ? { ...s, ...choix } : s
    ),
  });
}

// ============================================================
// Prières
// ============================================================

export function appliquerAchatPriere(
  b: BrouillonVisiteur,
  demande: BrouillonPriere
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    prieres: [...b.acquisitions.prieres, { ...demande }],
  });
}

export function retirerPriere(
  b: BrouillonVisiteur,
  priereId: string
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    prieres: b.acquisitions.prieres.filter((p) => p.priereId !== priereId),
  });
}

/** Remplace les choix zone/portée/durée/niveau d'une prière déjà présente. */
export function modifierPriere(
  b: BrouillonVisiteur,
  priereId: string,
  choix: Partial<Omit<BrouillonPriere, "priereId">>
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    prieres: b.acquisitions.prieres.map((p) =>
      p.priereId === priereId ? { ...p, ...choix } : p
    ),
  });
}

// ============================================================
// Artisanat (pièges / recettes / assemblages)
// ============================================================

export function appliquerAchatPiege(
  b: BrouillonVisiteur,
  piegeId: string
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    pieges: [...b.acquisitions.pieges, { piegeId }],
  });
}

export function retirerPiege(
  b: BrouillonVisiteur,
  piegeId: string
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    pieges: b.acquisitions.pieges.filter((p) => p.piegeId !== piegeId),
  });
}

export function appliquerAchatRecette(
  b: BrouillonVisiteur,
  recetteId: string
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    recettes: [...b.acquisitions.recettes, { recetteId }],
  });
}

export function retirerRecette(
  b: BrouillonVisiteur,
  recetteId: string
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    recettes: b.acquisitions.recettes.filter((r) => r.recetteId !== recetteId),
  });
}

export function appliquerAchatAssemblage(
  b: BrouillonVisiteur,
  assemblageId: string
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    assemblages: [...b.acquisitions.assemblages, { assemblageId }],
  });
}

export function retirerAssemblage(
  b: BrouillonVisiteur,
  assemblageId: string
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    assemblages: b.acquisitions.assemblages.filter(
      (a) => a.assemblageId !== assemblageId
    ),
  });
}

// ============================================================
// Étapes 1 → 4
// ============================================================

export function appliquerEtape1(
  b: BrouillonVisiteur,
  payload: BrouillonEtape1
): BrouillonVisiteur {
  return patch(b, { etape1: { ...payload } });
}

export function appliquerEtape2(
  b: BrouillonVisiteur,
  payload: BrouillonEtape2
): BrouillonVisiteur {
  return patch(b, { etape2: { ...payload } });
}

export function appliquerEtape3(
  b: BrouillonVisiteur,
  payload: BrouillonEtape3
): BrouillonVisiteur {
  return patch(b, { etape3: { ...payload } });
}

export function appliquerEtape4(
  b: BrouillonVisiteur,
  payload: BrouillonEtape4
): BrouillonVisiteur {
  return patch(b, { etape4: { ...payload } });
}

/**
 * Remplace la classe. Ne touche QUE `etape4.classeId` (et `modifieLe`). Les
 * gratuités de l'ancienne classe disparaissent et celles de la nouvelle
 * apparaissent TOUTES SEULES à la prochaine dérivation (recompute) — c'est le
 * test clé. `choixParCompetence` est réinitialisé : les choix de gratuités de
 * l'ancienne classe n'ont plus de sens.
 */
export function changerClasse(
  b: BrouillonVisiteur,
  classeId: string
): BrouillonVisiteur {
  return patch(b, { etape4: { classeId } });
}
