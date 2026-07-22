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
  teteDeListe?: boolean;
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

/** Filet martial (règle s346) : Religions 4 XP puis Langues 5 XP. */
export const FILET_MARTIAL_COMMUN: EtapePond[] = [
  { type: "jauge", nom: "Connaissances des Religions", plafondRachats: 15 },
  { type: "jauge", nom: "Langue supplémentaire", plafondRachats: 6 },
];

/** Filet caster (s349) : chaque PS = un lancer de plus — DS 2 XP puis DSS 4 XP.
 *  Reliquat borné à 3 (une unité DSS ne rentre plus, DS au plafond). */
export const FILET_CASTER: EtapePond[] = [
  { type: "jauge", nom: "Développement Spirituel", plafondRachats: 10 },
  { type: "jauge", nom: "Développement Spirituel Supérieur", plafondRachats: 10 },
];
