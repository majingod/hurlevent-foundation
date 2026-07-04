/**
 * PARITÉ ENREGISTRÉE — MAGIE (sorts + prières).
 *
 * Le moteur client doit reproduire AU CARACTÈRE PRÈS les verdicts de
 * public.peut_acheter_sort (59 cas) et public.peut_acheter_priere (33 cas)
 * capturés en prod sur de vrais personnages éditables (fixtures figées).
 *
 * Patron identique à parite.test.ts : contexte snake_case → ctx camelCase,
 * rejeu de chaque demande, mapping du verdict client → snake_case, puis
 * `toEqual(fixture.verdict)` STRICT (clés optionnelles comprises). Un écart =
 * échec avec dump — on ne retouche JAMAIS une fixture.
 */

import { describe, it, expect } from "vitest";
import { peutAcheterSort, peutAcheterPriere } from "./gatesMagie";
import type {
  ContexteMagie,
  VerdictSort,
  VerdictPriere,
} from "./types";
import sortsFx from "./fixtures/pariteSorts.json";
import prieresFx from "./fixtures/paritePrieres.json";

interface FixtureAcquis {
  competence_id: string;
  competence_nom: string;
  categorie: string | null;
  niveau_acquis: number;
  choix_achat: string | null;
}
interface FixtureContexte {
  ref: number;
  xp_dispo: number;
  religion_id?: string | null;
  competences_acquises: FixtureAcquis[];
}
interface FixtureCasSort {
  ctx: number;
  demande: {
    sort_id: string;
    sort_nom: string;
    niveau_sort: number;
    zone_choisie: string;
    portee_choisie: string;
    duree_choisie: string;
  };
  verdict: Record<string, unknown>;
}
interface FixtureCasPriere {
  ctx: number;
  demande: {
    priere_id: string;
    priere_nom: string;
    niveau_priere: number;
    zone_choisie: string;
    portee_choisie: string;
    duree_choisie: string;
  };
  verdict: Record<string, unknown>;
}
interface FixturesSorts {
  nb_cas: number;
  nb_contextes: number;
  contextes: FixtureContexte[];
  cas: FixtureCasSort[];
}
interface FixturesPrieres {
  nb_cas: number;
  nb_contextes: number;
  contextes: FixtureContexte[];
  cas: FixtureCasPriere[];
}

const sorts = sortsFx as unknown as FixturesSorts;
const prieres = prieresFx as unknown as FixturesPrieres;

function toContexte(ctx: FixtureContexte): ContexteMagie {
  return {
    xpDispo: ctx.xp_dispo,
    religionId: ctx.religion_id ?? null,
    competencesAcquises: ctx.competences_acquises.map((a) => ({
      competenceId: a.competence_id,
      competenceNom: a.competence_nom,
      categorie: a.categorie,
      niveauAcquis: a.niveau_acquis,
      choixAchat: a.choix_achat,
    })),
  };
}

function verdictSortSnake(c: VerdictSort): Record<string, unknown> {
  const v: Record<string, unknown> = {
    peut_acheter: c.peutAcheter,
    raison: c.raison,
  };
  if (c.code !== undefined) v.code = c.code;
  if (c.coutXp !== undefined) v.cout_xp = c.coutXp;
  if (c.formuleMagique !== undefined) v.formule_magique = c.formuleMagique;
  if (c.niveauMaxCercle !== undefined) v.niveau_max_cercle = c.niveauMaxCercle;
  return v;
}

function verdictPriereSnake(c: VerdictPriere): Record<string, unknown> {
  const v: Record<string, unknown> = {
    peut_acheter: c.peutAcheter,
    raison: c.raison,
  };
  if (c.code !== undefined) v.code = c.code;
  if (c.coutXp !== undefined) v.cout_xp = c.coutXp;
  if (c.dureeIncantationCalculee !== undefined)
    v.duree_incantation_calculee = c.dureeIncantationCalculee;
  if (c.niveauMaxDomaine !== undefined)
    v.niveau_max_domaine = c.niveauMaxDomaine;
  return v;
}

describe("parité enregistrée peut_acheter_sort (59 cas)", () => {
  const ctxParRef = new Map<number, FixtureContexte>(
    sorts.contextes.map((c) => [c.ref, c])
  );

  it("fixtures cohérentes", () => {
    expect(sorts.cas.length).toBe(sorts.nb_cas);
    expect(sorts.cas.length).toBe(59);
    expect(sorts.contextes.length).toBe(sorts.nb_contextes);
  });

  sorts.cas.forEach((cas, i) => {
    const label = `#${i + 1} ctx${cas.ctx} « ${cas.demande.sort_nom} » niv ${cas.demande.niveau_sort}`;
    it(label, () => {
      const fx = ctxParRef.get(cas.ctx);
      expect(fx, `contexte ref ${cas.ctx} introuvable`).toBeDefined();
      const client = peutAcheterSort(toContexte(fx!), {
        sortId: cas.demande.sort_id,
        niveauSort: cas.demande.niveau_sort,
        zoneChoisie: cas.demande.zone_choisie,
        porteeChoisie: cas.demande.portee_choisie,
        dureeChoisie: cas.demande.duree_choisie,
      });
      const snake = verdictSortSnake(client);
      const dump = JSON.stringify(
        { demande: cas.demande, client: snake, serveur: cas.verdict },
        null,
        2
      );
      expect(snake, dump).toEqual(cas.verdict);
    });
  });
});

describe("parité enregistrée peut_acheter_priere (33 cas)", () => {
  const ctxParRef = new Map<number, FixtureContexte>(
    prieres.contextes.map((c) => [c.ref, c])
  );

  it("fixtures cohérentes", () => {
    expect(prieres.cas.length).toBe(prieres.nb_cas);
    expect(prieres.cas.length).toBe(33);
    expect(prieres.contextes.length).toBe(prieres.nb_contextes);
  });

  prieres.cas.forEach((cas, i) => {
    const label = `#${i + 1} ctx${cas.ctx} « ${cas.demande.priere_nom} » niv ${cas.demande.niveau_priere}`;
    it(label, () => {
      const fx = ctxParRef.get(cas.ctx);
      expect(fx, `contexte ref ${cas.ctx} introuvable`).toBeDefined();
      const client = peutAcheterPriere(toContexte(fx!), {
        priereId: cas.demande.priere_id,
        niveauPriere: cas.demande.niveau_priere,
        zoneChoisie: cas.demande.zone_choisie,
        porteeChoisie: cas.demande.portee_choisie,
        dureeChoisie: cas.demande.duree_choisie,
      });
      const snake = verdictPriereSnake(client);
      const dump = JSON.stringify(
        { demande: cas.demande, client: snake, serveur: cas.verdict },
        null,
        2
      );
      expect(snake, dump).toEqual(cas.verdict);
    });
  });
});
