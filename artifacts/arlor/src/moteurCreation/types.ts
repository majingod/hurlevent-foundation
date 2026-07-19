/**
 * Types pour le moteur de création offline MODE-VISITEUR
 * Port fidèle du contrat jsonb serveur (public.peut_acheter_competence)
 */

/**
 * Verdict d'un gate d'achat de compétence — miroir exact du jsonb serveur
 */
export interface VerdictAchat {
  peutAcheter: boolean;
  raison: string; // "OK" si peutAcheter
  coutXp?: number;
  niveauActuel?: number;
  niveauDesire?: number;
  necessiteMaitre?: boolean;
  typeAchat?: string;
  typeChoix?: string | null;
  verrouillageCroise?: boolean;
}

/**
 * Contexte du personnage local (état dérivé fourni par l'appelant)
 * P1 ne calcule pas les dérivés ; l'appelant les fournit.
 */
export interface ContextePersonnage {
  classeNom: "Guerrier" | "Voleur" | "Mage" | "Prêtre" | null;
  raceInapteMagie: boolean; // la race possède le trait actif « Inapte à la magie »
  xpDispo: number;
  psMax: number;
  competencesAcquises: AcquisCompetence[];
}

export interface AcquisCompetence {
  competenceId: string;
  competenceNom: string;
  categorie: string | null;
  niveauAcquis: number;
  choixAchat: string | null;
}

export interface DemandeAchatCompetence {
  competenceId: string;
  niveauDesire: number;
  choixAchat: string | null;
}

// ============================================================
// P1-c — MAGIE (sorts / prières)
// ============================================================

/**
 * Contexte magie : le ctx EST le personnage local. `religionId` sert uniquement
 * aux prières (exclusion des domaines proscrits).
 */
export interface ContexteMagie {
  xpDispo: number;
  /** Niveau du PERSONNAGE (pas du sort) — décide le plafond 10 + 10 x niveau. */
  niveau: number;
  competencesAcquises: AcquisCompetence[];
  religionId?: string | null;
}

export interface DemandeAchatSort {
  sortId: string;
  niveauSort: number;
  zoneChoisie: string;
  porteeChoisie: string;
  dureeChoisie: string;
}

/** Miroir du jsonb peut_acheter_sort (§Lot 1). Champs optionnels = émis par le serveur. */
export interface VerdictSort {
  peutAcheter: boolean;
  code?: string;
  raison: string;
  coutXp?: number;
  formuleMagique?: string | null;
  niveauMaxCercle?: number;
}

export interface DemandeAchatPriere {
  priereId: string;
  niveauPriere: number;
  zoneChoisie: string;
  porteeChoisie: string;
  dureeChoisie: string;
}

/** Miroir du jsonb peut_acheter_priere (§Lot 1). */
export interface VerdictPriere {
  peutAcheter: boolean;
  code?: string;
  raison: string;
  coutXp?: number;
  dureeIncantationCalculee?: number;
  niveauMaxDomaine?: number;
}

// ============================================================
// P1-c — TRAITS RACIAUX (gate legacy, SANS champ `code`)
// ============================================================

/**
 * `traitsRaciauxChoisis` = tableau BRUT d'objets `{ trait_id, … }` tel qu'en base
 * (personnages.traits_raciaux_choisis), non converti en camelCase.
 */
export interface ContexteTraitRacial {
  xpDispo: number;
  traitsRaciauxChoisis: Array<{ trait_id?: string; [k: string]: unknown }>;
}

export interface DemandeAchatTraitRacial {
  traitId: string;
  raceId: string | null;
  sousType: string | null;
}

/** Miroir du jsonb peut_acheter_trait_racial (§3.7) — legacy, PAS de `code`. */
export interface VerdictTraitRacial {
  peutAcheter: boolean;
  raison: string;
  coutXp?: number;
  estGratuit?: boolean;
  nbTraitsActuels?: number;
}

// ============================================================
// P1-c — ARTISANAT (pièges / recettes / assemblages)
// ============================================================

export interface PiegeAcquis {
  piegeNom: string;
  niveauAcquis: number;
  estGratuit: boolean;
}

export interface ContextePiege {
  xpDispo: number;
  competencesAcquises: AcquisCompetence[];
  piegesAcquis: PiegeAcquis[];
}

export interface RecetteAcquise {
  recetteId: string;
  estGratuit: boolean;
}

export interface ContexteRecette {
  xpDispo: number;
  competencesAcquises: AcquisCompetence[];
  recettesAcquises: RecetteAcquise[];
}

export interface AssemblageAcquis {
  assemblageId: string;
  estGratuit: boolean;
}

export interface ContexteAssemblage {
  xpDispo: number;
  competencesAcquises: AcquisCompetence[];
  assemblagesAcquis: AssemblageAcquis[];
}

/**
 * Miroir commun des jsonb peut_acheter_piege / _recette / _assemblage (§Lot 1).
 * `champ` n'est émis que par le refus « palier de recette non débloqué ».
 */
export interface VerdictArtisanat {
  peutAcheter: boolean;
  code?: string;
  raison: string;
  coutXp?: number;
  estGratuit?: boolean;
  champ?: string;
}
