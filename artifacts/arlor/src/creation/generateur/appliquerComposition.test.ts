/**
 * [VIS-8 PR-B s365] `appliquerComposition` BOUT-EN-BOUT contre le VRAI
 * `clientVisiteur` (hors ligne, zéro réseau) : de VRAIS tirages seedés
 * (fixtures du résolveur — même montage que `generateur.resolveur.test.ts`)
 * traversent conversion → étapes 1-3 en brouillon → étape 4 complète
 * (gratuites + décision 32) → achats, à travers les gates MIROIR.
 *
 * Les ids des fixtures sont des captures PROD, comme le snapshot bundlé :
 * les achats du tirage se valident donc contre le vrai catalogue offline.
 *
 * PREUVES PAR LE CONTRAIRE (s355) :
 *  - sans la décision 32 (choix retirés), l'étape 4 DOIT refuser
 *    `choix_manquant` — et comme les achats ne partent qu'APRÈS l'étape 4,
 *    AUCUN achat ne doit figurer aux faits. ⭐ Ce refus est possible hors
 *    ligne PARCE QUE le miroir visiteur n'a PAS le fallback religion du
 *    serveur (`attribuer_competences_gratuites_classe` retombe sur
 *    `personnages.religion_id`, le miroir non) — divergence mesurée s365,
 *    raison pour laquelle le convertisseur passe TOUJOURS les choix
 *    explicitement.
 *  - sans `etapes123EnBrouillon`, l'étape 1 DOIT refuser `nom_manquant`
 *    (un tirage n'a pas de nom) — la preuve que le mode brouillon travaille.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { CatalogueCompetences } from "@/moteurCreation/generateur/catalogue";
import {
  CatalogueMagie,
  type PriereModele,
  type SortModele,
} from "@/moteurCreation/generateur/catalogueMagie";
import { type Catalogues } from "@/moteurCreation/generateur/composer";
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
  tirerPersonnage,
  type Alea,
  type DepsResolveur,
  type MondeResolveur,
  type TiragePersonnage,
} from "@/moteurCreation/generateur/resoudre";
import type {
  CompetenceCatalogue,
  CompositionOk,
  ContexteComposition,
} from "@/moteurCreation/generateur/types";
import { convertirTirageEnBrouillon } from "@/moteurCreation/generateur/versBrouillon";
import { getSnapshot } from "@/moteurCreation/snapshot";
import type { BrouillonVisiteur } from "@/moteurCreation/brouillon/types";

import {
  catalogueDepuisSnapshot,
  executerRejeu,
} from "../reprise/rejouerBrouillon";
import { clientVisiteur, PERSONNAGE_LOCAL_ID } from "../visiteur/clientVisiteur";
import { CLE_BROUILLON } from "../visiteur/stockageBrouillon";
import { appliquerComposition } from "./appliquerComposition";

/* ------------------------------------------------------------------ */
/* localStorage stub (config vitest = node) — pattern clientVisiteur   */
/* ------------------------------------------------------------------ */

function installerLocalStorage(): void {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

/* ------------------------------------------------------------------ */
/* Montage résolveur — mêmes fixtures que generateur.resolveur.test.ts */
/* ------------------------------------------------------------------ */

const magie = new CatalogueMagie(
  fxMagie as unknown as { sorts: SortModele[]; prieres: PriereModele[] },
);
const magieVide = new CatalogueMagie({ sorts: [], prieres: [] });
const catalogue = (fx: unknown): CatalogueCompetences =>
  new CatalogueCompetences(
    (fx as { competences: unknown[] }).competences as CompetenceCatalogue[],
  );

type ClasseId = ContexteComposition["classe"];
const parClasse: Record<ClasseId, { cats: Catalogues; contenu: ContenuClasse }> = {
  guerrier: { cats: { competences: catalogue(fxGuerrier), magie: magieVide }, contenu: CONTENU_GUERRIER },
  pretre: { cats: { competences: catalogue(fxPretre), magie }, contenu: CONTENU_PRETRE },
  voleur: { cats: { competences: catalogue(fxVoleur), magie: magieVide }, contenu: CONTENU_VOLEUR },
  mage: { cats: { competences: catalogue(fxMage), magie }, contenu: CONTENU_MAGE },
};
const monde = fxMonde as unknown as MondeResolveur;
const deps: DepsResolveur = { parClasse, monde };

/** Inventaire « riche » de la simulation (toutes clés costume incluses). */
const RICHE: ReadonlySet<string> = new Set([
  "contondante_moyenne", "ecu", "armure_cuir", "bandages", "pavois",
  "armure_plaques", "lame_longue", "lame_courte", "deux_armes_identiques",
  "targe", "fioles", "armure_maille", "bourse", "feuille_crayon",
  "contondante_longue", "contondante_courte", "arme_distance",
  "baton_sceptre_baguette", "oreilles_pointues", "masque", "maquillage_vert",
  "maquillage_fonce", "costume_animal", "costume_creature", "barbe",
]);

const lcg = (seed: number): Alea => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};

/** Premier tirage OK de la classe demandée (seeds croissants, échec bruyant). */
function tirageDeClasse(classe: ClasseId): {
  tirage: TiragePersonnage;
  composition: CompositionOk;
} {
  for (let seed = 1; seed < 500; seed++) {
    const r = tirerPersonnage(deps, lcg(seed), RICHE);
    if (r.ok && r.tirage.classe === classe) return r;
  }
  throw new Error(`aucun tirage ${classe} en 500 seeds — fixtures à revoir`);
}

/* ------------------------------------------------------------------ */
/* Repères snapshot (ids retrouvés, jamais en dur)                     */
/* ------------------------------------------------------------------ */

const snap = getSnapshot();
const gratuiteAChoix = (classeNom: string, typeChoix: string): string => {
  const classe = snap.tables.classes.find((c) => c.nom === classeNom)!;
  const gratuites =
    (classe.competences_gratuites as Array<{ competence_id?: string }> | null) ?? [];
  const parId = new Map(snap.tables.competences.map((c) => [c.id, c]));
  const comp = gratuites
    .map((g) => (g.competence_id ? parId.get(g.competence_id) : undefined))
    .find((c) => c?.type_choix === typeChoix);
  if (!comp) throw new Error(`aucune gratuite ${typeChoix} pour ${classeNom}`);
  return comp.id;
};
const languesAnciennes = snap.tables.langues
  .filter((l) => l.est_ancienne === true && l.est_actif === true)
  .map((l) => l.id);

const brouillonStocke = (): BrouillonVisiteur =>
  JSON.parse(localStorage.getItem(CLE_BROUILLON)!) as BrouillonVisiteur;

const paires = (xs: Array<{ competenceId: string; niveauAcquis?: number; niveau?: number }>) =>
  xs
    .map((x) => `${x.competenceId}@${x.niveauAcquis ?? x.niveau}`)
    .sort((a, b) => a.localeCompare(b));

beforeEach(async () => {
  installerLocalStorage();
  // La page a DÉJÀ démarré le personnage quand l'accueil s'affiche — on
  // reproduit ce préalable : un brouillon vide existe, id local en main.
  const dem = await clientVisiteur.demarrerCreationPersonnage({});
  expect((dem.data as { succes?: boolean }).succes).toBe(true);
});

/* ------------------------------------------------------------------ */
/* Bout-en-bout — un tirage par classe à magie + un martial            */
/* ------------------------------------------------------------------ */

describe("appliquerComposition — bout-en-bout clientVisiteur", () => {
  it("prêtre : COMPLET, religion tirée gravée (étape 1 + gratuite), rien n'avance", async () => {
    const res = tirageDeClasse("pretre");
    const resultat = await appliquerComposition(
      clientVisiteur,
      res,
      PERSONNAGE_LOCAL_ID,
      { alea: lcg(42) },
    );

    expect(resultat.echecs).toEqual([]);
    expect(resultat.statut).toBe("complet");
    expect(resultat.personnageId).toBe(PERSONNAGE_LOCAL_ID);

    const b = brouillonStocke();
    // Identité vierge : le joueur nomme au wizard ; étape courante restée à 1
    // (étapes 1-3 en brouillon n'avancent pas ; l'étape 4 complète n'avance
    // que depuis 4 — miroir du serveur).
    expect(b.etape1.nom).toBe("");
    expect(b.meta.etapeCourante).toBe(1);
    // Décision 32 : religion TIRÉE, aux deux endroits.
    expect(b.etape1.estCroyant).toBe(true);
    expect(b.etape1.religionId).toBe(res.tirage.religionId);
    expect(
      b.etape4.choixParCompetence?.[gratuiteAChoix("Prêtre", "religion")],
    ).toBe(res.tirage.religionId);
    // Tous les achats du tirage sont passés — mêmes paires (compétence, niveau).
    expect(paires(b.acquisitions.competences)).toEqual(
      paires(res.composition.achats),
    );
    const nbPrieres = res.composition.achatsMagie.filter((m) => m.type === "priere").length;
    expect(b.acquisitions.prieres).toHaveLength(nbPrieres);
    // Journal : un fait par action (4 étapes + achats + magie), zéro échec.
    expect(resultat.faits).toHaveLength(
      4 + res.composition.achats.length + res.composition.achatsMagie.length,
    );
  });

  it("mage : COMPLET, une des langues anciennes actives posée sur la gratuite", async () => {
    const res = tirageDeClasse("mage");
    const resultat = await appliquerComposition(
      clientVisiteur,
      res,
      PERSONNAGE_LOCAL_ID,
      { alea: lcg(7) },
    );

    expect(resultat.echecs).toEqual([]);
    expect(resultat.statut).toBe("complet");

    const b = brouillonStocke();
    const langue = b.etape4.choixParCompetence?.[gratuiteAChoix("Mage", "langue_ancienne")];
    expect(languesAnciennes).toContain(langue);
    expect(b.etape1.estCroyant).toBe(false);
    const nbSorts = res.composition.achatsMagie.filter((m) => m.type === "sort").length;
    expect(b.acquisitions.sorts).toHaveLength(nbSorts);
  });

  it("mage : la langue est DÉTERMINISTE sur l'aléa injecté (même seed → même langue)", async () => {
    const res = tirageDeClasse("mage");
    const cle = gratuiteAChoix("Mage", "langue_ancienne");

    await appliquerComposition(clientVisiteur, res, PERSONNAGE_LOCAL_ID, { alea: lcg(7) });
    const premiere = brouillonStocke().etape4.choixParCompetence?.[cle];

    // Second parcours À NEUF (stockage réinstallé + re-démarrage).
    installerLocalStorage();
    await clientVisiteur.demarrerCreationPersonnage({});
    await appliquerComposition(clientVisiteur, res, PERSONNAGE_LOCAL_ID, { alea: lcg(7) });
    expect(brouillonStocke().etape4.choixParCompetence?.[cle]).toBe(premiere);
  });

  it("guerrier : COMPLET — les jauges répétées (même compétence, même niveau) passent toutes", async () => {
    const res = tirageDeClasse("guerrier");
    const resultat = await appliquerComposition(
      clientVisiteur,
      res,
      PERSONNAGE_LOCAL_ID,
      { alea: lcg(3) },
    );

    expect(resultat.echecs).toEqual([]);
    expect(resultat.statut).toBe("complet");
    const b = brouillonStocke();
    expect(paires(b.acquisitions.competences)).toEqual(
      paires(res.composition.achats),
    );
    // Un guerrier ne prie ni ne lance : gratuites sans choix → pas de map.
    expect(b.etape4.choixParCompetence).toBeUndefined();
    expect(b.acquisitions.sorts).toEqual([]);
    expect(b.acquisitions.prieres).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Preuves par le contraire                                            */
/* ------------------------------------------------------------------ */

describe("appliquerComposition — preuves par le contraire", () => {
  it("SANS la décision 32 : l'étape 4 refuse `choix_manquant` et AUCUN achat ne part", async () => {
    const res = tirageDeClasse("pretre");
    const brouillon = convertirTirageEnBrouillon(getSnapshot(), res, lcg(42));
    delete brouillon.etape4.choixParCompetence;

    const resultat = await executerRejeu(
      clientVisiteur,
      catalogueDepuisSnapshot(),
      brouillon,
      PERSONNAGE_LOCAL_ID,
      { etapes123EnBrouillon: true },
    );

    expect(resultat.statut).toBe("partiel");
    expect(resultat.echecs).toHaveLength(1);
    expect(resultat.echecs[0]).toMatchObject({ type: "etape4", code: "choix_manquant" });
    // L'ordre du plan protège : les achats ne démarrent qu'APRÈS l'étape 4.
    const achats = resultat.faits.filter((f) =>
      ["competence", "sort", "priere"].includes(f.type),
    );
    expect(achats).toEqual([]);
  });

  it("SANS `etapes123EnBrouillon` : l'étape 1 refuse `nom_manquant` (un tirage n'a pas de nom)", async () => {
    const res = tirageDeClasse("pretre");
    const brouillon = convertirTirageEnBrouillon(getSnapshot(), res, lcg(42));

    const resultat = await executerRejeu(
      clientVisiteur,
      catalogueDepuisSnapshot(),
      brouillon,
      PERSONNAGE_LOCAL_ID,
      {},
    );

    expect(resultat.statut).toBe("partiel");
    expect(resultat.echecs).toHaveLength(1);
    expect(resultat.echecs[0]).toMatchObject({ type: "etape1", code: "nom_manquant" });
    expect(resultat.faits).toEqual([]);
  });
});
