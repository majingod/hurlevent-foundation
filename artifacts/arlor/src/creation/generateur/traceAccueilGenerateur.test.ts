/**
 * [s394] Tests de `preparerTraceAccueil` et `evenementDePorte` — chaque garde
 * négative a son jumeau positif (le cas nominal), sinon un `null` permanent
 * serait vert aussi (assertion vraie à vide).
 */

import { describe, expect, it } from "vitest";

import {
  evenementDePorte,
  preparerTraceAccueil,
} from "./traceAccueilGenerateur";

describe("preparerTraceAccueil", () => {
  it("ne trace pas en mode visiteur (aucune base derrière)", () => {
    expect(
      preparerTraceAccueil({
        modeVisiteur: true,
        personnageId: "p1",
        evenement: "portes_vues",
      }),
    ).toBeNull();
  });

  it("ne trace pas sans personnageId (rien à rattacher)", () => {
    expect(
      preparerTraceAccueil({
        modeVisiteur: false,
        personnageId: null,
        evenement: "portes_vues",
      }),
    ).toBeNull();
  });

  it("cas nominal : construit les arguments EXACTS de la RPC (jumeau positif des 2 gardes)", () => {
    expect(
      preparerTraceAccueil({
        modeVisiteur: false,
        personnageId: "p1",
        evenement: "porte_tirage",
      }),
    ).toEqual({
      p_personnage_id: "p1",
      p_evenement: "porte_tirage",
    });
  });
});

describe("evenementDePorte", () => {
  it("batir → porte_batir", () => {
    expect(evenementDePorte("batir")).toBe("porte_batir");
  });

  it("guide → porte_guide", () => {
    expect(evenementDePorte("guide")).toBe("porte_guide");
  });

  it("tirage → porte_tirage", () => {
    expect(evenementDePorte("tirage")).toBe("porte_tirage");
  });
});
