/**
 * [VIS-8 lot A2-Prêtre, s360] Les 4 archétypes Prêtre MESURÉS.
 *
 * ⭐ CE FICHIER ATTESTE LE CHIFFRAGE : les ② ne sont plus des chiffres de
 * document, le moteur les RE-DÉRIVE de la fixture à chaque `vitest`, comme
 * les 6 martiaux (s353) et les 5 Mage (s358). C'est ce geste qui a montré
 * que la table §5 de la référence reposait sur « 1 prière = 4 XP » — une
 * hypothèse jamais mesurée, exacte 4 fois sur 4 en la reconstruisant.
 *
 * ⚠️ CHAQUE GARDE VA AVEC SON JUMEAU NÉGATIF (« sans la garde, X apparaît »).
 * Un test qui vérifie qu'une garde EMPÊCHE quelque chose est vert par défaut
 * si la chose n'arrivait de toute façon pas.
 */
import { describe, expect, it } from "vitest";

import { ZONES_PAR_TYPE } from "@/constants/magie";
import { calculerCoutXP } from "@/utils/calculsMagie";

import { CatalogueCompetences } from "./catalogue";
import {
  CatalogueMagie,
  type PriereModele,
  type SortModele,
} from "./catalogueMagie";
import { composerClasse, type Catalogues } from "./composer";
import { estCompetenceAPS } from "./contenu/commun";
import { CONTENU_PRETRE } from "./contenu/pretre";
import { configGenerateur, ordonnerPrieresRepresentatives } from "./coutsMagie";
import fxPretre from "./fixtures/competences_pretre.fixture.json";
import fxMagie from "./fixtures/magie_generateur.fixture.json";
import type { CompetenceCatalogue, Composition } from "./types";

const magie = new CatalogueMagie(
  fxMagie as unknown as { sorts: SortModele[]; prieres: PriereModele[] }
);
const cats: Catalogues = {
  competences: new CatalogueCompetences(
    (fxPretre as { competences: unknown[] }).competences as CompetenceCatalogue[]
  ),
  magie,
};
const PRIERES = (fxMagie as unknown as { prieres: PriereModele[] }).prieres;

/** Les 8 domaines de prière de la prod (référence §5.2). */
const DOMAINES = [
  "Bénédiction",
  "Chaos",
  "Connaissance",
  "Guerre",
  "Nature",
  "Nécromancie",
  "Ordre",
  "Éléments",
];

const composer = (roleId: string, domaine?: string, budget = 80, inv: string[] = []) =>
  composerClasse(cats, CONTENU_PRETRE, {
    classe: "pretre",
    roleId,
    inventaire: new Set(inv),
    budget,
    element: domaine,
  });
const ok = (c: Composition) => {
  if (!c.ok) throw new Error(`refus inattendu : ${c.raison}`);
  return c;
};
const coutCouche = (c: Extract<Composition, { ok: true }>, couche: number) =>
  c.achats.filter((a) => a.couche === couche).reduce((s, a) => s + a.coutXp, 0) +
  c.achatsMagie
    .filter((m) => m.couche === couche)
    .reduce((s, m) => s + m.coutXp, 0);

/** [D40 s372] L'XP partie en compétences à PS — le thermomètre de l'indigence. */
const psXp = (c: Extract<Composition, { ok: true }>) =>
  c.achats
    .filter((a) => estCompetenceAPS(a.nom))
    .reduce((s, a) => s + a.coutXp, 0);

/** Le ② d'un rôle, dérivé par le MOTEUR sur chaque domaine. */
const bornes2 = (roleId: string) => {
  const v = DOMAINES.map((d) => coutCouche(ok(composer(roleId, d)), 2));
  return [Math.min(...v), Math.max(...v)];
};

describe("PRÊTRE — les 4 archétypes mesurés (§4.0.3), ② dérivé du catalogue", () => {
  // ⚠️ FOURCHETTE, PAS UN POINT, pour ⛪ et ✝️ : leur domaine est LIBRE, donc
  // le prix dépend de la prière représentative du domaine choisi. Même
  // mécanique que le cercle libre côté mage (s358). Bornes CALCULÉES ici.
  it("⛪ le prêtre de rite : ② = 26–33 sur les 8 domaines, ③ signature = 8", () => {
    expect(bornes2("pRite")).toEqual([26, 33]);
    const c = ok(composer("pRite", "Bénédiction"));
    // ⭐ [R1a s361] 18 -> 8 : « Acquisition de Domaine 2 » (10 XP) RETIRÉE.
    // C'était un PLAFOND SEC — l'accès 1 ouvre déjà les prières de niveau
    // ≤ 5, et le générateur n'achète que du niveau 1. Reste Bénédiction 2,
    // que la mesure soutient (50 % des créations contre 27 % des vétérans).
    expect(coutCouche(c, 3)).toBe(8); // Bénédiction 2
    expect(c.achats.filter((a) => a.couche === 2).map((a) => a.nom)).toEqual(
      expect.arrayContaining(["Méditation", "Développement Spirituel", "Revenu"])
    );
  });

  it("✝️ le soigneur (D40 s372) : ② = 10 POINT sur les 8 domaines — le domaine vit en ③ (18–25)", () => {
    // Avant D40 le ② portait la prière : 18–25 selon le domaine. La prière a
    // quitté le noyau (décision 40) : le ② redevient un POINT, la fourchette
    // se déplace en ③ (accès 5 + prière 2–10 + Premiers Soins@2 10).
    expect(bornes2("pSoigne")).toEqual([10, 10]);
    const bornes3 = DOMAINES.map((d) =>
      coutCouche(ok(composer("pSoigne", d)), 3)
    );
    expect([Math.min(...bornes3), Math.max(...bornes3)]).toEqual([18, 25]);
    const c = ok(composer("pSoigne", "Bénédiction"));
    // ③ Bénédiction, chiffres machine s372 : accès 5 + Soins 4 + PS@2 10.
    expect(coutCouche(c, 3)).toBe(19);
    expect(c.achatsMagie.filter((m) => m.couche === 3)).toHaveLength(1);
    // Fiche dit vrai (décision 34) : l'accès porte le CHOIX du domaine.
    expect(
      c.achats.some(
        (a) =>
          a.nom === "Acquisition de Domaine" &&
          a.couche === 3 &&
          a.choix === "Bénédiction"
      )
    ).toBe(true);
    expect(c.achats.filter((a) => a.couche === 2).map((a) => a.nom)).toEqual(
      expect.arrayContaining(["Réveil Expéditif", "Premiers Soins"])
    );
  });

  it("🕊️ le missionnaire IMPOSE la Guerre : ② = 22, trois prières, zéro armure", () => {
    const c = ok(composer("pMissionnaire"));
    expect(coutCouche(c, 2)).toBe(22);
    // ⭐ [R1a s361] 10 -> 0 : même plafond sec retiré. 🕊️ n'a plus de
    // signature ③a, comme ✨ et ᚱ. Sa signature MESURÉE est « une prière de
    // Guerre plus puissante » — inécrivable tant que la fixture ne porte que
    // du niveau 1. Dette [VIS8-GROSSE-PRIERE-SIGNATURE].
    expect(coutCouche(c, 3)).toBe(0);
    expect(c.achatsMagie.filter((m) => m.couche === 2)).toHaveLength(3);
    // « par la prière, pas par l'armure » — même avec tout l'attirail coché.
    const arme = ok(composer("pMissionnaire", undefined, 80, ["armure_maille", "ecu"]));
    expect(arme.achats.filter((a) => a.couche === 2).map((a) => a.nom)).not.toContain(
      "Port d'armure intermédiaire"
    );
  });

  it("📿 le consécrateur IMPOSE la Bénédiction : ② = 16, le plus léger des 15", () => {
    const c = ok(composer("pConsecrateur"));
    expect(coutCouche(c, 2)).toBe(16);
    expect(coutCouche(c, 3)).toBe(10); // Consécration 2 (plafonnée création)
  });

  it("un domaine imposé ne dépend pas du choix du joueur (🕊️ et 📿)", () => {
    for (const roleId of ["pMissionnaire", "pConsecrateur"]) {
      const impose = coutCouche(ok(composer(roleId)), 2);
      for (const d of DOMAINES) {
        expect(coutCouche(ok(composer(roleId, d)), 2)).toBe(impose);
      }
    }
  });
});

describe("PRÊTRE — la garde de zone (C66) et sa preuve par le contraire", () => {
  /** La config la moins chère SANS la garde — ce que le moteur faisait avant. */
  const configSansGarde = (m: PriereModele) => {
    const zones = ZONES_PAR_TYPE[m.zone_effet] ?? [m.zone_effet];
    let best = { zone: "", cout: Number.POSITIVE_INFINITY };
    for (const zone of zones) {
      const c = calculerCoutXP(zone, "Toucher", "Instantanée", 1, m.cout_xp_base);
      if (c < best.cout) best = { zone, cout: c };
    }
    return best;
  };

  it("✝️ le soigneur soigne QUELQU'UN D'AUTRE — Soins n'est jamais « Personnelle »", () => {
    const c = ok(composer("pSoigne", "Bénédiction"));
    const soins = c.achatsMagie.find((m) => m.nom === "Soins");
    expect(soins).toBeDefined();
    expect(soins?.config.zone).toBe("1 Cible");
  });

  it("PREUVE PAR LE CONTRAIRE : sans la garde, Soins SORTIRAIT en « Personnelle »", () => {
    // Si ce test devient impossible à écrire, le précédent ne prouve plus rien.
    const soins = PRIERES.find((p) => p.nom === "Soins");
    expect(soins).toBeDefined();
    expect(configSansGarde(soins!).zone).toBe("Personnelle");
    // …et la garde coûte exactement 1 XP (zone 1 -> zone 2).
    const avec = configGenerateur(soins!);
    expect(avec.zone).toBe("1 Cible");
    expect(
      calculerCoutXP(avec.zone, avec.portee, avec.duree, 1, soins!.cout_xp_base) -
        configSansGarde(soins!).cout
    ).toBe(1);
  });

  it("les prières CONÇUES personnelles la gardent (modèle zone_effet = Personnelle)", () => {
    const combat = PRIERES.find((p) => p.nom === "Combat Aveugle");
    expect(combat?.zone_effet).toBe("Personnelle");
    expect(configGenerateur(combat!).zone).toBe("Personnelle");
  });

  it("la garde ne laisse AUCUNE prière multi-cibles sortir en « Personnelle »", () => {
    const fuites = PRIERES.filter(
      (p) =>
        (ZONES_PAR_TYPE[p.zone_effet] ?? [p.zone_effet]).length > 1 &&
        configGenerateur(p).zone === "Personnelle"
    );
    expect(fuites.map((p) => p.nom)).toEqual([]);
    // Jumeau : il EXISTE bien des prières multi-cibles, sinon on ne mesure rien.
    const multi = PRIERES.filter(
      (p) => (ZONES_PAR_TYPE[p.zone_effet] ?? [p.zone_effet]).length > 1
    );
    expect(multi.length).toBeGreaterThan(30);
  });
});

describe("PRÊTRE — « la plus portée », et pourquoi ce n'est PAS « la moins chère »", () => {
  it("Bénédiction mène avec Soins (9 porteurs), pas avec la moins chère", () => {
    const ordre = ordonnerPrieresRepresentatives(magie.prieresDuDomaine("Bénédiction"));
    expect(ordre[0].modele.nom).toBe("Soins");
  });

  it("PREUVE PAR LE CONTRAIRE : Soins est 7e sur 8 par prix — jamais choisie sinon", () => {
    const ordre = ordonnerPrieresRepresentatives(magie.prieresDuDomaine("Bénédiction"));
    const soins = ordre.find((x) => x.modele.nom === "Soins")!;
    const moinsCheres = ordre.filter((x) => x.coutXp < soins.coutXp);
    // S'il n'existait aucune prière moins chère, la règle serait indistinguable
    // de « la moins chère » et le test précédent passerait à vide.
    expect(moinsCheres.length).toBeGreaterThanOrEqual(4);
  });

  it("sans signal mesuré, on retombe sur la « effet bénéfique » la moins chère", () => {
    // Connaissance, Nécromancie et Ordre sont à ÉGALITÉ À 1 PORTEUR en prod :
    // du bruit, pas un signal. La règle de repli doit s'y voir.
    for (const d of ["Connaissance", "Nécromancie", "Ordre"]) {
      const ordre = ordonnerPrieresRepresentatives(magie.prieresDuDomaine(d));
      expect(ordre[0].modele.type_priere).toBe("effet bénéfique");
    }
  });

  it("l'ordre est STABLE : deux appels donnent la même tête", () => {
    for (const d of DOMAINES) {
      const a = ordonnerPrieresRepresentatives(magie.prieresDuDomaine(d));
      const b = ordonnerPrieresRepresentatives(magie.prieresDuDomaine(d));
      expect(a.map((x) => x.modele.nom)).toEqual(b.map((x) => x.modele.nom));
    }
  });
});

describe("PRÊTRE — ce que le lot RETIRE", () => {
  it("🛡️ pFront n'existe plus : son id est devenu pMissionnaire", () => {
    expect(CONTENU_PRETRE.roles.map((r) => r.id)).toEqual([
      "pRite",
      "pSoigne",
      "pMissionnaire",
      "pConsecrateur",
    ]);
    const c = composer("pFront");
    expect(c.ok).toBe(false);
  });

  it("④ n'empile plus « Connaissances des Religions » — 17 prêtres sur 17 à 1", () => {
    // ⚠️ CE TEST ROUGIT SUR LA VERSION D'AVANT : les 3 rôles d'alors la
    // portaient tous en ④ avec `plafondRachats: 15`, soit jusqu'à 60 XP
    // brûlés sur une GRATUITÉ que personne n'a jamais rachetée.
    const jauges = Object.values(CONTENU_PRETRE.pond4)
      .flat()
      .filter((e) => e.type === "jauge")
      .map((e) => (e as { nom: string }).nom);
    expect(jauges).not.toContain("Connaissances des Religions");
    // Jumeau : le ④ n'est pas vide pour autant, il porte les jauges MESURÉES.
    expect(jauges).toContain("Développement Spirituel");
    expect(jauges).toContain("Langue supplémentaire");
  });

  it("les plafonds de ④ sont ceux MESURÉS en prod (Dév. Spi 10 · Langue 4)", () => {
    const plafond = (nom: string) =>
      Object.values(CONTENU_PRETRE.pond4)
        .flat()
        .filter(
          (e): e is { type: "jauge"; nom: string; plafondRachats: number } =>
            e.type === "jauge" && e.nom === nom
        )
        .map((e) => e.plafondRachats);
    expect(new Set(plafond("Développement Spirituel"))).toEqual(new Set([10]));
    expect(new Set(plafond("Langue supplémentaire"))).toEqual(new Set([4]));
  });
});

describe("PRÊTRE — les refus parlent au joueur", () => {
  it("⛪ sans domaine : le refus dit quoi choisir, et parle de religion", () => {
    // [D40 s372] ✝️ ne refuse PLUS — son bloc dédié atteste le sans-domaine.
    const c = composer("pRite", undefined);
    expect(c.ok).toBe(false);
    if (!c.ok) {
      expect(c.raison).toMatch(/domaine/i);
      expect(c.raison).toMatch(/religion/i);
    }
  });

  it("✝️ DÉCISION 40 — sans domaine : soigneur NON MAGIQUE, compensation active, reliquat 0 (chiffres machine s372)", () => {
    const c60 = ok(composer("pSoigne", undefined, 60));
    expect(c60.achatsMagie).toHaveLength(0);
    expect(c60.achats.some((a) => a.nom === "Acquisition de Domaine")).toBe(
      false
    );
    expect(c60.reliquat).toBe(0);
    expect(psXp(c60)).toBe(0);
    // La chaîne du médecin (pool Soin mesuré) : Chirurgien tire Diagnostic@2
    // en prérequis — c'est le moteur qui achète le chemin, pas le contenu.
    expect(c60.achats.map((a) => `${a.nom}@${a.niveau}`)).toEqual(
      expect.arrayContaining([
        "Chirurgien@1",
        "Diagnostic@2",
        "Premiers Soins@2",
      ])
    );
    const c80 = ok(composer("pSoigne", undefined, 80));
    expect(c80.reliquat).toBe(0);
    // UN rachat de Développement Spirituel — la petite monnaie qui termine
    // la cascade (précédent guerrier ≤ 5), jamais un placement.
    expect(psXp(c80)).toBe(2);
    expect(c80.achats.map((a) => a.nom)).toEqual(
      expect.arrayContaining([
        "Connaissances des Herbes Communes",
        "Herbalisme",
      ])
    );
  });

  it("✝️ DÉCISION 40 — un INAPTE compose sans domaine : reliquat 0, zéro PS (le trou de 14 XP est réparé)", () => {
    const c = composerClasse(cats, CONTENU_PRETRE, {
      classe: "pretre",
      roleId: "pSoigne",
      inventaire: new Set<string>(),
      budget: 60,
      inapteMagie: true,
    });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.achatsMagie).toHaveLength(0);
    expect(c.reliquat).toBe(0);
    expect(psXp(c)).toBe(0);
  });

  it("✝️ DÉCISION 40 — PREUVE PAR LE CONTRAIRE : sans la compensation conditionnelle, les PS morts reviennent", () => {
    // On retire les entrées ④ conditionnelles (la compensation) : l'ancien ④
    // réapparaît et déverse 24 XP de PS que rien ne consomme — c'est le
    // défaut mesuré s372 que la décision 40 corrige.
    const pond4Nu = {
      ...CONTENU_PRETRE.pond4,
      pSoigne: CONTENU_PRETRE.pond4.pSoigne.filter((e) => !e.condition),
    };
    const nu = composerClasse(
      cats,
      { ...CONTENU_PRETRE, pond4: pond4Nu },
      {
        classe: "pretre",
        roleId: "pSoigne",
        inventaire: new Set<string>(),
        budget: 60,
        inapteMagie: false,
      }
    );
    expect(nu.ok).toBe(true);
    if (nu.ok) expect(psXp(nu)).toBe(24);
  });

  it("✝️ DÉCISION 40 — avec domaine, la compensation est INERTE : pas de Chirurgien, ② reste 10", () => {
    const c = ok(composer("pSoigne", "Bénédiction", 80));
    expect(c.achats.some((a) => a.nom === "Chirurgien")).toBe(false);
    expect(coutCouche(c, 2)).toBe(10);
  });

  it("🕊️ et 📿 n'ont RIEN à demander : leur domaine vient de l'archétype", () => {
    expect(composer("pMissionnaire", undefined).ok).toBe(true);
    expect(composer("pConsecrateur", undefined).ok).toBe(true);
  });
});
