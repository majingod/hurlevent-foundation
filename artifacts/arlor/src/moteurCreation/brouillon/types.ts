/**
 * Modèle du BROUILLON VISITEUR (lot P2-a3-i) — l'état du personnage en cours de
 * création qui vit sur le téléphone en mode offline.
 *
 * Principe gravé : « recompute from scratch ». Le brouillon stocke UNIQUEMENT les
 * CHOIX bruts du joueur (étapes 1→4 + acquisitions). Tout le reste — XP dispo,
 * PV/PS, gratuités, quotas, inapte-magie — est DÉRIVÉ à la demande par
 * `deriver.ts`. AUCUN champ dérivé n'est stocké ici (vérifié par test structurel).
 *
 * TS pur : aucun import React, aucun accès `localStorage`/`window`. Seul
 * `src/creation/visiteur/stockageBrouillon.ts` touche `localStorage`.
 *
 * Source unique des shapes d'étapes : les Args des RPC serveur
 * `sauvegarder_etape_1..4` (`Fonctions[...]["Args"]`, cf. `ArgsR` dans
 * `src/creation/types.ts`). On reprend chaque champ, en camelCase idiomatique du
 * moteur, et on RETIRE les params qui n'ont aucun sens hors ligne — chaque
 * retrait est documenté ci-dessous.
 */

import { getSnapshot } from "../snapshot";

// ============================================================
// Données d'étapes 1 → 4 (miroir des Args RPC, sans les params serveur)
// ============================================================

/**
 * Étape 1 — identité & croyance.
 * Miroir de `ArgsR<"sauvegarder_etape_1">`.
 * Retirés :
 *  - `p_personnage_id` : id serveur, inexistant pour un brouillon local.
 *  - `p_brouillon`     : flag de sauvegarde PARTIELLE côté serveur ; hors ligne
 *                        la notion de brouillon EST ce fichier (schemaVersion/meta).
 */
export interface BrouillonEtape1 {
  nom: string; // p_nom
  gnCompletes: number; // p_gn_completes
  miniGnCompletes: number; // p_mini_gn_completes
  ouverturesTerrain: number; // p_ouvertures_terrain
  estCroyant: boolean; // p_est_croyant
  /** p_religion_id — non-null côté RPC ; `null` tant que non renseigné hors ligne. */
  religionId: string | null;
  historique?: string; // p_historique?
  amePersonnage?: string; // p_ame_personnage?
}

/**
 * Étape 2 — race.
 * Miroir de `ArgsR<"sauvegarder_etape_2">`.
 * Retirés :
 *  - `p_personnage_id` : id serveur.
 *  - `p_brouillon`     : flag serveur (cf. étape 1).
 *  - `p_justification`  : justification destinée au FLUX D'APPROBATION serveur
 *                         (demande de race) ; aucun sens en création offline.
 */
export interface BrouillonEtape2 {
  raceId: string; // p_race_id
  sousTypeChimeride?: string | null; // p_sous_type_chimeride?
}

/**
 * Étape 3 — traits raciaux.
 * Miroir de `ArgsR<"sauvegarder_etape_3">` (`p_traits_raciaux_choisis: Json`).
 * On conserve la forme BRUTE `[{ trait_id, … }]` telle qu'attendue par
 * `ContexteTraitRacial` du moteur (non converti en camelCase).
 * Retirés : `p_personnage_id`, `p_brouillon`.
 */
export interface BrouillonEtape3 {
  traitsRaciauxChoisis: Array<{ trait_id?: string; [k: string]: unknown }>; // p_traits_raciaux_choisis
}

/**
 * Étape 4 — classe.
 * Miroir de `ArgsR<"sauvegarder_etape_4">`.
 * Retirés : `p_personnage_id`, `p_brouillon`.
 * `choixParCompetence` (p_choix_par_competence: Json) = map
 * `competence_id → choix_achat` pour les gratuités de classe à `type_choix`
 * non-null (ex. religion, langue). Consommée telle quelle par `appliquerGratuites`.
 */
export interface BrouillonEtape4 {
  classeId: string; // p_classe_id
  choixParCompetence?: Record<string, string>; // p_choix_par_competence?
}

// ============================================================
// Acquisitions — listes de CHOIX bruts (aucun coût, aucune gratuité stockés)
// ============================================================

/**
 * IDENTITÉ D'INSTANCE (lot désachats fidèles).
 *
 * Chaque acquisition porte un `instanceId` (uuid local, `crypto.randomUUID()`)
 * posé À L'ACHAT par les applicateurs. C'est la SOURCE UNIQUE d'identité d'une
 * ligne acquise, UNIFORME sur les 6 familles — même celles sans doublon possible
 * aujourd'hui. Les lectures exposent `id = instanceId`, les désachats retirent
 * la ligne DÉSIGNÉE (et non toutes les copies du catalogue), fidèle au serveur
 * qui supprime une ligne `personnage_*` par sa PK.
 */

/** Choix brut d'achat de compétence. Aligné sur `DemandeAchatCompetence`. */
export interface BrouillonCompetence {
  /** Identité de la ligne acquise (uuid local, posé à l'achat). */
  instanceId: string;
  competenceId: string;
  niveauAcquis: number;
  choixAchat: string | null;
}

/** Choix brut d'achat de sort. Aligné sur `DemandeAchatSort`. */
export interface BrouillonSort {
  /** Identité de la ligne acquise (uuid local, posé à l'achat). */
  instanceId: string;
  sortId: string;
  niveauSort: number;
  zoneChoisie: string;
  porteeChoisie: string;
  dureeChoisie: string;
  /** p_nom_personnalise — libellé cosmétique choisi par le joueur (optionnel). */
  nomPersonnalise?: string;
}

/** Choix brut d'achat de prière. Aligné sur `DemandeAchatPriere`. */
export interface BrouillonPriere {
  /** Identité de la ligne acquise (uuid local, posé à l'achat). */
  instanceId: string;
  priereId: string;
  niveauPriere: number;
  zoneChoisie: string;
  porteeChoisie: string;
  dureeChoisie: string;
  /** p_nom_personnalise — libellé cosmétique choisi par le joueur (optionnel). */
  nomPersonnalise?: string;
}

/** Choix brut d'achat de piège (RPC `acheter_piege` : `p_piege_id` seul). */
export interface BrouillonPiege {
  /** Identité de la ligne acquise (uuid local, posé à l'achat). */
  instanceId: string;
  piegeId: string;
}

/** Choix brut d'achat de recette (RPC `acheter_recette` : `p_recette_id` seul). */
export interface BrouillonRecette {
  /** Identité de la ligne acquise (uuid local, posé à l'achat). */
  instanceId: string;
  recetteId: string;
}

/** Choix brut d'achat d'assemblage (RPC `acheter_assemblage` : `p_assemblage_id`). */
export interface BrouillonAssemblage {
  /** Identité de la ligne acquise (uuid local, posé à l'achat). */
  instanceId: string;
  assemblageId: string;
}

/**
 * Toutes les acquisitions du visiteur, en listes ordonnées de choix bruts.
 * L'ORDRE est signifiant pour l'artisanat (gratuités par quota, dérivées dans
 * l'ordre d'insertion — cf. `deriver.ts`).
 */
export interface BrouillonAcquisitions {
  competences: BrouillonCompetence[];
  sorts: BrouillonSort[];
  prieres: BrouillonPriere[];
  pieges: BrouillonPiege[];
  recettes: BrouillonRecette[];
  assemblages: BrouillonAssemblage[];
}

// ============================================================
// Le modèle complet
// ============================================================

export interface BrouillonMeta {
  /** ISO 8601 — date de création du brouillon. */
  creeLe: string;
  /** ISO 8601 — dernière modification (mise à jour par chaque applicateur). */
  modifieLe: string;
  /** `manifest.genere_le` du snapshot au moment de la création (garde de péremption). */
  snapshotGenereLe: string;
  /** Étape courante du wizard (1→n). */
  etapeCourante: number;
}

/**
 * BROUILLON VISITEUR — JSON-sérialisable, versionné.
 *
 * INVARIANT : ne contient QUE des choix bruts. Aucun champ dérivé (`xpDispo`,
 * `pvMax`, `psMax`, gratuités, quotas…) — vérifié par test structurel.
 */
export interface BrouillonVisiteur {
  /**
   * Version de schéma (garde de stockage). `2` depuis l'ajout des `instanceId`
   * d'acquisition ; un brouillon `1` (sans `instanceId`) est migré au chargement
   * (`stockageBrouillon.migrerVersV2`). Un schéma inconnu → jeté.
   */
  schemaVersion: 2;
  meta: BrouillonMeta;
  etape1: BrouillonEtape1;
  etape2: BrouillonEtape2;
  etape3: BrouillonEtape3;
  etape4: BrouillonEtape4;
  acquisitions: BrouillonAcquisitions;
}

// ============================================================
// Fabrique
// ============================================================

function maintenantIso(): string {
  return new Date().toISOString();
}

/**
 * Brouillon vide, prêt à recevoir les choix du joueur.
 * `snapshotGenereLe` est figé sur le snapshot bundlé courant.
 */
export function creerBrouillonVide(): BrouillonVisiteur {
  const now = maintenantIso();
  return {
    schemaVersion: 2,
    meta: {
      creeLe: now,
      modifieLe: now,
      snapshotGenereLe: getSnapshot().manifest.genere_le,
      etapeCourante: 1,
    },
    etape1: {
      nom: "",
      gnCompletes: 0,
      miniGnCompletes: 0,
      ouverturesTerrain: 0,
      estCroyant: false,
      religionId: null,
    },
    etape2: {
      raceId: "",
    },
    etape3: {
      traitsRaciauxChoisis: [],
    },
    etape4: {
      classeId: "",
    },
    acquisitions: {
      competences: [],
      sorts: [],
      prieres: [],
      pieges: [],
      recettes: [],
      assemblages: [],
    },
  };
}
