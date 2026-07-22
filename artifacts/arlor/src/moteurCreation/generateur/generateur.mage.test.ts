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

describe("MAGE — noyaux attestés (§4.4, chiffres MCP s349, politique boucliers au toucher)", () => {
  it("🔥 Feu : 37 = rampe Cercle 1+2 (15) + Jet de flammes niv 6 (11) + Bouclier de Feu niv 10 au toucher (11)", () => {
    const c = ok(composer("mBrule", inv(), 60, "Feu"));
    expect(coutCouche(c, 2)).toBe(37);
    const noms = c.achats.filter((a) => a.couche === 2).map((a) => `${a.nom}@${a.niveau}:${a.coutXp}`);
    expect(noms).toContain("Acquisition de Cercle@1:5");
    expect(noms).toContain("Acquisition de Cercle@2:10");
    expect(noms).toContain("Acquisition de Sort@1:0");
    expect(c.achatsMagie.map((m) => `${m.nom}:${m.coutXp}/${m.coutPS}PS`)).toEqual([
      "Jet de flammes:11/3PS",
      "Bouclier de Feu:11/3PS",
    ]);
  });

  it("🔥 Magie Pure : 36 (bouclier plafonné 10 minutes → 10) · Nécromancie : 37", () => {
    const mp = ok(composer("mBrule", inv(), 60, "Magie Pure"));
    expect(coutCouche(mp, 2)).toBe(36);
    expect(mp.achatsMagie.find((m) => m.nom === "Bouclier Magique")).toMatchObject({
      coutXp: 10,
      config: { duree: "10 Minutes" },
    });
    const necro = ok(composer("mBrule", inv(), 60, "Nécromancie"));
    expect(coutCouche(necro, 2)).toBe(37);
  });

  it("🔥 sans élément choisi : refus qui pose LA question", () => {
    const c = composer("mBrule", inv(), 60);
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.raison).toMatch(/élément/);
  });

  it("🔥 ④ : Dév Spirituel prioritaire (×10) puis plus rien ne rentre — reliquat 3 (pire cas caster)", () => {
    const c = ok(composer("mBrule", inv(), 60, "Feu"));
    expect(c.achats.filter((a) => a.nom === "Développement Spirituel")).toHaveLength(10);
    expect(c.reliquat).toBe(3);
  });

  it("⚗️ fioles : noyau 16 (Herbes 6 + Alchimie 10) ; ④ Alchimie 2 tire Herbes Rares (23) puis Potions (+4) — reliquat 1", () => {
    const c = ok(composer("mAlchimiste", inv("fioles")));
    expect(coutCouche(c, 2)).toBe(16);
    expect(c.achats.filter((a) => a.nom === "Connaissances des Herbes Rares")).toHaveLength(1);
    expect(c.achats.some((a) => a.nom === "Identification des Potions" && a.coutXp === 4)).toBe(true);
    expect(c.reliquat).toBe(1);
    const sansFioles = composer("mAlchimiste", inv());
    expect(sansFioles.ok).toBe(false);
    if (!sansFioles.ok) expect(sansFioles.raison).toMatch(/fioles/);
  });

  it("ᚱ feuille+crayon : noyau 26 (Runes 12 + Canalisation 6 + Assemblage 8) ; ④ Assemblage 2 (+14)", () => {
    const c = ok(composer("mRuniste", inv("feuille_crayon")));
    expect(coutCouche(c, 2)).toBe(26);
    expect(c.achats.some((a) => a.nom === "Assemblage de Runes" && a.niveau === 2 && a.coutXp === 14)).toBe(true);
    expect(c.reliquat).toBe(0);
  });

  it("③ « Un deuxième élément » : jamais un accès sec — le rachat du cercle (5) ET un premier sort (6)", () => {
    const c = ok(
      composer("mBrule", inv(), 80, "Feu", [
        { label: "Un deuxième élément — un cercle + un sort dedans" },
      ])
    );
    expect(coutCouche(c, 3)).toBe(11);
    expect(c.achats.filter((a) => a.nom === "Acquisition de Cercle")).toHaveLength(3); // niv 1 + niv 2 + le rachat
    expect(c.achatsMagie.some((m) => m.nom === "Rayon Électrique" && m.config.niveau === 1 && m.coutXp === 6)).toBe(true);
  });
});
