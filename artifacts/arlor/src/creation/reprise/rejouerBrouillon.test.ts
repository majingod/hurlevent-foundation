/**
 * [VIS-6] Lot 1 — tests de l'orchestrateur pur `rejouerBrouillon`.
 *
 * Le `ClientCreation` est MOCKÉ : chaque méthode utilisée enregistre son appel
 * dans un journal (nom + params) et retourne une réponse programmée au format
 * standard `{ data: { succes, erreurs, donnees }, error }`. On prouve ainsi :
 *  - l'ordre topologique du rabais (cercle → sorts, domaine → prières) ;
 *  - la politique d'échec (STOP étape / STOP exception / CONTINUE refus) ;
 *  - le mapping byte-exact des `p_*` ;
 *  - la sémantique de `onProgres` (une fois par fait réussi).
 *
 * `catalogueDepuisSnapshot` (seule touche au snapshot) est vérifiée à part sur
 * le snapshot bundlé.
 */

import { describe, it, expect } from "vitest";
import {
  rejouerBrouillon,
  catalogueDepuisSnapshot,
  type CatalogueRejeu,
  type FaitRejeu,
} from "./rejouerBrouillon";
import type { ClientCreation } from "../types";
import {
  creerBrouillonVide,
  type BrouillonVisiteur,
} from "@/moteurCreation/brouillon/types";
import { getSnapshot } from "@/moteurCreation/snapshot";

// ============================================================
// Mock client — journal d'appels + réponses programmées
// ============================================================

interface Appel {
  methode: string;
  params: Record<string, unknown>;
}

type Payload = {
  succes: boolean;
  erreurs: Array<{ code?: string; message: string }>;
  donnees?: Record<string, unknown> | null;
};

const ok = (donnees: Record<string, unknown> | null = null): Payload => ({
  succes: true,
  erreurs: [],
  donnees,
});
const refus = (code: string, message: string): Payload => ({
  succes: false,
  erreurs: [{ code, message }],
  donnees: null,
});

/** Décide de la réponse (ou du jet) pour un appel donné, selon la méthode. */
type Reponse = { data: Payload; error: null } | { throw: Error };
type Programmeur = (methode: string, params: Record<string, unknown>) => Reponse;

interface Mock {
  client: ClientCreation;
  journal: Appel[];
}

const PROFIL_ID = "profil-xyz";
const PERSO_ID = "perso-123";

/** Programmeur par défaut : démarrage OK (renvoie personnage_id), tout le reste OK. */
const toutOk: Programmeur = (methode) => {
  if (methode === "demarrerCreationPersonnage") {
    return { data: ok({ personnage_id: PERSO_ID, etape_creation: 1 }), error: null };
  }
  return { data: ok(), error: null };
};

function creerMock(programmeur: Programmeur = toutOk): Mock {
  const journal: Appel[] = [];
  const handler = (methode: string) => async (params: Record<string, unknown>) => {
    journal.push({ methode, params });
    const r = programmeur(methode, params);
    if ("throw" in r) throw r.throw;
    return r;
  };
  const methodes = [
    "demarrerCreationPersonnage",
    "sauvegarderEtape1",
    "sauvegarderEtape2",
    "sauvegarderEtape3",
    "sauvegarderEtape4",
    "acheterCompetence",
    "acheterSort",
    "acheterPriere",
    "acheterRecette",
    "acheterAssemblage",
    "acheterPiege",
  ];
  const client = {} as Record<string, unknown>;
  for (const m of methodes) client[m] = handler(m);
  return { client: client as unknown as ClientCreation, journal };
}

/** Catalogue factice : maps explicites (id → type_choix / cercle / domaine). */
function catalogueFactice(opts: {
  typeChoix?: Record<string, "cercle" | "domaine" | null>;
  cercle?: Record<string, string>;
  domaine?: Record<string, string>;
}): CatalogueRejeu {
  return {
    typeChoixCompetence: (id) => opts.typeChoix?.[id] ?? null,
    cercleDuSort: (id) => opts.cercle?.[id] ?? null,
    domaineDeLaPriere: (id) => opts.domaine?.[id] ?? null,
  };
}

// ── Fabriques de lignes de brouillon ──
let compteurInstance = 0;
const nextId = (prefixe: string) => `${prefixe}-${++compteurInstance}`;

function brouillonBase(): BrouillonVisiteur {
  const b = creerBrouillonVide();
  b.etape1 = {
    ...b.etape1,
    nom: "Aldric",
    gnCompletes: 2,
    miniGnCompletes: 1,
    ouverturesTerrain: 0,
    estCroyant: false,
    religionId: null,
  };
  b.etape2 = { raceId: "race-humain", sousTypeChimeride: null };
  b.etape3 = { traitsRaciauxChoisis: [{ trait_id: "trait-1", est_gratuit: true }] };
  b.etape4 = { classeId: "classe-mage", choixParCompetence: { comp: "x" } };
  return b;
}

function comp(competenceId: string, niveauAcquis: number, choixAchat: string | null) {
  return { instanceId: nextId("comp"), competenceId, niveauAcquis, choixAchat };
}
function sort(sortId: string, niveauSort: number, nomPersonnalise?: string) {
  return {
    instanceId: nextId("sort"),
    sortId,
    niveauSort,
    zoneChoisie: "Personnelle",
    porteeChoisie: "Toucher",
    dureeChoisie: "Instantanée",
    nomPersonnalise,
  };
}
function priere(priereId: string, niveauPriere: number, nomPersonnalise?: string) {
  return {
    instanceId: nextId("priere"),
    priereId,
    niveauPriere,
    zoneChoisie: "Personnelle",
    porteeChoisie: "Toucher",
    dureeChoisie: "Instantanée",
    nomPersonnalise,
  };
}

/** Séquence des noms de méthode achats (hors démarrage + étapes). */
function sequenceAchats(journal: Appel[]): Array<{ methode: string; id: string }> {
  const debutAchats = journal.findIndex((a) => a.methode === "acheterCompetence" || a.methode === "acheterSort" || a.methode === "acheterPriere" || a.methode === "acheterRecette" || a.methode === "acheterAssemblage" || a.methode === "acheterPiege");
  if (debutAchats < 0) return [];
  return journal.slice(debutAchats).map((a) => ({
    methode: a.methode,
    id:
      (a.params.p_competence_id as string) ??
      (a.params.p_sort_id as string) ??
      (a.params.p_priere_id as string) ??
      (a.params.p_recette_id as string) ??
      (a.params.p_assemblage_id as string) ??
      (a.params.p_piege_id as string) ??
      "",
  }));
}

// ============================================================
// 1. Ordre topologique — cercle (sorts)
// ============================================================
describe("ordre topologique cercle", () => {
  it("Acq(cercle Feu) niv 1,2,3 + sorts Feu niv 1,1,2 → Acq1 → sorts niv1 ×2 → Acq2 → sort niv2 → Acq3", async () => {
    const b = brouillonBase();
    const acq1 = comp("acq-cercle", 1, "Feu");
    const acq2 = comp("acq-cercle", 2, "Feu");
    const acq3 = comp("acq-cercle", 3, "Feu");
    const s1a = sort("sort-feu-a", 1);
    const s1b = sort("sort-feu-b", 1);
    const s2 = sort("sort-feu-c", 2);
    b.acquisitions.competences = [acq1, acq2, acq3];
    b.acquisitions.sorts = [s1a, s1b, s2];

    const { client, journal } = creerMock();
    const catalogue = catalogueFactice({
      typeChoix: { "acq-cercle": "cercle" },
      cercle: { "sort-feu-a": "Feu", "sort-feu-b": "Feu", "sort-feu-c": "Feu" },
    });
    const res = await rejouerBrouillon(client, catalogue, b, PROFIL_ID);

    expect(res.statut).toBe("complet");
    expect(sequenceAchats(journal).map((x) => x.id)).toEqual([
      "acq-cercle", // Acq1 (niv1, pas de pré-rejeu)
      "sort-feu-a", // pré-rejeu avant Acq2 (niv ≤ 1)
      "sort-feu-b",
      "acq-cercle", // Acq2
      "sort-feu-c", // pré-rejeu avant Acq3 (niv ≤ 2)
      "acq-cercle", // Acq3
    ]);
  });
});

// ============================================================
// 2. Ordre topologique — domaine (prières)
// ============================================================
describe("ordre topologique domaine", () => {
  it("Acq(domaine Chaos) niv 1,2,3 + prières Chaos niv 1,1,2 → symétrique", async () => {
    const b = brouillonBase();
    b.acquisitions.competences = [
      comp("acq-domaine", 1, "Chaos"),
      comp("acq-domaine", 2, "Chaos"),
      comp("acq-domaine", 3, "Chaos"),
    ];
    b.acquisitions.prieres = [
      priere("pri-a", 1),
      priere("pri-b", 1),
      priere("pri-c", 2),
    ];

    const { client, journal } = creerMock();
    const catalogue = catalogueFactice({
      typeChoix: { "acq-domaine": "domaine" },
      domaine: { "pri-a": "Chaos", "pri-b": "Chaos", "pri-c": "Chaos" },
    });
    const res = await rejouerBrouillon(client, catalogue, b, PROFIL_ID);

    expect(res.statut).toBe("complet");
    expect(sequenceAchats(journal).map((x) => x.id)).toEqual([
      "acq-domaine",
      "pri-a",
      "pri-b",
      "acq-domaine",
      "pri-c",
      "acq-domaine",
    ]);
  });
});

// ============================================================
// 3. Compétences non-Acquisition : ordre du brouillon inchangé
// ============================================================
describe("compétences non-Acquisition", () => {
  it("restent strictement dans l'ordre du brouillon, non déplacées", async () => {
    const b = brouillonBase();
    b.acquisitions.competences = [
      comp("comp-a", 1, null),
      comp("comp-b", 2, null),
      comp("comp-c", 3, "quelconque"), // niv 2/3 mais type_choix null → pas de pré-rejeu
    ];
    b.acquisitions.sorts = [sort("sort-x", 1)];

    const { client, journal } = creerMock();
    const catalogue = catalogueFactice({ typeChoix: {}, cercle: { "sort-x": "Feu" } });
    const res = await rejouerBrouillon(client, catalogue, b, PROFIL_ID);

    expect(res.statut).toBe("complet");
    // Les 3 compétences d'abord (ordre brouillon), le sort seulement à la fin.
    expect(sequenceAchats(journal).map((x) => x.id)).toEqual([
      "comp-a",
      "comp-b",
      "comp-c",
      "sort-x",
    ]);
  });
});

// ============================================================
// 4. Restants après compétences : sort de niveau = palier max
// ============================================================
describe("restants après compétences", () => {
  it("un sort de niveau = palier max est rejoué après la dernière compétence", async () => {
    const b = brouillonBase();
    // Acq cercle Feu niv 2 → seuil pré-rejeu = niv ≤ 1 ; le sort niv 2 n'est PAS
    // éligible au pré-rejeu et tombe dans la passe « restants ».
    b.acquisitions.competences = [comp("acq-cercle", 2, "Feu")];
    b.acquisitions.sorts = [sort("sort-feu-2", 2)];

    const { client, journal } = creerMock();
    const catalogue = catalogueFactice({
      typeChoix: { "acq-cercle": "cercle" },
      cercle: { "sort-feu-2": "Feu" },
    });
    const res = await rejouerBrouillon(client, catalogue, b, PROFIL_ID);

    expect(res.statut).toBe("complet");
    expect(sequenceAchats(journal).map((x) => x.id)).toEqual([
      "acq-cercle",
      "sort-feu-2",
    ]);
  });
});

// ============================================================
// 5. Échec étape 2 → partiel, aucun appel après
// ============================================================
describe("échec d'étape", () => {
  it("étape 2 refusée → statut partiel, journal vide au-delà, code/message verbatim", async () => {
    const b = brouillonBase();
    b.acquisitions.competences = [comp("comp-a", 1, null)]; // ne doit jamais être tenté

    const prog: Programmeur = (methode, params) => {
      if (methode === "sauvegarderEtape2") {
        return { data: refus("race_manquante", "La race est obligatoire"), error: null };
      }
      return toutOk(methode, params);
    };
    const { client, journal } = creerMock(prog);
    const res = await rejouerBrouillon(client, catalogueFactice({}), b, PROFIL_ID);

    expect(res.statut).toBe("partiel");
    expect(res.echecs).toEqual([
      { type: "etape2", code: "race_manquante", message: "La race est obligatoire" },
    ]);
    // Rien après l'étape 2 (ni étape 3/4, ni achats).
    const methodes = journal.map((a) => a.methode);
    expect(methodes).toEqual([
      "demarrerCreationPersonnage",
      "sauvegarderEtape1",
      "sauvegarderEtape2",
    ]);
    expect(res.faits.map((f) => f.type)).toEqual(["demarrage", "etape1"]);
  });
});

// ============================================================
// 6. Achat refusé → on continue
// ============================================================
describe("achat refusé", () => {
  it("un achat refusé est journalisé, statut partiel, les suivants sont tentés", async () => {
    const b = brouillonBase();
    const cA = comp("comp-a", 1, null);
    const cB = comp("comp-b", 1, null);
    const cC = comp("comp-c", 1, null);
    b.acquisitions.competences = [cA, cB, cC];

    const prog: Programmeur = (methode, params) => {
      if (methode === "acheterCompetence" && params.p_competence_id === "comp-b") {
        return { data: refus("xp_insuffisant", "XP insuffisant"), error: null };
      }
      return toutOk(methode, params);
    };
    const { client, journal } = creerMock(prog);
    const faitsProgres: FaitRejeu[] = [];
    const res = await rejouerBrouillon(client, catalogueFactice({}), b, PROFIL_ID, (f) =>
      faitsProgres.push(f),
    );

    expect(res.statut).toBe("partiel");
    // Les 3 compétences ont bien été TENTÉES (comp-b refusée n'arrête pas).
    expect(sequenceAchats(journal).map((x) => x.id)).toEqual(["comp-a", "comp-b", "comp-c"]);
    expect(res.echecs).toEqual([
      { type: "competence", instanceId: cB.instanceId, code: "xp_insuffisant", message: "XP insuffisant" },
    ]);
    // comp-b n'apparaît PAS dans les faits réussis (ni dans onProgres).
    const idsReussis = res.faits.filter((f) => f.type === "competence").map((f) => f.instanceId);
    expect(idsReussis).toEqual([cA.instanceId, cC.instanceId]);
    expect(faitsProgres.filter((f) => f.type === "competence").map((f) => f.instanceId)).toEqual([
      cA.instanceId,
      cC.instanceId,
    ]);
  });
});

// ============================================================
// 7. brouillon_existant au démarrage → echec_demarrage
// ============================================================
describe("démarrage refusé", () => {
  it("brouillon_existant → statut echec_demarrage, code propagé, zéro autre appel", async () => {
    const b = brouillonBase();
    b.acquisitions.competences = [comp("comp-a", 1, null)];

    const prog: Programmeur = (methode) => {
      if (methode === "demarrerCreationPersonnage") {
        return {
          data: refus("brouillon_existant", "Vous avez déjà un personnage en cours de création."),
          error: null,
        };
      }
      return { data: ok(), error: null };
    };
    const { client, journal } = creerMock(prog);
    const res = await rejouerBrouillon(client, catalogueFactice({}), b, PROFIL_ID);

    expect(res.statut).toBe("echec_demarrage");
    expect(res.personnageId).toBeNull();
    expect(res.echecs).toEqual([
      {
        type: "demarrage",
        code: "brouillon_existant",
        message: "Vous avez déjà un personnage en cours de création.",
      },
    ]);
    expect(res.faits).toEqual([]);
    expect(journal.map((a) => a.methode)).toEqual(["demarrerCreationPersonnage"]);
  });
});

// ============================================================
// 8. Exception réseau sur un achat → stop immédiat
// ============================================================
describe("exception réseau", () => {
  it("exception sur un achat → stop, partiel, code:'exception', rien après", async () => {
    const b = brouillonBase();
    const cA = comp("comp-a", 1, null);
    const cB = comp("comp-b", 1, null);
    const cC = comp("comp-c", 1, null);
    b.acquisitions.competences = [cA, cB, cC];

    const prog: Programmeur = (methode, params) => {
      if (methode === "acheterCompetence" && params.p_competence_id === "comp-b") {
        return { throw: new Error("Network request failed") };
      }
      return toutOk(methode, params);
    };
    const { client, journal } = creerMock(prog);
    const res = await rejouerBrouillon(client, catalogueFactice({}), b, PROFIL_ID);

    expect(res.statut).toBe("partiel");
    expect(res.echecs).toEqual([
      { type: "competence", instanceId: cB.instanceId, code: "exception", message: "Network request failed" },
    ]);
    // comp-c ne doit PAS être tenté (arrêt immédiat sur exception).
    expect(sequenceAchats(journal).map((x) => x.id)).toEqual(["comp-a", "comp-b"]);
  });
});

// ============================================================
// 9. Mapping params byte-exact
// ============================================================
describe("mapping params byte-exact", () => {
  it("chaque appel reçoit exactement les p_* spécifiés (null propagés)", async () => {
    const b = brouillonBase();
    // Non-croyant → p_religion_id null ; sort sans nomPersonnalise → p_nom_personnalise null.
    const cA = comp("comp-a", 1, null);
    const s = sort("sort-x", 1); // pas de nomPersonnalise
    const p = priere("pri-x", 1, "Litanie");
    b.acquisitions.competences = [cA];
    b.acquisitions.sorts = [s];
    b.acquisitions.prieres = [p];
    b.acquisitions.recettes = [{ instanceId: "r1", recetteId: "rec-1" }];
    b.acquisitions.assemblages = [{ instanceId: "a1", assemblageId: "asm-1" }];
    b.acquisitions.pieges = [{ instanceId: "pg1", piegeId: "piege-1" }];

    const { client, journal } = creerMock();
    await rejouerBrouillon(client, catalogueFactice({}), b, PROFIL_ID);

    const par = (m: string) => journal.find((a) => a.methode === m)!.params;

    expect(par("demarrerCreationPersonnage")).toEqual({ p_profil_id: PROFIL_ID });
    expect(par("sauvegarderEtape1")).toEqual({
      p_personnage_id: PERSO_ID,
      p_nom: "Aldric",
      p_gn_completes: 2,
      p_mini_gn_completes: 1,
      p_ouvertures_terrain: 0,
      p_est_croyant: false,
      p_religion_id: null,
    });
    expect(par("sauvegarderEtape2")).toEqual({
      p_personnage_id: PERSO_ID,
      p_race_id: "race-humain",
      p_sous_type_chimeride: null,
    });
    expect(par("sauvegarderEtape3")).toEqual({
      p_personnage_id: PERSO_ID,
      p_traits_raciaux_choisis: [{ trait_id: "trait-1", est_gratuit: true }],
    });
    expect(par("sauvegarderEtape4")).toEqual({
      p_personnage_id: PERSO_ID,
      p_classe_id: "classe-mage",
      p_choix_par_competence: { comp: "x" },
    });
    expect(par("acheterCompetence")).toEqual({
      p_personnage_id: PERSO_ID,
      p_competence_id: "comp-a",
      p_niveau_desire: 1,
      p_choix_achat: null,
    });
    expect(par("acheterSort")).toEqual({
      p_personnage_id: PERSO_ID,
      p_sort_id: "sort-x",
      p_niveau_sort: 1,
      p_zone_choisie: "Personnelle",
      p_portee_choisie: "Toucher",
      p_duree_choisie: "Instantanée",
      p_nom_personnalise: null,
    });
    expect(par("acheterPriere")).toEqual({
      p_personnage_id: PERSO_ID,
      p_priere_id: "pri-x",
      p_niveau_priere: 1,
      p_zone_choisie: "Personnelle",
      p_portee_choisie: "Toucher",
      p_duree_choisie: "Instantanée",
      p_nom_personnalise: "Litanie",
    });
    expect(par("acheterRecette")).toEqual({ p_personnage_id: PERSO_ID, p_recette_id: "rec-1" });
    expect(par("acheterAssemblage")).toEqual({ p_personnage_id: PERSO_ID, p_assemblage_id: "asm-1" });
    expect(par("acheterPiege")).toEqual({ p_personnage_id: PERSO_ID, p_piege_id: "piege-1" });
  });
});

// ============================================================
// 10. Ordre artisanat : recettes → assemblages → pièges
// ============================================================
describe("ordre artisanat", () => {
  it("recettes puis assemblages puis pièges, chacun dans l'ordre, après toutes les compétences", async () => {
    const b = brouillonBase();
    b.acquisitions.competences = [comp("comp-a", 1, null)];
    b.acquisitions.recettes = [
      { instanceId: "r1", recetteId: "rec-1" },
      { instanceId: "r2", recetteId: "rec-2" },
    ];
    b.acquisitions.assemblages = [
      { instanceId: "a1", assemblageId: "asm-1" },
      { instanceId: "a2", assemblageId: "asm-2" },
    ];
    b.acquisitions.pieges = [
      { instanceId: "pg1", piegeId: "piege-1" },
      { instanceId: "pg2", piegeId: "piege-2" },
    ];

    const { client, journal } = creerMock();
    const res = await rejouerBrouillon(client, catalogueFactice({}), b, PROFIL_ID);

    expect(res.statut).toBe("complet");
    expect(sequenceAchats(journal)).toEqual([
      { methode: "acheterCompetence", id: "comp-a" },
      { methode: "acheterRecette", id: "rec-1" },
      { methode: "acheterRecette", id: "rec-2" },
      { methode: "acheterAssemblage", id: "asm-1" },
      { methode: "acheterAssemblage", id: "asm-2" },
      { methode: "acheterPiege", id: "piege-1" },
      { methode: "acheterPiege", id: "piege-2" },
    ]);
  });
});

// ============================================================
// 11. onProgres : une fois par fait réussi, jamais pour un échec
// ============================================================
describe("onProgres", () => {
  it("appelé une fois par fait réussi, pas pour les échecs", async () => {
    const b = brouillonBase();
    const cOk = comp("comp-ok", 1, null);
    const cKo = comp("comp-ko", 1, null);
    b.acquisitions.competences = [cOk, cKo];

    const prog: Programmeur = (methode, params) => {
      if (methode === "acheterCompetence" && params.p_competence_id === "comp-ko") {
        return { data: refus("xp_insuffisant", "XP insuffisant"), error: null };
      }
      return toutOk(methode, params);
    };
    const { client } = creerMock(prog);
    const progres: FaitRejeu[] = [];
    const res = await rejouerBrouillon(client, catalogueFactice({}), b, PROFIL_ID, (f) =>
      progres.push(f),
    );

    // onProgres reflète EXACTEMENT la liste des faits réussis.
    expect(progres).toEqual(res.faits);
    expect(progres.map((f) => f.type)).toEqual([
      "demarrage",
      "etape1",
      "etape2",
      "etape3",
      "etape4",
      "competence", // comp-ok seulement
    ]);
    expect(progres.filter((f) => f.type === "competence").map((f) => f.instanceId)).toEqual([
      cOk.instanceId,
    ]);
  });
});

// ============================================================
// catalogueDepuisSnapshot — seule touche au snapshot
// ============================================================
describe("catalogueDepuisSnapshot", () => {
  const snap = getSnapshot();
  const cat = catalogueDepuisSnapshot();

  it("typeChoixCompetence reflète le type_choix du snapshot (cercle/domaine/null)", () => {
    const compCercle = snap.tables.competences.find((c) => c.type_choix === "cercle");
    const compDomaine = snap.tables.competences.find((c) => c.type_choix === "domaine");
    const compNull = snap.tables.competences.find((c) => c.type_choix == null);

    expect(compCercle && cat.typeChoixCompetence(compCercle.id)).toBe("cercle");
    expect(compDomaine && cat.typeChoixCompetence(compDomaine.id)).toBe("domaine");
    // type_choix non-null hors cercle/domaine (ex. religion/langue) ou null → null.
    expect(compNull && cat.typeChoixCompetence(compNull.id)).toBeNull();
    expect(cat.typeChoixCompetence("id-inexistant")).toBeNull();
  });

  it("cercleDuSort / domaineDeLaPriere lisent le catalogue du snapshot", () => {
    const sorts = snap.tables.sorts as Array<{ id: string; cercle: string | null }>;
    const prieres = snap.tables.prieres as Array<{ id: string; domaine: string | null }>;
    const unSort = sorts.find((s) => s.cercle != null)!;
    const unePriere = prieres.find((p) => p.domaine != null)!;

    expect(cat.cercleDuSort(unSort.id)).toBe(unSort.cercle);
    expect(cat.domaineDeLaPriere(unePriere.id)).toBe(unePriere.domaine);
    expect(cat.cercleDuSort("id-inexistant")).toBeNull();
    expect(cat.domaineDeLaPriere("id-inexistant")).toBeNull();
  });
});
