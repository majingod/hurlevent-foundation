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
import { CatalogueMagie } from "./catalogueMagie";
import { composerClasse, type Catalogues } from "./composer";
import { CONTENU_VOLEUR } from "./contenu/voleur";
import fxVoleur from "./fixtures/competences_voleur.fixture.json";
import type { CompetenceCatalogue, Composition } from "./types";

const cats: Catalogues = {
  competences: new CatalogueCompetences(
    (fxVoleur as { competences: unknown[] }).competences as CompetenceCatalogue[]
  ),
  magie: new CatalogueMagie({ sorts: [], prieres: [] }),
};
const inv = (...ids: string[]) => new Set(ids);
const composer = (
  roleId: string,
  inventaire: ReadonlySet<string>,
  budget = 60,
  essentiels?: readonly ({ nom: string; niveauCible: number } | { label: string })[]
) => composerClasse(cats, CONTENU_VOLEUR, { roleId, inventaire, budget, essentiels });
const ok = (c: Composition) => {
  if (!c.ok) throw new Error(`refus inattendu : ${c.raison}`);
  return c;
};
const coutCouche = (c: Extract<Composition, { ok: true }>, couche: number) =>
  c.achats.filter((a) => a.couche === couche).reduce((s, a) => s + a.coutXp, 0);

describe("VOLEUR — le geste d'élimination est résolu par l'arme (§4.3, base s349)", () => {
  const cas: [string[], number, string][] = [
    [["contondante_longue"], 13, "Assommer 1"],
    [["baton_hast"], 13, "Assommer 1 (le bâton l'ouvre aussi — divergence s347)"],
    [["lame_courte"], 21, "Attaque sournoise 1 (Égorgement)"],
    [["contondante_courte"], 29, "Assommer 1+2"],
    [[], 38, "Attaque sournoise 1+2 (Brise-cou, mains vides)"],
  ];
  for (const [inventaire, attendu, libelle] of cas) {
    it(`🗡️ ${libelle} : noyau ${attendu} XP`, () => {
      const c = ok(composer("vSurprise", inv(...inventaire)));
      expect(coutCouche(c, 2)).toBe(attendu);
    });
  }

  it("🗡️ la bourse ajoute Cachette secrète au noyau (13 + 10 = 23)", () => {
    const c = ok(composer("vSurprise", inv("contondante_longue", "bourse")));
    expect(coutCouche(c, 2)).toBe(23);
    expect(c.achats.some((a) => a.nom === "Cachette secrète" && a.couche === 2)).toBe(true);
  });

  it("🎯 sans arme à distance : refus avec rattrapage", () => {
    const c = composer("vTire", inv());
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.raison).toMatch(/distance/);
  });

  it("🎯 noyau 26 (arc niveau 2 : 7+9, Pistage 10) ; ④ : arc 3 SAUTÉ (plafond §2.5), Créatures possédée par son rachat, Dépeçage +16", () => {
    const c = ok(composer("vTire", inv("arme_distance")));
    expect(coutCouche(c, 2)).toBe(26);
    // L'entrée « arc niv 3 » de la spec est inatteignable à la création :
    expect(c.achats.some((a) => a.nom === "Compétence d'arme à distance" && a.niveau === 3)).toBe(false);
    // ⭐ fix s349 : le rachat rend la compétence POSSÉDÉE — Dépeçage ne la repaye pas.
    expect(c.achats.filter((a) => a.nom === "Connaissances des Créatures")).toHaveLength(1);
    const c4 = c.achats.filter((a) => a.couche === 4).map((a) => `${a.nom}:${a.coutXp}`);
    expect(c4).toContain("Premiers Soins:6");
    expect(c4).toContain("Dépeçage:10");
    expect(c.reliquat).toBe(0);
  });

  it("🪤 noyau 20 ; ④ : piège 2 (+16) puis crochetage 2 (11) puis un savoir criminel (5)", () => {
    const c = ok(composer("vPiege", inv()));
    expect(coutCouche(c, 2)).toBe(20);
    expect(c.achats.some((a) => a.nom === "Création et désarmement de piège" && a.niveau === 2 && a.coutXp === 16)).toBe(true);
    expect(c.achats.some((a) => a.nom === "Crochetage de serrure" && a.niveau === 2 && a.coutXp === 11)).toBe(true);
    expect(c.reliquat).toBe(0);
  });

  it("③ « L'empoisonneur » (fioles) : la chaîne complète 27 = Herbes 6 + Alchimie 10 + Toxicologie 11", () => {
    const c = ok(composer("vSurprise", inv("contondante_longue", "fioles"), 60, [{ label: "L'empoisonneur" }]));
    const c3 = c.achats.filter((a) => a.couche === 3).map((a) => `${a.nom}:${a.coutXp}`);
    expect(c3).toEqual([
      "Connaissances des Herbes Communes:6",
      "Alchimie:10",
      "Expertise en toxicologie:11",
    ]);
  });

  it("③ « Rumeur » : 30 = 15 + la montée de Connaissances Criminelles au niveau 2", () => {
    const c = ok(composer("vSurprise", inv("contondante_longue"), 60, [{ label: "Rumeur" }]));
    expect(coutCouche(c, 3)).toBe(30);
  });
});
