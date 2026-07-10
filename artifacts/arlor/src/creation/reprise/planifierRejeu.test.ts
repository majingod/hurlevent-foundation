/**
 * [VIS-6] Lot 2 — tests dédiés du PLAN pur `planifierRejeu`.
 *
 * Le plan est la SOURCE UNIQUE de l'ordre de rejeu : `rejouerBrouillon` le
 * consomme tel quel (prouvé par les tests Lot 1, inchangés et verts). Ici on
 * vérifie l'ordre topologique produit sur les MÊMES fixtures que le Lot 1 :
 * pré-rejeu des sorts/prières éligibles avant chaque palier d'Acquisition
 * niv 2/3, restants après compétences, artisanat en fin (recettes → assemblages
 * → pièges), et l'invariance des compétences non-Acquisition.
 */

import { describe, it, expect } from "vitest";
import {
  planifierRejeu,
  type ActionRejeu,
  type CatalogueRejeu,
} from "./rejouerBrouillon";
import {
  creerBrouillonVide,
  type BrouillonVisiteur,
} from "@/moteurCreation/brouillon/types";

// ── Fixtures (reprises du test Lot 1) ──
function catalogueFactice(opts: {
  typeChoix?: Record<string, "cercle" | "domaine" | null>;
  cercle?: Record<string, string>;
  domaine?: Record<string, string>;
}): CatalogueRejeu {
  return {
    typeChoixCompetence: (id) => opts.typeChoix?.[id] ?? null,
    cercleDuSort: (id) => opts.cercle?.[id] ?? null,
    domaineDeLaPriere: (id) => opts.domaine?.[id] ?? null,
  };
}

let compteurInstance = 0;
const nextId = (prefixe: string) => `${prefixe}-${++compteurInstance}`;

function brouillonBase(): BrouillonVisiteur {
  const b = creerBrouillonVide();
  b.etape1 = { ...b.etape1, nom: "Aldric" };
  b.etape2 = { raceId: "race-humain", sousTypeChimeride: null };
  b.etape4 = { classeId: "classe-mage", choixParCompetence: { comp: "x" } };
  return b;
}
function comp(competenceId: string, niveauAcquis: number, choixAchat: string | null) {
  return { instanceId: nextId("comp"), competenceId, niveauAcquis, choixAchat };
}
function sort(sortId: string, niveauSort: number) {
  return {
    instanceId: nextId("sort"),
    sortId,
    niveauSort,
    zoneChoisie: "Personnelle",
    porteeChoisie: "Toucher",
    dureeChoisie: "Instantanée",
  };
}
function priere(priereId: string, niveauPriere: number) {
  return {
    instanceId: nextId("priere"),
    priereId,
    niveauPriere,
    zoneChoisie: "Personnelle",
    porteeChoisie: "Toucher",
    dureeChoisie: "Instantanée",
  };
}

/** Séquence lisible : `type` + id d'instance (les étapes n'en ont pas). */
function sequence(plan: ActionRejeu[]): string[] {
  return plan.map((a) => ("instanceId" in a ? `${a.type}:${a.instanceId}` : a.type));
}

// ── Les 4 étapes ouvrent TOUJOURS le plan, dans l'ordre ──
describe("planifierRejeu — squelette", () => {
  it("commence par etape1→4 même sur un brouillon sans acquisition", () => {
    const plan = planifierRejeu(brouillonBase(), catalogueFactice({}));
    expect(sequence(plan)).toEqual(["etape1", "etape2", "etape3", "etape4"]);
  });
});

// ── Ordre topologique cercle (miroir du test Lot 1 §1) ──
describe("planifierRejeu — ordre topologique cercle", () => {
  it("Acq(cercle Feu) niv 1,2,3 + sorts Feu niv 1,1,2 → pré-rejeu par palier", () => {
    const b = brouillonBase();
    const acq1 = comp("acq-cercle", 1, "Feu");
    const acq2 = comp("acq-cercle", 2, "Feu");
    const acq3 = comp("acq-cercle", 3, "Feu");
    const s1a = sort("sort-feu-a", 1);
    const s1b = sort("sort-feu-b", 1);
    const s2 = sort("sort-feu-c", 2);
    b.acquisitions.competences = [acq1, acq2, acq3];
    b.acquisitions.sorts = [s1a, s1b, s2];

    const plan = planifierRejeu(
      b,
      catalogueFactice({
        typeChoix: { "acq-cercle": "cercle" },
        cercle: { "sort-feu-a": "Feu", "sort-feu-b": "Feu", "sort-feu-c": "Feu" },
      }),
    );
    expect(sequence(plan)).toEqual([
      "etape1",
      "etape2",
      "etape3",
      "etape4",
      `competence:${acq1.instanceId}`, // Acq1 (niv1, pas de pré-rejeu)
      `sort:${s1a.instanceId}`, // pré-rejeu avant Acq2 (niv ≤ 1)
      `sort:${s1b.instanceId}`,
      `competence:${acq2.instanceId}`, // Acq2
      `sort:${s2.instanceId}`, // pré-rejeu avant Acq3 (niv ≤ 2)
      `competence:${acq3.instanceId}`, // Acq3
    ]);
  });
});

// ── Ordre topologique domaine (miroir du test Lot 1 §2) ──
describe("planifierRejeu — ordre topologique domaine", () => {
  it("Acq(domaine Chaos) niv 1,2,3 + prières Chaos niv 1,1,2 → symétrique", () => {
    const b = brouillonBase();
    const acq1 = comp("acq-domaine", 1, "Chaos");
    const acq2 = comp("acq-domaine", 2, "Chaos");
    const acq3 = comp("acq-domaine", 3, "Chaos");
    const pa = priere("pri-a", 1);
    const pb = priere("pri-b", 1);
    const pc = priere("pri-c", 2);
    b.acquisitions.competences = [acq1, acq2, acq3];
    b.acquisitions.prieres = [pa, pb, pc];

    const plan = planifierRejeu(
      b,
      catalogueFactice({
        typeChoix: { "acq-domaine": "domaine" },
        domaine: { "pri-a": "Chaos", "pri-b": "Chaos", "pri-c": "Chaos" },
      }),
    );
    expect(sequence(plan).slice(4)).toEqual([
      `competence:${acq1.instanceId}`,
      `priere:${pa.instanceId}`,
      `priere:${pb.instanceId}`,
      `competence:${acq2.instanceId}`,
      `priere:${pc.instanceId}`,
      `competence:${acq3.instanceId}`,
    ]);
  });
});

// ── Compétences non-Acquisition : ordre du brouillon inchangé (Lot 1 §3) ──
describe("planifierRejeu — compétences non-Acquisition", () => {
  it("restent dans l'ordre du brouillon, le sort ne remonte pas", () => {
    const b = brouillonBase();
    const cA = comp("comp-a", 1, null);
    const cB = comp("comp-b", 2, null);
    const cC = comp("comp-c", 3, "quelconque"); // niv 3 mais type_choix null → pas de pré-rejeu
    const sx = sort("sort-x", 1);
    b.acquisitions.competences = [cA, cB, cC];
    b.acquisitions.sorts = [sx];

    const plan = planifierRejeu(b, catalogueFactice({ typeChoix: {}, cercle: { "sort-x": "Feu" } }));
    expect(sequence(plan).slice(4)).toEqual([
      `competence:${cA.instanceId}`,
      `competence:${cB.instanceId}`,
      `competence:${cC.instanceId}`,
      `sort:${sx.instanceId}`,
    ]);
  });
});

// ── Sort de niveau = palier max tombe dans les restants (Lot 1 §4) ──
describe("planifierRejeu — restants après compétences", () => {
  it("un sort de niveau = palier max n'est pas pré-rejoué, il passe en restant", () => {
    const b = brouillonBase();
    const acq = comp("acq-cercle", 2, "Feu"); // seuil pré-rejeu = niv ≤ 1
    const s2 = sort("sort-feu-2", 2); // niv 2 → pas éligible → restant
    b.acquisitions.competences = [acq];
    b.acquisitions.sorts = [s2];

    const plan = planifierRejeu(
      b,
      catalogueFactice({ typeChoix: { "acq-cercle": "cercle" }, cercle: { "sort-feu-2": "Feu" } }),
    );
    expect(sequence(plan).slice(4)).toEqual([
      `competence:${acq.instanceId}`,
      `sort:${s2.instanceId}`,
    ]);
  });
});

// ── Artisanat : recettes → assemblages → pièges, en fin de plan (Lot 1 §10) ──
describe("planifierRejeu — ordre artisanat", () => {
  it("recettes puis assemblages puis pièges, après toutes les compétences", () => {
    const b = brouillonBase();
    const cA = comp("comp-a", 1, null);
    b.acquisitions.competences = [cA];
    b.acquisitions.recettes = [
      { instanceId: "r1", recetteId: "rec-1" },
      { instanceId: "r2", recetteId: "rec-2" },
    ];
    b.acquisitions.assemblages = [{ instanceId: "a1", assemblageId: "asm-1" }];
    b.acquisitions.pieges = [
      { instanceId: "pg1", piegeId: "piege-1" },
      { instanceId: "pg2", piegeId: "piege-2" },
    ];

    const plan = planifierRejeu(b, catalogueFactice({}));
    expect(sequence(plan).slice(4)).toEqual([
      `competence:${cA.instanceId}`,
      "recette:r1",
      "recette:r2",
      "assemblage:a1",
      "piege:pg1",
      "piege:pg2",
    ]);
  });
});
