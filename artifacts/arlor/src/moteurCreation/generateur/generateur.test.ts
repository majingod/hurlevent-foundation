/**
 * [VIS-8 lot A2] Preuves du moteur de composition — GUERRIER, les 3
 * archétypes MESURÉS (conception §4.0.3, arrêtés Fred s350).
 *
 * Fixture : `fixtures/competences_guerrier.fixture.json` — capture MCP prod
 * (2026-07-23, s353). Ne jamais l'éditer à la main : toute retouche de règle
 * en base impose une recapture. SELECT :
 *   WITH RECURSIVE seed(nom) AS (SELECT unnest(ARRAY[<seeds du contenu>])),
 *   fermeture(nom) AS (
 *     SELECT nom FROM seed
 *     UNION
 *     SELECT pr.p->>'competence_nom'
 *     FROM fermeture f
 *     JOIN competences c ON c.nom = f.nom AND c.est_actif = true
 *      AND (c.nom NOT IN ('Assemblage de Runes','Développement Spirituel',
 *           'Développement Spirituel Supérieur','Canalisation')
 *           OR c.categorie = 'guerrier')
 *     CROSS JOIN LATERAL jsonb_each(COALESCE(c.prerequis_competences::jsonb,'{}'::jsonb)) AS niv(k,val)
 *     CROSS JOIN LATERAL jsonb_array_elements(niv.val) AS pr(p))
 *   SELECT id, nom, categorie, classes_requises, type_achat, est_actif,
 *          niveaux épurés {niveau, cout_xp}, prerequis_competences AS prerequis
 *   FROM competences WHERE est_actif AND nom IN (SELECT nom FROM fermeture)
 *     AND (<même filtre homonymes>);
 *
 * ⭐ Les totaux ci-dessous sont ceux de `VIS8_archetypes_REFERENCE_v2.md` §5
 * (SEULE autorité sur les coûts) : le moteur doit les RE-DÉRIVER depuis la
 * fixture, jamais les connaître. ⚠️ Ne PAS lire les coûts du §4.0.3 de la
 * conception — ils divergent sur 13 archétypes sur 15 (dette
 * [VIS8-CHIFFRAGE-3-MAISONS]).
 */
import { describe, expect, it } from "vitest";

import { CatalogueCompetences, plafondCreation } from "./catalogue";
import { CatalogueMagie } from "./catalogueMagie";
import { composerClasse, type Catalogues } from "./composer";
import {
  CONTENU_GUERRIER,
  GRATUITES_GUERRIER,
  POND4_GUERRIER,
  POOL3_GUERRIER,
  ROLES_GUERRIER,
  SIGNATURE3_GUERRIER,
} from "./contenu/guerrier";
import { cheminComplet, prixChemin, type EtatPossession } from "./couts";
import fixture from "./fixtures/competences_guerrier.fixture.json";
import type { CompetenceCatalogue, Composition } from "./types";

const CAT = new CatalogueCompetences(
  fixture.competences as CompetenceCatalogue[]
);
const cats: Catalogues = {
  competences: CAT,
  magie: new CatalogueMagie({ sorts: [], prieres: [] }),
};

const etatVierge = (): EtatPossession => ({ niveaux: new Map() });
const etatGuerrier = (): EtatPossession => ({
  niveaux: new Map(GRATUITES_GUERRIER.map((n) => [n, 1] as const)),
});
const inv = (...ids: string[]) => new Set(ids);

const compose = (roleId: string, inventaire: Set<string>, budget = 60) =>
  composerClasse(cats, CONTENU_GUERRIER, {
    classe: "guerrier",
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

/** Chiffre un noyau comme le composeur : chemins complets enchaînés sur un
 *  état partagé, donc un prérequis commun n'est payé qu'une fois. */
const noyau = (roleId: string, inventaire: Set<string>) => {
  const role = ROLES_GUERRIER.find((r) => r.id === roleId)!;
  const etat = etatGuerrier();
  let total = 0;
  for (const a of role.noyau(inventaire, {})) {
    const cible = "niveauCible" in a ? a.niveauCible : 1;
    const r = cheminComplet(CAT, "guerrier", etat, a.nom, cible);
    expect(r, `${roleId} — ${a.nom}@${cible} refusé par le plafond`).not.toBeNull();
    total += r!.total;
  }
  return total;
};

/* ------------------------------------------------------------------ */

describe("cheminComplet — R3, prix contextuels re-dérivés de la fixture", () => {
  it("Forge 1 = 15 (9 + Métaux Communs 6)", () => {
    expect(cheminComplet(CAT, "guerrier", etatVierge(), "Forge", 1)!.total).toBe(
      15
    );
  });

  it("Mineur 1 = 12 (6 + Métaux Communs 6)", () => {
    expect(cheminComplet(CAT, "guerrier", etatVierge(), "Mineur", 1)!.total).toBe(
      12
    );
  });

  it("Connaissances des Métaux Rares 1 = 16 (10 + Métaux Communs 6)", () => {
    expect(
      cheminComplet(CAT, "guerrier", etatVierge(), "Connaissances des Métaux Rares", 1)!
        .total
    ).toBe(16);
  });

  it("Charge est contextuelle : 17 à froid, 8 quand Botte est au panier", () => {
    expect(cheminComplet(CAT, "guerrier", etatVierge(), "Charge", 1)!.total).toBe(
      17
    );
    const avec: EtatPossession = { niveaux: new Map([["Botte Secrète", 1]]) };
    expect(prixChemin(CAT, "guerrier", avec, "Charge", 1)).toBe(8);
  });

  it("un prérequis partagé n'est payé qu'une fois (Forge puis Mineur : 15 + 6)", () => {
    const etat = etatVierge();
    const forge = cheminComplet(CAT, "guerrier", etat, "Forge", 1)!;
    const mineur = cheminComplet(CAT, "guerrier", etat, "Mineur", 1)!;
    expect(forge.total).toBe(15);
    expect(mineur.total).toBe(6);
    expect(forge.total + mineur.total).toBe(21);
  });

  it("les paliers se cumulent (Résolution Guerrière 1→2 = 13 + 8 = 21)", () => {
    expect(
      cheminComplet(CAT, "guerrier", etatVierge(), "Résolution Guerrière", 2)!
        .total
    ).toBe(21);
  });
});

describe("verrous de création — §2.5", () => {
  it("hors-classe = niveau 1 seulement (Premiers Soins, catégorie prêtre)", () => {
    expect(plafondCreation(CAT.exiger("Premiers Soins"), "guerrier")).toBe(1);
  });

  it("sa classe ou générale = plafond création 2, jamais 3", () => {
    expect(plafondCreation(CAT.exiger("Botte Secrète"), "guerrier")).toBe(2);
    expect(plafondCreation(CAT.exiger("Mineur"), "guerrier")).toBe(2);
  });

  it("classes_requises est un verrou absolu (Bonne santé pour un mage : 0)", () => {
    expect(plafondCreation(CAT.exiger("Bonne santé"), "mage")).toBe(0);
  });
});

describe("② noyaux des 3 archétypes mesurés — table §5 re-dérivée", () => {
  it("🔨 Le forgeron : 26 XP, quel que soit l'équipement apporté", () => {
    expect(noyau("gForgeron", inv())).toBe(26);
    expect(noyau("gForgeron", inv("armure_plaques", "pavois", "lame_longue"))).toBe(
      26
    );
  });

  it("🛡️ Celui qui tient : créneau armure + créneau arme — plaques+lame = 43", () => {
    expect(noyau("gTient", inv("armure_plaques", "lame_longue"))).toBe(43);
    expect(noyau("gTient", inv("armure_cuir", "lame_moyenne"))).toBe(33);
    expect(noyau("gTient", inv("armure_maille", "contondante_moyenne"))).toBe(27);
    expect(noyau("gTient", inv("armure_cuir"))).toBe(13);
  });

  it("⚔️ Celui qui frappe : 19 XP (Berserk 11 + Combat à deux armes 8)", () => {
    expect(noyau("gFrappe", inv("deux_armes_identiques"))).toBe(19);
  });

  it("🔨 est jouable les mains vides ; 🛡️ exige une armure ; ⚔️ une arme de mêlée", () => {
    expect(compose("gForgeron", inv()).ok).toBe(true);
    const t = compose("gTient", inv("lame_longue"));
    expect(t.ok).toBe(false);
    if (!t.ok) expect(t.raison).toMatch(/armure/);
    // ⭐ PORTE LARGE (arbitrage Fred s353) : une seule épée suffit.
    expect(compose("gFrappe", inv("lame_longue")).ok).toBe(true);
    expect(compose("gFrappe", inv("deux_armes_identiques")).ok).toBe(true);
    const f = compose("gFrappe", inv("arme_distance"));
    expect(f.ok).toBe(false);
    if (!f.ok) expect(f.raison).toMatch(/arc seul/);
    const g = compose("gFrappe", inv("armure_plaques"));
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.raison).toMatch(/arme de mêlée/);
  });

  it("⚔️ sans deux armes identiques : la Botte Secrète tient le geste offensif", () => {
    expect(noyau("gFrappe", inv("deux_armes_identiques"))).toBe(19);
    expect(noyau("gFrappe", inv("lame_longue"))).toBe(20);
    const c = ok(compose("gFrappe", inv("lame_longue"), 80));
    expect(c.achats.some((a) => a.nom === "Combat à deux armes")).toBe(false);
    expect(
      c.achats.some((a) => a.nom === "Botte Secrète" && a.couche === 2)
    ).toBe(true);
  });
});

describe("③a signature — l'archétype reste reconnaissable (PR #716)", () => {
  it("🔨 monte Mineur 2 (9) → ②+③ = 35, la valeur §5", () => {
    const c = ok(compose("gForgeron", inv(), 80));
    expect(couche(c, 2)).toBe(26);
    expect(couche(c, 3)).toBe(9);
    expect(
      c.achats.some((a) => a.nom === "Mineur" && a.niveau === 2 && a.couche === 3)
    ).toBe(true);
  });

  it("🛡️ monte Botte Secrète 2 (12) → ②+③ = 55, LE plus cher des 15", () => {
    const c = ok(compose("gTient", inv("armure_plaques", "lame_longue"), 80));
    expect(couche(c, 2) + couche(c, 3)).toBe(55);
    expect(couche(c, 3)).toBe(12);
  });

  it("⚔️ monte Berserk 2 et Combat à deux armes 2 (26) → ②+③ = 45", () => {
    const c = ok(compose("gFrappe", inv("deux_armes_identiques"), 80));
    expect(couche(c, 2) + couche(c, 3)).toBe(45);
    expect(couche(c, 3)).toBe(26);
  });

  it("⚔️ à une seule arme : la signature bascule sur Botte Secrète 2 (12)", () => {
    const c = ok(compose("gFrappe", inv("lame_longue"), 80));
    expect(couche(c, 3)).toBe(27); // Berserk 2 (15) + Botte Secrète 2 (12)
    expect(
      c.achats.some((a) => a.nom === "Botte Secrète" && a.niveau === 2)
    ).toBe(true);
  });

  it("🛡️ sans arme de mêlée : la signature est SAUTÉE, jamais bloquante", () => {
    const c = ok(compose("gTient", inv("armure_cuir"), 80));
    expect(c.achats.some((a) => a.nom === "Botte Secrète")).toBe(false);
    expect(couche(c, 3)).toBe(0);
  });
});

describe("la composition tient ses comptes", () => {
  it("🔨 les mains vides à 60 XP : reliquat 3, dit au joueur (décision 15 ; chiffre s374)", () => {
    // ⭐ [s374] L'ancien « reliquat 1 » attestait LE DÉFAUT, pas une règle :
    // le forgeron dépensait 2 XP en Développement Spirituel qu'aucune magie
    // ne consomme. La règle d'usage (arbitrage Fred) les laisse au joueur.
    const c = ok(compose("gForgeron", inv(), 60));
    expect(c.reliquat).toBe(3);
    expect(c.totalDepense + c.reliquat).toBe(60);
    expect(c.alertes.some((a) => a.includes("Il reste 3 XP"))).toBe(true);
    // Et plus AUCUN point de spiritualité sur cette fiche :
    expect(
      c.achats.filter((a) => a.nom.startsWith("Développement Spirituel"))
    ).toEqual([]);
  });

  it("⭐ plus JAMAIS de rafale de Connaissances des Religions (arbitrage Fred s353)", () => {
    // Avant s353 le filet en ouvrait 15 : le générateur en posait jusqu'à 7
    // d'affilée. Mesure prod : 3 guerriers sur 21 en portent UNE, jamais deux.
    for (const role of ROLES_GUERRIER) {
      for (const budget of [60, 80]) {
        for (const equip of [inv(), inv("lame_longue", "armure_plaques", "ecu", "bandages", "deux_armes_identiques")]) {
          const c = compose(role.id, equip, budget);
          if (!c.ok) continue;
          const rel = c.achats.filter(
            (a) => a.nom === "Connaissances des Religions"
          ).length;
          expect(rel, `${role.id} budget=${budget}`).toBeLessThanOrEqual(1);
          const lang = c.achats.filter(
            (a) => a.nom === "Langue supplémentaire"
          ).length;
          expect(lang, `${role.id} budget=${budget}`).toBe(0);
        }
      }
    }
  });

  it("le forgeron les mains vides est prévenu que sa gratuité d'arme est inutilisable", () => {
    const c = ok(compose("gForgeron", inv(), 60));
    expect(c.alertes.some((a) => a.includes("deux mains"))).toBe(true);
  });

  it("un essentiel ③ qui ne rentre plus est écarté avec une alerte, jamais bloquant", () => {
    const c = composerClasse(cats, CONTENU_GUERRIER, {
      classe: "guerrier",
      roleId: "gTient",
      inventaire: inv("armure_plaques", "lame_longue"),
      budget: 60,
      essentiels: [{ label: "Résistance à la magie 1" }],
    });
    const r = ok(c);
    expect(
      r.alertes.some((a) => a.includes("Résistance à la magie 1"))
    ).toBe(true);
  });

  it("aucun achat planifié ne dépasse le plafond de création", () => {
    for (const role of ROLES_GUERRIER) {
      for (const budget of [60, 80]) {
        const c = compose(
          role.id,
          inv(
            "deux_armes_identiques",
            "lame_longue",
            "armure_plaques",
            "pavois",
            "bandages",
            "contondante_longue",
            "armure_cuir"
          ),
          budget
        );
        if (!c.ok) continue;
        for (const a of c.achats) {
          expect(
            a.niveau,
            `${role.id} — ${a.nom}@${a.niveau}`
          ).toBeLessThanOrEqual(plafondCreation(CAT.exiger(a.nom), "guerrier"));
          expect(a.niveau, `${role.id} — ${a.nom}`).toBeLessThan(3);
        }
      }
    }
  });
});

describe("intégrité du contenu — chaque nom référencé existe", () => {
  const TOUT = inv(
    "lame_courte",
    "lame_moyenne",
    "lame_longue",
    "lame_deux_mains",
    "hache",
    "contondante_courte",
    "contondante_moyenne",
    "contondante_longue",
    "baton_hast",
    "deux_armes_identiques",
    "targe",
    "ecu",
    "pavois",
    "armure_cuir",
    "armure_maille",
    "armure_plaques",
    "bandages"
  );

  const nomsReferences = [
    ...GRATUITES_GUERRIER,
    ...ROLES_GUERRIER.flatMap((r) => r.noyau(TOUT, {}).map((a) => a.nom)),
    ...Object.values(SIGNATURE3_GUERRIER)
      .flat()
      .flatMap((e) => e.achats(TOUT, {}).map((a) => a.nom)),
    ...Object.values(POOL3_GUERRIER)
      .flat()
      .flatMap((e) => e.achats(TOUT, {}).map((a) => a.nom)),
    ...Object.values(POND4_GUERRIER)
      .flat()
      .flatMap((e) =>
        e.type === "jauge" ? [e.nom] : e.achats(TOUT, {}).map((a) => a.nom)
      ),
    ...CONTENU_GUERRIER.filet.map((e) => (e.type === "jauge" ? e.nom : "")),
  ].filter(Boolean);

  it("dans la fixture MCP (le catalogue lève sinon)", () => {
    for (const nom of nomsReferences) expect(CAT.exiger(nom).nom).toBe(nom);
  });

  it("dans le snapshot bundlé (tolérant : présence des noms seulement)", async () => {
    const snapshot = (await import("@/data/snapshotVisiteur.json")) as {
      tables: { competences?: { nom: string | null }[] };
    };
    const noms = new Set((snapshot.tables.competences ?? []).map((c) => c.nom));
    for (const nom of new Set(nomsReferences)) {
      expect(noms.has(nom), `« ${nom} » absent du snapshot bundlé`).toBe(true);
    }
  });

  it("aucun rôle supprimé ne survit (gArtisan retiré au profit de gForgeron)", () => {
    const ids = ROLES_GUERRIER.map((r) => r.id);
    expect(ids).toEqual(["gForgeron", "gTient", "gFrappe"]);
    expect(ids).not.toContain("gArtisan");
  });
});
