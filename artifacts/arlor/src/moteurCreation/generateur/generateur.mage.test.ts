/**
 * RECAPTURE DE LA FIXTURE (MCP, prod) — fermeture récursive des prérequis,
 * homonymes filtrés par classe (4 paires mage/prêtre) :
 *
 *   WITH RECURSIVE seed(nom) AS (SELECT unnest(ARRAY[<seeds du contenu>])),
 *   fermeture(nom) AS (
 *     SELECT nom FROM seed
 *     UNION
 *     SELECT pr.p->>'competence_nom'
 *     FROM fermeture f
 *     JOIN competences c ON c.nom = f.nom AND c.est_actif = true
 *      AND (c.nom NOT IN ('Assemblage de Runes','Développement Spirituel',
 *           'Développement Spirituel Supérieur','Canalisation')
 *           OR c.categorie = '<classe>')
 *     CROSS JOIN LATERAL jsonb_each(COALESCE(c.prerequis_competences::jsonb,'{}'::jsonb)) AS niv(k,val)
 *     CROSS JOIN LATERAL jsonb_array_elements(niv.val) AS pr(p))
 *   SELECT id, nom, categorie, classes_requises, type_achat, est_actif,
 *          niveaux épurés {niveau, cout_xp}, prerequis_competences AS prerequis
 *   FROM competences WHERE est_actif AND nom IN (SELECT nom FROM fermeture)
 *     AND (<même filtre homonymes>);
 */
import { describe, expect, it } from "vitest";

import { CatalogueCompetences } from "./catalogue";
import { CatalogueMagie, type PriereModele, type SortModele } from "./catalogueMagie";
import { composerClasse, type Catalogues } from "./composer";
import { CONTENU_MAGE } from "./contenu/mage";
import fxMage from "./fixtures/competences_mage.fixture.json";
import fxMagie from "./fixtures/magie_generateur.fixture.json";
import type { CompetenceCatalogue, Composition } from "./types";

const cats: Catalogues = {
  competences: new CatalogueCompetences(
    (fxMage as { competences: unknown[] }).competences as CompetenceCatalogue[]
  ),
  magie: new CatalogueMagie(
    fxMagie as unknown as { sorts: SortModele[]; prieres: PriereModele[] }
  ),
};
const inv = (...ids: string[]) => new Set(ids);
const composer = (
  roleId: string,
  inventaire: ReadonlySet<string>,
  budget = 60,
  element?: string,
  essentiels?: readonly ({ nom: string; niveauCible: number } | { label: string })[]
) => composerClasse(cats, CONTENU_MAGE, { roleId, inventaire, budget, element, essentiels });
const ok = (c: Composition) => {
  if (!c.ok) throw new Error(`refus inattendu : ${c.raison}`);
  return c;
};
const coutCouche = (c: Extract<Composition, { ok: true }>, couche: number) =>
  c.achats.filter((a) => a.couche === couche).reduce((s, a) => s + a.coutXp, 0) +
  c.achatsMagie.filter((m) => m.couche === couche).reduce((s, m) => s + m.coutXp, 0);

const CERCLES = [
  "Air", "Altération", "Charmes", "Combat", "Divination", "Eau", "Feu",
  "Illusion", "Magie Noire", "Magie Pure", "Nécromancie", "Protection", "Terre",
];

/** Le ② d'un rôle, dérivé par le MOTEUR sur chaque cercle. */
const noyauxParCercle = (roleId: string, inventaire: ReadonlySet<string>) =>
  CERCLES.map((cercle) => ({
    cercle,
    cout: coutCouche(ok(composer(roleId, inventaire, 80, cercle)), 2),
  }));

const bornes = (v: { cout: number }[]) => [
  Math.min(...v.map((x) => x.cout)),
  Math.max(...v.map((x) => x.cout)),
];

describe("MAGE — les 5 archétypes mesurés (§4.0.3), ② dérivé sur les 13 cercles", () => {
  // ⭐ Le cercle étant LIBRE (référence §5.1), un rôle n'a plus UN prix mais
  // une FOURCHETTE. Les bornes ci-dessous sont dérivées du catalogue, jamais
  // écrites dans le contenu — elles attestent la table §5 de la référence.
  it("⚗️ l'alchimiste sort SANS magie : ② = 25, zéro sort, zéro cercle", () => {
    const c = ok(composer("mAlchimiste", inv("fioles"), 60));
    expect(coutCouche(c, 2)).toBe(25);
    expect(c.achatsMagie).toHaveLength(0);
    expect(c.achats.map((a) => a.nom)).not.toContain("Acquisition de Cercle");
    const n2 = c.achats.filter((a) => a.couche === 2).map((a) => a.nom);
    expect(n2).toEqual(
      expect.arrayContaining([
        "Alchimie",
        "Connaissances des Herbes Rares",
        "Connaissances des Herbes Communes",
      ])
    );
  });

  it("⚗️ la magie est une OPTION ③, jamais dans son ② (décision Fred s357)", () => {
    // 4 des 7 alchimistes mesurés n'ont NI cercle NI sort : la magie ne peut
    // pas vivre dans un noyau défini comme « ≥ 80 % des membres ». Elle est
    // une entrée ③ que le joueur prend en 🧭 — et que le 🎲 ne voit pas,
    // faute de cercle tiré. ⚠️ La référence §5 comptait « ⚗️ ② = 33 avec
    // magie » : c'était un raccourci, pas une mesure. À corriger en v7.
    const sans = ok(composer("mAlchimiste", inv("fioles"), 60));
    expect(coutCouche(sans, 2)).toBe(25);

    const avec = ok(
      composer("mAlchimiste", inv("fioles"), 60, "Charmes", [
        { label: "Un cercle de magie — et un premier sort dedans" },
      ])
    );
    expect(coutCouche(avec, 2)).toBe(25); // le noyau ne bouge PAS
    expect(coutCouche(avec, 3)).toBeGreaterThan(0); // l'option est en ③
    expect(avec.achatsMagie).toHaveLength(1);
  });

  it("⚗️ son ③ = signature Alchimie 2 (14) + option magie (7 à 11) = 21–25", () => {
    const sansOption = coutCouche(ok(composer("mAlchimiste", inv("fioles"), 60)), 3);
    expect(sansOption).toBe(14); // la signature seule — 7/7 membres l'ont
    const couts = CERCLES.map((cercle) =>
      coutCouche(
        ok(
          composer("mAlchimiste", inv("fioles"), 60, cercle, [
            { label: "Un cercle de magie — et un premier sort dedans" },
          ])
        ),
        3
      )
    );
    expect([Math.min(...couts), Math.max(...couts)]).toEqual([21, 25]);
    // L'option seule : 7 XP (accès 5 + sort 2) à 11 XP (accès 5 + sort 6).
    expect([Math.min(...couts) - 14, Math.max(...couts) - 14]).toEqual([7, 11]);
  });

  it("🎭 le mage de guilde (3 sorts) : ② = 29–36", () => {
    expect(bornes(noyauxParCercle("mGuilde", inv()))).toEqual([29, 36]);
  });

  it("🔮 le canalisateur : ② = 40–44 — le PIRE CAS caster de la table", () => {
    const v = noyauxParCercle("mCanalisateur", inv());
    expect(bornes(v)).toEqual([40, 44]);
    // ②+③ = 55 au pire (③ Canalisation 2 = 11), reste 5 XP sur 60.
    const c = ok(composer("mCanalisateur", inv(), 60, "Altération"));
    expect(coutCouche(c, 2) + coutCouche(c, 3)).toBeLessThanOrEqual(55);
    expect(c.reliquat).toBeGreaterThanOrEqual(0);
  });

  it("✨ l'enchanteur (3 sorts + bâton) : ② = 21–28", () => {
    expect(bornes(noyauxParCercle("mEnchanteur", inv("baton_sceptre_baguette")))).toEqual([21, 28]);
  });

  it("ᚱ le runiste : ② = 43–47", () => {
    expect(bornes(noyauxParCercle("mRuniste", inv("feuille_crayon")))).toEqual([43, 47]);
  });

  it("🔥 « Celui qui brûle » n'existe plus — aucun groupe élémentaire mesuré (§4.0.4 ①)", () => {
    expect(CONTENU_MAGE.roles.map((r) => r.id)).toEqual([
      "mAlchimiste", "mGuilde", "mCanalisateur", "mEnchanteur", "mRuniste",
    ]);
  });
});

describe("MAGE — les portes de rôle posent LA question manquante", () => {
  it("🎭 sans cercle : le refus nomme le cercle, pas un jargon", () => {
    const c = composer("mGuilde", inv(), 60);
    expect(c.ok).toBe(false);
    expect(!c.ok && c.raison).toMatch(/cercle/i);
  });

  it("⚗️ sans fioles : le refus dit où cocher", () => {
    const c = composer("mAlchimiste", inv(), 60);
    expect(c.ok).toBe(false);
    expect(!c.ok && c.raison).toMatch(/fioles/i);
  });

  it("✨ sans bâton : le refus dit quoi apporter", () => {
    const c = composer("mEnchanteur", inv(), 60, "Charmes");
    expect(c.ok).toBe(false);
    expect(!c.ok && c.raison).toMatch(/bâton|sceptre|baguette/i);
  });

  it("ᚱ sans feuille ni crayon : le refus le dit AVANT de parler de cercle", () => {
    const c = composer("mRuniste", inv(), 60);
    expect(c.ok).toBe(false);
    expect(!c.ok && c.raison).toMatch(/écrire|feuille|crayon/i);
  });
});
