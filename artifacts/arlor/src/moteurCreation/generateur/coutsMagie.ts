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

/**
 * ⭐ [A2-Mage s358] LA CONFIG QUE LE GÉNÉRATEUR POSE SUR UN SORT TIRÉ DU
 * CATALOGUE. Le cercle étant LIBRE (référence §5.1), le contenu ne peut plus
 * nommer ses sorts : il demande « le n-ième sort représentatif du cercle » et
 * c'est ici qu'on décide COMMENT il est lancé.
 *
 * Deux gardes mesurées en s358 — sans elles, « la config la moins chère »
 * produit des sorts qui ne se jouent pas :
 *
 *  ① Un sort de DÉGÂTS n'est jamais « Personnelle » (le lanceur se blesserait
 *    lui-même) et se lance à 10 Pieds — le patron déjà retenu par le contenu
 *    🔥 de s349. Les 7 sorts de dégâts de niveau 1 acceptent tous cette
 *    config (vérifié en prod : 6 sont « À vue », 1 est « 25 Pieds »).
 *  ② Une durée « Instantanée » n'est gardée que si le modèle n'offre RIEN
 *    d'autre. Sinon un « Bouclier de Feu » sortirait à durée nulle, alors que
 *    le manuel le décrit comme durant jusqu'à 30 minutes.
 *
 * Coût mesuré de ces deux gardes : +1 XP au pire sur le noyau d'un rôle.
 */
export function configGenerateur(modele: SortModele | PriereModele): ConfigMagie {
  const estDegats = "type_sort" in modele && modele.type_sort === "dégâts";

  const zonesModele = ZONES_PAR_TYPE[modele.zone_effet] ?? [modele.zone_effet];
  const zones = estDegats
    ? zonesModele.filter((z) => z !== "Personnelle")
    : zonesModele;

  const porteesModele = filterPorteesDisponibles(modele.portee).map((p) => p.label);
  const portees =
    estDegats && porteesModele.includes("10 Pieds")
      ? ["10 Pieds"]
      : porteesModele;

  const dureesModele = filterDureesDisponibles(modele.duree).map((d) => d.label);
  const durees =
    dureesModele.length > 1
      ? dureesModele.filter((d) => d !== "Instantanée")
      : dureesModele;

  let meilleur: ConfigMagie | null = null;
  let prix = Number.POSITIVE_INFINITY;
  for (const zone of zones)
    for (const portee of portees)
      for (const duree of durees) {
        const c = calculerCoutXP(zone, portee, duree, 1, modele.cout_xp_base);
        if (c < prix) {
          prix = c;
          meilleur = { niveau: 1, zone, portee, duree };
        }
      }
  if (meilleur === null) {
    throw new Error(
      `[generateur] ${modele.nom} : aucune configuration jouable au niveau 1.`
    );
  }
  return meilleur;
}

/**
 * ⭐ [A2-Mage s358] L'ORDRE « REPRÉSENTATIF » d'un cercle (arbitrage Fred s358).
 *
 * Le sort de DÉGÂTS du cercle vient en tête quand il en existe un, puis les
 * moins chers. Motif : « le moins cher » n'est pas « le plus reconnaissable » —
 * mesuré, 7 cercles sur 13 donnaient un *Bouclier* en premier, et un
 * canalisateur en Magie Pure serait sorti avec pour seul sort
 * « Bouclier Magique ». Les 6 cercles sans sort de dégâts (Altération,
 * Charmes, Combat, Divination, Illusion, Protection) gardent leur moins cher —
 * aucun n'est un bouclier.
 *
 * ⭐ La règle REJOINT la mesure joueur là où celle-ci parle : Projectile
 * Magique (5 porteurs), Jet de flammes (3) et Rayon Électrique (3) sont
 * exactement les sorts de niveau 1 les plus portés de leur cercle.
 *
 * Départage stable par NOM à prix égal : deux appels donnent le même ordre.
 */
export function ordonnerSortsRepresentatifs(
  sorts: readonly SortModele[]
): { modele: SortModele; config: ConfigMagie; coutXp: number }[] {
  const chiffres = sorts.map((modele) => {
    const config = configGenerateur(modele);
    return { modele, config, coutXp: prixMagie(modele, "sort", config).coutXp };
  });
  const parPrix = [...chiffres].sort(
    (a, b) => a.coutXp - b.coutXp || a.modele.nom.localeCompare(b.modele.nom, "fr")
  );
  const tete = parPrix.find((x) => x.modele.type_sort === "dégâts");
  return tete === null || tete === undefined
    ? parPrix
    : [tete, ...parPrix.filter((x) => x.modele.nom !== tete.modele.nom)];
}
