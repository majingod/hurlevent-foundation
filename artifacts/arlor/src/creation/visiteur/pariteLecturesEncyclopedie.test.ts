/**
 * Parité visiteur — LECTURES ENCYCLOPÉDIE + RÈGLES ([HL-A2] Lot 1, s320).
 *
 * Même patron que pariteLecturesCatalogues.test.ts (#670) : chaque `lire*`
 * doit reproduire le contrat de son SELECT serveur (FILTRE / TRI / PROJECTION),
 * attesté contre le snapshot, sans réseau.
 *
 * ⚠️ [s400] Le snapshot COMMITTÉ porte les 28 clés depuis la recapture (les
 * 7 tables hors-ligne comprises) ; la mini-fixture reste : elle ÉPINGLE les
 * attentes sur des données fixes, indépendantes des recaptures. Pour ces 7
 * tables, on injecte une MINI-FIXTURE (lignes minimales, schéma fidèle sur les
 * colonnes touchées par la logique : categorie/nom/ordre/est_actif) via le
 * mécanisme documenté `__SNAPSHOT_HORS_LIGNE__` de snapshotActif(). Les 11
 * catégories présentes dans la fixture committée sont attestées directement.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { clientVisiteur } from "./clientVisiteur";
import { getSnapshot } from "@/moteurCreation/snapshot";
import { TABLE_SOURCE_ENCYCLOPEDIE } from "../encyclopedie";
import type { CategorieEncyclopedie } from "../encyclopedie";

// ── localStorage stub (config vitest = node) ──
function installerLocalStorage(): void {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}
beforeEach(() => installerLocalStorage());

// ── comparateur répliqué (indépendant de l'implémentation) ──
type Row = Record<string, unknown>;
function cmp(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), "fr");
}
function trierPar<X>(rows: X[], ...cles: Array<(r: X) => unknown>): X[] {
  return [...rows].sort((x, y) => {
    for (const cle of cles) {
      const d = cmp(cle(x), cle(y));
      if (d !== 0) return d;
    }
    return 0;
  });
}
const ids = (rows: Row[]): unknown[] => rows.map((r) => r.id);

function attendreParite(
  data: unknown,
  source: Row[],
  pred: (r: Row) => boolean,
  cles: Array<(r: Row) => unknown>,
): void {
  const attendu = trierPar(source.filter(pred), ...cles);
  expect(Array.isArray(data)).toBe(true);
  const recu = data as Row[];
  expect(attendu.length).toBeGreaterThan(0); // anti-vacuité
  expect(recu.length).toBe(attendu.length);
  expect(ids(recu)).toEqual(ids(attendu));
}

// ── MINI-FIXTURE (7 tables absentes du snapshot committé) ──
// Lignes volontairement NON triées, avec accents (exerce localeCompare "fr"),
// 1 ligne inactive par table filtrée (prouve le filtre), 1 égalité de
// `categorie` avec `ordre` différent (prouve le tri secondaire des sections).
const FIXTURE_7: Record<string, Row[]> = {
  sections_regles: [
    { id: "s3", categorie: "combat", titre: "Étourdissement", contenu: "…", ordre: 2, est_actif: true },
    { id: "s1", categorie: "artisanat", titre: "Forge", contenu: "…", ordre: 1, est_actif: true },
    { id: "s4", categorie: "combat", titre: "Armures", contenu: "…", ordre: 1, est_actif: true },
    { id: "s2", categorie: "combat", titre: "Section retirée", contenu: "…", ordre: 3, est_actif: false },
    { id: "s5", categorie: "hors_champ", titre: "Autre catégorie non demandée", contenu: "…", ordre: 1, est_actif: true },
  ],
  effets_combat: [
    { id: "e2", nom: "Étourdi", description: "…", duree: "1 min", conditions: null, type: "état", source: "manuel" },
    { id: "e1", nom: "Ébranlé", description: "…", duree: "10 s", conditions: null, type: "état", source: "manuel" },
    { id: "e3", nom: "Aveuglé", description: "…", duree: "30 s", conditions: null, type: "état", source: "manuel" },
  ],
  bestiaire: [
    { id: "b2", nom: "Ombre", categorie: "esprit", description: "…", est_actif: true },
    { id: "b1", nom: "Gobelin", categorie: "humanoïde", description: "…", est_actif: true },
    { id: "b3", nom: "Créature retirée", categorie: "test", description: "…", est_actif: false },
  ],
  lore: [
    { id: "l2", nom: "Éther", sous_titre: null, categorie: "cosmologie", description: "…", est_actif: true },
    { id: "l1", nom: "Destéa", sous_titre: "Le monde", categorie: "monde", description: "…", est_actif: true },
    { id: "l3", nom: "Ancien texte retiré", sous_titre: null, categorie: "monde", description: "…", est_actif: false },
  ],
  vue_competences_encyclopedie: [
    { id: "c2", nom: "Érudition", categorie: "savoir", est_actif: true },
    { id: "c1", nom: "Alchimie", categorie: "artisanat", est_actif: true },
    { id: "c3", nom: "Compétence retirée", categorie: "test", est_actif: false },
  ],
  fiches_schemas: [
    { categorie: "bestiaire", mis_a_jour: "2026-01-01", champs_v2: [{ cle: "nom", libelle: "Nom" }] },
    { categorie: "lore", mis_a_jour: "2026-01-01", champs_v2: [{ cle: "description", libelle: "Description" }] },
  ],
  fiches_listes: [
    { categorie: "bestiaire", recherche: {}, navigation: {}, carte: { mode: "abrege" }, annexes: null, mis_a_jour: "2026-01-01" },
  ],
};

function poserFixture(): void {
  const base = getSnapshot();
  (globalThis as Record<string, unknown>).__SNAPSHOT_HORS_LIGNE__ = {
    ...base,
    tables: { ...base.tables, ...FIXTURE_7 },
  };
}
function retirerFixture(): void {
  delete (globalThis as Record<string, unknown>).__SNAPSHOT_HORS_LIGNE__;
}

// ═══ 1. Les 11 catégories PRÉSENTES dans le snapshot committé ═══
const CATS_PRESENTES: CategorieEncyclopedie[] = [
  "race", "trait_racial", "classe", "assemblages", "alchimie", "sorts",
  "prieres", "religions", "forge", "joaillerie", "pieges",
];

describe("lireCatalogueEncyclopedie — catégories du snapshot committé", () => {
  for (const cat of CATS_PRESENTES) {
    it(`${cat} → ${TABLE_SOURCE_ENCYCLOPEDIE[cat]} : est_actif, order nom`, async () => {
      const T = getSnapshot().tables as unknown as Record<string, Row[]>;
      const { data, error } = await clientVisiteur.lireCatalogueEncyclopedie(cat);
      expect(error).toBeNull();
      attendreParite(data, T[TABLE_SOURCE_ENCYCLOPEDIE[cat]] ?? [], (r) => r.est_actif === true, [(r) => r.nom]);
    });
  }
});

// ═══ 2. Les 7 tables ABSENTES — via mini-fixture ═══
describe("lectures encyclo/règles — tables du prebuild (mini-fixture)", () => {
  beforeEach(poserFixture);
  afterEach(retirerFixture);

  for (const cat of ["competences", "bestiaire", "lore"] as CategorieEncyclopedie[]) {
    it(`lireCatalogueEncyclopedie(${cat}) : est_actif, order nom`, async () => {
      const { data, error } = await clientVisiteur.lireCatalogueEncyclopedie(cat);
      expect(error).toBeNull();
      attendreParite(data, FIXTURE_7[TABLE_SOURCE_ENCYCLOPEDIE[cat]], (r) => r.est_actif === true, [(r) => r.nom]);
    });
  }

  it("lireSectionsRegles : in(categorie) + est_actif + order categorie,ordre", async () => {
    const { data, error } = await clientVisiteur.lireSectionsRegles(["combat", "artisanat"]);
    expect(error).toBeNull();
    attendreParite(
      data,
      FIXTURE_7.sections_regles,
      (s) => s.est_actif === true && ["combat", "artisanat"].includes(String(s.categorie)),
      [(s) => s.categorie, (s) => s.ordre],
    );
    // le tri secondaire est bien prouvé : 2 sections "combat" d'ordre 1 puis 2
    const recu = data as Row[];
    expect(recu.map((s) => s.id)).toEqual(["s1", "s4", "s3"]);
  });

  it("lireEffetsCombat : SANS filtre est_actif, order nom", async () => {
    const { data, error } = await clientVisiteur.lireEffetsCombat();
    expect(error).toBeNull();
    attendreParite(data, FIXTURE_7.effets_combat, () => true, [(e) => e.nom]);
  });

  it("lireFicheSchemaChampsV2 : maybeSingle présent / absent", async () => {
    const present = await clientVisiteur.lireFicheSchemaChampsV2("bestiaire");
    expect(present.error).toBeNull();
    expect(present.data).toEqual({ champs_v2: [{ cle: "nom", libelle: "Nom" }] });
    const absent = await clientVisiteur.lireFicheSchemaChampsV2("pieges");
    expect(absent.error).toBeNull();
    expect(absent.data).toBeNull();
  });

  it("lireFicheListe : maybeSingle présent / absent", async () => {
    const present = await clientVisiteur.lireFicheListe("bestiaire");
    expect(present.error).toBeNull();
    expect((present.data as Row | null)?.categorie).toBe("bestiaire");
    const absent = await clientVisiteur.lireFicheListe("lore");
    expect(absent.error).toBeNull();
    expect(absent.data).toBeNull();
  });
});

// ═══ 3. Lectures annexes sur tables PRÉSENTES ═══
describe("lectures annexes (snapshot committé)", () => {
  it("lireReparationsForge : est_actif, sans order (miroir serveur)", async () => {
    const T = getSnapshot().tables as unknown as Record<string, Row[]>;
    const { data, error } = await clientVisiteur.lireReparationsForge();
    expect(error).toBeNull();
    const attendu = (T.reparations_forge ?? []).filter((r) => r.est_actif === true);
    expect(attendu.length).toBeGreaterThan(0);
    const recu = data as Row[];
    expect(recu.length).toBe(attendu.length);
    expect(new Set(ids(recu))).toEqual(new Set(ids(attendu))); // sans exigence d'ordre
  });

  it("lireRaceTraits : projection (race_id, trait_id), sans filtre", async () => {
    const T = getSnapshot().tables as unknown as Record<string, Row[]>;
    const { data, error } = await clientVisiteur.lireRaceTraits();
    expect(error).toBeNull();
    const recu = data as Array<Record<string, unknown>>;
    expect(recu.length).toBe((T.race_traits ?? []).length);
    expect(recu.length).toBeGreaterThan(0);
    for (const r of recu.slice(0, 5)) {
      expect(Object.keys(r).sort()).toEqual(["race_id", "trait_id"]);
    }
  });

  it("clés absentes (absence construite) → tableaux vides, pas de crash", async () => {
    // [s400] L'absence se CONSTRUIT : clone du snapshot réel SANS les clés
    // hors-ligne, injecté via __SNAPSHOT_HORS_LIGNE__ (remplacement complet).
    // Avant la recapture, l'absence était héritée de la capture périmée —
    // un test qui dépendait de la péremption (C133/s359).
    const complet = getSnapshot() as unknown as {
      manifest: unknown;
      tables: Record<string, unknown>;
    };
    const tablesReduites: Record<string, unknown> = { ...complet.tables };
    for (const cle of [
      "sections_regles", "effets_combat", "bestiaire", "lore",
      "fiches_schemas", "fiches_listes", "vue_competences_encyclopedie",
    ]) {
      delete tablesReduites[cle];
    }
    (globalThis as Record<string, unknown>).__SNAPSHOT_HORS_LIGNE__ = {
      manifest: complet.manifest,
      tables: tablesReduites,
    };
    try {
      const sections = await clientVisiteur.lireSectionsRegles(["combat"]);
      expect(sections.error).toBeNull();
      expect(sections.data).toEqual([]);
      const effets = await clientVisiteur.lireEffetsCombat();
      expect(effets.error).toBeNull();
      expect(effets.data).toEqual([]);
      const schema = await clientVisiteur.lireFicheSchemaChampsV2("bestiaire");
      expect(schema.error).toBeNull();
      expect(schema.data).toBeNull();
    } finally {
      delete (globalThis as Record<string, unknown>).__SNAPSHOT_HORS_LIGNE__;
    }
  });
});
