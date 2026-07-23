import { describe, expect, it } from "vitest";

import { CatalogueCompetences } from "./catalogue";
import { CatalogueMagie, type PriereModele, type SortModele } from "./catalogueMagie";
import {
  composerClasse,
  tirerEssentielsClasse,
  type Catalogues,
} from "./composer";
import { type ContenuClasse } from "./contenu/commun";
import { CONTENU_GUERRIER } from "./contenu/guerrier";
import { CONTENU_MAGE, ELEMENTS } from "./contenu/mage";
import { CONTENU_PRETRE } from "./contenu/pretre";
import { CONTENU_VOLEUR } from "./contenu/voleur";
import fxGuerrier from "./fixtures/competences_guerrier.fixture.json";
import fxMage from "./fixtures/competences_mage.fixture.json";
import fxMagie from "./fixtures/magie_generateur.fixture.json";
import fxPretre from "./fixtures/competences_pretre.fixture.json";
import fxVoleur from "./fixtures/competences_voleur.fixture.json";
import type { CompetenceCatalogue, Composition } from "./types";

/**
 * [lot A2] JUMEAU POSITIF (règle s346) : la promesse « reliquat ≤ 3 XP,
 * jamais négatif » se DÉROULE sur tout le domaine — les 6 archétypes
 * MARTIAUX mesurés (s350) + les 6 rôles casters du 2b × 7 éléments
 * pour le 🔥 × budgets 60/80 × inventaires min/max × ③ absent/tiré —
 * et le pire cas est CITÉ, pas promis.
 */

const magie = new CatalogueMagie(
  fxMagie as unknown as { sorts: SortModele[]; prieres: PriereModele[] }
);
const magieVide = new CatalogueMagie({ sorts: [], prieres: [] });
const catalogue = (fx: unknown): CatalogueCompetences =>
  new CatalogueCompetences(
    (fx as { competences: unknown[] }).competences as CompetenceCatalogue[]
  );

const PAR_CLASSE: Record<string, { cats: Catalogues; contenu: ContenuClasse }> = {
  guerrier: { cats: { competences: catalogue(fxGuerrier), magie: magieVide }, contenu: CONTENU_GUERRIER },
  pretre: { cats: { competences: catalogue(fxPretre), magie }, contenu: CONTENU_PRETRE },
  voleur: { cats: { competences: catalogue(fxVoleur), magie: magieVide }, contenu: CONTENU_VOLEUR },
  mage: { cats: { competences: catalogue(fxMage), magie }, contenu: CONTENU_MAGE },
};

interface Cas {
  classe: keyof typeof PAR_CLASSE;
  roleId: string;
  inv: string[];
  element?: string;
}

const CAS: Cas[] = [
  { classe: "guerrier", roleId: "gForgeron", inv: [] },
  { classe: "guerrier", roleId: "gForgeron", inv: ["contondante_moyenne", "ecu", "armure_cuir", "bandages"] },
  { classe: "guerrier", roleId: "gTient", inv: ["armure_cuir"] },
  { classe: "guerrier", roleId: "gTient", inv: ["pavois", "armure_plaques", "lame_longue"] },
  { classe: "guerrier", roleId: "gFrappe", inv: ["lame_courte"] },
  { classe: "guerrier", roleId: "gFrappe", inv: ["deux_armes_identiques", "lame_longue", "targe", "armure_cuir", "bandages", "contondante_longue"] },
  { classe: "pretre", roleId: "pSoigne", inv: [] },
  { classe: "pretre", roleId: "pSoigne", inv: ["armure_maille", "ecu", "bourse"] },
  { classe: "pretre", roleId: "pFront", inv: ["armure_cuir"] },
  { classe: "pretre", roleId: "pFront", inv: ["armure_cuir", "armure_maille", "targe", "ecu"] },
  { classe: "pretre", roleId: "pRite", inv: [] },
  { classe: "pretre", roleId: "pRite", inv: ["targe", "fioles"] },
  { classe: "voleur", roleId: "vOrfevre", inv: ["bourse"] },
  { classe: "voleur", roleId: "vOrfevre", inv: ["bourse", "feuille_crayon", "lame_courte", "fioles"] },
  { classe: "voleur", roleId: "vPremier", inv: [] },
  { classe: "voleur", roleId: "vPremier", inv: ["contondante_longue", "bourse", "lame_courte", "fioles", "arme_distance"] },
  { classe: "voleur", roleId: "vEclaireur", inv: ["bandages"] },
  { classe: "voleur", roleId: "vEclaireur", inv: ["bandages", "bourse", "contondante_courte", "arme_distance"] },
  { classe: "mage", roleId: "mAlchimiste", inv: ["fioles"] },
  { classe: "mage", roleId: "mAlchimiste", inv: ["fioles", "baton_sceptre_baguette", "feuille_crayon"] },
  { classe: "mage", roleId: "mRuniste", inv: ["feuille_crayon"] },
  { classe: "mage", roleId: "mRuniste", inv: ["feuille_crayon", "fioles", "baton_sceptre_baguette"] },
  ...ELEMENTS.flatMap<Cas>((element) => [
    { classe: "mage", roleId: "mBrule", inv: [], element },
    { classe: "mage", roleId: "mBrule", inv: ["baton_sceptre_baguette", "feuille_crayon", "fioles"], element },
  ]),
];

const lcg = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};

const coutCouche = (c: Extract<Composition, { ok: true }>, couche: number) =>
  c.achats.filter((a) => a.couche === couche).reduce((s, a) => s + a.coutXp, 0) +
  c.achatsMagie.filter((m) => m.couche === couche).reduce((s, m) => s + m.coutXp, 0);

describe("simulation — tout le domaine", () => {
  it("144 compositions : ok partout, 0 ≤ reliquat ≤ 3, comptes exacts, aucun palier en double", () => {
    let nb = 0;
    const pire = { reliquat: -1, desc: "" };
    for (const [idx, cas] of CAS.entries()) {
      const { cats, contenu } = PAR_CLASSE[cas.classe];
      for (const budget of [60, 80]) {
        for (const tirage of [false, true]) {
          const desc = `${cas.classe}/${cas.roleId}${cas.element ? `(${cas.element})` : ""} inv=[${cas.inv.join(",")}] budget=${budget} ${tirage ? "③tiré" : "③absent"}`;
          const ctxBase = {
            roleId: cas.roleId,
            inventaire: new Set(cas.inv),
            budget,
            element: cas.element,
          };
          let essentiels: { label: string }[] | undefined;
          if (tirage) {
            const c0 = composerClasse(cats, contenu, ctxBase);
            expect(c0.ok, desc).toBe(true);
            if (!c0.ok) continue;
            essentiels = tirerEssentielsClasse(
              cats,
              contenu,
              ctxBase,
              budget - coutCouche(c0, 2),
              lcg(idx * 9973 + budget)
            );
          }
          const c = composerClasse(cats, contenu, { ...ctxBase, essentiels });
          expect(c.ok, desc).toBe(true);
          if (!c.ok) continue;
          nb += 1;
          expect(c.reliquat, desc).toBeGreaterThanOrEqual(0);
          expect(c.reliquat, desc).toBeLessThanOrEqual(3);
          expect(c.totalDepense + c.reliquat, desc).toBe(budget);
          const somme =
            c.achats.reduce((s, a) => s + a.coutXp, 0) +
            c.achatsMagie.reduce((s, m) => s + m.coutXp, 0);
          expect(somme, desc).toBe(c.totalDepense);
          // Aucun palier ≥ 2 en double ; les multiples de niveau 1 sont
          // réservés aux jauges/rachats (type_achat multiple_*).
          const parClef = new Map<string, number>();
          for (const a of c.achats) {
            const k = `${a.nom}@${a.niveau}`;
            parClef.set(k, (parClef.get(k) ?? 0) + 1);
          }
          for (const [k, n] of parClef) {
            if (n === 1) continue;
            const [nom, niveau] = k.split("@");
            expect(Number(niveau), `${desc} — ${k} ×${n}`).toBe(1);
            expect(
              cats.competences.exiger(nom).type_achat.startsWith("multiple"),
              `${desc} — ${k} ×${n}`
            ).toBe(true);
          }
          if (c.reliquat > pire.reliquat) {
            pire.reliquat = c.reliquat;
            pire.desc = desc;
          }
        }
      }
    }
    expect(nb).toBe(144);
    // ⭐ ATTESTATION du pire cas (re-mesuré s353, pas promis).
    // Depuis que les filets martiaux se terminent sur `Développement
    // Spirituel` à 2 XP (plafonds mesurés en prod, arbitrage Fred s353), le
    // pire cas n'est PLUS un martial : il a basculé sur un CASTER, dont le
    // contenu n'est pas touché par ce lot. Les 24 compositions martiales
    // tiennent maintenant sous 3 XP de reliquat.
    expect(pire).toEqual({
      reliquat: 3,
      desc: "mage/mAlchimiste inv=[fioles] budget=80 ③tiré",
    });

    // Le reliquat MARTIAL, mesuré à part : c'est lui que ce lot améliore.
    const pireMartial = { reliquat: -1, desc: "" };
    for (const [idx, cas] of CAS.entries()) {
      if (cas.classe !== "guerrier" && cas.classe !== "voleur") continue;
      const { cats, contenu } = PAR_CLASSE[cas.classe];
      for (const budget of [60, 80]) {
        const c = composerClasse(cats, contenu, {
          roleId: cas.roleId,
          inventaire: new Set(cas.inv),
          budget,
        } as Parameters<typeof composerClasse>[2]);
        if (!c.ok) continue;
        if (c.reliquat > pireMartial.reliquat) {
          pireMartial.reliquat = c.reliquat;
          pireMartial.desc = `${cas.classe}/${cas.roleId} inv=[${cas.inv.join(",")}] budget=${budget}`;
        }
        void idx;
      }
    }
    expect(pireMartial.reliquat).toBeLessThanOrEqual(3);
  });
});
