/**
 * PARITÉ ENREGISTRÉE — TRAITS RACIAUX (18 cas).
 *
 * Rejoue pariteTraitsRaciaux.json contre peutAcheterTraitRacial (gate legacy).
 * Verdicts SANS champ `code`, fautes volontaires conservées. `toEqual` strict.
 */

import { describe, it, expect } from "vitest";
import { peutAcheterTraitRacial } from "./gatesTraits";
import type { ContexteTraitRacial, VerdictTraitRacial } from "./types";
import traitsFx from "./fixtures/pariteTraitsRaciaux.json";

interface FixtureContexte {
  ref: number;
  race_id: string | null;
  xp_dispo: number;
  traits_raciaux_choisis: Array<{ trait_id?: string; [k: string]: unknown }>;
}
interface FixtureCas {
  ctx: number;
  demande: {
    trait_id: string;
    trait_nom: string;
    race_id: string | null;
    sous_type: string | null;
  };
  verdict: Record<string, unknown>;
}
interface FixturesFile {
  nb_cas: number;
  nb_contextes: number;
  contextes: FixtureContexte[];
  cas: FixtureCas[];
}

const data = traitsFx as unknown as FixturesFile;

function toContexte(ctx: FixtureContexte): ContexteTraitRacial {
  return {
    xpDispo: ctx.xp_dispo,
    traitsRaciauxChoisis: ctx.traits_raciaux_choisis,
  };
}

function verdictSnake(c: VerdictTraitRacial): Record<string, unknown> {
  const v: Record<string, unknown> = {
    peut_acheter: c.peutAcheter,
    raison: c.raison,
  };
  if (c.coutXp !== undefined) v.cout_xp = c.coutXp;
  if (c.estGratuit !== undefined) v.est_gratuit = c.estGratuit;
  if (c.nbTraitsActuels !== undefined) v.nb_traits_actuels = c.nbTraitsActuels;
  return v;
}

describe("parité enregistrée peut_acheter_trait_racial (18 cas)", () => {
  const ctxParRef = new Map<number, FixtureContexte>(
    data.contextes.map((c) => [c.ref, c])
  );

  it("fixtures cohérentes", () => {
    expect(data.cas.length).toBe(data.nb_cas);
    expect(data.cas.length).toBe(21);
    expect(data.contextes.length).toBe(data.nb_contextes);
  });

  data.cas.forEach((cas, i) => {
    const label = `#${i + 1} ctx${cas.ctx} « ${cas.demande.trait_nom} » sous_type=${cas.demande.sous_type}`;
    it(label, () => {
      const fx = ctxParRef.get(cas.ctx);
      expect(fx, `contexte ref ${cas.ctx} introuvable`).toBeDefined();
      const client = peutAcheterTraitRacial(toContexte(fx!), {
        traitId: cas.demande.trait_id,
        raceId: cas.demande.race_id,
        sousType: cas.demande.sous_type,
      });
      const snake = verdictSnake(client);
      const dump = JSON.stringify(
        { demande: cas.demande, client: snake, serveur: cas.verdict },
        null,
        2
      );
      expect(snake, dump).toEqual(cas.verdict);
    });
  });
});
