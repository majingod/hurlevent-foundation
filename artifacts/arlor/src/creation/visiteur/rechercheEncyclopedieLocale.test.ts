/**
 * Tests du port pur `rechercherEncyclopedieLocale` ([HL-A2], lot 3/3, s320).
 *
 * Miroir de `public.rechercher_encyclopedie` : seuil 3 caractères, unaccent+ILIKE,
 * `_snip_contient`, `rang` 1.0/0.5, tri `rang DESC` puis `titre` "fr", LIMIT 50,
 * dédoublonnage `pieges` par `nom`. Module PUR : tables passées directement, pas
 * de localStorage ni de `__SNAPSHOT_HORS_LIGNE__`. La non-vacuité s'atteste sur le
 * snapshot committé via `getSnapshot()` (branchement réel snapshot→port).
 */

import { describe, it, expect } from "vitest";
import {
  unaccentFr,
  snipContient,
  rechercherEncyclopedieLocale,
} from "./rechercheEncyclopedieLocale";
import { getSnapshot } from "@/moteurCreation/snapshot";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[] | undefined>;

// ═══ 1. Seuil (< 3 caractères → []) ═══
describe("rechercherEncyclopedieLocale — seuil 3 caractères", () => {
  const avecMatch: Tables = {
    races: [{ id: "r1", nom: "abc", description: "", resume_condense: "", est_actif: true }],
  };

  it("null / undefined / vide / < 3 → []", () => {
    expect(rechercherEncyclopedieLocale(avecMatch, null)).toEqual([]);
    expect(rechercherEncyclopedieLocale(avecMatch, undefined)).toEqual([]);
    expect(rechercherEncyclopedieLocale(avecMatch, "")).toEqual([]);
    expect(rechercherEncyclopedieLocale(avecMatch, "ab")).toEqual([]);
    // trim < 3 (le seuil s'applique après trim)
    expect(rechercherEncyclopedieLocale(avecMatch, "  ab  ")).toEqual([]);
  });

  it("« abc » (≥ 3) passe le seuil et renvoie un résultat", () => {
    const res = rechercherEncyclopedieLocale(avecMatch, "abc");
    expect(res.length).toBe(1);
    expect(res[0].id).toBe("r1");
  });
});

// ═══ 2. unaccentFr ═══
describe("unaccentFr — NFD + ligatures", () => {
  it("Épée → Epee", () => expect(unaccentFr("Épée")).toBe("Epee"));
  it("cœur → coeur", () => expect(unaccentFr("cœur")).toBe("coeur"));
  it("forêt → foret", () => expect(unaccentFr("forêt")).toBe("foret"));
});

// ═══ 3. snipContient (chaînes construites exactes) ═══
describe("snipContient — port fidèle de _snip_contient", () => {
  it("corps vide → \"\"", () => {
    expect(snipContient("", "abc")).toBe("");
  });

  it("terme absent → 80 premiers caractères", () => {
    const corps = "z".repeat(100);
    expect(snipContient(corps, "needle")).toBe("z".repeat(80));
  });

  it("match en début (pos ≤ 30) → pas de … initial, <mark>, 45 après, sans … final", () => {
    // "abcdefghij" (10) — terme "cd" à pos1=3, tail = "efghij" (6 < 45)
    expect(snipContient("abcdefghij", "cd")).toBe("ab<mark>cd</mark>efghij");
  });

  it("match en début + … final si la queue est tronquée (> 45)", () => {
    const corps = "ab" + "cd" + "e".repeat(50); // pos1=3, tail = 45 'e' + reste → …
    expect(snipContient(corps, "cd")).toBe("ab<mark>cd</mark>" + "e".repeat(45) + "…");
  });

  it("match profond (> 30) → … initial + 30 caractères avant + … final", () => {
    const corps = "x".repeat(40) + "needle" + "y".repeat(50);
    // pos1=41, start1=11 → 30 'x' avant ; tail = 45 'y' + reste → …
    expect(snipContient(corps, "needle")).toBe(
      "…" + "x".repeat(30) + "<mark>needle</mark>" + "y".repeat(45) + "…",
    );
  });
});

// ═══ 4. Branches sur mini-fixture ═══
describe("rechercherEncyclopedieLocale — branches (mini-fixture)", () => {
  it("filtre est_actif : une ligne inactive qui matche n'apparaît pas", () => {
    const tables: Tables = {
      races: [
        { id: "actif", nom: "Glaive", description: "", resume_condense: "", est_actif: true },
        { id: "inactif", nom: "Glaive maudit", description: "", resume_condense: "", est_actif: false },
      ],
    };
    const res = rechercherEncyclopedieLocale(tables, "glaive");
    expect(res.map((r) => r.id)).toEqual(["actif"]);
  });

  it("rang 1.0 (terme dans le nom) vs 0.5 (terme dans la description) + tri rang DESC puis titre fr", () => {
    const tables: Tables = {
      races: [
        { id: "r1", nom: "Glaive", description: "", resume_condense: "", est_actif: true }, // 1.0
        { id: "r2", nom: "Bouclier", description: "un glaive rangé", resume_condense: "", est_actif: true }, // 0.5
        { id: "r3", nom: "Arme glaive", description: "", resume_condense: "", est_actif: true }, // 1.0
      ],
    };
    const res = rechercherEncyclopedieLocale(tables, "glaive");
    // rang DESC (1.0 avant 0.5), puis titre "fr" ("Arme glaive" < "Glaive")
    expect(res.map((r) => r.id)).toEqual(["r3", "r1", "r2"]);
    expect(res.map((r) => r.rang)).toEqual([1.0, 1.0, 0.5]);
  });

  it("accents croisés : « epee » matche « Épée » ET « épée » matche « epee »", () => {
    const tables: Tables = {
      races: [
        { id: "e1", nom: "Épée", description: "", resume_condense: "", est_actif: true },
        { id: "e2", nom: "epee", description: "", resume_condense: "", est_actif: true },
      ],
    };
    expect(rechercherEncyclopedieLocale(tables, "epee").map((r) => r.id).sort()).toEqual(["e1", "e2"]);
    expect(rechercherEncyclopedieLocale(tables, "épée").map((r) => r.id).sort()).toEqual(["e1", "e2"]);
    // rang 1.0 des deux côtés (terme présent dans le nom, désaccentué)
    for (const r of rechercherEncyclopedieLocale(tables, "epee")) expect(r.rang).toBe(1.0);
  });

  it("religion : rituels_manuel (tableau) participe au corpus", () => {
    const tables: Tables = {
      religions: [
        {
          id: "rel1",
          nom: "Ordre du Soleil",
          dirigeant: "Le Primat",
          fondateur: "",
          description: "",
          lore_fiche: "",
          description_longue: "",
          lore_manuel: "",
          rituels_manuel: ["invocation vespérale", "litanie du crépuscule"],
          pouvoir_symbole: "",
          est_actif: true,
        },
      ],
    };
    // « crépuscule » n'existe que dans le tableau rituels_manuel
    const res = rechercherEncyclopedieLocale(tables, "crepuscule");
    expect(res.length).toBe(1);
    expect(res[0].type).toBe("religion");
    expect(res[0].id).toBe("rel1");
    expect(res[0].sous_titre).toBe("Le Primat");
    expect(res[0].categorie).toBe("religion");
    expect(res[0].rang).toBe(0.5); // pas dans le nom
  });

  it("pieges : 2 lignes même nom → 1 seul résultat (la première de l'ordre du tableau)", () => {
    const tables: Tables = {
      pieges: [
        { id: "p1", nom: "Fosse", type_piege: "mécanique", effets: "chute brutale", effet_generique: "", cible: "", est_actif: true },
        { id: "p2", nom: "Fosse", type_piege: "magique", effets: "chute vertigineuse", effet_generique: "", cible: "", est_actif: true },
      ],
    };
    const res = rechercherEncyclopedieLocale(tables, "chute");
    expect(res.length).toBe(1);
    expect(res[0].id).toBe("p1"); // DISTINCT ON (nom) : première ligne rencontrée
    expect(res[0].type).toBe("pieges");
  });

  it("regle : rang sur titre (pas nom), categorie=\"regle\", sous_titre=categorie de la ligne", () => {
    const tables: Tables = {
      sections_regles: [
        { id: "g1", titre: "Combat", categorie: "combat", contenu: "règles du combat", est_actif: true }, // titre → 1.0
        { id: "g2", titre: "Armures", categorie: "combat", contenu: "au combat rapproché", est_actif: true }, // corpus only → 0.5
      ],
    };
    const res = rechercherEncyclopedieLocale(tables, "combat");
    const g1 = res.find((r) => r.id === "g1")!;
    const g2 = res.find((r) => r.id === "g2")!;
    expect(g1.rang).toBe(1.0);
    expect(g2.rang).toBe(0.5);
    expect(g1.categorie).toBe("regle");
    expect(g1.sous_titre).toBe("combat"); // = categorie de la ligne
    expect(g1.titre).toBe("Combat");
  });

  it("LIMIT 50 : 60 lignes qui matchent → 50 résultats", () => {
    const races: Row[] = Array.from({ length: 60 }, (_v, i) => ({
      id: `x${i}`,
      nom: `Aaa objet ${i}`,
      description: "",
      resume_condense: "",
      est_actif: true,
    }));
    const res = rechercherEncyclopedieLocale({ races }, "aaa");
    expect(res.length).toBe(50);
  });
});

// ═══ 5. Non-vacuité sur le snapshot committé (branchement réel) ═══
describe("rechercherEncyclopedieLocale — snapshot réel", () => {
  const tables = getSnapshot().tables as unknown as Tables;

  it("le nom exact d'une race réelle → ≥ 1 résultat type=race rang 1.0 avec l'id correspondant", () => {
    const race = (tables.races ?? [])[0] as Row;
    expect(race).toBeTruthy();
    const nom = String(race.nom);
    const res = rechercherEncyclopedieLocale(tables, nom);
    const match = res.find((r) => r.type === "race" && r.id === String(race.id));
    expect(match).toBeTruthy();
    expect(match!.rang).toBe(1.0);
  });

  it("le nom exact d'une compétence réelle → ≥ 1 résultat type=competence rang 1.0 avec l'id correspondant", () => {
    const comp = (tables.competences ?? [])[0] as Row;
    expect(comp).toBeTruthy();
    const nom = String(comp.nom);
    const res = rechercherEncyclopedieLocale(tables, nom);
    const match = res.find((r) => r.type === "competence" && r.id === String(comp.id));
    expect(match).toBeTruthy();
    expect(match!.rang).toBe(1.0);
  });
});
