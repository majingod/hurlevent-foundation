/**
 * [VIS-8 lot 🧭 PR-β1, s367] CE QUE LA PORTE 🧭 AFFICHE — l'ouvert ET le
 * fermé, chacun avec sa raison (décision 6 : griser, jamais cacher).
 *
 * Chaque garde a sa PREUVE PAR LE CONTRAIRE dans le même bloc (règle s355) :
 * un test « X est fermé » ne prouve rien si X ne pouvait de toute façon pas
 * s'ouvrir. Les comptes sont MESURÉS puis gravés avec leur décomposition
 * (règle s362) — jamais annoncés d'avance.
 */
import { describe, expect, it } from "vitest";

import { raceInapteMagie } from "../deriveurs";
import { CatalogueCompetences } from "./catalogue";
import {
  CatalogueMagie,
  type PriereModele,
  type SortModele,
} from "./catalogueMagie";
import { raisonRoleInapte, type Catalogues } from "./composer";
import { type ContenuClasse, type RoleClasse } from "./contenu/commun";
import { CONTENU_GUERRIER } from "./contenu/guerrier";
import { CONTENU_MAGE } from "./contenu/mage";
import { CONTENU_PRETRE } from "./contenu/pretre";
import { CONTENU_VOLEUR } from "./contenu/voleur";
import fxGuerrier from "./fixtures/competences_guerrier.fixture.json";
import fxMage from "./fixtures/competences_mage.fixture.json";
import fxMagie from "./fixtures/magie_generateur.fixture.json";
import fxMonde from "./fixtures/monde_resolveur.fixture.json";
import fxPretre from "./fixtures/competences_pretre.fixture.json";
import fxVoleur from "./fixtures/competences_voleur.fixture.json";
import {
  classesProposables,
  religionsProposables,
  rolesProposables,
  rolesTirables,
  type DepsResolveur,
  type MondeResolveur,
} from "./resoudre";
import type { CompetenceCatalogue, ContexteComposition } from "./types";

/* ------------------------------------------------------------------ */
/* Montage — mêmes fixtures que le résolveur.                          */
/* ------------------------------------------------------------------ */

const magie = new CatalogueMagie(
  fxMagie as unknown as { sorts: SortModele[]; prieres: PriereModele[] }
);
const magieVide = new CatalogueMagie({ sorts: [], prieres: [] });
const catalogue = (fx: unknown): CatalogueCompetences =>
  new CatalogueCompetences(
    (fx as { competences: unknown[] }).competences as CompetenceCatalogue[]
  );

type ClasseId = ContexteComposition["classe"];
const parClasse: Record<
  ClasseId,
  { cats: Catalogues; contenu: ContenuClasse }
> = {
  guerrier: {
    cats: { competences: catalogue(fxGuerrier), magie: magieVide },
    contenu: CONTENU_GUERRIER,
  },
  pretre: {
    cats: { competences: catalogue(fxPretre), magie },
    contenu: CONTENU_PRETRE,
  },
  voleur: {
    cats: { competences: catalogue(fxVoleur), magie: magieVide },
    contenu: CONTENU_VOLEUR,
  },
  mage: {
    cats: { competences: catalogue(fxMage), magie },
    contenu: CONTENU_MAGE,
  },
};
const monde = fxMonde as unknown as MondeResolveur;
const deps: DepsResolveur = { parClasse, monde };

const VIDE: ReadonlySet<string> = new Set();
const RICHE: ReadonlySet<string> = new Set([
  "contondante_moyenne", "ecu", "armure_cuir", "bandages", "pavois",
  "armure_plaques", "lame_longue", "lame_courte", "deux_armes_identiques",
  "targe", "fioles", "armure_maille", "bourse", "feuille_crayon",
  "contondante_longue", "contondante_courte", "arme_distance",
  "baton_sceptre_baguette", "oreilles_pointues", "masque", "maquillage_vert",
  "maquillage_fonce", "costume_animal", "costume_creature", "barbe",
]);
const CLASSES: ClasseId[] = ["guerrier", "voleur", "mage", "pretre"];
const raceParNom = (nom: string) => {
  const r = monde.races.find((x) => x.nom === nom);
  if (!r) throw new Error(`race introuvable : ${nom}`);
  return r;
};

/* ------------------------------------------------------------------ */
/* 1. Les deux portes ne peuvent pas diverger                          */
/* ------------------------------------------------------------------ */

describe("🧭 rolesProposables — l'ouvert, le fermé, et la raison", () => {
  it("rolesTirables EST la projection sèche de rolesProposables", () => {
    let compares = 0;
    for (const classe of CLASSES) {
      const { cats, contenu } = parClasse[classe];
      for (const inv of [VIDE, RICHE]) {
        for (const inapte of [false, true]) {
          const projection = rolesProposables(contenu, cats, inv, inapte)
            .filter((r) => r.ouvert)
            .map((r) => r.role.id);
          expect(rolesTirables(contenu, cats, inv, inapte).map((r) => r.id))
            .toEqual(projection);
          compares += 1;
        }
      }
    }
    // 4 classes × 2 inventaires × 2 aptitudes.
    expect(compares).toBe(16);
  });

  it("TOUT rôle est rendu — un fermé n'est jamais escamoté", () => {
    for (const classe of CLASSES) {
      const { cats, contenu } = parClasse[classe];
      for (const inv of [VIDE, RICHE]) {
        const rendus = rolesProposables(contenu, cats, inv, true);
        expect(rendus.map((r) => r.role.id)).toEqual(
          contenu.roles.map((r) => r.id)
        );
      }
    }
  });

  it("une raison est présente si et seulement si le rôle est fermé", () => {
    for (const classe of CLASSES) {
      const { cats, contenu } = parClasse[classe];
      for (const inv of [VIDE, RICHE]) {
        for (const inapte of [false, true]) {
          for (const r of rolesProposables(contenu, cats, inv, inapte)) {
            expect(typeof r.raison === "string").toBe(!r.ouvert);
            if (!r.ouvert) expect(r.raison!.length).toBeGreaterThan(10);
          }
        }
      }
    }
  });

  it("inaptitude (D40 s372) : 3 rôles de prêtre ferment, ✝️ RESTE OUVERT — jumeau : sans elle, tout ouvre", () => {
    const { cats, contenu } = parClasse.pretre;
    const verdicts = rolesProposables(contenu, cats, RICHE, true);
    expect(verdicts.length).toBe(4);
    // ⭐ [DÉCISION 40] ✝️ n'EXIGE plus de magie (sonde à nu) : un inapte peut
    // le jouer sans domaine — mesuré : 60 XP, reliquat 0, zéro PS.
    const ouverts = verdicts.filter((r) => r.ouvert).map((r) => r.role.id);
    expect(ouverts).toEqual(["pSoigne"]);
    for (const r of verdicts.filter((x) => !x.ouvert)) {
      expect(r.raison).toBe(raisonRoleInapte(r.role));
    }
    // PREUVE PAR LE CONTRAIRE : sans l'inaptitude, les mêmes rôles ouvrent.
    const apte = rolesProposables(contenu, cats, RICHE, false);
    expect(apte.every((r) => r.ouvert)).toBe(true);
  });

  it("équipement : la raison vient du CONTENU, et l'objet la lève", () => {
    const { cats, contenu } = parClasse.guerrier;
    const aVide = rolesProposables(contenu, cats, VIDE, false);
    const fermes = aVide.filter((r) => !r.ouvert);
    // MESURÉ : sur 3 rôles Guerrier, 1 seul reste ouvert à mains nues.
    expect(fermes.length).toBe(2);
    for (const r of fermes) {
      // Exactement ce que `role.requiert` rend : une seule maison.
      expect(r.raison).toBe(r.role.requiert(VIDE, { element: undefined }));
    }
    // PREUVE PAR LE CONTRAIRE : l'inventaire riche les ouvre tous.
    expect(
      rolesProposables(contenu, cats, RICHE, false).every((r) => r.ouvert)
    ).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Les voies — jamais de cul-de-sac au barreau suivant              */
/* ------------------------------------------------------------------ */

describe("🧭 classesProposables — les 4 voies, ouvertes ou grisées", () => {
  it("les 4 voies sont TOUJOURS rendues, dans un ordre fixe", () => {
    for (const race of [raceParNom("Humain"), raceParNom("Demi-Orc")]) {
      for (const inv of [VIDE, RICHE]) {
        expect(
          classesProposables(deps, race.id, inv).map((c) => c.classe)
        ).toEqual(["guerrier", "voleur", "mage", "pretre"]);
      }
    }
  });

  it("une voie ouverte ⟺ au moins un de ses rôles est ouvert", () => {
    for (const race of monde.races.filter((r) => r.est_actif && r.est_jouable)) {
      for (const inv of [VIDE, RICHE]) {
        // L'inaptitude est re-dérivée ICI par le dériveur partagé, jamais
        // par un nom de race en dur : sinon le test suivrait le code.
        const inapte = raceInapteMagie(
          {
            tables: {
              race_traits: monde.race_traits,
              traits_raciaux: monde.traits_raciaux,
            },
          },
          race.id
        );
        for (const c of classesProposables(deps, race.id, inv)) {
          const { cats, contenu } = parClasse[c.classe];
          const ouverts = rolesProposables(contenu, cats, inv, inapte).filter(
            (r) => r.ouvert
          ).length;
          expect(c.ouverte).toBe(ouverts > 0);
        }
      }
    }
  });

  it("[s368 #4] voie fermée à DEUX causes : la phrase les SÉPARE (Demi-Orc, masque seul)", () => {
    const voies = classesProposables(
      deps,
      raceParNom("Demi-Orc").id,
      new Set(["masque"])
    );
    const mage = voies.find((v) => v.classe === "mage")!;
    expect(mage.ouverte).toBe(false);
    // Chaîne LUE à la machine (sonde s368) — 2 fermés par l'inaptitude,
    // 3 par l'équipement : jamais « les 5 rôles » imputés à une seule cause.
    expect(mage.raison).toBe(
      "2 des 5 rôles de cette voie vivent de points de spiritualité — et Demi-Orc peut naître inapte à la magie. ⚗️ L'alchimiste · ✨ L'enchanteur · ᚱ Le runiste attendent encore ton 🎒. « Je bâtis moi-même » reste ouvert."
    );
    // PREUVE PAR LE CONTRAIRE de l'ancien texte :
    expect(mage.raison).not.toContain("Les 5 rôles");
    // Et le chemin reste ATTEIGNABLE : des fioles ouvrent la voie (⚗️ ne
    // vit pas de PS) — le message ne fait plus renoncer à tort.
    const avecFioles = classesProposables(
      deps,
      raceParNom("Demi-Orc").id,
      new Set(["masque", "fioles"])
    );
    expect(avecFioles.find((v) => v.classe === "mage")!.ouverte).toBe(true);
  });

  it("D40 s372 : la voie Prêtre s'OUVRE au Demi-Orc — ✝️ jouable sans domaine (effet émergent, sert la décision 41)", () => {
    // Avant D40, les 4 rôles Prêtre vivaient de PS → voie grisée au MODÈLE
    // (arbitrage s367). ✝️ n'exigeant plus de magie, UN rôle suffit à ouvrir
    // la voie : le grisage de rôle (3 sur 4) reste attesté plus haut.
    const voies = classesProposables(deps, raceParNom("Demi-Orc").id, RICHE);
    const pretre = voies.find((c) => c.classe === "pretre")!;
    expect(pretre.ouverte).toBe(true);
    // Le Mage reste OUVERT : l'alchimiste ne vit pas de PS.
    expect(voies.find((c) => c.classe === "mage")!.ouverte).toBe(true);
    // Et l'instance sans le trait ouvre tout, comme avant.
    const instance = classesProposables(deps, raceParNom("Demi-Orc").id, RICHE, []);
    expect(instance.every((c) => c.ouverte)).toBe(true);
  });

  it("aucune autre race ne perd une voie — ni à vide, ni riche", () => {
    let fermees = 0;
    for (const race of monde.races.filter((r) => r.est_actif && r.est_jouable)) {
      if (race.nom === "Demi-Orc") continue;
      for (const inv of [VIDE, RICHE]) {
        fermees += classesProposables(deps, race.id, inv).filter(
          (c) => !c.ouverte
        ).length;
      }
    }
    expect(fermees).toBe(0);
  });

  it("branche ÉQUIPEMENT : la raison change quand l'inaptitude n'est pas en cause", () => {
    // Contenu SYNTHÉTIQUE : un rôle que rien n'ouvre. Sans lui, la branche
    // « équipement » ne serait jamais exercée (mesuré : aucune voie réelle
    // ne ferme par l'inventaire) et son test serait vert à vide.
    const roleImpossible: RoleClasse = {
      id: "xImpossible",
      emoji: "🚧",
      titre: "Le rôle scellé",
      phrase: "—",
      requiert: () => "Il te faut une clé que personne ne possède.",
      noyau: () => [],
    };
    const contenuScelle: ContenuClasse = {
      classe: "voleur",
      gratuites: [],
      roles: [roleImpossible],
      pool3: {},
      pond4: {},
      filet: [],
    };
    const depsScelles: DepsResolveur = {
      monde,
      parClasse: {
        ...parClasse,
        voleur: { cats: parClasse.voleur.cats, contenu: contenuScelle },
      },
    };
    const voies = classesProposables(depsScelles, raceParNom("Humain").id, RICHE);
    const voleur = voies.find((c) => c.classe === "voleur")!;
    expect(voleur.ouverte).toBe(false);
    expect(voleur.raison).toContain("🎒");
    expect(voleur.raison).not.toContain("spiritualité");
  });
});

/* ------------------------------------------------------------------ */
/* 3. Les foi — arbitrage Fred s367 : les 15, jamais 8                 */
/* ------------------------------------------------------------------ */

describe("🧭 religionsProposables — les 15 foi, refus grisés", () => {
  const actives = monde.religions.filter((r) => r.est_actif).length;

  it("toutes les foi actives sont rendues, quel que soit le domaine", () => {
    expect(actives).toBe(15);
    for (const d of [undefined, "Guerre", "Bénédiction", "Nécromancie"]) {
      expect(religionsProposables(monde, d).length).toBe(actives);
    }
  });

  it("comptes MESURÉS par domaine — prédilection / tolérée / proscrite", () => {
    const table: Record<string, [number, number, number]> = {};
    for (const d of [
      "Bénédiction", "Chaos", "Connaissance", "Éléments",
      "Guerre", "Nature", "Nécromancie", "Ordre",
    ]) {
      const l = religionsProposables(monde, d);
      table[d] = [
        l.filter((f) => f.statut === "predilection").length,
        l.filter((f) => f.statut === "toleree").length,
        l.filter((f) => f.statut === "proscrite").length,
      ];
    }
    // MESURÉ (fixture s362, identique à la prod au 2026-07-28) :
    // [prédilection, tolérée, proscrite] — la somme fait 15 partout.
    expect(table).toEqual({
      "Bénédiction": [8, 6, 1],
      Chaos: [4, 5, 6],
      Connaissance: [6, 7, 2],
      "Éléments": [6, 7, 2],
      Guerre: [8, 3, 4],
      Nature: [5, 7, 3],
      "Nécromancie": [3, 6, 6],
      Ordre: [5, 4, 6],
    });
    // Ce que l'arbitrage s367 rend au joueur : sans lui, un nécromancien
    // ne verrait que 3 foi au lieu des 9 qui l'acceptent (3 + 6).
    expect(table["Nécromancie"][0] + table["Nécromancie"][1]).toBe(9);
  });

  it("les proscrites arrivent EN DERNIER, avec leur phrase", () => {
    const l = religionsProposables(monde, "Guerre");
    const rangs = l.map((f) => f.statut);
    expect(rangs.indexOf("proscrite")).toBe(
      rangs.length - rangs.filter((s) => s === "proscrite").length
    );
    for (const f of l) {
      expect(typeof f.raison === "string").toBe(f.statut === "proscrite");
      if (f.raison) {
        expect(f.raison).toContain(f.religion.nom);
        expect(f.raison).toContain("Guerre");
      }
    }
  });

  it("[s368 #5] une religion proscrivant les DEUX domaines les porte tous les deux", () => {
    const deux = religionsProposables(monde, "Guerre", "Nécromancie").find(
      (f) => (f.proscrits ?? []).length === 2
    )!;
    expect(deux).toBeTruthy();
    expect(deux.proscrits).toEqual(["Guerre", "Nécromancie"]);
    expect(deux.raison).toContain("les domaines Guerre et Nécromancie");
  });

  it("le SECOND domaine ferme aussi — et sans lui, la foi rouvre", () => {
    // Une foi qui accepte Guerre mais proscrit Ordre : la garde doit mordre.
    const cible = monde.religions.find(
      (r) =>
        r.est_actif &&
        !r.domaines_proscrits.includes("Guerre") &&
        r.domaines_proscrits.includes("Ordre")
    );
    expect(cible).toBeTruthy();
    const avec = religionsProposables(monde, "Guerre", "Ordre").find(
      (f) => f.religion.id === cible!.id
    )!;
    expect(avec.statut).toBe("proscrite");
    expect(avec.raison).toContain("Ordre");
    // PREUVE PAR LE CONTRAIRE : sans le second domaine, elle est proposable.
    const sans = religionsProposables(monde, "Guerre").find(
      (f) => f.religion.id === cible!.id
    )!;
    expect(sans.statut).not.toBe("proscrite");
  });

  it("AUCUN cul-de-sac : chaque couple de domaines garde au moins une foi", () => {
    const domaines = [
      "Bénédiction", "Chaos", "Connaissance", "Éléments",
      "Guerre", "Nature", "Nécromancie", "Ordre",
    ];
    let pire = Number.POSITIVE_INFINITY;
    let pireCouple = "";
    let couples = 0;
    for (const d1 of domaines) {
      for (const d2 of [undefined, ...domaines.filter((d) => d !== d1)]) {
        const n = religionsProposables(monde, d1, d2).filter(
          (f) => f.statut !== "proscrite"
        ).length;
        couples += 1;
        if (n < pire) {
          pire = n;
          pireCouple = d2 ? `${d1} + ${d2}` : `${d1} seul`;
        }
      }
    }
    // 8 domaines × (1 « sans second » + 7 seconds possibles) = 64.
    expect(couples).toBe(64);
    expect(pire, `pire cas : ${pireCouple} → ${pire} foi`).toBeGreaterThan(0);
    // PIRE CAS MESURÉ : Chaos + Ordre → 3 foi. Jamais 0 : la porte 🧭
    // n'a aucun cul-de-sac de foi, sur tout son domaine.
    expect(pire).toBe(3);
    expect(pireCouple).toBe("Chaos + Ordre");
  });
});
