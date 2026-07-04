/**
 * Garde anti-stub (leçon P1-a) sur les 6 fixtures de parité P1-c.
 *
 * On NE teste PAS ici la logique des gates (voir parite*.test.ts) mais l'intégrité
 * STRUCTURELLE des JSON capturés en prod : cohérence des compteurs, planchers de
 * volume (un stub vide passerait sinon les tests de parité en 0 cas), intégrité
 * référentielle ctx→contexte, et forme uuid des identifiants de demande.
 */

import { describe, it, expect } from "vitest";
import sorts from "./fixtures/pariteSorts.json";
import prieres from "./fixtures/paritePrieres.json";
import traits from "./fixtures/pariteTraitsRaciaux.json";
import pieges from "./fixtures/paritePieges.json";
import recettes from "./fixtures/pariteRecettes.json";
import assemblages from "./fixtures/pariteAssemblages.json";

interface FixtureFile {
  type: string;
  nb_cas: number;
  nb_contextes: number;
  contextes: Array<{ ref: number }>;
  cas: Array<{ ctx: number; demande: Record<string, unknown> }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONFIGS: Array<{
  nom: string;
  data: FixtureFile;
  type: string;
  planchreCas: number;
  idField: string;
}> = [
  { nom: "sorts", data: sorts as unknown as FixtureFile, type: "sorts", planchreCas: 50, idField: "sort_id" },
  { nom: "prieres", data: prieres as unknown as FixtureFile, type: "prieres", planchreCas: 30, idField: "priere_id" },
  { nom: "traits_raciaux", data: traits as unknown as FixtureFile, type: "traits_raciaux", planchreCas: 15, idField: "trait_id" },
  { nom: "pieges", data: pieges as unknown as FixtureFile, type: "pieges", planchreCas: 6, idField: "piege_id" },
  { nom: "recettes", data: recettes as unknown as FixtureFile, type: "recettes", planchreCas: 10, idField: "recette_id" },
  { nom: "assemblages", data: assemblages as unknown as FixtureFile, type: "assemblages", planchreCas: 8, idField: "assemblage_id" },
];

describe("intégrité des fixtures de parité P1-c", () => {
  for (const cfg of CONFIGS) {
    describe(cfg.nom, () => {
      const { data } = cfg;

      it(`type === "${cfg.type}"`, () => {
        expect(data.type).toBe(cfg.type);
      });

      it("nb_cas === cas.length", () => {
        expect(data.cas.length).toBe(data.nb_cas);
      });

      it("nb_contextes === contextes.length", () => {
        expect(data.contextes.length).toBe(data.nb_contextes);
      });

      it(`plancher : ≥ ${cfg.planchreCas} cas et ≥ 2 contextes`, () => {
        expect(data.cas.length).toBeGreaterThanOrEqual(cfg.planchreCas);
        expect(data.contextes.length).toBeGreaterThanOrEqual(2);
      });

      it("chaque cas.ctx référence un contexte existant", () => {
        const refs = new Set(data.contextes.map((c) => c.ref));
        for (const cas of data.cas) {
          expect(refs.has(cas.ctx), `ctx ${cas.ctx} introuvable`).toBe(true);
        }
      });

      it("chaque id de demande est un uuid", () => {
        for (const cas of data.cas) {
          const id = cas.demande[cfg.idField];
          expect(typeof id, `id manquant (${cfg.idField})`).toBe("string");
          expect(UUID_RE.test(id as string), `uuid invalide : ${String(id)}`).toBe(
            true
          );
        }
      });
    });
  }
});
