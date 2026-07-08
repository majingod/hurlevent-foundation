/**
 * Régression BUG s313 : à l'étape 2 (Race + Traits), le total XP affiché
 * omettait les XP déclarés à l'étape 1 (GN, mini-GN, ouvertures). Exemple
 * vécu : 1 GN + 1 mini + 3 ouvertures = 60 XP déclarés, race Humain
 * (xp_depart = 80). Total correct = 80 + 60 = 140, mais l'étape 2 affichait
 * 80 — l'ancienne formule `xp_depart − xp_total` retranchait à tort les 60
 * XP déclarés (ADDITIFS à xp_depart, pas redondants).
 *
 * `gainDepartProjete` est la fonction réellement utilisée par le JSX de
 * `Etape2_V2` pour calculer `gainProjete`.
 */

import { describe, it, expect } from "vitest";
import { gainDepartProjete } from "./Etape2_V2.calc";

describe("BUG s313 — étape 2 : XP déclarés à l'étape 1 ne disparaissent plus", () => {
  it("création (race_id null, xp_total 60, Humain xp_depart 80) → gain 80 (départ complet, XP déclarés préservés)", () => {
    expect(gainDepartProjete(false, 80, 60)).toBe(80);
  });

  it("création sans XP déclarés (xp_total 0, xp_depart 60) → gain 60", () => {
    expect(gainDepartProjete(false, 60, 0)).toBe(60);
  });

  it("admin même race (race_id set, xp_total 200, xp_depart 80) → gain 0 (inchangé)", () => {
    expect(gainDepartProjete(true, 80, 200)).toBe(0);
  });

  it("ancien comportement admin préservé (race_id set, xp_total 60, xp_depart 80) → gain 20", () => {
    expect(gainDepartProjete(true, 80, 60)).toBe(20);
  });
});
