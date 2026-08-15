import { describe, it, expect } from "vitest";
import {
  destinationRefus,
  TITRE_REFUS,
  LIBELLE_COMPRIS,
  LIBELLE_ALLER_CREATEUR,
  LIBELLE_PLUS_TARD,
} from "./refusInscription";

/**
 * s404 — [INSCRIPTION-REFUS-MUET]. Le mapping code → action est attesté dans
 * les deux sens (jumeaux : chaque négatif a son positif), et les textes
 * joueur au VERBATIM LITTÉRAL (C101 — jamais contre la constante importée
 * pour le contenu attendu).
 */
describe("destinationRefus — le mapping code → action (s404)", () => {
  it("RC001 (aucune demande de race) mène au créateur du personnage choisi", () => {
    expect(destinationRefus("RC001", "abc-123")).toBe("/personnage/nouveau?id=abc-123");
  });

  it("RC003 (demande refusée) mène au créateur du personnage choisi", () => {
    expect(destinationRefus("RC003", "abc-123")).toBe("/personnage/nouveau?id=abc-123");
  });

  it("RC002 (demande en attente) n'offre aucune navigation : rien à modifier", () => {
    expect(destinationRefus("RC002", "abc-123")).toBeNull();
  });

  it("un code inconnu n'offre aucune navigation (fail-closed) — dont le gel P0001", () => {
    expect(destinationRefus("P0001", "abc-123")).toBeNull();
    expect(destinationRefus("23505", "abc-123")).toBeNull();
    expect(destinationRefus("XX123", "abc-123")).toBeNull();
  });

  it("sans code, aucune navigation (fail-closed)", () => {
    expect(destinationRefus(null, "abc-123")).toBeNull();
    expect(destinationRefus(undefined, "abc-123")).toBeNull();
    expect(destinationRefus("", "abc-123")).toBeNull();
  });

  it("sans personnage cible, aucune navigation même sur un code créateur (fail-closed)", () => {
    expect(destinationRefus("RC001", null)).toBeNull();
    expect(destinationRefus("RC001", undefined)).toBeNull();
    expect(destinationRefus("RC003", "")).toBeNull();
  });
});

describe("textes joueur du refus — verbatim littéral (C101)", () => {
  it("le titre porte le verbe en cours", () => {
    expect(TITRE_REFUS.inscription).toBe("Inscription impossible");
    expect(TITRE_REFUS.desinscription).toBe("Désinscription impossible");
  });

  it("les libellés des boutons", () => {
    expect(LIBELLE_COMPRIS).toBe("Compris");
    expect(LIBELLE_ALLER_CREATEUR).toBe("Aller au créateur");
    expect(LIBELLE_PLUS_TARD).toBe("Plus tard");
  });
});
