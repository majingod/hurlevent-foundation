/**
 * [VIS-8 lot A2] Preuves du contenu VOLEUR — les 3 archétypes MESURÉS
 * (conception §4.0.3, arrêtés Fred s350 ; ids arrêtés s352).
 *
 * Fixture : `fixtures/competences_voleur.fixture.json` — capture MCP prod
 * (2026-07-23, s353), fermeture récursive des prérequis. SELECT :
 *   WITH RECURSIVE seed(nom) AS (SELECT unnest(ARRAY[<seeds du contenu>])),
 *   fermeture(nom) AS (
 *     SELECT nom FROM seed
 *     UNION
 *     SELECT pr.p->>'competence_nom'
 *     FROM fermeture f
 *     JOIN competences c ON c.nom = f.nom AND c.est_actif = true
 *      AND (c.nom NOT IN ('Assemblage de Runes','Développement Spirituel',
 *           'Développement Spirituel Supérieur','Canalisation')
 *           OR c.categorie = 'voleur')
 *     CROSS JOIN LATERAL jsonb_each(COALESCE(c.prerequis_competences::jsonb,'{}'::jsonb)) AS niv(k,val)
 *     CROSS JOIN LATERAL jsonb_array_elements(niv.val) AS pr(p))
 *   SELECT id, nom, categorie, classes_requises, type_achat, est_actif,
 *          niveaux épurés {niveau, cout_xp}, prerequis_competences AS prerequis
 *   FROM competences WHERE est_actif AND nom IN (SELECT nom FROM fermeture)
 *     AND (<même filtre homonymes>);
 *
 * ⭐ Chiffres attendus = `VIS8_archetypes_REFERENCE_v2.md` §5 (seule autorité).
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
const compose = (roleId: string, inventaire: Set<string>, budget = 60) =>
  composerClasse(cats, CONTENU_VOLEUR, {
    classe: "voleur",
    roleId,
    inventaire,
    budget,
  });
const ok = (c: Composition) => {
  if (!c.ok) throw new Error(`refus inattendu : ${c.raison}`);
  return c;
};
const couche = (c: Extract<Composition, { ok: true }>, n: 2 | 3 | 4) =>
  c.achats.filter((a) => a.couche === n).reduce((s, a) => s + a.coutXp, 0);

describe("VOLEUR — les 3 archétypes mesurés (§4.0.3)", () => {
  it("💎 L'orfèvre : noyau 25 (Linguistique 4 + Joaillerie 5 + Métaux Communs 6 + Cachette 10)", () => {
    const c = ok(compose("vOrfevre", inv("bourse"), 80));
    expect(couche(c, 2)).toBe(25);
  });

  it("💎 exige la bourse — sans elle, refus avec la phrase de rattrapage", () => {
    const c = compose("vOrfevre", inv("lame_courte"));
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.raison).toMatch(/bourse/);
  });

  it("💎 signature : Joaillerie 2 (9) + Estimation 2 (11) = 20 → ②+③ = 45", () => {
    const c = ok(compose("vOrfevre", inv("bourse"), 80));
    expect(couche(c, 3)).toBe(20);
    expect(couche(c, 2) + couche(c, 3)).toBe(45);
    // Estimation est GRATUITE au niveau 1 (socle voleur) : la montée coûte
    // le seul palier 2.
    expect(
      c.achats.some((a) => a.nom === "Estimation" && a.niveau === 2)
    ).toBe(true);
    expect(
      c.achats.some((a) => a.nom === "Estimation" && a.niveau === 1)
    ).toBe(false);
  });

  it("🗡️ Frappe le premier : noyau 30 — Rumeur 15 + Criminelles 1 (5) et 2 (10) FORCÉES", () => {
    const c = ok(compose("vPremier", inv(), 80));
    expect(couche(c, 2)).toBe(30);
    const crim = c.achats.filter(
      (a) => a.nom === "Connaissances Criminelles" && a.couche === 2
    );
    expect(crim.map((a) => a.niveau).sort()).toEqual([1, 2]);
  });

  it("🗡️ n'a AUCUNE signature ③ : sa montée est déjà dans le noyau (décision 27)", () => {
    const c = ok(compose("vPremier", inv(), 80));
    expect(couche(c, 3)).toBe(0);
    expect(CONTENU_VOLEUR.signature3?.vPremier).toBeUndefined();
  });

  it("🗡️ est jouable les mains vides (aucun objet exigé)", () => {
    expect(compose("vPremier", inv()).ok).toBe(true);
  });

  it("🌲 L'éclaireur : noyau 26 avec la bourse, 16 sans (Cachette conditionnelle)", () => {
    expect(couche(ok(compose("vEclaireur", inv("bandages", "bourse"), 80)), 2)).toBe(
      26
    );
    expect(couche(ok(compose("vEclaireur", inv("bandages"), 80)), 2)).toBe(16);
  });

  it("🌲 exige les bandages — sans eux, refus avec la phrase de rattrapage", () => {
    const c = compose("vEclaireur", inv("bourse"));
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.raison).toMatch(/bandages/);
  });

  it("③ « Piège sécurisé » porte son chemin complet : 20 = 9 + Création de piège 11", () => {
    const c = ok(
      composerClasse(cats, CONTENU_VOLEUR, {
        classe: "voleur",
        roleId: "vEclaireur",
        inventaire: inv("bandages", "bourse"),
        budget: 80,
        essentiels: [{ label: "Piège sécurisé" }],
      })
    );
    expect(couche(c, 3)).toBe(20);
  });

  it("les rôles supprimés ne survivent pas (vTire : 0 joueur mesuré)", () => {
    const ids = CONTENU_VOLEUR.roles.map((r) => r.id);
    expect(ids).toEqual(["vOrfevre", "vPremier", "vEclaireur"]);
    for (const mort of ["vSurprise", "vTire", "vPiege"]) {
      expect(ids).not.toContain(mort);
    }
  });

  it("aucune entrée « Compétence d'arme à distance 3 » ne subsiste (inatteignable §2.1)", () => {
    const labels = [
      ...Object.values(CONTENU_VOLEUR.pool3).flat().map((e) => e.label),
      ...Object.values(CONTENU_VOLEUR.pond4)
        .flat()
        .map((e) => (e.type === "jauge" ? e.nom : e.label)),
    ];
    expect(labels.some((l) => l.includes("distance 3"))).toBe(false);
  });
});
