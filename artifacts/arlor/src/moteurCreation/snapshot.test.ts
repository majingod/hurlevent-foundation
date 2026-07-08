import { afterEach, describe, expect, it } from "vitest";

import { getCompetence, getSnapshot } from "./snapshot";

/**
 * Indirection snapshot (lot A1, s312) : la source du snapshot est
 * `globalThis.__SNAPSHOT_HORS_LIGNE__ ?? snapshot bundlé`. Le lot A5 injectera
 * l'override (« données fraîches ») dans le HTML autonome au téléchargement.
 */

const CLE = "__SNAPSHOT_HORS_LIGNE__";

type GlobalOverridable = typeof globalThis & { [CLE]?: unknown };

afterEach(() => {
  delete (globalThis as GlobalOverridable)[CLE];
});

describe("indirection snapshot hors-ligne", () => {
  it("sans override → snapshot bundlé (données réelles)", () => {
    const snap = getSnapshot();
    expect(snap.manifest.genere_le).toBeTruthy();
    expect(Array.isArray(snap.tables.competences)).toBe(true);
    expect(snap.tables.competences.length).toBeGreaterThan(0);
  });

  it("avec globalThis.__SNAPSHOT_HORS_LIGNE__ posé → override honoré", () => {
    const factice = {
      manifest: { genere_le: "2099-01-01T00:00:00+00:00", comptes: {} },
      tables: {
        competences: [{ id: "comp-factice", nom: "Compétence factice" }],
        langues: [],
        religions: [],
      },
    };
    (globalThis as GlobalOverridable)[CLE] = factice;

    expect(getSnapshot().manifest.genere_le).toBe("2099-01-01T00:00:00+00:00");
    expect(getSnapshot().tables.competences).toHaveLength(1);
    // Les getters lisent la même source active.
    expect(getCompetence("comp-factice")?.id).toBe("comp-factice");
  });

  it("après cleanup de l'override → retour au snapshot bundlé", () => {
    (globalThis as GlobalOverridable)[CLE] = {
      manifest: { genere_le: "x", comptes: {} },
      tables: { competences: [] },
    };
    delete (globalThis as GlobalOverridable)[CLE];

    expect(getSnapshot().tables.competences.length).toBeGreaterThan(0);
  });
});
