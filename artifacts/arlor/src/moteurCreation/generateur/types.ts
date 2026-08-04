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

/** Config d'un sort ou d'une prière planifié (labels des constantes magie). */
export interface ConfigMagie {
  niveau: number;
  zone: string;
  portee: string;
  duree: string;
}

/** [lot 2b] Un achat de MAGIE planifié : un sort/prière configuré, prix DÉRIVÉ
 *  par le miroir attesté (`@/utils/calculsMagie`, PR #710) — jamais écrit. */
export interface AchatMagiePlanifie {
  type: "sort" | "priere";
  modeleId: string;
  nom: string;
  config: ConfigMagie;
  coutXp: number;
  coutPS: number;
  couche: 2 | 3 | 4;
  motif: string;
  /** Surclassement (④ « monter la prière ») : l'entrée reste dans SA couche,
   *  montée sur place — la trace dit d'où elle vient et qui l'a montée. */
  surclasse?: {
    deNiveau: number;
    deCoutXp: number;
    parCouche: 2 | 3 | 4;
    motif: string;
  };
}

/** Un achat planifié : UNE montée de palier d'une compétence. */
export interface AchatPlanifie {
  competenceId: string;
  nom: string;
  niveau: number;
  coutXp: number;
  couche: 2 | 3 | 4;
  /** Pourquoi il est là (fiche « toujours explicable », décision 10). */
  motif: string;
  /**
   * ⭐ [R1a s361] `choix_achat` — le cercle ou le domaine que cette ligne
   * nomme. Obligatoire en base pour `Acquisition de Cercle` et
   * `Acquisition de Domaine` (`multiple_avec_choix_par_niveau`) : 178
   * lignes en prod, zéro sans choix. L'appelant l'écrit tel quel.
   */
  choix?: string;
}

/** [C1 s375] Enveloppe chiffrée d'artisanat — les ITEMS précis se tirent à
 *  la conversion (versBrouillon), l'enveloppe tient le budget (D34). */
export interface PlanArtisanat {
  famille: "recette" | "assemblage" | "piege";
  /** Palier du tirage. Gratuites : palier EXACT (le quota serveur est par
   *  palier). Payantes (recettes) : palier MAX débloqué — le tirage pioche
   *  dans 1..palier. */
  palier: number;
  nb: number;
  /** 0 (dû par la compétence) ou 3 (recette payante, manuel). */
  coutUnitaire: number;
  motif: string;
}

export interface CompositionOk {
  ok: true;
  /** Couche ① — gratuités de classe (0 XP). */
  gratuites: { competenceId: string; nom: string; note?: string }[];
  achats: AchatPlanifie[];
  /** [lot 2b] Sorts/prières planifiés (vide pour les classes martiales). */
  achatsMagie: AchatMagiePlanifie[];
  /** [C1 s375] Enveloppes d'artisanat — vide sans compétence d'artisanat. */
  artisanat: PlanArtisanat[];
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
  essentiels?: readonly (
    | { nom: string; niveauCible: number }
    | { label: string }
  )[];
  /** [lot 2b] 🔥 Mage : le cercle choisi (🧭) ou tiré (🎲) — « ton élément ? ». */
  element?: string;
  /** ⭐ [R1a s361] Le SECOND cercle / domaine, quand le joueur en veut un. */
  element2?: string;
  /**
   * ⭐ [A2-socle] Le personnage ne peut avoir AUCUNE compétence à points de
   * spiritualité (trait « Inapte à la magie »).
   *
   * ⚠️ CALCULÉ PAR L'APPELANT, jamais par le moteur — et surtout jamais
   * déduit de la RACE ici. La base actuelle refuse sur le pool de traits du
   * Demi-Orc ; le fix `[INAPTE-MAGIE-MODELE-INSTANCE]` la fera porter sur le
   * TRAIT CHOISI. Coder « Demi-Orc » dans le moteur serait donc déjà périmé
   * à la livraison. L'appelant change, le moteur ne bouge jamais.
   */
  inapteMagie?: boolean;
}
