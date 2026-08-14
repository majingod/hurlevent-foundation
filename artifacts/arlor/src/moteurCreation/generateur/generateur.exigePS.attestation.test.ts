/**
 * [s402] LA LISTE DES COMPÉTENCES À PS A UNE SEULE MAISON.
 *
 * Ce que ce fichier protège, en clair : le générateur et le créateur doivent
 * refuser les MÊMES compétences à un personnage inapte à la magie. Le créateur
 * refuse sur `competences.exige_ps` (`gatesCompetences.ts`), et le serveur
 * aussi ; le générateur, lui, portait une liste écrite à la main, tirée de la
 * référence v4 §2.2 — elle nommait 6 compétences quand la base en marque 10.
 * Rien ne rougissait : les 4 manquantes n'étaient pas atteignables (mesuré
 * s402), et une liste trop courte échoue TOUJOURS en silence, jamais en erreur.
 *
 * ⛔ L'instrument n'est PAS `estCompetenceAPS` — le comparer à lui-même serait
 * vert à vide des deux côtés (C109). L'autorité est la CAPTURE VISITEUR, que
 * la garde de dérive de la CI (s401) tient alignée sur la base vivante.
 */
import { describe, expect, it } from "vitest";

import snapshotJson from "../../data/snapshotVisiteur.json";
import { COMPETENCES_A_PS, estCompetenceAPS } from "./contenu/commun";

type LigneCompetence = { nom: string; exige_ps?: boolean | null };

const competences = (
  snapshotJson as unknown as { tables: { competences: LigneCompetence[] } }
).tables.competences;

/** Le jeu de noms que la BASE marque « repose sur les points de spiritualité ». */
const NOMS_EXIGE_PS = [
  ...new Set(competences.filter((c) => c.exige_ps === true).map((c) => c.nom)),
].sort();

describe("COMPETENCES_A_PS ↔ competences.exige_ps", () => {
  /**
   * ⚠️ GARDE ANTI-STUB (C99/C133, NE PAS resynchroniser mécaniquement).
   * Si une recapture perdait la colonne `exige_ps`, chaque ligne rendrait
   * `undefined`, le jeu ci-dessus serait VIDE, et une comparaison de jeux
   * vides passerait pour une concordance. Ce test-ci rougit d'abord.
   */
  it("la capture porte bien la colonne exige_ps sur TOUTES ses compétences", () => {
    expect(competences.length).toBeGreaterThanOrEqual(80);
    const sansColonne = competences.filter((c) => !("exige_ps" in c));
    expect(sansColonne.map((c) => c.nom)).toEqual([]);
    expect(NOMS_EXIGE_PS.length).toBeGreaterThanOrEqual(10);
  });

  /**
   * L'attestation elle-même. Égalité EXACTE dans les deux sens : une liste
   * trop courte laisse le générateur composer une fiche que le créateur
   * refusera ; une liste trop longue lui fait écarter des compétences que le
   * jeu autorise.
   */
  it("la liste du générateur est EXACTEMENT le jeu de noms de la base", () => {
    expect([...COMPETENCES_A_PS].sort()).toEqual(NOMS_EXIGE_PS);
  });

  /** Face positive : le prédicat répond vrai sur chacun de ces noms. */
  it("estCompetenceAPS reconnaît chacun des noms de la base", () => {
    for (const nom of NOMS_EXIGE_PS) {
      expect(estCompetenceAPS(nom)).toBe(true);
    }
  });

  /** Face négative jumelle : il ne mord pas au-delà. */
  it("estCompetenceAPS ne mord sur aucune compétence sans PS de la capture", () => {
    const sansPS = competences
      .filter((c) => c.exige_ps !== true)
      .map((c) => c.nom);
    expect(sansPS.length).toBeGreaterThan(0);
    expect(sansPS.filter((nom) => estCompetenceAPS(nom))).toEqual([]);
  });
});
