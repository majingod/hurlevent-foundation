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
  religionsCandidates,
  resoudreChoix,
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
  it("prêtre : COMPLET, religion tirée gravée (étape 1 + gratuite), wizard déverrouillé (étape 10)", async () => {
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
    // Identité vierge : le joueur nomme au wizard. [s373] Depuis la migration
    // 20260803145513 (étape 4 complète avance depuis toute étape ≤ 4) et la
    // chaîne `avancerEtape` 5→9 d'appliquerComposition, l'étape courante
    // atteint 10 : le wizard s'ouvre entièrement (« comme si on modifiait un
    // perso déjà fait » — demande Fred s372). L'ancien comportement attesté
    // ici (« restée à 1 ») était le DÉFAUT corrigé, pas une règle.
    expect(b.etape1.nom).toBe("");
    expect(b.meta.etapeCourante).toBe(10);
    expect(resultat.etapeApresAvancement).toBe(10);
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

  it("🧭 s366 : resoudreChoix s'applique BOUT-EN-BOUT, second domaine compris", async () => {
    const humain = monde.races.find((r) => r.nom === "Humain")!;
    const rel = religionsCandidates(monde, "Guerre")[0];
    const res = resoudreChoix(deps, {
      classe: "pretre",
      roleId: "pRite",
      raceId: humain.id,
      inventaire: RICHE,
      element: "Guerre",
      element2: "Ordre",
      religionId: rel.id,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Même forme que 🎲 : appliquerComposition la consomme TELLE QUELLE.
    const resultat = await appliquerComposition(
      clientVisiteur,
      res,
      PERSONNAGE_LOCAL_ID,
      { alea: lcg(11) },
    );
    expect(resultat.echecs).toEqual([]);
    expect(resultat.statut).toBe("complet");
    const b = brouillonStocke();
    // La religion CHOISIE (pas tirée) est gravée aux deux endroits.
    expect(b.etape1.religionId).toBe(rel.id);
    // Le SECOND domaine demandé est réellement écrit : Acquisition de
    // Domaine (Ordre) figure dans les acquisitions du brouillon.
    expect(
      b.acquisitions.competences.some((c) => c.choixAchat === "Ordre")
    ).toBe(true);
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

/* ------------------------------------------------------------------ */
/* ⭐⭐ [s375-v2 défaut 1] L'EMPILEMENT — un tirage ne s'applique qu'à   */
/*    un personnage VIERGE                                             */
/* ------------------------------------------------------------------ */

/** Un tirage 🧭 déterministe de rôle mage donné (pas de seed à chasser). */
const roleMage = (roleId: string) => {
  const humain = monde.races.find((r) => r.nom === "Humain")!;
  const res = resoudreChoix(deps, {
    classe: "mage",
    roleId,
    raceId: humain.id,
    inventaire: RICHE,
    element: "Feu",
  });
  if (!res.ok) throw new Error(`${roleId} refusé : ${res.raison}`);
  return res;
};

const xpDepenseCourante = async (): Promise<number> => {
  const { data } = await clientVisiteur.lirePersonnageProgression(
    PERSONNAGE_LOCAL_ID,
  );
  return (data as { xp_depense: number }).xp_depense;
};

describe("appliquerComposition — l'empilement (s375-v2 défaut 1)", () => {
  it("⚗️ puis 🔮 sur le MÊME personnage : REFUSÉ, et pas un octet écrit", async () => {
    const r1 = await appliquerComposition(
      clientVisiteur,
      roleMage("mAlchimiste"),
      PERSONNAGE_LOCAL_ID,
      { alea: lcg(4242) },
    );
    expect(r1.statut).toBe("complet");

    // L'état RÉEL après le 1er tirage — ce que la page lit sur `personnages`.
    const xpDepense = await xpDepenseCourante();
    expect(xpDepense).toBeGreaterThan(0); // mesuré : 60 sur 80
    const avant = localStorage.getItem(CLE_BROUILLON)!;

    const r2 = await appliquerComposition(
      clientVisiteur,
      roleMage("mRuniste"),
      PERSONNAGE_LOCAL_ID,
      { alea: lcg(77), etatActuel: { xpDepense } },
    );

    expect(r2.statut).toBe("refuse_non_vierge");
    expect(r2.faits).toEqual([]);
    expect(r2.echecs).toEqual([]);
    expect(r2.etapeApresAvancement).toBeNull();
    expect(r2.personnageId).toBe(PERSONNAGE_LOCAL_ID);
    // AUCUNE ÉCRITURE : le brouillon stocké est byte-identique (le refus
    // tombe AVANT la conversion, donc avant la moindre RPC).
    expect(localStorage.getItem(CLE_BROUILLON)).toBe(avant);
    // Et l'XP dépensée n'a pas bougé d'un point.
    expect(await xpDepenseCourante()).toBe(xpDepense);
  });

  /**
   * ⭐ PREUVE PAR LE CONTRAIRE — EXÉCUTÉE, PAS DÉDUITE. Même scénario, sans
   * `etatActuel` : c'est le comportement de s375-v1, celui que Fred a vu en
   * aperçu. RELEVÉ DE LA SONDE (ce test, code de cette branche) :
   *
   *   1er ⚗️ mAlchimiste → `complet`, 0 échec, xp_depense = 60 / 80.
   *   2e  🔮 mRuniste    → `partiel`, 18 ÉCHECS :
   *     · 14 « XP insuffisant » — « Requis : 10 | Disponible : 2 », puis
   *       « Requis : 8 | Disponible : 2 », « Requis : 5 », « Requis : 9 »,
   *       et 9 × « Requis : 2 | Disponible : 0 » ;
   *     · « Prérequis manquant(s) : Acquisition de Cercle niveau 1 » — le
   *       prérequis a été refusé lui aussi, l'échec se propage ;
   *     · « Nécessite 20 PS (achetez d'abord Développement Spirituel) » ;
   *     · 1 sort `niveau_invalide` ;
   *     · 2 × assemblage `niveau_requis_non_atteint` : « Compétence
   *       Assemblage de Runes requise » — la compétence-mère du runiste
   *       n'a jamais pu être achetée.
   *   BROUILLON FINAL : 9 recettes, 0 assemblage, 0 piège, 11 compétences,
   *   xp_depense = 80/80. C'EST L'HYBRIDE CASSÉ : Alchimie + ses 9 recettes,
   *   et ZÉRO RUNE pour un personnage que le joueur a tiré runiste.
   *
   * (Le prompt s375-v2 annonçait « 12 échecs, Requis : 6 | Disponible : 1 » :
   * même défaut, autre rôle/seed. Les chiffres ci-dessus sont ceux LUS ici.)
   */
  it("SANS `etatActuel` : le 2ᵉ tirage EMPILE — hybride ⚗️ + zéro rune", async () => {
    const r1 = await appliquerComposition(
      clientVisiteur,
      roleMage("mAlchimiste"),
      PERSONNAGE_LOCAL_ID,
      { alea: lcg(4242) },
    );
    expect(r1.statut).toBe("complet");
    const recettesDuPremier = brouillonStocke().acquisitions.recettes.length;
    expect(recettesDuPremier).toBeGreaterThan(0);

    // ⚠️ L'OPTION EST ABSENTE — exactement l'appel de s375-v1.
    const r2 = await appliquerComposition(
      clientVisiteur,
      roleMage("mRuniste"),
      PERSONNAGE_LOCAL_ID,
      { alea: lcg(77) },
    );

    expect(r2.statut).toBe("partiel");
    expect(
      r2.echecs.filter((e) => e.message.includes("XP insuffisant")).length,
    ).toBeGreaterThan(0);
    // La compétence-mère du runiste n'est jamais passée : ses assemblages
    // sont refusés, et le brouillon garde les recettes de l'alchimiste.
    expect(
      r2.echecs.some((e) => e.type === "assemblage"),
    ).toBe(true);
    const b = brouillonStocke();
    expect(b.acquisitions.assemblages).toEqual([]);
    expect(b.acquisitions.recettes).toHaveLength(recettesDuPremier);
  });
});

/* ------------------------------------------------------------------ */
/* [s373] Chaîne d'avancement 5→9 (déverrouillage du wizard)           */
/* ------------------------------------------------------------------ */

describe("appliquerComposition — chaîne d'avancement 5→9 (s373)", () => {
  it("appelle avancerEtape dans l'ordre 5,6,7,8,9 et atteint 10 (guerrier : étapes masquées comprises)", async () => {
    const res = tirageDeClasse("guerrier");
    const appels: number[] = [];
    const clientEspion = {
      ...clientVisiteur,
      avancerEtape: async (params: { p_personnage_id: string; p_etape_courante: number }) => {
        appels.push(params.p_etape_courante);
        return clientVisiteur.avancerEtape(params);
      },
    } as typeof clientVisiteur;

    const resultat = await appliquerComposition(
      clientEspion,
      res,
      PERSONNAGE_LOCAL_ID,
      { alea: lcg(3) },
    );

    expect(appels).toEqual([5, 6, 7, 8, 9]);
    expect(resultat.etapeApresAvancement).toBe(10);
    expect(brouillonStocke().meta.etapeCourante).toBe(10);
  });

  it("un refus arrête la chaîne EN SILENCE : statu quo séquentiel, échecs d'achat intacts", async () => {
    const res = tirageDeClasse("pretre");
    const appels: number[] = [];
    const clientRefuseA7 = {
      ...clientVisiteur,
      avancerEtape: async (params: { p_personnage_id: string; p_etape_courante: number }) => {
        appels.push(params.p_etape_courante);
        if (params.p_etape_courante >= 7) {
          return {
            data: {
              succes: false,
              erreurs: [{ code: "test_refus", message: "refus simulé" }],
              avertissements: [],
              donnees: {},
            },
            error: null,
          } as Awaited<ReturnType<typeof clientVisiteur.avancerEtape>>;
        }
        return clientVisiteur.avancerEtape(params);
      },
    } as typeof clientVisiteur;

    const resultat = await appliquerComposition(
      clientRefuseA7,
      res,
      PERSONNAGE_LOCAL_ID,
      { alea: lcg(42) },
    );

    // La chaîne s'est arrêtée à 7 (5 et 6 passés, 7 refusé, 8-9 jamais tentés).
    expect(appels).toEqual([5, 6, 7]);
    expect(resultat.etapeApresAvancement).toBe(7);
    expect(brouillonStocke().meta.etapeCourante).toBe(7);
    // SILENCE : le refus d'avancement ne pollue PAS les échecs d'achat
    // (le toast de la page compte `echecs` — il doit rester juste).
    expect(resultat.echecs).toEqual([]);
    expect(resultat.statut).toBe("complet");
  });

  it("preuve par le contraire : étape 4 refusée → avancerEtape JAMAIS appelé, phase null", async () => {
    const res = tirageDeClasse("pretre");
    const appels: number[] = [];
    const clientEtape4Refuse = {
      ...clientVisiteur,
      sauvegarderEtape4: async () =>
        ({
          data: {
            succes: false,
            erreurs: [{ code: "test_refus_etape4", message: "refus simulé" }],
            avertissements: [],
            donnees: {},
          },
          error: null,
        }) as Awaited<ReturnType<typeof clientVisiteur.sauvegarderEtape4>>,
      avancerEtape: async (params: { p_personnage_id: string; p_etape_courante: number }) => {
        appels.push(params.p_etape_courante);
        return clientVisiteur.avancerEtape(params);
      },
    } as typeof clientVisiteur;

    const resultat = await appliquerComposition(
      clientEtape4Refuse,
      res,
      PERSONNAGE_LOCAL_ID,
      { alea: lcg(42) },
    );

    expect(resultat.statut).toBe("partiel");
    expect(appels).toEqual([]);
    expect(resultat.etapeApresAvancement).toBeNull();
    // Et l'ordre du plan protège toujours : aucun achat n'est parti.
    const achats = resultat.faits.filter((f) =>
      ["competence", "sort", "priere"].includes(f.type),
    );
    expect(achats).toEqual([]);
  });
});
