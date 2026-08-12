/**
 * s395-bis (C101) — `composerGabarit` compose le coût de réparation forge
 * (« 15 min · 3 pépites métal + 3 pépites fer ») affiché par le champ
 * « Réparation » de l'Encyclopédie, au lieu du seul nom_affichage.
 *
 * Le cas POSITIF est comparé au verbatim littéral écrit ici, jamais en
 * réutilisant la constante testée, pour que la phrase ne puisse pas dériver
 * en silence sans faire rougir le test.
 */

import { describe, it, expect } from "vitest";
import { composerGabarit } from "./FicheMoteur2";

describe("composerGabarit", () => {
  it("POSITIF — compose le gabarit avec les colonnes de la ligne", () => {
    const rendu = composerGabarit("{temps_minutes} min · {materiaux}", {
      temps_minutes: 15,
      materiaux: "3 pépites métal + 3 pépites fer",
    });
    expect(rendu).toBe("15 min · 3 pépites métal + 3 pépites fer");
  });

  it("JUMEAU / non-régression — une colonne citée null rend null (pas de ligne « Rare »)", () => {
    const rendu = composerGabarit("{temps_rare_minutes} min · {materiaux_rares}", {
      temps_rare_minutes: null,
      materiaux_rares: "x",
    });
    expect(rendu).toBeNull();
  });

  it("TÉMOIN — une colonne absente de la ligne rend null, jamais la chaîne \"undefined\"", () => {
    const rendu = composerGabarit("{temps_minutes} min · {materiaux}", {
      temps_minutes: 15,
    });
    expect(rendu).toBeNull();
  });
});
