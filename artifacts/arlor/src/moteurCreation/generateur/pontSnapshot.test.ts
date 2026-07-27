/**
 * [VIS-8 lot 🎲, s364] LE PONT PROD — comptes mesurés + preuves par le
 * contraire (règle s355 : un test de garde est vert par défaut ; chaque
 * « X ne passe pas » a son jumeau « sans la garde, X passe »).
 *
 * Les comptes exacts sont ceux du snapshot COMMITTÉ, lus par la machine
 * en s364. Si un recommit du snapshot les fait rougir, c'est voulu :
 * c'est le test « un lot de données est arrivé » (règle s359) — mettre à
 * jour les comptes fait partie du lot de données, pas d'un fix aveugle.
 */
import { describe, expect, it } from "vitest";

import snapshotJson from "../../data/snapshotVisiteur.json";
import type { SnapshotVisiteur } from "../snapshot";
import { CatalogueCompetences } from "./catalogue";
import { CatalogueMagie, type SortModele } from "./catalogueMagie";
import fxMonde from "./fixtures/monde_resolveur.fixture.json";
import {
  ErreurPontSnapshot,
  competencesPourClasse,
  depsDepuisSnapshot,
  modelesMagieNiveau1,
  versCompetenceCatalogue,
} from "./pontSnapshot";
import { tirerPersonnage } from "./resoudre";

const base = snapshotJson as unknown as SnapshotVisiteur;
/** Le snapshot committé N'A PAS la carte (dette [SNAPSHOT-COMMIT-STUB]) :
 *  on l'injecte depuis la fixture monde (capture MCP prod s362, identique
 *  à la prod du jour — 0 migration sur objets_requis depuis). */
const avecCarte: SnapshotVisiteur = {
  ...base,
  tables: {
    ...base.tables,
    objets_requis: (fxMonde as { objets_requis: unknown[] }).objets_requis,
  },
};

type LigneBrute = {
  nom: string;
  est_actif: boolean | null;
  niveau?: number | null;
  prerequis_competences?: unknown;
};
const brutes = base.tables.competences as unknown as LigneBrute[];
const sortsBruts = base.tables.sorts as unknown as LigneBrute[];
const prieresBrutes = base.tables.prieres as unknown as LigneBrute[];

const lcg = (seed: number) => {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
};
const RICHE: ReadonlySet<string> = new Set([
  "lame_deux_mains", "contondante_courte", "armure_cuir", "ecu", "masque",
  "fioles", "feuille_crayon", "baton_sceptre_baguette", "oreilles_pointues",
  "bourse", "maquillage_vert", "capuchon_cape", "dague", "arc_fleches",
  "instrument_musique",
]);
const VIDE: ReadonlySet<string> = new Set();

describe("pont — compétences par classe", () => {
  it("comptes exacts après filtre + départage (mesurés s364)", () => {
    expect(competencesPourClasse(brutes as never, "guerrier")).toHaveLength(77);
    expect(competencesPourClasse(brutes as never, "pretre")).toHaveLength(72);
    expect(competencesPourClasse(brutes as never, "voleur")).toHaveLength(69);
    expect(competencesPourClasse(brutes as never, "mage")).toHaveLength(67);
  });

  it("le catalogue de chaque classe se construit sans lever", () => {
    for (const classe of ["guerrier", "pretre", "voleur", "mage"] as const) {
      expect(
        () => new CatalogueCompetences(competencesPourClasse(brutes as never, classe))
      ).not.toThrow();
    }
  });

  it("CONTRAIRE : sans le départage, les homonymes font lever", () => {
    const toutes = brutes
      .filter((c) => c.est_actif === true)
      .map((c) => versCompetenceCatalogue(c as never));
    expect(() => new CatalogueCompetences(toutes)).toThrow(/homonymes/);
  });

  it("les prérequis TRAVERSENT le pont (contraire du bug s364)", () => {
    const brute = brutes.find((c) => c.nom === "Acquisition de Domaine")!;
    // Le bug : la ligne DB ne porte PAS de clé `prerequis` — le moteur
    // lisait `undefined` en silence (couts.ts, `?.`).
    expect("prerequis" in brute).toBe(false);
    expect(brute.prerequis_competences).not.toBeNull();
    // Le fix : la version mappée porte la MÊME valeur sous le bon nom.
    const mappee = versCompetenceCatalogue(brute as never);
    expect(mappee.prerequis).toEqual(brute.prerequis_competences);
    // Et elle est lisible à travers le catalogue assemblé.
    const deps = depsDepuisSnapshot(avecCarte);
    expect(
      deps.parClasse.pretre.cats.competences.get("Acquisition de Domaine")
        ?.prerequis
    ).toEqual(brute.prerequis_competences);
  });
});

describe("pont — magie de niveau 1", () => {
  it("comptes exacts (mesurés s364) : le filtre retire du réel", () => {
    const { sorts, prieres } = modelesMagieNiveau1(base);
    expect(sorts).toHaveLength(72);
    expect(prieres).toHaveLength(64);
    // Matière première : 136 sorts actifs, 121 prières actives. Si le
    // filtre saute, ces deux comptes rougissent (64 + 57 modèles de
    // niveau supérieur entreraient dans le générateur).
    expect(sortsBruts.filter((s) => s.est_actif === true)).toHaveLength(136);
    expect(prieresBrutes.filter((p) => p.est_actif === true)).toHaveLength(121);
    // Zéro homonyme APRÈS filtre (un doublon futur de niveau 1 rougirait).
    expect(new Set(sorts.map((s) => s.nom)).size).toBe(72);
    expect(new Set(prieres.map((p) => p.nom)).size).toBe(64);
  });

  it("CONTRAIRE : sans le filtre, le catalogue lève (« Poigne de fer », niv 6, Combat ET Terre)", () => {
    const tous = sortsBruts.filter(
      (s) => s.est_actif === true
    ) as unknown as SortModele[];
    expect(() => new CatalogueMagie({ sorts: tous, prieres: [] })).toThrow(
      /double/
    );
  });
});

describe("pont — garde carte d'équipement", () => {
  it("REFUSE le snapshot committé (objets_requis absent) avec un message en clair", () => {
    expect(() => depsDepuisSnapshot(base)).toThrow(ErreurPontSnapshot);
    expect(() => depsDepuisSnapshot(base)).toThrow(/objets_requis/);
  });

  it("CONTRAIRE : avec la carte, le pont construit", () => {
    expect(() => depsDepuisSnapshot(avecCarte)).not.toThrow();
  });
});

describe("pont — bout en bout sur le vrai moteur", () => {
  it("100 tirages sac riche + 100 mains nues : tous composent (mesuré s364, sous-ensemble du 800/800)", () => {
    const deps = depsDepuisSnapshot(avecCarte);
    let okRiche = 0;
    let okVide = 0;
    const racesVide = new Set<string>();
    for (let i = 1; i <= 100; i++) {
      const r = tirerPersonnage(deps, lcg(i * 97), RICHE);
      if (r.ok) okRiche++;
      const v = tirerPersonnage(deps, lcg(i * 97), VIDE);
      if (v.ok) {
        okVide++;
        racesVide.add(v.tirage.raceNom);
      }
    }
    expect(okRiche, "sac riche : chaque tirage doit composer").toBe(100);
    expect(okVide, "mains nues : chaque tirage doit composer").toBe(100);
    // Décision 31, pire cas cité : à mains nues, SEUL l'Humain part sans
    // costume (les 7 autres races exigent un objet, `objets_requis`).
    expect([...racesVide]).toEqual(["Humain"]);
  });

  it("les 3 sorties neuves traversent (religion, element2, traits incompatibles)", () => {
    const deps = depsDepuisSnapshot(avecCarte);
    // Seed mesuré s364 : Humain · prêtre/pConsecrateur · Bénédiction +
    // Chaos · religion appariée sur les DEUX (corollaire C3, s362).
    const r = tirerPersonnage(deps, lcg(77 * 97), RICHE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tirage.roleId).toBe("pConsecrateur");
    expect(r.tirage.element).toBe("Bénédiction");
    expect(r.tirage.element2).toBe("Chaos");
    expect(r.tirage.religionNom).toBeTruthy();
    expect(r.tirage.traitsIncompatibles).toContain("Inapte à la magie");
  });
});
