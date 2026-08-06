/**
 * s379 (prompt CC_SONNET, fenêtre « accès magiques dormants », D51) — logique
 * pure de la fenêtre de confirmation à la finalisation. Cf. §5 du prompt.
 */

import { describe, it, expect } from "vitest";
import {
  doitOuvrirFenetreAccesDormants,
  totalXpDormant,
  decisionApresDryRun,
} from "./Etape10_Recapitulatif_V2.accesDormants";

describe("doitOuvrirFenetreAccesDormants — §5.1 (porte de la fenêtre)", () => {
  it("liste vide → n'ouvre pas", () => {
    expect(doitOuvrirFenetreAccesDormants([])).toBe(false);
    expect(doitOuvrirFenetreAccesDormants(undefined)).toBe(false);
  });

  it("au moins un avertissement → ouvre", () => {
    expect(
      doitOuvrirFenetreAccesDormants([{ code: "info_cercle_sans_sort" }]),
    ).toBe(true);
  });
});

describe("totalXpDormant — §5.2", () => {
  it("3 avertissements à 15 XP chacun → 45", () => {
    expect(
      totalXpDormant([{ xp: 15 }, { xp: 15 }, { xp: 15 }]),
    ).toBe(45);
  });

  it("un avertissement sans xp compte 0 et n'écrase pas le total", () => {
    expect(
      totalXpDormant([{ xp: 15 }, { code: "info_aucune_competence_payante" }, { xp: 15 }]),
    ).toBe(30);
  });
});

describe("decisionApresDryRun — §5.4 (erreur bloquante ⇒ pas de fenêtre)", () => {
  it("valide === false → action erreur, même avec des avertissements", () => {
    const decision = decisionApresDryRun({
      valide: false,
      avertissements: [{ code: "info_cercle_sans_sort", xp: 15 }],
    });
    expect(decision.action).toBe("erreur");
  });

  it("valide === true avec avertissements → ouvre la fenêtre", () => {
    const decision = decisionApresDryRun({
      valide: true,
      avertissements: [{ code: "info_cercle_sans_sort", xp: 15 }],
    });
    expect(decision.action).toBe("ouvrir_fenetre");
  });

  it("valide === true sans avertissement → finalise directement (D51-c)", () => {
    const decision = decisionApresDryRun({ valide: true, avertissements: [] });
    expect(decision.action).toBe("finaliser");
  });
});
