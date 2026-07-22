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
import { CONTENU_PRETRE } from "./contenu/pretre";
import fxPretre from "./fixtures/competences_pretre.fixture.json";
import fxMagie from "./fixtures/magie_generateur.fixture.json";
import type { CompetenceCatalogue, Composition } from "./types";

const cats: Catalogues = {
  competences: new CatalogueCompetences(
    (fxPretre as { competences: unknown[] }).competences as CompetenceCatalogue[]
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
  essentiels?: readonly ({ nom: string; niveauCible: number } | { label: string })[]
) => composerClasse(cats, CONTENU_PRETRE, { roleId, inventaire, budget, essentiels });
const ok = (c: Composition) => {
  if (!c.ok) throw new Error(`refus inattendu : ${c.raison}`);
  return c;
};
const coutCouche = (c: Extract<Composition, { ok: true }>, couche: number) =>
  c.achats.filter((a) => a.couche === couche).reduce((s, a) => s + a.coutXp, 0) +
  c.achatsMagie.filter((m) => m.couche === couche).reduce((s, m) => s + m.coutXp, 0);

describe("PRÊTRE — noyaux attestés (§4.2, chiffres MCP s349)", () => {
  it("✝️ Le Soigneur : 22 XP, rampe incluse (Réveil 4 + Premiers Soins 6 + Domaine 5 + Prière 0 + Soins 7)", () => {
    const c = ok(composer("pSoigne", inv(), 22)); // budget = noyau : ④ ne tire pas
    expect(coutCouche(c, 2)).toBe(22);
    const noms = c.achats.filter((a) => a.couche === 2).map((a) => `${a.nom}@${a.niveau}:${a.coutXp}`);
    expect(noms).toContain("Premiers Soins@1:6");
    expect(noms).toContain("Réveil Expéditif@1:4");
    expect(noms).toContain("Acquisition de Domaine@1:5");
    expect(noms).toContain("Acquisition de Prière@1:0");
    const soins = c.achatsMagie.find((m) => m.nom === "Soins" && m.couche === 2);
    expect(soins).toMatchObject({ coutXp: 7, coutPS: 2, config: { niveau: 1, zone: "2 Cibles", portee: "5 Pieds" } });
  });

  it("✝️ ④ monte la MÊME prière au niveau 3 — EN PLACE au noyau (trace ④, delta +2), jamais deux exemplaires", () => {
    const c = ok(composer("pSoigne", inv()));
    const soins = c.achatsMagie.filter((m) => m.nom === "Soins");
    expect(soins).toHaveLength(1);
    expect(soins[0]).toMatchObject({
      couche: 2, // elle reste la prière du noyau
      coutXp: 9,
      config: { niveau: 3 },
      surclasse: { deNiveau: 1, deCoutXp: 7, parCouche: 4 },
    });
    expect(c.reliquat).toBeLessThanOrEqual(3);
    expect(c.totalDepense + c.reliquat).toBe(60);
  });

  it("🛡️ Le Prêtre de front : protections cochées + Soins niveau 3 au toucher (rampe incluse : 11)", () => {
    const c = ok(composer("pFront", inv("armure_maille", "ecu")));
    expect(coutCouche(c, 2)).toBe(33); // 12 + 10 + (5 + 0 + 6)
    const soins = c.achatsMagie.find((m) => m.couche === 2);
    expect(soins).toMatchObject({ nom: "Soins", coutXp: 6, coutPS: 2, config: { niveau: 3, portee: "Toucher", zone: "1 Cible" } });
  });

  it("🛡️ sans aucune protection apportée : refus avec rattrapage", () => {
    const c = composer("pFront", inv());
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.raison).toMatch(/protection/);
  });

  it("⛪ Le Prêtre de rite : 23 XP (Consécration 7 + Bénédiction 2 : 8 + Grande Messe 8) — aucune prière", () => {
    const c = ok(composer("pRite", inv()));
    expect(coutCouche(c, 2)).toBe(23);
    expect(c.achatsMagie).toHaveLength(0);
    // ④ (spec : l'érudit des cultes d'abord) : 9 savoirs de Religions, la
    // Grande Messe 2 ne rentre plus — reliquat 1.
    expect(c.achats.filter((a) => a.nom === "Connaissances des Religions").length).toBe(9);
    expect(c.achats.some((a) => a.nom === "Grande Messe" && a.niveau === 2)).toBe(false);
    expect(c.reliquat).toBe(1);
  });

  it("③ un essentiel par label du pool : « Diagnostic » = 6 XP en couche 3", () => {
    const c = ok(composer("pRite", inv(), 60, [{ label: "Diagnostic" }]));
    expect(coutCouche(c, 3)).toBe(6);
  });
});
