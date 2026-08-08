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
import { getSnapshot } from "../snapshot";
import type {
  BrouillonVisiteur,
  BrouillonEtape1,
  BrouillonEtape2,
  BrouillonEtape3,
  BrouillonEtape4,
  BrouillonCompetence,
  BrouillonSort,
  BrouillonPriere,
} from "./types";

// ============================================================
// Utilitaire immuable commun
// ============================================================

function maintenantIso(): string {
  return new Date().toISOString();
}

/**
 * Identité d'instance posée À L'ACHAT (uuid local). `crypto.randomUUID()` est un
 * global standard (navigateur + Node ≥ 19) — pas d'accès React/localStorage/window,
 * l'invariant « TS pur » du modèle est préservé.
 */
function nouvelInstanceId(): string {
  return crypto.randomUUID();
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

/**
 * D54 (s382) — miroir offline de `tg_poser_porte_magique` (migration
 * 20260808062934). Acheter « Acquisition de Cercle »/« Acquisition de
 * Domaine » pose d'office « Acquisition de Sort »/« Acquisition de Prière »
 * (même catégorie, 0 XP), avec la MÊME idempotence que le trigger serveur :
 * aucune ligne ajoutée si la porte est déjà posée pour ce brouillon.
 */
const NOM_PORTE_PAR_ACCES: Record<string, string> = {
  "Acquisition de Cercle": "Acquisition de Sort",
  "Acquisition de Domaine": "Acquisition de Prière",
};

function poserPorteMagiqueSiNecessaire(
  competences: BrouillonCompetence[],
  competenceAcheteeId: string
): BrouillonCompetence[] {
  const catalogue = getSnapshot().tables.competences;
  const acces = catalogue.find((c) => c.id === competenceAcheteeId);
  if (!acces) return competences;

  const nomPorte = NOM_PORTE_PAR_ACCES[acces.nom ?? ""];
  if (!nomPorte) return competences;

  const porte = catalogue.find(
    (c) => c.nom === nomPorte && c.categorie === acces.categorie
  );
  if (!porte) return competences;

  const dejaPosee = competences.some((c) => c.competenceId === porte.id);
  if (dejaPosee) return competences;

  return [
    ...competences,
    {
      instanceId: nouvelInstanceId(),
      competenceId: porte.id,
      niveauAcquis: 1,
      choixAchat: null,
    },
  ];
}

export function appliquerAchatCompetence(
  b: BrouillonVisiteur,
  demande: DemandeAchatCompetence
): BrouillonVisiteur {
  const nouvelle = {
    instanceId: nouvelInstanceId(),
    competenceId: demande.competenceId,
    niveauAcquis: demande.niveauDesire,
    choixAchat: demande.choixAchat,
  };
  const competences = poserPorteMagiqueSiNecessaire(
    [...b.acquisitions.competences, nouvelle],
    demande.competenceId
  );
  return patchAcquisitions(b, { competences });
}

/** Retire LA ligne compétence désignée par son `instanceId` (une seule copie). */
export function retirerCompetence(
  b: BrouillonVisiteur,
  instanceId: string
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    competences: b.acquisitions.competences.filter(
      (c) => c.instanceId !== instanceId
    ),
  });
}

// ============================================================
// Sorts
// ============================================================

export function appliquerAchatSort(
  b: BrouillonVisiteur,
  demande: Omit<BrouillonSort, "instanceId">
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    sorts: [...b.acquisitions.sorts, { ...demande, instanceId: nouvelInstanceId() }],
  });
}

/** Retire LA ligne sort désignée par son `instanceId` (une seule copie). */
export function retirerSort(
  b: BrouillonVisiteur,
  instanceId: string
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    sorts: b.acquisitions.sorts.filter((s) => s.instanceId !== instanceId),
  });
}

/** Remplace les choix zone/portée/durée/niveau du sort désigné par `instanceId`. */
export function modifierSort(
  b: BrouillonVisiteur,
  instanceId: string,
  choix: Partial<Omit<BrouillonSort, "instanceId" | "sortId">>
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    sorts: b.acquisitions.sorts.map((s) =>
      s.instanceId === instanceId ? { ...s, ...choix } : s
    ),
  });
}

// ============================================================
// Prières
// ============================================================

export function appliquerAchatPriere(
  b: BrouillonVisiteur,
  demande: Omit<BrouillonPriere, "instanceId">
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    prieres: [...b.acquisitions.prieres, { ...demande, instanceId: nouvelInstanceId() }],
  });
}

/** Retire LA ligne prière désignée par son `instanceId` (une seule copie). */
export function retirerPriere(
  b: BrouillonVisiteur,
  instanceId: string
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    prieres: b.acquisitions.prieres.filter((p) => p.instanceId !== instanceId),
  });
}

/** Remplace les choix zone/portée/durée/niveau de la prière désignée par `instanceId`. */
export function modifierPriere(
  b: BrouillonVisiteur,
  instanceId: string,
  choix: Partial<Omit<BrouillonPriere, "instanceId" | "priereId">>
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    prieres: b.acquisitions.prieres.map((p) =>
      p.instanceId === instanceId ? { ...p, ...choix } : p
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
    pieges: [...b.acquisitions.pieges, { instanceId: nouvelInstanceId(), piegeId }],
  });
}

/** Retire LA ligne piège désignée par son `instanceId` (une seule copie). */
export function retirerPiege(
  b: BrouillonVisiteur,
  instanceId: string
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    pieges: b.acquisitions.pieges.filter((p) => p.instanceId !== instanceId),
  });
}

export function appliquerAchatRecette(
  b: BrouillonVisiteur,
  recetteId: string
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    recettes: [...b.acquisitions.recettes, { instanceId: nouvelInstanceId(), recetteId }],
  });
}

/** Retire LA ligne recette désignée par son `instanceId` (une seule copie). */
export function retirerRecette(
  b: BrouillonVisiteur,
  instanceId: string
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    recettes: b.acquisitions.recettes.filter((r) => r.instanceId !== instanceId),
  });
}

export function appliquerAchatAssemblage(
  b: BrouillonVisiteur,
  assemblageId: string
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    assemblages: [
      ...b.acquisitions.assemblages,
      { instanceId: nouvelInstanceId(), assemblageId },
    ],
  });
}

/** Retire LA ligne assemblage désignée par son `instanceId` (une seule copie). */
export function retirerAssemblage(
  b: BrouillonVisiteur,
  instanceId: string
): BrouillonVisiteur {
  return patchAcquisitions(b, {
    assemblages: b.acquisitions.assemblages.filter(
      (a) => a.instanceId !== instanceId
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
