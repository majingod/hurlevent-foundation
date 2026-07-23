import type { ClasseId, ConfigMagie } from "../types";

/**
 * [VIS-8 lot 2b] Contrat GÉNÉRIQUE d'un contenu de classe — le composeur
 * déroule ce contrat pour les 4 classes ; seul le contenu change (patron
 * annoncé au lot 2a). Les prix ne sont JAMAIS écrits ici (décision 20).
 */

export interface OptionsRole {
  /** 🔥 Mage : le cercle choisi/tiré (« ton élément ? »). */
  element?: string;
}

export type Achat =
  | { t: "comp"; nom: string; niveauCible: number }
  /** +1 rachat au prix du niveau 1 (jauges à choix : cercle, langue, savoir…). */
  | { t: "rachat"; nom: string }
  | { t: "sort"; nom: string; config: ConfigMagie }
  | { t: "priere"; nom: string; config: ConfigMagie };

export interface RoleClasse {
  id: string;
  emoji: string;
  titre: string;
  phrase: string;
  /** null = jouable ; sinon la raison du refus (avec quoi rattraper). */
  requiert: (inv: ReadonlySet<string>, o: OptionsRole) => string | null;
  noyau: (inv: ReadonlySet<string>, o: OptionsRole) => Achat[];
}

export interface EntreePool {
  /** Identité de l'entrée (affichage, dédup, essentiels retenus ③). */
  label: string;
  note: string;
  achats: (inv: ReadonlySet<string>, o: OptionsRole) => Achat[];
  condition?: (inv: ReadonlySet<string>, o: OptionsRole) => boolean;
}

export type EtapePond =
  | {
      type: "achats";
      label: string;
      achats: (inv: ReadonlySet<string>, o: OptionsRole) => Achat[];
    }
  | { type: "jauge"; nom: string; plafondRachats: number };

export interface ContenuClasse {
  classe: ClasseId;
  gratuites: readonly string[];
  alertesGratuites?: (inv: ReadonlySet<string>) => string[];
  roles: readonly RoleClasse[];
  /** ⭐ s352 — MONTÉES SIGNATURE, indexées par rôle comme `pond4`.
   *  Prises EN TÊTE de ③, dans l'ordre déclaré, AVANT tout tirage : c'est
   *  ce qui rend l'archétype reconnaissable. Jamais laissé au hasard. */
  signature3?: Record<string, EntreePool[]>;
  pool3: Record<string, EntreePool[]>;
  pond4: Record<string, EtapePond[]>;
  filet: EtapePond[];
}

export const comp = (nom: string, niveauCible = 1): Achat => ({
  t: "comp",
  nom,
  niveauCible,
});
export const rachat = (nom: string): Achat => ({ t: "rachat", nom });
export const sort = (nom: string, config: ConfigMagie): Achat => ({
  t: "sort",
  nom,
  config,
});
export const priere = (nom: string, config: ConfigMagie): Achat => ({
  t: "priere",
  nom,
  config,
});

/**
 * ⭐ FILETS MARTIAUX — PLAFONDS MESURÉS EN PROD (s353, arbitrage Fred).
 *
 * L'ancien `FILET_MARTIAL_COMMUN` ouvrait `Connaissances des Religions` à
 * **15 rachats** : un chiffre de conception, jamais mesuré. Le générateur
 * pouvait en poser **7 d'affilée** sur une fiche. Or sur les 99 personnages
 * vivants, `Connaissances des Religions` est portée par **3 guerriers sur 21**
 * (moins de 3 voleurs sur 16) et **jamais plus d'une fois**. Une fiche à sept
 * religions ne ressemble à aucun joueur réel.
 *
 * Les plafonds ci-dessous sont les MAXIMA OBSERVÉS chez les vivants de la
 * classe, pas des estimations :
 *   guerrier · `Développement Spirituel` 4 porteurs/21, jusqu'à **5** rachats
 *              (2 XP l'unité — la vraie petite monnaie du guerrier)
 *            · `Connaissances des Religions` 3/21, **1** rachat, jamais deux
 *   voleur   · `Langue supplémentaire` 4 porteurs/16, jusqu'à **6** rachats
 *            · `Connaissances des Religions` 2/16, **1** rachat
 *            · `Développement Spirituel` 1/16, **1** rachat (2 XP — le grain
 *              qui termine la cascade, règle s346)
 *
 * ⚠️ Chaque plafond est le MAXIMUM OBSERVÉ, pas une cible : le générateur ne
 * remplit une jauge que faute de mieux, après la couche ④ de l'archétype.
 */
export const FILET_GUERRIER: EtapePond[] = [
  { type: "jauge", nom: "Développement Spirituel", plafondRachats: 5 },
  { type: "jauge", nom: "Connaissances des Religions", plafondRachats: 1 },
];

export const FILET_VOLEUR: EtapePond[] = [
  { type: "jauge", nom: "Langue supplémentaire", plafondRachats: 6 },
  { type: "jauge", nom: "Connaissances des Religions", plafondRachats: 1 },
  { type: "jauge", nom: "Développement Spirituel", plafondRachats: 1 },
];

/** Filet caster (s349) : chaque PS = un lancer de plus — DS 2 XP puis DSS 4 XP.
 *  Reliquat borné à 3 (une unité DSS ne rentre plus, DS au plafond). */
export const FILET_CASTER: EtapePond[] = [
  { type: "jauge", nom: "Développement Spirituel", plafondRachats: 10 },
  { type: "jauge", nom: "Développement Spirituel Supérieur", plafondRachats: 10 },
];
