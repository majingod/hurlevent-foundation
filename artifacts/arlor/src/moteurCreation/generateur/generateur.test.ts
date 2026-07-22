/**
 * [VIS-8 lot 2a] Preuves du moteur de composition — pilote Guerrier.
 *
 * Fixture : `fixtures/competences_guerrier.fixture.json` — capture MCP prod
 * (2026-07-21, s348). Ne jamais l'éditer à la main : toute retouche de règle
 * en base impose une recapture — même patron de fermeture récursive que
 * les tests pretre/voleur/mage (seeds = les noms du contenu guerrier). Les totaux ci-dessous sont les
 * chiffres MESURÉS de la conception (§4.1/§4.5) : le moteur doit les
 * RE-DÉRIVER depuis la fixture, jamais les connaître.
 *
 * ⭐ Jumeau positif (règle gravée s346) : la promesse « reliquat ≤ 3 XP » se
 * SIMULE sur tout le domaine (rôles × budgets × inventaires min/max), pire
 * cas cité — pas seulement rédigée.
 */
import { describe, expect, it } from "vitest";

import { CatalogueCompetences, plafondCreation } from "./catalogue";
import { composerGuerrier, tirerEssentiels } from "./composer";
import {
  GRATUITES_GUERRIER,
  POND4_GUERRIER,
  POOL3_GUERRIER,
  ROLES_GUERRIER,
} from "./contenu/guerrier";
import { cheminComplet, prixChemin, type EtatPossession } from "./couts";
import fixture from "./fixtures/competences_guerrier.fixture.json";
import type { CompetenceCatalogue, Composition } from "./types";

const CAT = new CatalogueCompetences(
  fixture.competences as CompetenceCatalogue[]
);
const etatVierge = (): EtatPossession => ({ niveaux: new Map() });
const etatGuerrier = (): EtatPossession => ({
  niveaux: new Map(GRATUITES_GUERRIER.map((n) => [n, 1])),
});
const inv = (...ids: string[]) => new Set(ids);

/* ------------------------------------------------------------------ */
describe("cheminComplet — R3, prix contextuels (chiffres §4.5 re-dérivés)", () => {
  it("Forge 1 = 15 (9 + Métaux Communs 6)", () => {
    expect(
      cheminComplet(CAT, "guerrier", etatVierge(), "Forge", 1)?.total
    ).toBe(15);
  });

  it("Dépeçage 1 = 26 (10 + Créatures 10 + Premiers Soins 6)", () => {
    expect(
      cheminComplet(CAT, "guerrier", etatVierge(), "Dépeçage", 1)?.total
    ).toBe(26);
  });

  it("Hache 1 = 24 (Botte Secrète 9 en prérequis + 15)", () => {
    const r = cheminComplet(
      CAT,
      "guerrier",
      etatVierge(),
      "Compétence d'arme à la hache",
      1
    );
    expect(r?.total).toBe(24);
    expect(r?.achats.map((a) => a.nom)).toEqual([
      "Botte Secrète",
      "Compétence d'arme à la hache",
    ]);
  });

  it("Charge est contextuelle : 17 à froid, 8 quand Botte est au panier (mesuré s348)", () => {
    expect(prixChemin(CAT, "guerrier", etatVierge(), "Charge", 1)).toBe(17);
    const avecBotte = etatVierge();
    avecBotte.niveaux.set("Botte Secrète", 1);
    expect(prixChemin(CAT, "guerrier", avecBotte, "Charge", 1)).toBe(8);
  });

  it("un prérequis partagé n'est payé qu'une fois (Forge puis Mineur : 15 + 6)", () => {
    const etat = etatVierge();
    const forge = cheminComplet(CAT, "guerrier", etat, "Forge", 1);
    const mineur = cheminComplet(CAT, "guerrier", etat, "Mineur", 1);
    expect(forge?.total).toBe(15);
    expect(mineur?.total).toBe(6); // Métaux Communs déjà payé par Forge
  });

  it("les paliers se cumulent (Résolution Guerrière 1→2 = 13 + 8 = 21)", () => {
    expect(
      cheminComplet(CAT, "guerrier", etatVierge(), "Résolution Guerrière", 2)
        ?.total
    ).toBe(21);
  });
});

/* ------------------------------------------------------------------ */
describe("verrous de création — §2.5", () => {
  it("hors-classe = niveau 1 seulement (Premiers Soins, catégorie prêtre)", () => {
    expect(plafondCreation(CAT.exiger("Premiers Soins"), "guerrier")).toBe(1);
    expect(
      cheminComplet(CAT, "guerrier", etatVierge(), "Premiers Soins", 2)
    ).toBeNull();
  });

  it("sa classe ou générale = plafond création 2, jamais 3", () => {
    expect(plafondCreation(CAT.exiger("Botte Secrète"), "guerrier")).toBe(2);
    expect(plafondCreation(CAT.exiger("Estimation"), "guerrier")).toBe(2);
    expect(
      cheminComplet(CAT, "guerrier", etatVierge(), "Botte Secrète", 3)
    ).toBeNull();
  });

  it("classes_requises est un verrou absolu (Bonne santé pour un mage : 0)", () => {
    expect(plafondCreation(CAT.exiger("Bonne santé"), "mage")).toBe(0);
    expect(plafondCreation(CAT.exiger("Bonne santé"), "guerrier")).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
describe("noyaux §4.1 — les tableaux de la spec, re-dérivés", () => {
  const noyauTotal = (roleId: string, inventaire: ReadonlySet<string>) => {
    const role = ROLES_GUERRIER.find((r) => r.id === roleId)!;
    const etat = etatGuerrier();
    let total = 0;
    for (const c of role.noyau(inventaire)) {
      const r = cheminComplet(CAT, "guerrier", etat, c.nom, c.niveauCible);
      expect(r).not.toBeNull();
      total += r!.total;
    }
    return total;
  };

  it("⚔️ : deux mains 9 · masse 22 · hache 24 · hast 31 · épée 32", () => {
    expect(noyauTotal("gFrappe", inv("lame_deux_mains"))).toBe(9);
    expect(noyauTotal("gFrappe", inv("contondante_moyenne"))).toBe(22);
    expect(noyauTotal("gFrappe", inv("hache"))).toBe(24);
    expect(noyauTotal("gFrappe", inv("baton_hast"))).toBe(31);
    expect(noyauTotal("gFrappe", inv("lame_moyenne"))).toBe(32);
  });

  it("⚔️ refuse l'arc seul (cul-de-sac, Gotcha A43) et les mains vides", () => {
    const frappe = ROLES_GUERRIER.find((r) => r.id === "gFrappe")!;
    expect(frappe.requiert(inv("arme_distance"))).toMatch(/voleur/);
    expect(frappe.requiert(inv())).toMatch(/arme de mêlée/);
    expect(frappe.requiert(inv("hache"))).toBeNull();
  });

  it("🛡️ : targe 18 · cuir 17 · targe+cuir 25 · écu+maille 32 · pavois+plaques 39", () => {
    expect(noyauTotal("gTient", inv("targe"))).toBe(18);
    expect(noyauTotal("gTient", inv("armure_cuir"))).toBe(17);
    expect(noyauTotal("gTient", inv("targe", "armure_cuir"))).toBe(25);
    expect(noyauTotal("gTient", inv("ecu", "armure_maille"))).toBe(32);
    expect(noyauTotal("gTient", inv("pavois", "armure_plaques"))).toBe(39);
  });

  it("🛡️ exige AU MOINS un bouclier ou une armure (décision s341), 🔨 rien", () => {
    const tient = ROLES_GUERRIER.find((r) => r.id === "gTient")!;
    expect(tient.requiert(inv())).toMatch(/bouclier ou une armure/);
    expect(tient.requiert(inv("targe"))).toBeNull();
    const artisan = ROLES_GUERRIER.find((r) => r.id === "gArtisan")!;
    expect(artisan.requiert(inv())).toBeNull();
  });

  it("🔨 : 32 XP exactement, quel que soit l'équipement", () => {
    expect(noyauTotal("gArtisan", inv())).toBe(32);
    expect(noyauTotal("gArtisan", inv("pavois", "fioles"))).toBe(32);
  });
});

/* ------------------------------------------------------------------ */
describe("composerGuerrier — la composition tient ses comptes", () => {
  it("⚔️ deux mains, 60 XP : reliquat 3 — LE pire cas mesuré s346, reproduit", () => {
    const c = composerGuerrier(CAT, {
      classe: "guerrier",
      roleId: "gFrappe",
      inventaire: inv("lame_deux_mains"),
      budget: 60,
    }) as Extract<Composition, { ok: true }>;
    expect(c.ok).toBe(true);
    expect(c.totalDepense + c.reliquat).toBe(60);
    expect(c.reliquat).toBe(3);
    expect(c.alertes.join(" ")).toMatch(/reste 3 XP/);
  });

  it("l'Artisan les mains vides est prévenu que sa gratuité d'arme est inutilisable", () => {
    const c = composerGuerrier(CAT, {
      classe: "guerrier",
      roleId: "gArtisan",
      inventaire: inv(),
      budget: 60,
    }) as Extract<Composition, { ok: true }>;
    expect(c.ok).toBe(true);
    expect(c.alertes.join(" ")).toMatch(/inutilisable/);
    expect(c.gratuites.map((g) => g.nom)).toEqual([...GRATUITES_GUERRIER]);
  });

  it("un essentiel ③ qui ne rentre plus est écarté avec une alerte, jamais bloquant", () => {
    const c = composerGuerrier(CAT, {
      classe: "guerrier",
      roleId: "gTient",
      inventaire: inv("pavois", "armure_plaques"),
      budget: 60,
      essentiels: [{ nom: "Discours du Commandement", niveauCible: 1 }], // 17 > 21 restants ? si, rentre — Dépeçage 26 non
    }) as Extract<Composition, { ok: true }>;
    expect(c.ok).toBe(true);
    const c2 = composerGuerrier(CAT, {
      classe: "guerrier",
      roleId: "gTient",
      inventaire: inv("pavois", "armure_plaques"),
      budget: 60,
      essentiels: [{ nom: "Dépeçage", niveauCible: 1 }],
    }) as Extract<Composition, { ok: true }>;
    expect(c2.alertes.join(" ")).toMatch(/Dépeçage.*écarté/);
  });

  it("aucun achat planifié ne dépasse le plafond de création", () => {
    const c = composerGuerrier(CAT, {
      classe: "guerrier",
      roleId: "gArtisan",
      inventaire: inv(),
      budget: 80,
    }) as Extract<Composition, { ok: true }>;
    for (const a of c.achats) {
      expect(a.niveau).toBeLessThanOrEqual(
        plafondCreation(CAT.exiger(a.nom), "guerrier")
      );
    }
  });
});

/* ------------------------------------------------------------------ */
describe("⭐ SIMULATION — reliquat ≤ 3 XP sur tout le domaine (promesse s346)", () => {
  const INVENTAIRES: Record<string, ReadonlySet<string>[]> = {
    gFrappe: [
      inv("lame_deux_mains"), // noyau min 9
      inv("lame_moyenne"), // noyau max 32
      inv("hache", "targe", "armure_cuir", "deux_armes_identiques"),
    ],
    gTient: [
      inv("targe"), // min 18
      inv("pavois", "armure_plaques"), // max 39
      inv("targe", "armure_cuir", "lame_moyenne"),
    ],
    gArtisan: [inv(), inv("lame_deux_mains", "pavois", "armure_plaques")],
  };
  const rngFixe = (graine: number) => {
    // LCG déterministe — l'aléa est injecté, la CI est stable.
    let s = graine;
    return () => {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
  };

  it("rôles × budgets {60, 80} × inventaires × ③ {aucun, tiré} : jamais plus de 3 XP orphelins", () => {
    let pire = { reliquat: -1, cas: "" };
    for (const role of ROLES_GUERRIER) {
      for (const budget of [60, 80]) {
        for (const inventaire of INVENTAIRES[role.id]) {
          for (const avecTirage of [false, true]) {
            const base = { classe: "guerrier" as const, roleId: role.id, inventaire, budget };
            const essentiels = avecTirage
              ? tirerEssentiels(CAT, base, budget, rngFixe(42))
              : [];
            const c = composerGuerrier(CAT, { ...base, essentiels });
            expect(c.ok).toBe(true);
            if (!c.ok) continue;
            expect(c.reliquat).toBeGreaterThanOrEqual(0);
            expect(c.totalDepense + c.reliquat).toBe(budget);
            expect(c.reliquat).toBeLessThanOrEqual(3);
            // Jamais deux fois le même palier au panier.
            const paliers = c.achats
              .filter((a) => CAT.exiger(a.nom).type_achat === "simple")
              .map((a) => `${a.nom}@${a.niveau}`);
            expect(new Set(paliers).size).toBe(paliers.length);
            if (c.reliquat > pire.reliquat) {
              pire = {
                reliquat: c.reliquat,
                cas: `${role.emoji} budget ${budget}, [${[...inventaire].join(",") || "mains vides"}], ③ ${avecTirage ? "tiré" : "aucun"}`,
              };
            }
          }
        }
      }
    }
    // Le pire cas est CITÉ (règle s346) : ⚔️ deux mains à 60, reliquat 3.
    expect(pire.reliquat).toBe(3);
  });

  it("tirerEssentiels est déterministe à graine fixe, ≤ 2 items, conditions d'inventaire respectées", () => {
    const base = {
      classe: "guerrier" as const,
      roleId: "gFrappe",
      inventaire: inv("lame_deux_mains"),
      budget: 60,
    };
    const a = tirerEssentiels(CAT, base, 51, rngFixe(7));
    const b = tirerEssentiels(CAT, base, 51, rngFixe(7));
    expect(a).toEqual(b);
    expect(a.length).toBeLessThanOrEqual(2);
    for (const e of a) {
      const item = Object.values(POOL3_GUERRIER)
        .flat()
        .find((i) => i.nom === e.nom)!;
      if (item.condition) expect(item.condition(base.inventaire)).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
describe("intégrité du contenu — chaque nom référencé existe", () => {
  const nomsReferences = [
    ...GRATUITES_GUERRIER,
    ...ROLES_GUERRIER.flatMap((r) => [
      ...r.noyau(inv("lame_deux_mains", "hache", "baton_hast", "lame_moyenne", "contondante_moyenne", "targe", "ecu", "pavois", "armure_cuir", "armure_maille", "armure_plaques")).map((c) => c.nom),
    ]),
    ...Object.values(POOL3_GUERRIER).flat().map((i) => i.nom),
    ...Object.values(POND4_GUERRIER).flat().flatMap((e) => [e.nom]),
  ];

  it("dans la fixture MCP (le catalogue lève sinon)", () => {
    for (const nom of nomsReferences) expect(CAT.exiger(nom).nom).toBe(nom);
  });

  it("dans le snapshot bundlé (tolérant : présence des noms seulement)", async () => {
    const snapshot = (await import("@/data/snapshotVisiteur.json")) as {
      tables: { competences?: { nom: string | null }[] };
    };
    const noms = new Set(
      (snapshot.tables.competences ?? []).map((c) => c.nom)
    );
    for (const nom of new Set(nomsReferences)) {
      expect(noms.has(nom), `« ${nom} » absent du snapshot bundlé`).toBe(true);
    }
  });
});
