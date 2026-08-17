import { describe, expect, it } from "vitest";

import { CatalogueCompetences } from "@/moteurCreation/generateur/catalogue";
import {
  CatalogueMagie,
  type PriereModele,
  type SortModele,
} from "@/moteurCreation/generateur/catalogueMagie";
import type { Catalogues } from "@/moteurCreation/generateur/composer";
import { type ContenuClasse } from "@/moteurCreation/generateur/contenu/commun";
import { CONTENU_GUERRIER } from "@/moteurCreation/generateur/contenu/guerrier";
import { CONTENU_MAGE } from "@/moteurCreation/generateur/contenu/mage";
import { CONTENU_PRETRE } from "@/moteurCreation/generateur/contenu/pretre";
import { CONTENU_VOLEUR } from "@/moteurCreation/generateur/contenu/voleur";
import fxGuerrier from "@/moteurCreation/generateur/fixtures/competences_guerrier.fixture.json";
import fxMage from "@/moteurCreation/generateur/fixtures/competences_mage.fixture.json";
import fxMagie from "@/moteurCreation/generateur/fixtures/magie_generateur.fixture.json";
import fxMonde from "@/moteurCreation/generateur/fixtures/monde_resolveur.fixture.json";
import fxPretre from "@/moteurCreation/generateur/fixtures/competences_pretre.fixture.json";
import fxVoleur from "@/moteurCreation/generateur/fixtures/competences_voleur.fixture.json";
import {
  classesProposables,
  religionsProposables,
  rolesProposables,
  type DepsResolveur,
  type MondeResolveur,
} from "@/moteurCreation/generateur/resoudre";
import type {
  CompetenceCatalogue,
  ContexteComposition,
} from "@/moteurCreation/generateur/types";

import {
  roleAttendElement,
  sousTypesAffiches,
  traitsRaciauxAffiches,
  type ParcoursBoussole,
} from "./boussole.logic";
import {
  ETAT_BOUSSOLE_VIDE,
  VERSION_ETAT_BOUSSOLE,
  cleEtatBoussole,
  lireEtatBoussoleBrut,
  purgerEtatBoussole,
  restaurerEtatBoussole,
  sauverEtatBoussole,
  serialiserEtatBoussole,
  type EtatBoussole,
} from "./parcoursPersistance";

/* ---------------------------------------------------------------- *
 * Bootstrap IDENTIQUE à boussole.logic.test.ts : mêmes fixtures,
 * mêmes catalogues — le restaurateur est jugé par les MÊMES pools
 * que l'escalier.
 * ---------------------------------------------------------------- */

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
const RICHE: ReadonlySet<string> = new Set([
  "contondante_moyenne", "ecu", "armure_cuir", "bandages", "pavois",
  "armure_plaques", "lame_longue", "lame_courte", "deux_armes_identiques",
  "targe", "fioles", "armure_maille", "bourse", "feuille_crayon",
  "contondante_longue", "contondante_courte", "arme_distance",
  "baton_sceptre_baguette", "oreilles_pointues", "masque", "maquillage_vert",
  "maquillage_fonce", "costume_animal", "costume_creature", "barbe",
]);

const raceParNom = (nom: string) => {
  const r = monde.races.find((x) => x.nom === nom);
  if (!r) throw new Error(`race introuvable : ${nom}`);
  return r;
};

/** Un état COMPLET et VALIDE, dérivé des pools eux-mêmes (jamais d'ids en
 *  dur au-delà des noms de race et des voies) — le même chemin que le
 *  joueur : voie ouverte → rôle ouvert → domaine du catalogue → foi non
 *  proscrite → héritage du pool. Race Chiméride + voie prêtre : le cas qui
 *  couvre LES HUIT champs, sous-type compris (leçon s406). */
function etatCompletChimeridePretre(): EtatBoussole {
  const race = raceParNom("Chiméride");
  expect(
    classesProposables(deps, race.id, RICHE).find(
      (v) => v.classe === "pretre" && v.ouverte
    )
  ).toBeTruthy();
  const { contenu, cats } = parClasse.pretre;
  const role = rolesProposables(contenu, cats, RICHE, false).find(
    (r) =>
      r.ouvert &&
      !r.role.magieImposee &&
      roleAttendElement(contenu, cats, r.role, RICHE)
  )?.role;
  if (!role) throw new Error("aucun rôle prêtre ouvert à domaine libre");
  const domaines = cats.magie.domaines();
  expect(domaines.length).toBeGreaterThanOrEqual(2);
  const [element, element2] = domaines;
  const foi = religionsProposables(monde, element, element2).find(
    (f) => f.statut !== "proscrite"
  );
  if (!foi) throw new Error("aucune foi non proscrite pour ces domaines");
  const sousTypes = sousTypesAffiches(monde, race);
  expect(sousTypes.length).toBeGreaterThanOrEqual(2);
  // ⭐ Le sous-type NON suggéré — si la restauration le perdait, le suggéré
  //   prendrait sa place en silence : exactement le trou de s406-bis.
  const sousType = sousTypes.find((s) => !s.suggere)!.valeur;
  const trait = traitsRaciauxAffiches(monde, race, sousType, true).find(
    (t) => !t.grise
  );
  if (!trait) throw new Error("aucun trait non grisé pour ce sous-type");
  const parcours: ParcoursBoussole = {
    classe: "pretre",
    roleId: role.id,
    element,
    second: true,
    element2,
    religionId: foi.religion.id,
    sousTypeChimeride: sousType,
    traitRacialChoisi: trait.id,
  };
  return { inventaire: RICHE, raceId: race.id, parcours };
}

const restaure = (brut: string | null | undefined) =>
  restaurerEtatBoussole(brut, deps, RICHE);

/** Ré-écrit le JSON sauvé avec UNE mutation — l'instrument des jumeaux. */
const mute = (
  etat: EtatBoussole,
  patch: (s: {
    v: number;
    inventaire: string[];
    raceId: string | null;
    parcours: ParcoursBoussole;
  }) => void
): string => {
  const s = JSON.parse(serialiserEtatBoussole(etat));
  patch(s);
  return JSON.stringify(s);
};

/* ---------------------------------------------------------------- */

describe("cleEtatBoussole", () => {
  it("est par personnage, et `visiteur` sans personnage", () => {
    expect(cleEtatBoussole("abc-123")).toBe(
      `hv.boussole.v${VERSION_ETAT_BOUSSOLE}.abc-123`
    );
    expect(cleEtatBoussole(null)).toBe(
      `hv.boussole.v${VERSION_ETAT_BOUSSOLE}.visiteur`
    );
    expect(cleEtatBoussole("a")).not.toBe(cleEtatBoussole("b"));
  });
});

describe("restaurerEtatBoussole — face positive (anti-stub)", () => {
  it("aller-retour COMPLET : les huit champs du parcours, la race et l'inventaire reviennent identiques", () => {
    const etat = etatCompletChimeridePretre();
    const r = restaure(serialiserEtatBoussole(etat));
    expect(r.raceId).toBe(etat.raceId);
    expect([...r.inventaire].sort()).toEqual([...etat.inventaire].sort());
    // Champ par champ — un `toEqual` global masquerait LEQUEL meurt.
    expect(r.parcours.classe).toBe(etat.parcours.classe);
    expect(r.parcours.roleId).toBe(etat.parcours.roleId);
    expect(r.parcours.element).toBe(etat.parcours.element);
    expect(r.parcours.second).toBe(true);
    expect(r.parcours.element2).toBe(etat.parcours.element2);
    expect(r.parcours.religionId).toBe(etat.parcours.religionId);
    expect(r.parcours.sousTypeChimeride).toBe(etat.parcours.sousTypeChimeride);
    expect(r.parcours.traitRacialChoisi).toBe(
      etat.parcours.traitRacialChoisi
    );
  });

  it("un parcours PARTIEL (voie seule) revient tel quel — on ne complète jamais à sa place", () => {
    const race = raceParNom("Humain");
    const voie = classesProposables(deps, race.id, RICHE).find(
      (v) => v.ouverte
    )!;
    const etat: EtatBoussole = {
      inventaire: RICHE,
      raceId: race.id,
      parcours: {
        classe: voie.classe,
        roleId: null,
        element: null,
        second: false,
        element2: null,
        religionId: null,
        sousTypeChimeride: null,
        traitRacialChoisi: null,
      },
    };
    const r = restaure(serialiserEtatBoussole(etat));
    expect(r.raceId).toBe(race.id);
    expect(r.parcours.classe).toBe(voie.classe);
    expect(r.parcours.roleId).toBeNull();
    expect(r.parcours.traitRacialChoisi).toBeNull();
  });
});

describe("restaurerEtatBoussole — fail-closed, champ par champ", () => {
  const etat = etatCompletChimeridePretre();

  it("brut absent, JSON illisible ou version étrangère → tout vide", () => {
    expect(restaure(null)).toEqual(ETAT_BOUSSOLE_VIDE);
    expect(restaure(undefined)).toEqual(ETAT_BOUSSOLE_VIDE);
    expect(restaure("{pas du json")).toEqual(ETAT_BOUSSOLE_VIDE);
    expect(restaure('"une chaîne"')).toEqual(ETAT_BOUSSOLE_VIDE);
    expect(restaure(mute(etat, (s) => void (s.v = 999)))).toEqual(
      ETAT_BOUSSOLE_VIDE
    );
  });

  it("un objet d'inventaire inconnu est filtré, les connus restent", () => {
    const r = restaure(
      mute(etat, (s) => s.inventaire.push("objet_fantome_9999"))
    );
    expect(r.inventaire.has("objet_fantome_9999")).toBe(false);
    expect(r.inventaire.has("lame_longue")).toBe(true);
  });

  it("race inconnue → race ET parcours jetés (l'inventaire survit)", () => {
    const r = restaure(mute(etat, (s) => void (s.raceId = "race-fantome")));
    expect(r.raceId).toBeNull();
    expect(r.parcours.classe).toBeNull();
    expect(r.parcours.sousTypeChimeride).toBeNull();
    expect(r.inventaire.has("lame_longue")).toBe(true);
  });

  it("race NON JOUABLE (Fée) → jetée comme une inconnue — le même critère qu'EcranRace", () => {
    const fee = raceParNom("Fée");
    expect(fee.est_jouable).toBe(false);
    const r = restaure(mute(etat, (s) => void (s.raceId = fee.id)));
    expect(r.raceId).toBeNull();
    expect(r.parcours.classe).toBeNull();
  });

  it("voie inconnue → la race survit, le parcours entier est jeté", () => {
    const r = restaure(
      mute(etat, (s) => void (s.parcours.classe = "druide" as never))
    );
    expect(r.raceId).toBe(etat.raceId);
    expect(r.parcours.classe).toBeNull();
    expect(r.parcours.roleId).toBeNull();
  });

  it("rôle inconnu → la voie survit, tout l'aval est jeté (élément, foi, héritage)", () => {
    const r = restaure(
      mute(etat, (s) => void (s.parcours.roleId = "role-fantome"))
    );
    expect(r.parcours.classe).toBe("pretre");
    expect(r.parcours.roleId).toBeNull();
    expect(r.parcours.element).toBeNull();
    expect(r.parcours.religionId).toBeNull();
    expect(r.parcours.traitRacialChoisi).toBeNull();
  });

  it("élément hors catalogue → l'élément ET son second meurent, le rôle survit", () => {
    const r = restaure(
      mute(etat, (s) => void (s.parcours.element = "Domaine Fantôme"))
    );
    expect(r.parcours.roleId).toBe(etat.parcours.roleId);
    expect(r.parcours.element).toBeNull();
    expect(r.parcours.second).toBe(false);
    expect(r.parcours.element2).toBeNull();
  });

  it("second égal au premier → le second seul meurt", () => {
    const r = restaure(
      mute(etat, (s) => void (s.parcours.element2 = s.parcours.element))
    );
    expect(r.parcours.element).toBe(etat.parcours.element);
    expect(r.parcours.second).toBe(false);
    expect(r.parcours.element2).toBeNull();
  });

  it("foi inconnue → la foi seule meurt", () => {
    const r = restaure(
      mute(etat, (s) => void (s.parcours.religionId = "foi-fantome"))
    );
    expect(r.parcours.element).toBe(etat.parcours.element);
    expect(r.parcours.religionId).toBeNull();
    expect(r.parcours.sousTypeChimeride).toBe(
      etat.parcours.sousTypeChimeride
    );
  });

  it("foi PROSCRITE pour le domaine restauré → jetée — jamais une proscrite pré-cochée", () => {
    const proscrite = religionsProposables(
      monde,
      etat.parcours.element ?? undefined,
      etat.parcours.element2 ?? undefined
    ).find((f) => f.statut === "proscrite");
    if (!proscrite) return; // fixture sans proscrite pour ce couple : rien à prouver ici
    const r = restaure(
      mute(
        etat,
        (s) => void (s.parcours.religionId = proscrite.religion.id)
      )
    );
    expect(r.parcours.religionId).toBeNull();
  });

  it("sous-type inconnu → le sous-type meurt, il ne redevient JAMAIS le suggéré en silence (s406)", () => {
    const r = restaure(
      mute(etat, (s) => void (s.parcours.sousTypeChimeride = "🦄 inconnu"))
    );
    expect(r.parcours.sousTypeChimeride).toBeNull();
    expect(r.parcours.roleId).toBe(etat.parcours.roleId);
  });

  it("trait hors pool → le trait seul meurt", () => {
    const r = restaure(
      mute(etat, (s) => void (s.parcours.traitRacialChoisi = "trait-fantome"))
    );
    expect(r.parcours.sousTypeChimeride).toBe(
      etat.parcours.sousTypeChimeride
    );
    expect(r.parcours.traitRacialChoisi).toBeNull();
  });
});

describe("le navigateur — jamais un bloqueur", () => {
  it("lire/sauver/purger ne lèvent jamais — avec ou sans sessionStorage", () => {
    const cle = cleEtatBoussole("perso-test");
    expect(() =>
      sauverEtatBoussole(cle, ETAT_BOUSSOLE_VIDE)
    ).not.toThrow();
    expect(() => purgerEtatBoussole(cle)).not.toThrow();
    expect(lireEtatBoussoleBrut(cle)).toBeNull();
  });
});
