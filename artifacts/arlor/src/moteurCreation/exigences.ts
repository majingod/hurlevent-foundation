/**
 * Lecteur de la carte équipement ↔ compétences/races (VIS-8 lot 0, s347).
 *
 * La carte vit EN BASE (`objets_generateur` + `objets_requis`, migrations
 * 20260720225633…225803) et voyage dans le snapshot visiteur : le générateur
 * en ligne et hors ligne lisent les MÊMES règles, sans miroir à entretenir.
 *
 * Sémantique (décisions Fred s340/s341/s346/s347) :
 * - `variantes` = OU entre variantes ; dans une variante, `objets` = ET.
 * - `objets: []` = « mains nues » : la variante est satisfaite sans rien.
 * - `niveauEntree` = plus petit `niveau_min` des variantes satisfaites,
 *   `null` si aucune ne l'est (→ entrée grisée, filtre dur du générateur).
 * - Une compétence/race SANS ligne dans la carte n'exige rien (niveau 1).
 * - Snapshot antérieur au lot 0 (clés absentes) → aucune exigence connue,
 *   rien de grisé (dégradation douce, même patron que l'extension
 *   hors-ligne de A0).
 *
 * Module PUR : aucun effet de bord ; la source est résolue à CHAQUE appel
 * (l'override de test `__SNAPSHOT_HORS_LIGNE__` reste honoré).
 */

import { getSnapshot } from "./snapshot";
import type { ObjetGenerateur, ObjetRequis } from "./snapshot";

/** Ordre d'affichage des groupes de l'inventaire (maquette phase 2, s346). */
export const GROUPES_OBJETS = ["armes", "protections", "accessoires", "costume"] as const;
export type GroupeObjets = (typeof GROUPES_OBJETS)[number];

const RANG_GROUPE = new Map<string, number>(GROUPES_OBJETS.map((g, i) => [g, i]));

/** Une façon de satisfaire l'exigence : TOUS les objets, dès `niveau_min`. */
export interface VarianteObjets {
  objets: string[];
  niveau_min: number;
}

/** Exigence d'équipement d'une compétence ou d'une race. */
export interface ExigenceObjets {
  /** Phrase joueur affichée quand l'objet manque (seule maison : la base). */
  libelleManque: string;
  /** OU entre variantes ; `objets` vide = mains nues. */
  variantes: VarianteObjets[];
}

function lireVariante(brut: unknown): VarianteObjets | null {
  if (typeof brut !== "object" || brut === null) return null;
  const objets = (brut as { objets?: unknown }).objets;
  const niveau = (brut as { niveau_min?: unknown }).niveau_min;
  if (!Array.isArray(objets) || typeof niveau !== "number") return null;
  return {
    objets: objets.filter((o): o is string => typeof o === "string"),
    niveau_min: niveau,
  };
}

/** Parse défensif du `variantes` jsonb : les entrées malformées sont ignorées. */
export function lireVariantes(brut: unknown): VarianteObjets[] {
  if (!Array.isArray(brut)) return [];
  return brut.map(lireVariante).filter((v): v is VarianteObjets => v !== null);
}

function lignesObjetsRequis(): ObjetRequis[] {
  return (getSnapshot().tables.objets_requis ?? []) as ObjetRequis[];
}

function construireIndex(
  lignes: ObjetRequis[],
  cle: "competence_id" | "race_id"
): Map<string, ExigenceObjets> {
  const index = new Map<string, ExigenceObjets>();
  for (const ligne of lignes) {
    const id = ligne[cle];
    if (!id) continue;
    const variantes = lireVariantes(ligne.variantes);
    if (variantes.length === 0) continue; // ligne inexploitable → pas d'exigence
    index.set(id, { libelleManque: ligne.libelle_manque, variantes });
  }
  return index;
}

/** Les cases actives de l'inventaire, triées groupe (ordre maquette) puis ordre. */
export function objetsGenerateur(): ObjetGenerateur[] {
  const objets = (getSnapshot().tables.objets_generateur ?? []) as ObjetGenerateur[];
  return objets
    .filter((o) => o.est_actif)
    .sort(
      (a, b) =>
        (RANG_GROUPE.get(a.groupe) ?? 99) - (RANG_GROUPE.get(b.groupe) ?? 99) ||
        a.ordre - b.ordre
    );
}

/** Index compétence → exigence. Reconstruit à chaque appel (source vive). */
export function exigencesCompetences(): Map<string, ExigenceObjets> {
  return construireIndex(lignesObjetsRequis(), "competence_id");
}

/** Index race → exigence. */
export function exigencesRaces(): Map<string, ExigenceObjets> {
  return construireIndex(lignesObjetsRequis(), "race_id");
}

/**
 * Niveau à partir duquel l'inventaire satisfait l'exigence : plus petit
 * `niveau_min` des variantes couvertes, `null` si aucune (→ grisée).
 */
export function niveauEntree(
  exigence: ExigenceObjets,
  inventaire: ReadonlySet<string>
): number | null {
  let meilleur: number | null = null;
  for (const v of exigence.variantes) {
    if (!v.objets.every((o) => inventaire.has(o))) continue;
    if (meilleur === null || v.niveau_min < meilleur) meilleur = v.niveau_min;
  }
  return meilleur;
}

/**
 * Niveau d'entrée d'une compétence pour cet inventaire.
 * `1` si la compétence n'a aucune exigence ; `null` = grisée.
 * `index` peut être précalculé pour boucler sur une liste sans le rebâtir.
 */
export function niveauEntreeCompetence(
  competenceId: string,
  inventaire: ReadonlySet<string>,
  index: Map<string, ExigenceObjets> = exigencesCompetences()
): number | null {
  const exigence = index.get(competenceId);
  if (!exigence) return 1;
  return niveauEntree(exigence, inventaire);
}

/** Une race est proposable si son costume est couvert (ou sans exigence). */
export function raceAccessible(
  raceId: string,
  inventaire: ReadonlySet<string>,
  index: Map<string, ExigenceObjets> = exigencesRaces()
): boolean {
  const exigence = index.get(raceId);
  if (!exigence) return true;
  return niveauEntree(exigence, inventaire) !== null;
}
