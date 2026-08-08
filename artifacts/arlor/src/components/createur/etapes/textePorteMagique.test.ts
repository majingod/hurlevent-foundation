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
 *
 * s383 (D54, suite) — `texteIndisponibleSorts`/`texteIndisponiblePrieres`
 * envoyaient le joueur dans un cul-de-sac : elles nommaient la compétence
 * retirée de la liste d'achat (« Acquisition de Sort »/« de Prière ») au lieu
 * du Cercle/Domaine réellement achetable à l'étape 5. Les deux `toBe` verbatim
 * ci-dessous ont d'abord été mesurés rouges contre le NOUVEAU texte (preuve
 * par le contraire mécanique, cf. rapport de PR) avant d'être mis à jour.
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
      "Pour acquérir des sorts, ce personnage doit d'abord acheter un Cercle à l'étape 5 (compétence « Acquisition de Cercle »). L'accès s'ouvre en même temps.",
    );
  });

  it("l'ancienne phrase (« Acquisition de Sort ») a disparu, ET le chemin vers l'étape 5 est bien là (jumelle positive, C101)", () => {
    const texte = texteIndisponibleSorts();
    expect(texte).not.toContain("Acquisition de Sort");
    expect(texte).toContain("Acquisition de Cercle");
    expect(texte).toContain("étape 5");
  });
});

describe("texteIndisponiblePrieres — Étape 7, cartouche d'indisponibilité", () => {
  it("verbatim littéral", () => {
    expect(texteIndisponiblePrieres()).toBe(
      "Pour acquérir des prières, ce personnage doit d'abord acheter un Domaine à l'étape 5 (compétence « Acquisition de Domaine »). L'accès s'ouvre en même temps.",
    );
  });

  it("l'ancienne phrase (« Acquisition de Prière ») a disparu, ET le chemin vers l'étape 5 est bien là (jumelle positive, C101)", () => {
    const texte = texteIndisponiblePrieres();
    expect(texte).not.toContain("Acquisition de Prière");
    expect(texte).toContain("Acquisition de Domaine");
    expect(texte).toContain("étape 5");
  });
});

describe("sentinelle anti-contradiction (s383) — le nom mesuré doit être le nom cité", () => {
  it("aucun des deux cartouches ne nomme la compétence retirée de la liste d'achat aux côtés du geste qu'il décrit", () => {
    const sorts = texteIndisponibleSorts();
    const prieres = texteIndisponiblePrieres();
    // La faute réparée : dire « Cercle » (le geste) ET « Acquisition de
    // Sort » (la case retirée de l'étape 5) dans la même phrase — le joueur
    // cherche une compétence qui n'est plus dans la liste.
    expect(sorts.includes("Cercle") && sorts.includes("Acquisition de Sort")).toBe(false);
    expect(
      prieres.includes("Domaine") && prieres.includes("Acquisition de Prière"),
    ).toBe(false);
  });
});
