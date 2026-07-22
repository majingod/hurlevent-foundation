/**
 * RECAPTURE DE LA FIXTURE MAGIE (MCP, prod) : les 14 sorts des 7 paires
 * (dégâts base 1.00 + bouclier base 0.50 par cercle) + la prière Soins —
 * SELECT nom-à-nom sur `sorts`/`prieres`, champs id, nom, cercle|domaine,
 * niveau, type_sort|type_priere, zone_effet, portee, duree,
 * cout_xp_base::float8.
 */
import { describe, expect, it } from "vitest";

import { CatalogueCompetences } from "./catalogue";
import { CatalogueMagie, type PriereModele, type SortModele } from "./catalogueMagie";
import { dureeBouclier, PAIRES_ELEMENTS } from "./contenu/mage";
import { dureePlafonnee, NIVEAU_ACQUISITION, prixMagie } from "./coutsMagie";
import fxMagie from "./fixtures/magie_generateur.fixture.json";
import fxPretre from "./fixtures/competences_pretre.fixture.json";
import type { CompetenceCatalogue } from "./types";

/**
 * [lot 2b] ATTESTATION MIROIR : chaque valeur ci-dessous a été relevée via
 * MCP sur la prod (s349) en appelant `calculer_cout_xp_magie(...)` — le
 * miroir TS doit rendre exactement les mêmes chiffres.
 */

const MAGIE = fxMagie as unknown as {
  sorts: SortModele[];
  prieres: PriereModele[];
};
const cat = new CatalogueMagie(MAGIE);
const soins = cat.exigerPriere("Soins");
const jet = cat.exigerSort("Jet de flammes");
const bclFeu = cat.exigerSort("Bouclier de Feu");
const bclMagique = cat.exigerSort("Bouclier Magique");
const destruction = cat.exigerSort("Destruction des Morts-Vivants");

describe("prixMagie — attestation contre calculer_cout_xp_magie (MCP s349)", () => {
  it("Soins : 7 (niv 1, 2 pers, 5 pieds) · 9 (niv 3) · 6 (niv 3 au toucher, 1 pers)", () => {
    expect(
      prixMagie(soins, "priere", { niveau: 1, zone: "2 Cibles", portee: "5 Pieds", duree: "Instantanée" })
    ).toEqual({ coutXp: 7, coutPS: 2 });
    expect(
      prixMagie(soins, "priere", { niveau: 3, zone: "2 Cibles", portee: "5 Pieds", duree: "Instantanée" }).coutXp
    ).toBe(9);
    expect(
      prixMagie(soins, "priere", { niveau: 3, zone: "1 Cible", portee: "Toucher", duree: "Instantanée" }).coutXp
    ).toBe(6);
  });

  it("sort de dégâts (1 cible, 10 pieds) : 6 / 8 / 11 / 14 aux niveaux 1 / 3 / 6 / 9", () => {
    for (const [niveau, attendu] of [[1, 6], [3, 8], [6, 11], [9, 14]] as const) {
      expect(
        prixMagie(jet, "sort", { niveau, zone: "1 Cible", portee: "10 Pieds", duree: "Instantanée" }).coutXp
      ).toBe(attendu);
    }
  });

  it("boucliers (3 pers, 30 min, AU TOUCHER — politique s349) : 9 au niv 5, 11 au niv 10 ; 12 à 10 pieds", () => {
    expect(
      prixMagie(bclFeu, "sort", { niveau: 5, zone: "3 Cibles", portee: "Toucher", duree: "30 Minutes" })
    ).toEqual({ coutXp: 9, coutPS: 3 });
    expect(
      prixMagie(bclFeu, "sort", { niveau: 10, zone: "3 Cibles", portee: "Toucher", duree: "30 Minutes" })
    ).toEqual({ coutXp: 11, coutPS: 3 });
    expect(
      prixMagie(bclFeu, "sort", { niveau: 10, zone: "3 Cibles", portee: "10 Pieds", duree: "30 Minutes" }).coutXp
    ).toBe(12);
  });

  it("l'exception Magie Pure : bouclier plafonné à 10 minutes → 10 XP au niveau 10", () => {
    expect(
      prixMagie(bclMagique, "sort", { niveau: 10, zone: "3 Cibles", portee: "Toucher", duree: "10 Minutes" }).coutXp
    ).toBe(10);
    expect(() =>
      prixMagie(bclMagique, "sort", { niveau: 10, zone: "3 Cibles", portee: "Toucher", duree: "30 Minutes" })
    ).toThrow(/durée/);
  });

  it("les caps du modèle lèvent (jamais silencieux) : Destruction plafonne à 25 pieds", () => {
    expect(
      prixMagie(destruction, "sort", { niveau: 6, zone: "1 Cible", portee: "25 Pieds", duree: "Instantanée" }).coutXp
    ).toBe(13); // 25 Pieds coûte 4 — vérifié SQL s349
    expect(() =>
      prixMagie(destruction, "sort", { niveau: 6, zone: "1 Cible", portee: "50 Pieds", duree: "Instantanée" })
    ).toThrow(/portée/);
  });

  it("le plafond de création (20 XP, miroir #710) lève sur une config de contenu trop chère", () => {
    expect(() =>
      prixMagie(jet, "sort", { niveau: 9, zone: "5 Cibles", portee: "10 Pieds", duree: "Instantanée" })
    ).toThrow();
  });

  it("NIVEAU_ACQUISITION : le manuel (Cercle/Domaine N ouvre ≤ 5×N)", () => {
    expect([1, 5, 6, 10, 11].map(NIVEAU_ACQUISITION)).toEqual([1, 1, 2, 2, 3]);
  });
});

describe("intégrité des paires d'éléments et des gardes", () => {
  it("7 éléments, chacun : un sort de dégâts (base 1.00) + un bouclier (base 0.50)", () => {
    expect(Object.keys(PAIRES_ELEMENTS)).toHaveLength(7);
    for (const [element, paire] of Object.entries(PAIRES_ELEMENTS)) {
      const d = cat.exigerSort(paire.degats);
      const b = cat.exigerSort(paire.bouclier);
      expect(d.cercle, element).toBe(element);
      expect(b.cercle, element).toBe(element);
      expect(d.cout_xp_base).toBe(1);
      expect(b.cout_xp_base).toBe(0.5);
      // La durée du contenu = la durée voulue (30 min) plafonnée par le modèle.
      expect(dureeBouclier(element)).toBe(dureePlafonnee(b, "30 Minutes"));
    }
  });

  it("CatalogueMagie refuse un modèle en double", () => {
    expect(
      () => new CatalogueMagie({ sorts: [MAGIE.sorts[0], MAGIE.sorts[0]], prieres: [] })
    ).toThrow(/double/);
  });

  it("CatalogueCompetences refuse une collision d'homonymes (4 paires mage/prêtre mesurées)", () => {
    const comps = (fxPretre as { competences: unknown[] }).competences as CompetenceCatalogue[];
    const ds = comps.find((c) => c.nom === "Développement Spirituel")!;
    expect(() => new CatalogueCompetences([...comps, { ...ds }])).toThrow(/homonymes/);
  });
});
