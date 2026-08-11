import { describe, it, expect } from "vitest";
import { libelleCompetenceAvecChoix } from "./libelleCompetenceAvecChoix";

describe("libelleCompetenceAvecChoix — JUMEAU A (choix rempli / tableau vide)", () => {
  it("① positif : deux choix → verbatim littéral avec le séparateur « · »", () => {
    expect(
      libelleCompetenceAvecChoix("Décryptage", 1, ["L'Ancien Drow", "L'Ancien Elfique"]),
    ).toBe("Décryptage 1 · L'Ancien Drow, L'Ancien Elfique");
  });

  it("② négatif : tableau vide → pas de « · » orphelin", () => {
    const label = libelleCompetenceAvecChoix("Décryptage", 1, []);
    expect(label).toBe("Décryptage 1");
    expect(label).not.toContain("·");
  });
});

describe("libelleCompetenceAvecChoix — JUMEAU B (null / undefined)", () => {
  it("① choix = null → repli sans choix", () => {
    expect(libelleCompetenceAvecChoix("Décryptage", 1, null)).toBe("Décryptage 1");
  });

  it("② choix = undefined → même repli", () => {
    expect(libelleCompetenceAvecChoix("Décryptage", 1, undefined)).toBe("Décryptage 1");
  });
});

describe("libelleCompetenceAvecChoix — JUMEAU C (6 choix / 1 seul choix)", () => {
  it("① 6 choix → les 6 sont présents, séparés par « , »", () => {
    const choix = ["A", "B", "C", "D", "E", "F"];
    const label = libelleCompetenceAvecChoix("Décryptage", 1, choix);
    expect(label).toBe("Décryptage 1 · A, B, C, D, E, F");
    choix.forEach((c) => expect(label).toContain(c));
  });

  it("② un seul choix → aucune virgule", () => {
    const label = libelleCompetenceAvecChoix("Décryptage", 1, ["L'Ancien Drow"]);
    expect(label).toBe("Décryptage 1 · L'Ancien Drow");
    expect(label).not.toContain(",");
  });
});

describe("libelleCompetenceAvecChoix — C101, pire cas (niveau null)", () => {
  it("niveau null, sans choix → pas d'espace en trop", () => {
    expect(libelleCompetenceAvecChoix("Décryptage", null, null)).toBe("Décryptage");
  });

  it("niveau null, avec choix → pas d'espace en trop avant le séparateur", () => {
    expect(libelleCompetenceAvecChoix("Décryptage", null, ["L'Ancien Drow"])).toBe(
      "Décryptage · L'Ancien Drow",
    );
  });
});
