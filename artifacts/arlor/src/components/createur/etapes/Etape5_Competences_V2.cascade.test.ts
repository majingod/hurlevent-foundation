/**
 * T3 (prompt s378, fenêtre cascade & miroir) : la fenêtre de confirmation de
 * désachat doit s'ouvrir dès que l'aperçu serveur signale de l'artisanat
 * (recettes/pièges/assemblages), même seul — pas seulement compétences/sorts/
 * prières. Avant le fix, `count_recettes`/`count_assemblages`/`count_pieges`
 * étaient ignorés : un désachat qui ne faisait tomber QUE de l'artisanat
 * supprimait direct, sans avertissement.
 */

import { describe, it, expect } from "vitest";
import { doitOuvrirModaleCascade } from "./Etape5_Competences_V2.cascade";

describe("doitOuvrirModaleCascade — T3 (porte de la fenêtre)", () => {
  it("rien à cascader (1 seul niveau, aucun sort/prière/artisanat) → pas de modale", () => {
    expect(doitOuvrirModaleCascade({ count_competences: 1 })).toBe(false);
  });

  it("plusieurs niveaux de compétence → modale", () => {
    expect(doitOuvrirModaleCascade({ count_competences: 2 })).toBe(true);
  });

  it("artisanat SEUL (recettes) → modale (régression du bug signalé par Fred)", () => {
    expect(
      doitOuvrirModaleCascade({ count_competences: 1, count_recettes: 2 }),
    ).toBe(true);
  });

  it("artisanat SEUL (pièges) → modale", () => {
    expect(
      doitOuvrirModaleCascade({ count_competences: 1, count_pieges: 1 }),
    ).toBe(true);
  });

  it("artisanat SEUL (assemblages) → modale", () => {
    expect(
      doitOuvrirModaleCascade({ count_competences: 1, count_assemblages: 1 }),
    ).toBe(true);
  });

  it("sort/prière seuls (comportement préexistant préservé) → modale", () => {
    expect(
      doitOuvrirModaleCascade({ count_competences: 1, count_sorts: 1 }),
    ).toBe(true);
    expect(
      doitOuvrirModaleCascade({ count_competences: 1, count_prieres: 1 }),
    ).toBe(true);
  });

  it("donnees vide (clés absentes) → pas de modale", () => {
    expect(doitOuvrirModaleCascade({})).toBe(false);
  });
});
