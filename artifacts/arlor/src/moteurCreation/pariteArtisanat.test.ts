/**
 * PARITÉ ENREGISTRÉE — ARTISANAT (pièges 7 + recettes 13 + assemblages 10).
 *
 * Rejoue les 3 fixtures contre peutAcheterPiege / peutAcheterRecette /
 * peutAcheterAssemblage. `toEqual` strict (guillemets « », champ `champ` compris).
 */

import { describe, it, expect } from "vitest";
import {
  peutAcheterPiege,
  peutAcheterRecette,
  peutAcheterAssemblage,
} from "./gatesArtisanat";
import type {
  ContextePiege,
  ContexteRecette,
  ContexteAssemblage,
  VerdictArtisanat,
  AcquisCompetence,
} from "./types";
import piegesFx from "./fixtures/paritePieges.json";
import recettesFx from "./fixtures/pariteRecettes.json";
import assemblagesFx from "./fixtures/pariteAssemblages.json";

interface FixtureAcquis {
  competence_id: string;
  competence_nom: string;
  categorie: string | null;
  niveau_acquis: number;
  choix_achat: string | null;
}

function mapAcquis(acquis: FixtureAcquis[]): AcquisCompetence[] {
  return acquis.map((a) => ({
    competenceId: a.competence_id,
    competenceNom: a.competence_nom,
    categorie: a.categorie,
    niveauAcquis: a.niveau_acquis,
    choixAchat: a.choix_achat,
  }));
}

function verdictSnake(c: VerdictArtisanat): Record<string, unknown> {
  const v: Record<string, unknown> = {
    peut_acheter: c.peutAcheter,
    raison: c.raison,
  };
  if (c.code !== undefined) v.code = c.code;
  if (c.champ !== undefined) v.champ = c.champ;
  if (c.coutXp !== undefined) v.cout_xp = c.coutXp;
  if (c.estGratuit !== undefined) v.est_gratuit = c.estGratuit;
  return v;
}

// ------------------------------------------------------------
// Pièges
// ------------------------------------------------------------
interface FxPiegeContexte {
  ref: number;
  xp_dispo: number;
  competences_acquises: FixtureAcquis[];
  pieges_acquis: Array<{
    piege_nom: string;
    niveau_acquis: number;
    est_gratuit: boolean;
  }>;
}
interface FxPiegeCas {
  ctx: number;
  demande: { piege_id: string; piege_nom: string; niveau: number };
  verdict: Record<string, unknown>;
}
const pieges = piegesFx as unknown as {
  nb_cas: number;
  nb_contextes: number;
  contextes: FxPiegeContexte[];
  cas: FxPiegeCas[];
};

describe("parité enregistrée peut_acheter_piege (7 cas)", () => {
  const ctxParRef = new Map<number, FxPiegeContexte>(
    pieges.contextes.map((c) => [c.ref, c])
  );
  it("fixtures cohérentes", () => {
    expect(pieges.cas.length).toBe(pieges.nb_cas);
    expect(pieges.cas.length).toBe(7);
    expect(pieges.contextes.length).toBe(pieges.nb_contextes);
  });
  pieges.cas.forEach((cas, i) => {
    it(`#${i + 1} ctx${cas.ctx} « ${cas.demande.piege_nom} » niv ${cas.demande.niveau}`, () => {
      const fx = ctxParRef.get(cas.ctx);
      expect(fx, `contexte ref ${cas.ctx} introuvable`).toBeDefined();
      const ctx: ContextePiege = {
        xpDispo: fx!.xp_dispo,
        competencesAcquises: mapAcquis(fx!.competences_acquises),
        piegesAcquis: fx!.pieges_acquis.map((p) => ({
          piegeNom: p.piege_nom,
          niveauAcquis: p.niveau_acquis,
          estGratuit: p.est_gratuit,
        })),
      };
      const snake = verdictSnake(peutAcheterPiege(ctx, cas.demande.piege_id));
      const dump = JSON.stringify(
        { demande: cas.demande, client: snake, serveur: cas.verdict },
        null,
        2
      );
      expect(snake, dump).toEqual(cas.verdict);
    });
  });
});

// ------------------------------------------------------------
// Recettes
// ------------------------------------------------------------
interface FxRecetteContexte {
  ref: number;
  xp_dispo: number;
  competences_acquises: FixtureAcquis[];
  recettes_acquises: Array<{ recette_id: string; est_gratuit: boolean }>;
}
interface FxRecetteCas {
  ctx: number;
  demande: { recette_id: string; recette_nom: string; niveau_requis: number };
  verdict: Record<string, unknown>;
}
const recettes = recettesFx as unknown as {
  nb_cas: number;
  nb_contextes: number;
  contextes: FxRecetteContexte[];
  cas: FxRecetteCas[];
};

describe("parité enregistrée peut_acheter_recette (13 cas)", () => {
  const ctxParRef = new Map<number, FxRecetteContexte>(
    recettes.contextes.map((c) => [c.ref, c])
  );
  it("fixtures cohérentes", () => {
    expect(recettes.cas.length).toBe(recettes.nb_cas);
    expect(recettes.cas.length).toBe(13);
    expect(recettes.contextes.length).toBe(recettes.nb_contextes);
  });
  recettes.cas.forEach((cas, i) => {
    it(`#${i + 1} ctx${cas.ctx} « ${cas.demande.recette_nom} » palier ${cas.demande.niveau_requis}`, () => {
      const fx = ctxParRef.get(cas.ctx);
      expect(fx, `contexte ref ${cas.ctx} introuvable`).toBeDefined();
      const ctx: ContexteRecette = {
        xpDispo: fx!.xp_dispo,
        competencesAcquises: mapAcquis(fx!.competences_acquises),
        recettesAcquises: fx!.recettes_acquises.map((r) => ({
          recetteId: r.recette_id,
          estGratuit: r.est_gratuit,
        })),
      };
      const snake = verdictSnake(
        peutAcheterRecette(ctx, cas.demande.recette_id)
      );
      const dump = JSON.stringify(
        { demande: cas.demande, client: snake, serveur: cas.verdict },
        null,
        2
      );
      expect(snake, dump).toEqual(cas.verdict);
    });
  });
});

// ------------------------------------------------------------
// Assemblages
// ------------------------------------------------------------
interface FxAssContexte {
  ref: number;
  xp_dispo: number;
  competences_acquises: FixtureAcquis[];
  assemblages_acquis: Array<{ assemblage_id: string; est_gratuit: boolean }>;
}
interface FxAssCas {
  ctx: number;
  demande: { assemblage_id: string; assemblage_nom: string };
  verdict: Record<string, unknown>;
}
const assemblages = assemblagesFx as unknown as {
  nb_cas: number;
  nb_contextes: number;
  contextes: FxAssContexte[];
  cas: FxAssCas[];
};

describe("parité enregistrée peut_acheter_assemblage (10 cas)", () => {
  const ctxParRef = new Map<number, FxAssContexte>(
    assemblages.contextes.map((c) => [c.ref, c])
  );
  it("fixtures cohérentes", () => {
    expect(assemblages.cas.length).toBe(assemblages.nb_cas);
    expect(assemblages.cas.length).toBe(10);
    expect(assemblages.contextes.length).toBe(assemblages.nb_contextes);
  });
  assemblages.cas.forEach((cas, i) => {
    it(`#${i + 1} ctx${cas.ctx} « ${cas.demande.assemblage_nom} »`, () => {
      const fx = ctxParRef.get(cas.ctx);
      expect(fx, `contexte ref ${cas.ctx} introuvable`).toBeDefined();
      const ctx: ContexteAssemblage = {
        xpDispo: fx!.xp_dispo,
        competencesAcquises: mapAcquis(fx!.competences_acquises),
        assemblagesAcquis: fx!.assemblages_acquis.map((a) => ({
          assemblageId: a.assemblage_id,
          estGratuit: a.est_gratuit,
        })),
      };
      const snake = verdictSnake(
        peutAcheterAssemblage(ctx, cas.demande.assemblage_id)
      );
      const dump = JSON.stringify(
        { demande: cas.demande, client: snake, serveur: cas.verdict },
        null,
        2
      );
      expect(snake, dump).toEqual(cas.verdict);
    });
  });
});
