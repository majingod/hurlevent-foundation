/**
 * [VIS-8 lot 2a] Types du moteur de composition — le « cerveau » du
 * générateur. PUR : aucune dépendance UI, catalogue injecté, aléa injectable.
 *
 * Le moteur PLANIFIE (liste d'achats chiffrée par couches ①②③④ + reliquat) ;
 * il n'APPLIQUE rien : l'application repasse par le parcours client existant
 * (mêmes gates, en ligne comme hors ligne) — architecture VIS-8 « zéro
 * moteur nouveau ».
 */

/** Sous-ensemble du Row `competences` dont le moteur a besoin. */
export interface CompetenceCatalogue {
  id: string;
  nom: string;
  /** guerrier · mage · pretre · voleur · generale */
  categorie: string | null;
  /** Verrou absolu (ex. ["guerrier"]) — null = ouvert. */
  classes_requises: string[] | null;
  type_achat: string | null;
  est_actif: boolean | null;
  niveaux: { niveau: number; cout_xp: number }[];
  /** { "N": [{ competence_nom, niveau_min }] } — prérequis du palier N. */
  prerequis: Record<
    string,
    { competence_nom: string; niveau_min: number }[]
  > | null;
}

export type ClasseId = "guerrier" | "mage" | "pretre" | "voleur";

/** Un achat planifié : UNE montée de palier d'une compétence. */
export interface AchatPlanifie {
  competenceId: string;
  nom: string;
  niveau: number;
  coutXp: number;
  couche: 2 | 3 | 4;
  /** Pourquoi il est là (fiche « toujours explicable », décision 10). */
  motif: string;
}

export interface CompositionOk {
  ok: true;
  /** Couche ① — gratuités de classe (0 XP). */
  gratuites: { competenceId: string; nom: string; note?: string }[];
  achats: AchatPlanifie[];
  budget: number;
  totalDepense: number;
  reliquat: number;
  /** Décision 15 : « s'il reste quelque chose, le dire ». */
  alertes: string[];
}

export interface CompositionRefus {
  ok: false;
  /** Ce qui manque pour tenir le rôle (ex. aucun bouclier ni armure). */
  raison: string;
}

export type Composition = CompositionOk | CompositionRefus;

export interface ContexteComposition {
  classe: ClasseId;
  roleId: string;
  /** Cases `objets_generateur` cochées (constats phase 1). */
  inventaire: ReadonlySet<string>;
  /** XP de départ de la race (Humain 80, autres 60). */
  budget: number;
  /**
   * Couche ③ « essentiels » déjà retenus (mode 🧭 : choisis par le joueur ;
   * mode 🎲 : tirés par `tirerEssentiels`). Cibles = { nom, niveauCible }.
   */
  essentiels?: readonly { nom: string; niveauCible: number }[];
}
