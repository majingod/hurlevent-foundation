import { describe, expect, it } from "vitest";
import { verdictSante } from "./sante-verdict.mjs";

const REPONSE_SAINE = {
  mesure_le: "2026-09-06T00:00:00Z",
  invariants: { xp: 0, pv: 0, ps: 0 },
  fixtures: { anon: 0, authenticated: 0, total: 3 },
  definer_anon: 0,
  c119_rouges: 0,
  erreurs_24h: 0,
  migrations: { n: 250, head: "20260906123557" },
};

describe("verdictSante — réponse saine", () => {
  it("aucun compte rouge → code 0", () => {
    expect(verdictSante(REPONSE_SAINE).code).toBe(0);
  });
});

describe("verdictSante — un compte rouge", () => {
  it("invariants.xp = 1 → code 1, et la sortie nomme invariants.xp", () => {
    const reponse = { ...REPONSE_SAINE, invariants: { ...REPONSE_SAINE.invariants, xp: 1 } };
    const verdict = verdictSante(reponse);
    expect(verdict.code).toBe(1);
    expect(verdict.motifs.some((m) => m.includes("invariants.xp"))).toBe(true);
  });
});

describe("verdictSante — champ manquant", () => {
  it("c119_rouges absent de la réponse → code 1 (jamais vert à vide)", () => {
    const { c119_rouges, ...reponse } = REPONSE_SAINE;
    expect(verdictSante(reponse).code).toBe(1);
  });
});

describe("verdictSante — information, jamais rouge", () => {
  it("erreurs_24h = 7 seul (rien d'autre en écart) → code 0", () => {
    const reponse = { ...REPONSE_SAINE, erreurs_24h: 7 };
    expect(verdictSante(reponse).code).toBe(0);
  });
});
