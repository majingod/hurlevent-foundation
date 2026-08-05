/**
 * [VIS-8 s376] Tests de `preparerTraceGeneration` — la règle « quand trace-t-on
 * une génération ? », attestée sur ses DEUX faces : chaque garde négative a son
 * jumeau positif (le cas nominal du test 4), sinon un `null` permanent serait
 * vert aussi (assertion vraie à vide).
 */

import { describe, expect, it } from "vitest";

import type { TiragePersonnage } from "@/moteurCreation/generateur/resoudre";
import type { CompositionOk } from "@/moteurCreation/generateur/types";

import type { ResultatApplication } from "./appliquerComposition";
import { preparerTraceGeneration } from "./traceGeneration";

const tirage = { rolePrincipal: "test" } as unknown as TiragePersonnage;
const composition = { achats: [] } as unknown as CompositionOk;

const resComplet: ResultatApplication = {
  personnageId: "p1",
  statut: "complet",
  faits: [{ type: "etape1" }, { type: "etape4" }, { type: "competence" }],
  echecs: [],
  etapeApresAvancement: 10,
};

const base = {
  modeVisiteur: false,
  personnageId: "p1",
  mode: "de" as const,
  resultat: { tirage, composition },
  res: resComplet,
};

describe("preparerTraceGeneration", () => {
  it("ne trace pas en mode visiteur (aucune base derrière)", () => {
    expect(preparerTraceGeneration({ ...base, modeVisiteur: true })).toBeNull();
  });

  it("ne trace pas un tirage refusé (refuse_non_vierge : rien d'écrit)", () => {
    expect(
      preparerTraceGeneration({
        ...base,
        res: { ...resComplet, statut: "refuse_non_vierge", faits: [] },
      }),
    ).toBeNull();
  });

  it("ne trace pas quand l'étape 4 n'est pas passée (le joueur va réessayer)", () => {
    expect(
      preparerTraceGeneration({
        ...base,
        res: {
          ...resComplet,
          statut: "partiel",
          faits: [{ type: "etape1" }, { type: "etape2" }],
        },
      }),
    ).toBeNull();
  });

  it("cas nominal : construit les arguments EXACTS de la RPC (jumeau positif des 3 gardes)", () => {
    expect(preparerTraceGeneration(base)).toEqual({
      p_personnage_id: "p1",
      p_mode: "de",
      p_statut: "complet",
      p_etape_apres: 10,
      p_nb_echecs: 0,
      p_composition: { tirage, composition },
    });
  });

  it("un partiel APRÈS l'étape 4 se trace AVEC son diagnostic (statut, étape, échecs)", () => {
    const args = preparerTraceGeneration({
      ...base,
      mode: "boussole",
      res: {
        ...resComplet,
        statut: "partiel",
        etapeApresAvancement: 7,
        echecs: [
          { type: "competence", code: "xp_insuffisant", message: "XP insuffisant." },
          { type: "sort", code: "prerequis", message: "Prérequis manquant." },
        ],
      },
    });
    expect(args?.p_mode).toBe("boussole");
    expect(args?.p_statut).toBe("partiel");
    expect(args?.p_etape_apres).toBe(7);
    expect(args?.p_nb_echecs).toBe(2);
  });
});
