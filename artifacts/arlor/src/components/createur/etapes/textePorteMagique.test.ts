/**
 * D54 (s382) — texte joueur (assertion 4/5 du prompt) : `toBe` sur la chaîne
 * ENTIÈRE, comparée au verbatim littéral écrit ici — jamais contre la
 * constante elle-même (sinon la phrase dérive en silence, cf. C101).
 *
 * Preuve par le contraire (assertion 5) : en retirant l'appel à
 * `texteAstucePorteMagique`/`texteIndisponibleSorts`/`texteIndisponiblePrieres`
 * dans les composants pour revenir aux anciens littéraux « Achetez
 * « Acquisition de Sort »… », ces tests rougissent (vérifié manuellement,
 * cf. rapport de PR) — la nouvelle phrase n'existe alors nulle part.
 */

import { describe, it, expect } from "vitest";
import {
  texteAstucePorteMagique,
  texteIndisponibleSorts,
  texteIndisponiblePrieres,
} from "./textePorteMagique";

describe("texteAstucePorteMagique — Étape 5, astuce de catégorie", () => {
  it("mage → verbatim littéral", () => {
    expect(texteAstucePorteMagique("mage")).toBe(
      "Achetez un Cercle pour créer vos sorts à l'étape 6.",
    );
  });

  it("pretre → verbatim littéral", () => {
    expect(texteAstucePorteMagique("pretre")).toBe(
      "Achetez un Domaine pour créer vos prières à l'étape 7.",
    );
  });

  it("l'ancienne phrase « Achetez « Acquisition de Sort » » a disparu, ET la nouvelle est bien là (jumelle positive, C101)", () => {
    const mage = texteAstucePorteMagique("mage");
    const pretre = texteAstucePorteMagique("pretre");
    expect(mage).not.toContain("Acquisition de Sort");
    expect(pretre).not.toContain("Acquisition de Prière");
    expect(mage).toContain("Cercle");
    expect(pretre).toContain("Domaine");
  });
});

describe("texteIndisponibleSorts — Étape 6, cartouche d'indisponibilité", () => {
  it("verbatim littéral", () => {
    expect(texteIndisponibleSorts()).toBe(
      "Pour acquérir des sorts, ce personnage doit posséder un Cercle (compétence « Acquisition de Sort » au niveau 1 minimum).",
    );
  });
});

describe("texteIndisponiblePrieres — Étape 7, cartouche d'indisponibilité", () => {
  it("verbatim littéral", () => {
    expect(texteIndisponiblePrieres()).toBe(
      "Pour acquérir des prières, ce personnage doit posséder un Domaine (compétence « Acquisition de Prière » au niveau 1 minimum).",
    );
  });
});
