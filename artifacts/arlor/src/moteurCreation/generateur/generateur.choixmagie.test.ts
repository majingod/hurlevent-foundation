/**
 * ⭐ [R1a s361] LE CERCLE ET LE DOMAINE ONT ENFIN UN NOM.
 *
 * MESURE FONDATRICE (prod du 2026-07-25) : `Acquisition de Cercle` et
 * `Acquisition de Domaine` sont `multiple_avec_choix_par_niveau` — 122 + 56
 * lignes en base, **zéro sans `choix_achat`**. Le générateur, lui, posait des
 * accès ANONYMES : une ligne comme il n'en existe aucune chez un joueur.
 *
 * Les portes (`Acquisition de Sort` / `de Prière`) sont `simple` : 32 + 23
 * lignes, **zéro AVEC choix**. Leur en coller un serait le défaut inverse.
 *
 * ⚠️ CHAQUE GARDE EST DOUBLÉE DE SA PREUVE PAR LE CONTRAIRE : un test
 * « X n'apparaît pas » est vert à vide s'il n'a rien exercé.
 */
import { describe, expect, it } from "vitest";

import { CatalogueCompetences } from "./catalogue";
import { CatalogueMagie, type PriereModele, type SortModele } from "./catalogueMagie";
import { composerClasse, tirerEssentielsClasse, type Catalogues } from "./composer";
import { CONTENU_MAGE } from "./contenu/mage";
import { CONTENU_PRETRE } from "./contenu/pretre";
import fxMage from "./fixtures/competences_mage.fixture.json";
import fxPretre from "./fixtures/competences_pretre.fixture.json";
import fxMagie from "./fixtures/magie_generateur.fixture.json";
import type { CompetenceCatalogue, Composition, CompositionOk } from "./types";

const magie = new CatalogueMagie(
  fxMagie as unknown as { sorts: SortModele[]; prieres: PriereModele[] }
);
const catsMage: Catalogues = {
  competences: new CatalogueCompetences(
    (fxMage as { competences: unknown[] }).competences as CompetenceCatalogue[]
  ),
  magie,
};
const catsPretre: Catalogues = {
  competences: new CatalogueCompetences(
    (fxPretre as { competences: unknown[] }).competences as CompetenceCatalogue[]
  ),
  magie,
};

const ok = (c: Composition): CompositionOk => {
  if (!c.ok) throw new Error(`refus inattendu : ${c.raison}`);
  return c;
};
const lignes = (c: CompositionOk, nom: string) =>
  c.achats.filter((a) => a.nom === nom);

describe("⭐ le choix_achat voyage avec l'achat", () => {
  it("🔥 l'accès au cercle NOMME le cercle du personnage", () => {
    const c = ok(
      composerClasse(catsMage, CONTENU_MAGE, {
        classe: "mage",
        roleId: "mGuilde",
        inventaire: new Set<string>(),
        budget: 80,
        element: "Feu",
      })
    );
    const acces = lignes(c, "Acquisition de Cercle");
    expect(acces.length).toBeGreaterThan(0);
    for (const a of acces) expect(a.choix).toBe("Feu");
  });

  it("PREUVE PAR LE CONTRAIRE — un autre cercle donne un autre nom", () => {
    const c = ok(
      composerClasse(catsMage, CONTENU_MAGE, {
        classe: "mage",
        roleId: "mGuilde",
        inventaire: new Set<string>(),
        budget: 80,
        element: "Magie Pure",
      })
    );
    for (const a of lignes(c, "Acquisition de Cercle"))
      expect(a.choix).toBe("Magie Pure");
  });

  it("⛔ la PORTE (`Acquisition de Sort`) n'a JAMAIS de choix — elle est `simple`", () => {
    const c = ok(
      composerClasse(catsMage, CONTENU_MAGE, {
        classe: "mage",
        roleId: "mGuilde",
        inventaire: new Set<string>(),
        budget: 80,
        element: "Feu",
      })
    );
    const porte = lignes(c, "Acquisition de Sort");
    expect(porte.length).toBeGreaterThan(0); // sinon le test est vert à vide
    for (const a of porte) expect(a.choix).toBeUndefined();
  });

  it("⛪ l'accès au domaine NOMME le domaine imposé par l'archétype", () => {
    const c = ok(
      composerClasse(catsPretre, CONTENU_PRETRE, {
        classe: "pretre",
        roleId: "pMissionnaire", // 🕊️ impose `Guerre` (magieImposee)
        inventaire: new Set<string>(),
        budget: 80,
      })
    );
    const acces = lignes(c, "Acquisition de Domaine");
    expect(acces.length).toBeGreaterThan(0);
    for (const a of acces) expect(a.choix).toBe("Guerre");
  });
});

describe("⭐ le SECOND cercle / SECOND domaine", () => {
  const secondsCercles = (element2?: string) => {
    const c = ok(
      composerClasse(catsMage, CONTENU_MAGE, {
        classe: "mage",
        roleId: "mEnchanteur",
        inventaire: new Set(["baton_sceptre_baguette"]),
        budget: 80,
        element: "Charmes",
        element2,
        essentiels: [{ label: "Un SECOND cercle — et un premier sort dedans" }],
      })
    );
    return lignes(c, "Acquisition de Cercle").filter(
      (a) => a.choix === element2
    );
  };

  it("sans second cercle choisi, l'entrée n'achète RIEN", () => {
    expect(secondsCercles(undefined)).toEqual([]);
  });

  it("PREUVE PAR LE CONTRAIRE — avec un second cercle, la ligne existe ET le nomme", () => {
    const l = secondsCercles("Illusion");
    expect(l.length).toBe(1);
    expect(l[0].choix).toBe("Illusion");
    expect(l[0].couche).toBe(3);
  });

  it("⛔ un « second » cercle identique au premier est écarté — pas de doublon", () => {
    const c = ok(
      composerClasse(catsMage, CONTENU_MAGE, {
        classe: "mage",
        roleId: "mEnchanteur",
        inventaire: new Set(["baton_sceptre_baguette"]),
        budget: 80,
        element: "Charmes",
        element2: "Charmes",
        essentiels: [{ label: "Un SECOND cercle — et un premier sort dedans" }],
      })
    );
    expect(lignes(c, "Acquisition de Cercle").filter((a) => a.couche === 3)).toEqual([]);
  });

  it("⛪ jumeau prêtre : le second domaine existe et se nomme", () => {
    const c = ok(
      composerClasse(catsPretre, CONTENU_PRETRE, {
        classe: "pretre",
        roleId: "pMissionnaire",
        inventaire: new Set<string>(),
        budget: 80,
        element2: "Ordre", // Guerre + Ordre, mesuré s380
        essentiels: [{ label: "Un SECOND domaine de prière" }],
      })
    );
    const l = lignes(c, "Acquisition de Domaine").filter((a) => a.choix === "Ordre");
    expect(l.length).toBe(1);
    expect(l[0].couche).toBe(3);
  });

  it("🎲 le TIRAGE ne peut pas sortir un second cercle sans qu'on en ait choisi un", () => {
    const tires = tirerEssentielsClasse(
      catsMage,
      CONTENU_MAGE,
      {
        classe: "mage",
        roleId: "mEnchanteur",
        inventaire: new Set(["baton_sceptre_baguette"]),
        budget: 80,
        element: "Charmes",
      },
      80,
      () => 0.5
    );
    expect(tires.map((t) => t.label)).not.toContain(
      "Un SECOND cercle — et un premier sort dedans"
    );
  });

  it("PREUVE PAR LE CONTRAIRE — avec `element2`, le tirage PEUT la sortir", () => {
    // Sans ce jumeau, le test ci-dessus serait vert même si l'entrée
    // n'existait pas du tout dans le pool.
    const vu = new Set<string>();
    for (let k = 0; k < 40; k++) {
      const r = k / 40;
      for (const t of tirerEssentielsClasse(
        catsMage,
        CONTENU_MAGE,
        {
          classe: "mage",
          roleId: "mEnchanteur",
          inventaire: new Set(["baton_sceptre_baguette"]),
          budget: 80,
          element: "Charmes",
          element2: "Illusion",
        },
        80,
        () => r
      ))
        vu.add(t.label);
    }
    expect([...vu]).toContain("Un SECOND cercle — et un premier sort dedans");
  });
});
