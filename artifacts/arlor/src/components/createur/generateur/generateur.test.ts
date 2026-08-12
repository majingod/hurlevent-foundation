/**
 * [VIS-8 lot 1] Logique du générateur — décision d'accueil, ordre des races,
 * contrat des portes. (Le grisage OU-de-ET est déjà couvert par
 * `moteurCreation/exigences.test.ts`.)
 */
import { describe, expect, it } from "vitest";

import {
  doitMontrerAccueil,
  doitOffrirAutreTirage,
  idBrouillonAReprendre,
} from "./decisionAccueil";
import { ordonnerRaces, raceDemandeApprobation } from "./ordreRaces";
import { PORTES } from "./portes";

const BASE = {
  actif: true,
  accueilFranchi: false,
  modeAdmin: false,
  modeCampagne: false,
  etape: 1,
  etapeServeur: 1,
  // [s375-v2] Champ REQUIS depuis le défaut 1c — un démarrage à zéro n'a
  // rien dépensé. Voir le cas dédié plus bas.
  xpDepense: 0,
};

// [s396] État exact du cul-de-sac : personnage GÉNÉRÉ (75 XP dépensés,
// etape_creation serveur = 10), jamais nommé.
const BASE_SORTIE = {
  modeAdmin: false,
  modeCampagne: false,
  modeVisiteur: false,
  sansNom: true,
  etapeServeur: 10,
  xpDepense: 75,
};

describe("doitMontrerAccueil", () => {
  it("s'affiche sur un démarrage à zéro (étape 1, aucun mode spécial)", () => {
    expect(doitMontrerAccueil(BASE)).toBe(true);
  });

  it("jamais quand l'interrupteur est coupé (GENERATEUR_ACTIF=false : geste de repli)", () => {
    expect(doitMontrerAccueil({ ...BASE, actif: false })).toBe(false);
  });

  it("jamais après avoir franchi une porte (Précédent ne le fait pas réapparaître)", () => {
    expect(doitMontrerAccueil({ ...BASE, accueilFranchi: true })).toBe(false);
  });

  // [s394b] Le cœur du lot : une reprise ?id= d'un brouillon vierge (rien
  // reçu, étape serveur ≤ 1) remontre les portes. C'est exactement le cas
  // qui rendait `false` avant ce lot.
  it("reprise ?id= d'un brouillon vierge : les portes se remontrent", () => {
    expect(
      doitMontrerAccueil({ ...BASE, etapeServeur: 1, xpDepense: 0 })
    ).toBe(true);
  });

  // [s394b] Test jumeau — face négative n°1 : un brouillon avancé sans nom
  // est ramené à l'étape 1 AFFICHÉE (règle `sansNomInitial`), mais son étape
  // SERVEUR dit qu'il a déjà une race posée. Sans ce cas, la face positive
  // ci-dessus serait verte sur une fonction qui ignore etapeServeur.
  it("jamais sur un brouillon avancé sans nom (étape serveur > 1, étape 1 affichée)", () => {
    expect(doitMontrerAccueil({ ...BASE, etapeServeur: 8 })).toBe(false);
  });

  // [s394b] Face négative n°2 : un personnage finalisé repris en
  // remodelage repart lui aussi de l'étape 1 affichée.
  it("jamais sur un personnage finalisé repris en remodelage", () => {
    expect(doitMontrerAccueil({ ...BASE, etapeServeur: 11 })).toBe(false);
  });

  it("jamais en mode admin ni en mode campagne", () => {
    expect(doitMontrerAccueil({ ...BASE, modeAdmin: true })).toBe(false);
    expect(doitMontrerAccueil({ ...BASE, modeCampagne: true })).toBe(false);
  });

  it("jamais sur un brouillon repris à une étape > 1", () => {
    expect(doitMontrerAccueil({ ...BASE, etape: 4 })).toBe(false);
  });

  // ⭐⭐ [s375-v2 défaut 1c — piège C88] LE CAS QUE L'ÉTAPE NE VOIT PAS.
  // Un personnage GÉNÉRÉ affiche l'étape 1 (il n'a pas encore de nom, D43)
  // alors qu'il porte déjà tous ses achats (`etape_creation` = 10 en base).
  // Sur ce seul critère d'étape, les portes se rouvraient et un second
  // tirage s'empilait sur le premier (mesuré : 12 refus « XP insuffisant »,
  // hybride ⚗️ + 9 recettes / zéro rune). `xp_depense` est l'état qui le dit.
  it("jamais sur un personnage qui a DÉJÀ dépensé, même à l'étape 1 affichée", () => {
    expect(doitMontrerAccueil({ ...BASE, xpDepense: 66 })).toBe(false);
    // Le retour aux portes lit la MÊME fonction : les deux portes ferment.
    expect(
      doitMontrerAccueil({ ...BASE, accueilFranchi: false, xpDepense: 1 })
    ).toBe(false);
    // Et le critère ne mord PAS sur un démarrage à zéro (non-régression).
    expect(doitMontrerAccueil({ ...BASE, xpDepense: 0 })).toBe(true);
  });
});

// [s396] doitOffrirAutreTirage — bouton « Repartir d'un autre tirage » :
// n'est offert QUE sur l'état exact du cul-de-sac (C120 : ce que le
// personnage PORTE, jamais par où il est arrivé ; fail-closed sur absence).
describe("doitOffrirAutreTirage", () => {
  it("s'affiche sur l'état exact du cul-de-sac (sansNom, étape serveur 10, 75 XP)", () => {
    expect(doitOffrirAutreTirage(BASE_SORTIE)).toBe(true);
  });

  it("jamais si aucun XP dépensé (brouillon vierge : les portes reviennent déjà, D58)", () => {
    expect(doitOffrirAutreTirage({ ...BASE_SORTIE, xpDepense: 0 })).toBe(false);
  });

  it("jamais sur un brouillon à peine commencé (étape serveur 1)", () => {
    expect(doitOffrirAutreTirage({ ...BASE_SORTIE, etapeServeur: 1 })).toBe(false);
  });

  it("jamais si le personnage a un nom", () => {
    expect(doitOffrirAutreTirage({ ...BASE_SORTIE, sansNom: false })).toBe(false);
  });

  it("jamais en mode admin, campagne, ou visiteur", () => {
    expect(doitOffrirAutreTirage({ ...BASE_SORTIE, modeAdmin: true })).toBe(false);
    expect(doitOffrirAutreTirage({ ...BASE_SORTIE, modeCampagne: true })).toBe(false);
    expect(doitOffrirAutreTirage({ ...BASE_SORTIE, modeVisiteur: true })).toBe(false);
  });

  // Fail-closed : la valeur passée en cas d'absence de donnée serveur.
  it("jamais quand etapeServeur vaut 0 (fail-closed)", () => {
    expect(doitOffrirAutreTirage({ ...BASE_SORTIE, etapeServeur: 0 })).toBe(false);
  });
});

// [s396-bis] idBrouillonAReprendre — l'id sur lequel atterrir après
// suppression : le démarrage a réussi, OU le serveur a refusé avec
// `brouillon_existant` (il renvoie alors l'id du brouillon qui reste).
// ⛔ Fail-closed : aucun autre code d'erreur ne doit rendre un id.
describe("idBrouillonAReprendre", () => {
  it("succes: true + id → rend l'id", () => {
    expect(
      idBrouillonAReprendre({ succes: true, donnees: { personnage_id: "abc" } }),
    ).toBe("abc");
  });

  it("succes: false, code brouillon_existant, id présent → rend l'id", () => {
    expect(
      idBrouillonAReprendre({
        succes: false,
        erreurs: [{ code: "brouillon_existant" }],
        donnees: { personnage_id: "abc" },
      }),
    ).toBe("abc");
  });

  it("succes: false, code brouillon_existant, sans id → null", () => {
    expect(
      idBrouillonAReprendre({
        succes: false,
        erreurs: [{ code: "brouillon_existant" }],
        donnees: {},
      }),
    ).toBeNull();
  });

  // Le cas qui prouve que le helper n'est pas permissif.
  it("succes: false, code profil_introuvable, id présent → null", () => {
    expect(
      idBrouillonAReprendre({
        succes: false,
        erreurs: [{ code: "profil_introuvable" }],
        donnees: { personnage_id: "abc" },
      }),
    ).toBeNull();
  });

  it("payload vide → null", () => {
    expect(idBrouillonAReprendre({})).toBeNull();
  });

  it("null / undefined → null", () => {
    expect(idBrouillonAReprendre(null)).toBeNull();
    expect(idBrouillonAReprendre(undefined)).toBeNull();
  });
});

describe("ordonnerRaces — contrat de la maquette validée s346", () => {
  // Les 8 races jouables réelles (noms de prod). Seule Humain est sans
  // exigence de costume (objets_requis, mesuré s348).
  const RACES = [
    "Chiméride",
    "Demi-Elfe",
    "Demi-Orc",
    "Drow",
    "Gobelin",
    "Humain",
    "Les Non-Races",
    "Myrvalk",
  ].map((nom) => ({ nom }));
  const aExigence = (r: { nom: string }) => r.nom !== "Humain";

  it("sans exigence d'abord, puis alphabétique, approbation à la fin", () => {
    expect(ordonnerRaces(RACES, aExigence).map((r) => r.nom)).toEqual([
      "Humain",
      "Demi-Elfe",
      "Demi-Orc",
      "Drow",
      "Gobelin",
      "Myrvalk",
      "Chiméride",
      "Les Non-Races",
    ]);
  });

  it("l'approbation est portée par nom, comme dans Etape2_V2", () => {
    expect(raceDemandeApprobation("Chiméride")).toBe(true);
    expect(raceDemandeApprobation("Les Non-Races")).toBe(true);
    expect(raceDemandeApprobation("Humain")).toBe(false);
    expect(raceDemandeApprobation("Drow")).toBe(false);
  });

  it("ne mute pas la liste d'entrée", () => {
    const copie = [...RACES];
    ordonnerRaces(RACES, aExigence);
    expect(RACES).toEqual(copie);
  });
});

describe("PORTES — contrat maquette s346, déclinaison lot 1 (Fred s348)", () => {
  it("🃏 « Pige ta main » est masquée (ni id, ni emoji, ni titre)", () => {
    expect(PORTES.some((p) => p.emoji === "🃏")).toBe(false);
    expect(PORTES.some((p) => p.titre.includes("Pige"))).toBe(false);
  });

  it("les trois portes portent le vocabulaire VERBATIM de la maquette", () => {
    expect(PORTES.map((p) => [p.emoji, p.titre, p.description])).toEqual([
      [
        "🛠️",
        "Je bâtis moi-même",
        "Le créateur complet, étape par étape. Tu contrôles tout.",
      ],
      [
        "🧭",
        "Guide-moi",
        "Quelques questions sur toi, ton équipement, ta place au village — et un personnage qui te ressemble.",
      ],
      [
        "🎲",
        "Surprends-moi",
        "Un clic, un personnage jouable. Relance tant que tu veux.",
      ],
    ]);
  });
});
