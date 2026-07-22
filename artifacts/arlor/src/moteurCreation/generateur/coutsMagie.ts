import { ZONES_PAR_TYPE } from "@/constants/magie";
import {
  calculerCoutPS,
  calculerCoutXP,
  filterDureesDisponibles,
  filterPorteesDisponibles,
  refusPlafondMagie,
} from "@/utils/calculsMagie";

import type { PriereModele, SortModele } from "./catalogueMagie";
import type { ConfigMagie } from "./types";

/**
 * [VIS-8 lot 2b] Prix d'un sort/prière configuré — SOURCE UNIQUE réutilisée :
 * le miroir attesté `@/utils/calculsMagie` (PR #710). Ici on n'ajoute que les
 * gardes d'INTÉGRITÉ du contenu (un contenu invalide lève, jamais silencieux).
 */

/** Manuel (Acquisition de Cercle / de Domaine) : le niveau N d'accès ouvre
 *  les sorts/prières de niveau ≤ 5×N. */
export const NIVEAU_ACQUISITION = (niveauMagie: number): number =>
  Math.ceil(niveauMagie / 5);

/** La rampe (compétences d'accès) que le planificateur dérive et chiffre
 *  en chemin complet — « rampe incluse », jamais un accès sec (décision 16). */
export const RAMPE = {
  sort: { acces: "Acquisition de Cercle", porte: "Acquisition de Sort" },
  priere: { acces: "Acquisition de Domaine", porte: "Acquisition de Prière" },
} as const;

export function prixMagie(
  modele: SortModele | PriereModele,
  type: "sort" | "priere",
  config: ConfigMagie
): { coutXp: number; coutPS: number } {
  const zonesOk = ZONES_PAR_TYPE[modele.zone_effet] ?? [modele.zone_effet];
  if (!zonesOk.includes(config.zone)) {
    throw new Error(
      `[generateur] ${modele.nom} : zone « ${config.zone} » hors du type « ${modele.zone_effet} ».`
    );
  }
  if (!filterPorteesDisponibles(modele.portee).some((p) => p.label === config.portee)) {
    throw new Error(
      `[generateur] ${modele.nom} : portée « ${config.portee} » au-delà du plafond « ${modele.portee} ».`
    );
  }
  if (!filterDureesDisponibles(modele.duree).some((d) => d.label === config.duree)) {
    throw new Error(
      `[generateur] ${modele.nom} : durée « ${config.duree} » au-delà du plafond « ${modele.duree} ».`
    );
  }
  const coutXp = calculerCoutXP(
    config.zone,
    config.portee,
    config.duree,
    config.niveau,
    modele.cout_xp_base
  );
  // Plafond du manuel à la CRÉATION (niveau 1) — même miroir que la prod (#710).
  const refus = refusPlafondMagie(type, 1, coutXp);
  if (refus !== null) {
    throw new Error(`[generateur] ${modele.nom} (config du contenu) : ${refus}`);
  }
  return { coutXp, coutPS: calculerCoutPS(coutXp) };
}

/** La durée voulue, plafonnée par le modèle (ex. Bouclier Magique ≤ 10 Minutes). */
export function dureePlafonnee(
  modele: SortModele | PriereModele,
  voulue: string
): string {
  const dispo = filterDureesDisponibles(modele.duree);
  return dispo.some((d) => d.label === voulue)
    ? voulue
    : dispo[dispo.length - 1].label;
}
