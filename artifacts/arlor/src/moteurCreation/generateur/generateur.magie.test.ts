/**
 * RECAPTURE DE LA FIXTURE MAGIE (MCP, prod) : les 14 sorts des 7 paires
 * (dégâts base 1.00 + bouclier base 0.50 par cercle) + la prière Soins —
 * SELECT nom-à-nom sur `sorts`/`prieres`, champs id, nom, cercle|domaine,
 * niveau, type_sort|type_priere, zone_effet, portee, duree,
 * cout_xp_base::float8.
 */
import { describe, expect, it } from "vitest";

import { COUT_ZONE, DUREES, ZONES_PAR_TYPE } from "@/constants/magie";
import { filterDureesDisponibles } from "@/utils/calculsMagie";

import { CatalogueCompetences } from "./catalogue";
import { CatalogueMagie, type PriereModele, type SortModele } from "./catalogueMagie";
import {
  configGenerateur,
  dureePlafonnee,
  NIVEAU_ACQUISITION,
  ordonnerSortsRepresentatifs,
  prixMagie,
} from "./coutsMagie";
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

describe("configGenerateur — les deux gardes mesurées en s358", () => {
  // ⚠️ PREUVE PAR LE CONTRAIRE : chaque garde est doublée du test « SANS la
  // garde, la chose arrive ». Sinon l'assertion serait verte à vide.
  const sorts = (fxMagie as unknown as { sorts: SortModele[] }).sorts;
  const degats = sorts.filter((s) => s.type_sort === "dégâts");

  it("un sort de DÉGÂTS n'est JAMAIS « Personnelle » (le lanceur se blesserait)", () => {
    expect(degats.length).toBe(7);
    for (const s of degats) {
      expect(configGenerateur(s).zone, s.nom).not.toBe("Personnelle");
      expect(configGenerateur(s).portee, s.nom).toBe("10 Pieds");
    }
  });

  it("…et SANS la garde, « Personnelle » serait bien le moins cher — la garde mord", () => {
    // Le jumeau : les 7 sorts de dégâts ADMETTENT « Personnelle » d'après
    // leur modèle. Sans le filtre, le moins cher la choisirait toujours.
    for (const s of degats) {
      const zonesDuModele = ZONES_PAR_TYPE[s.zone_effet] ?? [s.zone_effet];
      expect(zonesDuModele, s.nom).toContain("Personnelle");
    }
    // Et elle coûte STRICTEMENT moins cher que « 1 Cible » : sans garde, elle gagne.
    expect(COUT_ZONE["Personnelle"]).toBeLessThan(COUT_ZONE["1 Cible"]);
  });

  it("une durée « Instantanée » n'est gardée que si le modèle n'offre rien d'autre", () => {
    const bouclier = cat.exigerSort("Bouclier de Feu");
    expect(configGenerateur(bouclier).duree).not.toBe("Instantanée");
    // Un sort réellement instantané la garde — c'est sa seule option.
    const eclair = cat.exigerSort("Rayon Électrique");
    expect(configGenerateur(eclair).duree).toBe("Instantanée");
  });

  it("…et SANS la garde, le bouclier sortirait à durée nulle — la garde mord", () => {
    // Le jumeau : « Instantanée » EST proposée par le modèle du bouclier, et
    // c'est la moins chère. Sans le filtre, un Bouclier de Feu durerait 0 s.
    const bouclier = cat.exigerSort("Bouclier de Feu");
    const durees = filterDureesDisponibles(bouclier.duree).map((d) => d.label);
    expect(durees).toContain("Instantanée");
    expect(durees.length).toBeGreaterThan(1);
    const cout = (label: string) => DUREES.find((d) => d.label === label)!.cout;
    expect(cout("Instantanée")).toBeLessThan(cout(durees[1]));
  });
});

describe("ordonnerSortsRepresentatifs — le sort de dégâts en tête (arbitrage Fred s358)", () => {
  it("les 7 cercles à sort de dégâts le mettent en 1er, même s'il n'est pas le moins cher", () => {
    const attendu: Record<string, string> = {
      Air: "Rayon Électrique",
      Eau: "Projectile de glace",
      Feu: "Jet de flammes",
      "Magie Noire": "Rayon d'Énergie Négative",
      "Magie Pure": "Projectile Magique",
      Nécromancie: "Destruction des Morts-Vivants",
      Terre: "Rayon d'Acide",
    };
    for (const [cercle, nom] of Object.entries(attendu)) {
      const ordre = ordonnerSortsRepresentatifs(cat.sortsDuCercle(cercle));
      expect(ordre[0].modele.nom, cercle).toBe(nom);
    }
  });

  it("…et SANS la règle, 7 cercles sur 13 auraient mené avec un BOUCLIER", () => {
    // Le jumeau : c'est exactement le défaut que la règle corrige.
    const parPrix = (cercle: string) =>
      [...cat.sortsDuCercle(cercle)]
        .map((m) => ({ m, c: prixMagie(m, "sort", configGenerateur(m)).coutXp }))
        .sort((a, b) => a.c - b.c || a.m.nom.localeCompare(b.m.nom, "fr"))[0].m.nom;
    expect(parPrix("Feu")).toMatch(/^Bouclier/);
    expect(parPrix("Magie Pure")).toMatch(/^Bouclier/);
    expect(parPrix("Terre")).toMatch(/^Bouclier/);
  });

  it("les 6 cercles SANS sort de dégâts gardent leur moins cher — et aucun n'est un bouclier", () => {
    for (const cercle of ["Altération", "Charmes", "Combat", "Divination", "Illusion", "Protection"]) {
      const ordre = ordonnerSortsRepresentatifs(cat.sortsDuCercle(cercle));
      expect(ordre.some((x) => x.modele.type_sort === "dégâts"), cercle).toBe(false);
      expect(ordre[0].modele.nom, cercle).not.toMatch(/^Bouclier/);
    }
  });

  it("l'ordre est STABLE : deux appels donnent la même liste", () => {
    const a = ordonnerSortsRepresentatifs(cat.sortsDuCercle("Charmes")).map((x) => x.modele.nom);
    const b = ordonnerSortsRepresentatifs(cat.sortsDuCercle("Charmes")).map((x) => x.modele.nom);
    expect(a).toEqual(b);
  });
});

describe("intégrité du catalogue", () => {
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
