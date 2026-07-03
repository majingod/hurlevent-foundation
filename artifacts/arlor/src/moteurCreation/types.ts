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
