/**
 * Intégrité du snapshot visiteur offline — garde-fou anti-stub côté test.
 *
 * Ces assertions rendent un snapshot factice (tables vides, comptes mentis,
 * ids inventés) IMPOSSIBLE : un stub redeviendrait un état rouge.
 *
 * ⚠️ Aucun compte codé en dur : la seule vérité est la cohérence interne
 *    manifest ↔ contenu + des planchers de réalité. (Les stats pg divergent
 *    des comptes réels — mesuré : objets_forge 20 réels vs 45 estimés.)
 */

import { describe, it, expect } from "vitest";
import snapshot from "@/data/snapshotVisiteur.json";

const UUID_RE = /^[0-9a-f-]{36}$/i;

// Planchers de réalité : sous ces seuils, la donnée est forcément factice.
const PLANCHERS: Record<string, number> = {
  races: 3,
  classes: 3,
  competences: 50,
  sorts: 50,
  prieres: 50,
};

// Extension hors-ligne (lot A0, s312) : 7 clés optionnelles tant que le JSON
// committé reste en 18 clés (races/classes/.../parametres_jeu). Dès qu'un
// prebuild/refresh régénère le snapshot à 25 clés, ces garde-fous s'activent.
const CLES_HORS_LIGNE = [
  "sections_regles",
  "effets_combat",
  "bestiaire",
  "lore",
  "fiches_schemas",
  "fiches_listes",
  "vue_competences_encyclopedie",
] as const;
const PLANCHERS_HORS_LIGNE: Record<string, number> = {
  sections_regles: 40,
  effets_combat: 25,
  bestiaire: 4,
  lore: 10,
  fiches_schemas: 10,
  fiches_listes: 10,
  vue_competences_encyclopedie: 80,
};

describe("snapshot visiteur — intégrité anti-stub", () => {
  const tables = snapshot.tables as Record<string, unknown[]>;
  const comptes = snapshot.manifest.comptes as Record<string, number>;

  it("le manifest et les tables couvrent exactement les mêmes clés", () => {
    expect(new Set(Object.keys(comptes))).toEqual(new Set(Object.keys(tables)));
  });

  it("pour CHAQUE table : manifest.comptes[t] === tables[t].length", () => {
    for (const [t, rows] of Object.entries(tables)) {
      expect(Array.isArray(rows)).toBe(true);
      expect(comptes[t]).toBe(rows.length);
    }
  });

  it("aucune table n'est vide", () => {
    for (const [t, rows] of Object.entries(tables)) {
      expect(rows.length, `table « ${t} » vide`).toBeGreaterThan(0);
    }
  });

  it("planchers de réalité respectés (races/classes/competences/sorts/prieres ≥ 3/3/50/50/50)", () => {
    for (const [t, plancher] of Object.entries(PLANCHERS)) {
      expect(
        tables[t].length,
        `table « ${t} » sous le plancher ${plancher}`
      ).toBeGreaterThanOrEqual(plancher);
    }
  });

  it("races[0].id est un UUID", () => {
    const races = tables.races as Array<{ id: string }>;
    expect(races[0].id).toMatch(UUID_RE);
  });

  it("chaque classe possède pv_depart, ps_depart, competences_gratuites", () => {
    const classes = tables.classes as Array<Record<string, unknown>>;
    for (const c of classes) {
      expect(c, `classe ${JSON.stringify(c.nom)}`).toHaveProperty("pv_depart");
      expect(c).toHaveProperty("ps_depart");
      expect(c).toHaveProperty("competences_gratuites");
    }
  });

  it("chaque race possède xp_depart, nb_traits_raciaux", () => {
    const races = tables.races as Array<Record<string, unknown>>;
    for (const r of races) {
      expect(r, `race ${JSON.stringify(r.nom)}`).toHaveProperty("xp_depart");
      expect(r).toHaveProperty("nb_traits_raciaux");
    }
  });

  it("extension hors-ligne (25 clés) : si une clé est présente, les 7 le sont et respectent leurs planchers", () => {
    const presentes = CLES_HORS_LIGNE.filter((c) => c in tables);

    if (presentes.length === 0) {
      // JSON committé à 18 clés : rien à vérifier, le garde-fou reste inactif.
      return;
    }

    for (const cle of CLES_HORS_LIGNE) {
      expect(tables, `clé « ${cle} » manquante alors que « ${presentes[0]} » est présente`).toHaveProperty(cle);
    }
    for (const cle of CLES_HORS_LIGNE) {
      const n = (tables[cle] ?? []).length;
      expect(n, `table « ${cle} » sous le plancher ${PLANCHERS_HORS_LIGNE[cle]}`).toBeGreaterThanOrEqual(
        PLANCHERS_HORS_LIGNE[cle]
      );
    }
  });
});
