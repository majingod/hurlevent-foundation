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

// Extension hors-ligne (lot A0, s312) : les 7 clés sont PRÉSENTES dans la
// capture committée depuis la recapture s400 (28 clés). Gardes ACTIVES en
// permanence — une clé qui disparaît ROUGIT (les early-returns sont retirés).
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

  it("extension hors-ligne : les 7 clés sont présentes et respectent leurs planchers", () => {
    // [s400] Garde ACTIVE en permanence : plus d'early-return d'attente.
    // Avant la recapture, ce test retournait tôt — VERT À VIDE pendant que
    // la capture restait 6 semaines en arrière (C133).
    for (const cle of CLES_HORS_LIGNE) {
      expect(tables, `clé « ${cle} » absente du snapshot committé (28 clés attendues depuis s400)`).toHaveProperty(cle);
    }
    for (const cle of CLES_HORS_LIGNE) {
      const n = (tables[cle] ?? []).length;
      expect(n, `table « ${cle} » sous le plancher ${PLANCHERS_HORS_LIGNE[cle]}`).toBeGreaterThanOrEqual(
        PLANCHERS_HORS_LIGNE[cle]
      );
    }
  });

  it("carte équipement (lot 0 générateur, s347) : les 2 clés vont ensemble et respectent leurs planchers", () => {
    const CLES_GENERATEUR = ["objets_generateur", "objets_requis"] as const;
    // [s400] Garde ACTIVE en permanence (early-return d'attente retiré).
    for (const cle of CLES_GENERATEUR) {
      expect(tables, `clé « ${cle} » absente du snapshot committé (28 clés attendues depuis s400)`).toHaveProperty(cle);
    }
    // Planchers de réalité : 31 objets et 37 exigences seedés en prod (s347).
    expect((tables.objets_generateur ?? []).length).toBeGreaterThanOrEqual(25);
    expect((tables.objets_requis ?? []).length).toBeGreaterThanOrEqual(30);
  });
});
