/**
 * Régression BUG s312-2 (test joueur réel s312, mode avion) : à l'étape 2
 * (Race + Traits), avec un trait racial payant sélectionné, la carte JaugeXP
 * affichait un reste FAUX (80) alors que le bandeau global affichait le reste
 * CORRECT (90) — double comptage du même delta traits (une fois via
 * `onXpDeltaChange` dans le `xpDisponible` global, une fois via
 * `coutEnCours.delta` dans la JaugeXP elle-même).
 *
 * `xpDisponibleJaugeEtape2` est la fonction réellement utilisée par le JSX de
 * `Etape2_V2` pour calculer la prop `xpDisponible` passée à `<JaugeXP />`.
 */

import { describe, it, expect } from "vitest";
import { xpDisponibleJaugeEtape2 } from "./Etape2_V2.calc";

describe("BUG s312-2 — JaugeXP étape 2 : fin du double comptage du delta traits", () => {
  it("état {xpTotal 100, xpDepense 0, delta traits 10} → valeur passée à JaugeXP = 100 (jamais 90)", () => {
    // xpDisponible du bandeau = xpTotal(100) − xpDepense(0) − xpDeltaCourant(10) = 90.
    const xpDisponibleBandeau = 90;
    const xpTraits = 10; // trait payant sélectionné en cours (achetes)
    const xpTraitsPersistes = 0; // rien encore persisté côté serveur

    const xpDisponibleJauge = xpDisponibleJaugeEtape2(
      xpDisponibleBandeau,
      xpTraits,
      xpTraitsPersistes,
    );

    // Avant fix : la JaugeXP recevait xpDisponibleBandeau (90) tel quel → une
    // 2e soustraction du delta (90 − 10 = 80) faussait l'affichage.
    expect(xpDisponibleJauge).toBe(100);
  });

  it("reste affiché par JaugeXP (xpDisponible − coutEnCours.delta) = 90, jamais 80", () => {
    const xpDisponibleBandeau = 90;
    const delta = 10;

    const xpDisponibleJauge = xpDisponibleJaugeEtape2(xpDisponibleBandeau, delta, 0);

    // Formule interne de JaugeXP (aide/JaugeXP.tsx, non modifiée par ce fix) :
    // reste = xpDisponible − coutEnCours.delta.
    const reste = xpDisponibleJauge - delta;

    expect(reste).toBe(90);
    expect(reste).toBe(xpDisponibleBandeau); // cohérent avec le bandeau global
    expect(reste).not.toBe(80);
  });

  it("aucun delta en cours (traits inchangés) → valeur passée à JaugeXP = xpDisponible du bandeau", () => {
    expect(xpDisponibleJaugeEtape2(90, 0, 0)).toBe(90);
    expect(xpDisponibleJaugeEtape2(90, 10, 10)).toBe(90); // delta déjà persisté = 0 net
  });
});
