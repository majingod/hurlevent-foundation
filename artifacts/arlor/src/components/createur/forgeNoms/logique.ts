/**
 * [s406] LA FORGE DES NOMS — LA LOGIQUE A UNE SEULE MAISON, C'EST ICI.
 *
 * Port exact de la maquette s405 (validée par Fred) : soudure à double
 * élision, tirage att(+mid)+fin ou prénom entier, familles par race,
 * 8 propositions dédupliquées. Tout est PUR : le hasard s'injecte (Rng),
 * les tests tirent en graine fixe.
 *
 * Décisions gravées (s405, ⛔ ne pas rouvrir) :
 * - Un seul point d'accès : bouton doré sous le champ nom de l'étape 1,
 *   visible ssi le nom est éditable (le nom se fige à la première présence
 *   en jeu — mode campagne).
 * - « Autre » tire dans les deux répertoires (M/F), au hasard nom par nom.
 * - Rien ne s'écrit en base depuis la Forge.
 */

import {
  NOMS_PAR_RACE,
  ORDRE_RACES_FORGE,
  type PoolPrenoms,
  type RaceForgeId,
  type RaceNoms,
  type SexeSonorite,
  type SousTypeChimeride,
} from "./noms";

/** Textes joueur — verbatim, testés (C101). */
export const TEXTES = {
  /** Le bouton d'entrée, sous le champ nom de l'étape 1. */
  bouton: "🔥 Propose-moi des noms",
  /** Le titre de la fenêtre. */
  titre: "La Forge des noms",
  /** Promesse tenue par le composant : toucher un nom remplit le champ. */
  sousTitre: "Chaque race a sa sonorité. Touche un nom : il remplit le champ.",
  /** Arbitrage Fred s405 : on décrit un NOM, pas une personne. */
  groupeSonorite: "Sonorité du nom",
  masculin: "Masculin",
  feminin: "Féminin",
  /** Arbitrage Fred s405 : ⛔ jamais « Peu importe ». */
  autre: "Autre",
  nomDeFamille: "nom de famille",
  forger: "🔥 Forger huit noms",
  vide: "La forge est froide. Appuie sur le soufflet.",
} as const;

/** Générateur de hasard injectable — rend un nombre dans [0, 1). */
export type Rng = () => number;

export const VOYELLE = /[aeiouyàâäéèêëîïôöùûüÿ]/i;

const pioche = <T>(t: readonly T[], rng: Rng): T =>
  t[Math.floor(rng() * t.length)];

/**
 * Soudure à double élision (maquette s405, port exact) : si une voyelle
 * finit la pièce et qu'une voyelle ouvre la suivante, on élide la première ;
 * si la frontière reste voyelle·voyelle, on élide aussi la seconde.
 * Élo+onde→Élonde · Vae+ariel→Variel (double) · Xil+une+aeye→Xilunaeye.
 */
export function souder(a: string, b: string): string {
  if (!a || !b) return a + b;
  if (VOYELLE.test(a.charAt(a.length - 1)) && VOYELLE.test(b.charAt(0))) {
    a = a.slice(0, -1);
    if (a && VOYELLE.test(a.charAt(a.length - 1)) && VOYELLE.test(b.charAt(0))) {
      b = b.slice(1);
    }
  }
  return a + b;
}

/**
 * Un prénom : assemblage att(+mid)+fin dans 70 % des tirages (100 % si le
 * volet n'a pas de prénoms entiers), prénom entier sinon. « Autre » choisit
 * le répertoire M ou F au hasard, nom par nom.
 */
export function forgerPrenom(
  race: RaceNoms,
  sexe: SexeSonorite,
  rng: Rng,
): string {
  const volet: "M" | "F" = sexe === "A" ? (rng() < 0.5 ? "M" : "F") : sexe;
  const p: PoolPrenoms = race.prenoms[volet];
  const assemblable = p.att.length > 0 && p.fin.length > 0;
  if (assemblable && (rng() < 0.7 || p.entiers.length === 0)) {
    const mid = p.mid && rng() < 0.45 ? pioche(p.mid, rng) : "";
    return souder(souder(pioche(p.att, rng), mid), pioche(p.fin, rng));
  }
  return pioche(p.entiers, rng);
}

/**
 * Un nom de famille selon la race : compose (A×B), liste fermée, ou par
 * sous-type Chiméride. `sousType` n'est lu QUE pour le type "sousType".
 */
export function forgerFamille(
  race: RaceNoms,
  sousType: SousTypeChimeride,
  rng: Rng,
): string {
  const f = race.familles;
  if (f.type === "compose") return pioche(f.a, rng) + pioche(f.b, rng);
  if (f.type === "sousType") return pioche(f[sousType], rng);
  return pioche(f.liste, rng);
}

export interface OptionsForge {
  race: RaceNoms;
  sexe: SexeSonorite;
  /** Lu seulement si la race compose ses familles par sous-type (Chiméride). */
  sousType: SousTypeChimeride;
  avecFamille: boolean;
  /** 8 par défaut (les huit plaques de la maquette). */
  n?: number;
  rng?: Rng;
}

/**
 * Forge `n` noms distincts (garde à 200 essais, comme la maquette : sur un
 * répertoire pathologiquement petit on rend moins de noms plutôt que de
 * boucler).
 */
export function forgerNoms({
  race,
  sexe,
  sousType,
  avecFamille,
  n = 8,
  rng = Math.random,
}: OptionsForge): string[] {
  const vus = new Set<string>();
  const sortie: string[] = [];
  let garde = 0;
  while (sortie.length < n && garde++ < 200) {
    let nom = forgerPrenom(race, sexe, rng);
    if (avecFamille) nom += " " + forgerFamille(race, sousType, rng);
    if (!vus.has(nom)) {
      vus.add(nom);
      sortie.push(nom);
    }
  }
  return sortie;
}

/**
 * Appariement base → Forge par le NOM de race (byte-exact avec `races.nom`,
 * attesté contre la capture visiteur). Refus = null, jamais une exception :
 * une race non jouable (Fée, Haut-Elfe, Orc) ou inconnue rend simplement la
 * Forge libre de sa sélection.
 */
export function raceForgeDepuisNom(
  nomRace: string | null | undefined,
): RaceForgeId | null {
  if (!nomRace) return null;
  for (const id of ORDRE_RACES_FORGE) {
    if (NOMS_PAR_RACE[id].label === nomRace) return id;
  }
  return null;
}
