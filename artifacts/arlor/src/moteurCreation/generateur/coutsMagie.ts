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
  const estPriere = !("type_sort" in modele);

  const zonesModele = ZONES_PAR_TYPE[modele.zone_effet] ?? [modele.zone_effet];
  // ⭐ [A2-Prêtre s360] GARDE ③ — une PRIÈRE ne sort jamais en « Personnelle »
  // quand son modèle permet de viser autrui. Sans elle, `configGenerateur`
  // prenait la zone la moins chère (1 point contre 2) et le générateur
  // produisait un SOIGNEUR QUI NE SOIGNE QUE LUI-MÊME — 7 domaines sur 8
  // sortaient en « Personnelle ». Coût mesuré de la garde : +1 XP.
  //
  // ⚠️ ELLE NE VAUT PAS POUR LES SORTS, et c'est MESURÉ, pas commode
  //    (prod du 2026-07-25, personnages vivants) :
  //      · sorts   : « Personnelle » = 26 instances / 92 (28 %), 10 porteurs
  //                  — 2e zone la plus utilisée. Un mage qui se protège
  //                    lui-même est un mage normal.
  //      · prières : « Personnelle » =  3 instances / 49 ( 6 %),  3 porteurs
  //                  — et les 3 sont des prières intrinsèquement personnelles
  //                    (Anti-Détection, Augure, Contact avec les Anciens).
  //    L'étendre aux sorts déplace 🎭 (29-36 -> 30-38) et ✨ (21-28 -> 22-30) :
  //    ça invaliderait l'attestation Mage de s358 sans aucun motif mesuré.
  //
  // Les prières CONÇUES personnelles (modèle `zone_effet = "Personnelle"`,
  // ex. Combat Aveugle, Globe d'Air) la gardent : la liste n'a qu'une entrée.
  const zones =
    estDegats || (estPriere && zonesModele.length > 1)
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

/**
 * ⭐ [A2-Prêtre s360] L'ORDRE « REPRÉSENTATIF » d'un DOMAINE (arbitrage Fred s360).
 *
 * ⚠️ LA RÈGLE DU MAGE NE SE TRANSPOSE PAS, et c'est mesuré (référence §5.2 ⑤) :
 * « le sort de dégâts du cercle sinon le moins cher » marche pour les sorts
 * parce que le sort de dégâts EST le sort le plus porté. Côté prêtre, sur les
 * 64 prières de niveau 1, **4 seulement** font des dégâts, et aucune des 8
 * prières les plus portées de leur domaine n'en fait. Un jumeau se RE-MESURE.
 *
 * LA RÈGLE RETENUE — la plus PORTÉE EN PROD quand le domaine donne un signal,
 * sinon la « effet bénéfique » la moins chère. C'est le MÊME PRINCIPE que côté
 * mage (représentatif = ce que les joueurs portent), dérivé sur la mesure
 * prêtre au lieu d'être hérité de sa formule.
 *
 * ⚠️ Écarté : « la moins chère », qui donnait `Protection de l'Âme` en
 * Bénédiction alors que `Soins` y est porté par 9 joueurs — le signal le plus
 * fort de toute la base. Optimiser sur le prix produit du contenu injouable
 * (Gotcha C66).
 */

/**
 * D'OÙ VIENNENT CES CHIFFRES (règle « tout seuil est une hypothèse ») :
 * MESURÉS en prod le 2026-07-25 sur les personnages vivants —
 *
 *   SELECT pr.domaine, pr.nom, count(DISTINCT pp.personnage_id) AS porteurs
 *   FROM personnage_prieres pp
 *   JOIN prieres pr     ON pr.id = pp.priere_id
 *   JOIN personnages p  ON p.id  = pp.personnage_id
 *   WHERE p.est_mort = false
 *   GROUP BY 1, 2 ORDER BY porteurs DESC;
 *
 * Effectif : 49 instances, 31 prières distinctes, 21 porteurs (17 prêtres).
 * ⚠️ SEULS 5 DOMAINES SUR 8 DONNENT UN SIGNAL. Connaissance, Nécromancie et
 * Ordre sont à ÉGALITÉ À 1 PORTEUR — du bruit, pas une mesure : ils sont
 * volontairement absents de cette table et retombent sur la règle de repli.
 */
export const PRIERE_LA_PLUS_PORTEE: Readonly<Record<string, string>> = {
  "Bénédiction": "Soins", // 9 porteurs
  "Chaos": "Ami/Ennemi", // 4
  "Éléments": "Peau de Pierre", // 3
  "Guerre": "Insensibilité à la douleur", // 2
  "Nature": "Baies de Guérison", // 2
};

export function ordonnerPrieresRepresentatives(
  prieres: readonly PriereModele[]
): { modele: PriereModele; config: ConfigMagie; coutXp: number }[] {
  const chiffres = prieres.map((modele) => {
    const config = configGenerateur(modele);
    return { modele, config, coutXp: prixMagie(modele, "priere", config).coutXp };
  });
  // Départage stable par NOM à prix égal : deux appels donnent le même ordre.
  const parPrix = [...chiffres].sort(
    (a, b) => a.coutXp - b.coutXp || a.modele.nom.localeCompare(b.modele.nom, "fr")
  );
  const domaine = prieres[0]?.domaine;
  const voulue = domaine === undefined ? undefined : PRIERE_LA_PLUS_PORTEE[domaine];
  const tete =
    voulue === undefined
      ? parPrix.find((x) => x.modele.type_priere === "effet bénéfique")
      : parPrix.find((x) => x.modele.nom === voulue);
  return tete === undefined
    ? parPrix
    : [tete, ...parPrix.filter((x) => x.modele.nom !== tete.modele.nom)];
}
