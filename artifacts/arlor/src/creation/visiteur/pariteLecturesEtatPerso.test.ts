/**
 * Parité visiteur — LECTURES ÉTAT-PERSO (verrouillage de régression).
 *
 * Dernier volet testable de [AUD-RESTE]. Contrairement aux lectures catalogue
 * (#670) et encyclopédie/règles (#672), qui rejouent un SNAPSHOT figé, les 6
 * lectures ci-dessous projettent le BROUILLON visiteur (`chargerBrouillon`) +
 * l'état DÉRIVÉ (`deriver`). La parité à verrouiller :
 *  1. le JEU DE COLONNES exact du `select(...)` serveur de
 *     `src/creation/clientServeur.ts` (recopié tel quel ci-dessous) ;
 *  2. le MAPPING des valeurs : champs bruts ← brouillon (etape1-4/meta), champs
 *     calculés ← `deriver(b)` (xp_total, xp_depense) — attestation de câblage,
 *     `deriver` a ses propres suites ;
 *  3. les GARDES : id ≠ `PERSONNAGE_LOCAL_ID` → `PERSONNAGE_INCONNU` ; brouillon
 *     absent → « Personnage introuvable. » pour les 5 lectures « single »,
 *     mais `data: []` pour `CompetencesNoms` — asymétrie FIDÈLE au serveur
 *     (`.single()` erre sur ligne absente ; un select-liste renvoie `[]`).
 *
 * Périmètre : uniquement les lectures marquées FIDÈLES (`✅`) dans
 * docs/PARITE_VISITEUR_AUDIT_s311.md. Les lectures divergentes (`⚠️`) restent
 * EXCLUES : les tester verrouillerait la divergence.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { clientVisiteur, PERSONNAGE_LOCAL_ID } from "./clientVisiteur";
import { sauverBrouillon, effacerBrouillon } from "./stockageBrouillon";
import {
  creerBrouillonVide,
  type BrouillonVisiteur,
} from "@/moteurCreation/brouillon/types";
import {
  deriverEtat as deriver,
  type EtatDeriveVisiteur,
} from "@/moteurCreation/brouillon/deriver";
import { getSnapshot } from "@/moteurCreation/snapshot";

// ── localStorage stub (config vitest = node) — copié de pariteLecturesCatalogues.test.ts.
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
beforeEach(() => {
  installerLocalStorage();
  localStorage.clear();
});

// ── args réels tirés du snapshot ──
const snap = getSnapshot();
const RELIGION_ID = snap.tables.religions[0].id;
const RACE = snap.tables.races.find(
  (r) => r.est_actif === true && r.est_jouable === true && r.nom !== "Chiméride",
)!;
const RACE_ID = RACE.id;
const TRAITS_RACE = snap.tables.race_traits
  .filter((rt) => rt.race_id === RACE_ID)
  .slice(0, 2)
  .map((rt) => rt.trait_id);
const CLASSE_ID = snap.tables.classes.find((c) => c.est_actif === true)!.id;
// « Botte Secrète » + « Maniement du bouclier moyen » : compétences actives
// simples, sans lien avec les gratuités de classe du Prêtre — noms résolubles
// au snapshot pour CompetencesNoms.
const COMPETENCE_1 = "04cadb85-598c-4dbf-b982-3b5f9d5736f2";
const COMPETENCE_2 = "05529f8e-0743-4573-bbb9-bad8358e9bd8";

/** Fixture BrouillonVisiteur v2 réaliste, surchargée depuis `creerBrouillonVide`. */
function construireFixture(): BrouillonVisiteur {
  const b = creerBrouillonVide();
  return {
    ...b,
    meta: { ...b.meta, etapeCourante: 6 },
    etape1: {
      nom: "Kaelith des Cendres",
      gnCompletes: 3,
      miniGnCompletes: 2,
      ouverturesTerrain: 1,
      estCroyant: true,
      religionId: RELIGION_ID,
      historique: "Née dans les cendres du Fort Gronde, elle a fui la guerre civile.",
      amePersonnage: "Prudente, loyale envers les siens, méfiante envers les inconnus.",
    },
    etape2: {
      raceId: RACE_ID,
      sousTypeChimeride: null,
    },
    etape3: {
      traitsRaciauxChoisis: [
        { trait_id: TRAITS_RACE[0], est_gratuit: true, xp_depense: 0 },
        { trait_id: TRAITS_RACE[1], est_gratuit: false, xp_depense: 10 },
      ],
    },
    etape4: {
      classeId: CLASSE_ID,
    },
    acquisitions: {
      ...b.acquisitions,
      competences: [
        { instanceId: "fixture-comp-1", competenceId: COMPETENCE_1, niveauAcquis: 1, choixAchat: null },
        { instanceId: "fixture-comp-2", competenceId: COMPETENCE_2, niveauAcquis: 1, choixAchat: null },
      ],
    },
  };
}

// ============================================================
// Table des 6 lectures — jeu de colonnes + mapping des valeurs
// ============================================================
interface Cas {
  nom: string;
  appel: () => Promise<{ data: unknown; error: unknown }>;
  colonnesServeur: string[];
  valeursAttendues: (b: BrouillonVisiteur, etat: EtatDeriveVisiteur) => Record<string, unknown>;
}

const CAS: Cas[] = [
  {
    nom: "lirePersonnageIdentite",
    appel: () => clientVisiteur.lirePersonnageIdentite(PERSONNAGE_LOCAL_ID),
    // clientServeur.ts:132
    colonnesServeur: [
      "nom", "gn_completes", "mini_gn_completes", "ouvertures_terrain",
      "est_croyant", "religion_id", "historique", "ame_personnage",
    ],
    valeursAttendues: (b) => ({
      nom: b.etape1.nom,
      gn_completes: b.etape1.gnCompletes,
      mini_gn_completes: b.etape1.miniGnCompletes,
      ouvertures_terrain: b.etape1.ouverturesTerrain,
      est_croyant: b.etape1.estCroyant,
      religion_id: b.etape1.religionId,
      historique: b.etape1.historique ?? null,
      ame_personnage: b.etape1.amePersonnage ?? null,
    }),
  },
  {
    nom: "lirePersonnageRace",
    appel: () => clientVisiteur.lirePersonnageRace(PERSONNAGE_LOCAL_ID),
    // clientServeur.ts:141
    colonnesServeur: ["race_id", "sous_type_chimeride", "traits_raciaux_choisis", "xp_total"],
    valeursAttendues: (b, etat) => ({
      race_id: b.etape2.raceId || null,
      sous_type_chimeride: b.etape2.sousTypeChimeride ?? null,
      traits_raciaux_choisis: b.etape3.traitsRaciauxChoisis,
      xp_total: etat.xpTotal,
    }),
  },
  {
    nom: "lirePersonnageClasse",
    appel: () => clientVisiteur.lirePersonnageClasse(PERSONNAGE_LOCAL_ID),
    // clientServeur.ts:149
    colonnesServeur: ["classe_id", "race_id", "religion_id", "est_croyant", "nom"],
    valeursAttendues: (b) => ({
      classe_id: b.etape4.classeId || null,
      race_id: b.etape2.raceId || null,
      religion_id: b.etape1.religionId,
      est_croyant: b.etape1.estCroyant,
      nom: b.etape1.nom,
    }),
  },
  {
    nom: "lirePersonnageReligion",
    appel: () => clientVisiteur.lirePersonnageReligion(PERSONNAGE_LOCAL_ID),
    // clientServeur.ts:157
    colonnesServeur: ["id", "religion_id"],
    valeursAttendues: (b) => ({
      id: PERSONNAGE_LOCAL_ID,
      religion_id: b.etape1.religionId,
    }),
  },
  {
    nom: "lirePersonnageProgression",
    appel: () => clientVisiteur.lirePersonnageProgression(PERSONNAGE_LOCAL_ID),
    // clientServeur.ts:165
    colonnesServeur: ["id", "nom", "etape_creation", "xp_total", "xp_depense"],
    valeursAttendues: (b, etat) => ({
      id: PERSONNAGE_LOCAL_ID,
      nom: b.etape1.nom,
      etape_creation: b.meta.etapeCourante,
      xp_total: etat.xpTotal,
      xp_depense: etat.xpDepense,
    }),
  },
];

describe("Parité lectures état-perso — jeu de colonnes + mapping brouillon/deriver", () => {
  let fixture: BrouillonVisiteur;

  beforeEach(() => {
    fixture = construireFixture();
    sauverBrouillon(fixture);
  });

  for (const cas of CAS) {
    it(`${cas.nom} : colonnes + valeurs === select serveur`, async () => {
      const etat = deriver(fixture);
      const { data, error } = await cas.appel();
      expect(error).toBeNull();
      const row = data as Record<string, unknown>;
      expect(Object.keys(row).sort()).toEqual([...cas.colonnesServeur].sort());
      expect(row).toEqual(cas.valeursAttendues(fixture, etat));
    });
  }

  // etape_creation discriminante (≠ 1) : la fixture pose etapeCourante = 6.
  it("etapeCourante = 6 (discriminant, distinct de la valeur par défaut du brouillon vide)", () => {
    expect(fixture.meta.etapeCourante).toBe(6);
    expect(fixture.meta.etapeCourante).not.toBe(creerBrouillonVide().meta.etapeCourante);
  });
});

// ============================================================
// CompetencesNoms — forme imbriquée { competences: { nom } }, hors table
// (`select("competences(nom)")` sans `.single()` → liste, clientServeur.ts:489)
// ============================================================
describe("Parité lectures état-perso — lirePersonnageCompetencesNoms", () => {
  it("chaque ligne = {competences:{nom}} ; ensemble des noms === deriver(fixture).contextePersonnage.competencesAcquises", async () => {
    const fixture = construireFixture();
    sauverBrouillon(fixture);
    const etat = deriver(fixture);

    const { data, error } = await clientVisiteur.lirePersonnageCompetencesNoms(PERSONNAGE_LOCAL_ID);
    expect(error).toBeNull();
    const rows = data as unknown as Array<{ competences: { nom: string | null } }>;

    // Non-vacuité : au moins les 2 achats payants de la fixture.
    expect(rows.length).toBeGreaterThanOrEqual(2);

    // Forme stricte : exactement { competences: { nom } } par ligne.
    for (const row of rows) {
      expect(Object.keys(row)).toEqual(["competences"]);
      expect(Object.keys(row.competences)).toEqual(["nom"]);
    }

    // Le serveur liste TOUTES les lignes personnage_competences — gratuités de
    // classe dérivées incluses (§ CompetencesNoms, deriver.ts contextePersonnage).
    const nomsAttendus = etat.contextePersonnage.competencesAcquises.map(
      (c) => snap.tables.competences.find((cat) => cat.id === c.competenceId)?.nom ?? null,
    );
    expect(rows.map((r) => r.competences.nom).sort()).toEqual([...nomsAttendus].sort());
    // Même multiplicité (pas de dédoublonnage) : mêmes effectifs.
    expect(rows.length).toBe(nomsAttendus.length);
  });
});

// ============================================================
// Gardes (3 tests)
// ============================================================
describe("Parité lectures état-perso — gardes", () => {
  const LECTURES_SINGLE: Array<[string, (id: string) => Promise<{ data: unknown; error: unknown }>]> = [
    ["lirePersonnageIdentite", (id) => clientVisiteur.lirePersonnageIdentite(id)],
    ["lirePersonnageRace", (id) => clientVisiteur.lirePersonnageRace(id)],
    ["lirePersonnageClasse", (id) => clientVisiteur.lirePersonnageClasse(id)],
    ["lirePersonnageReligion", (id) => clientVisiteur.lirePersonnageReligion(id)],
    ["lirePersonnageProgression", (id) => clientVisiteur.lirePersonnageProgression(id)],
  ];

  beforeEach(() => {
    sauverBrouillon(construireFixture());
  });

  // `guardPerso` est PARTAGÉ avec les orchestrations d'écriture (§A/§C) : il
  // renvoie l'enveloppe jsonb RPC (`{succes:false, erreurs:[...]}`) avec un
  // `error` de premier niveau à `null`, PAS le `{data:null, error:{code,message}}`
  // que documente `Reponse<D>` pour ces lectures — comportement RÉEL observé,
  // identique sur les 6 lectures (verrouillé tel quel, pas une hypothèse).
  interface EnveloppeErreur {
    succes: boolean;
    erreurs: Array<{ code?: string; message: string }>;
  }
  it("id inconnu (≠ PERSONNAGE_LOCAL_ID) → PERSONNAGE_INCONNU (enveloppe guardPerso) pour les 6 lectures", async () => {
    for (const [, appel] of LECTURES_SINGLE) {
      const { data, error } = await appel("autre-id");
      expect(error).toBeNull();
      const env = data as unknown as EnveloppeErreur;
      expect(env.succes).toBe(false);
      expect(env.erreurs[0]).toEqual({ code: "PERSONNAGE_INCONNU", message: "Personnage introuvable." });
    }
    const { data, error } = await clientVisiteur.lirePersonnageCompetencesNoms("autre-id");
    expect(error).toBeNull();
    const env = data as unknown as EnveloppeErreur;
    expect(env.succes).toBe(false);
    expect(env.erreurs[0]).toEqual({ code: "PERSONNAGE_INCONNU", message: "Personnage introuvable." });
  });

  it("brouillon absent → data:null + 'Personnage introuvable.' pour les 5 lectures single", async () => {
    effacerBrouillon();
    for (const [, appel] of LECTURES_SINGLE) {
      const { data, error } = await appel(PERSONNAGE_LOCAL_ID);
      expect(data).toBeNull();
      expect((error as { message: string }).message).toBe("Personnage introuvable.");
    }
  });

  it("brouillon absent → CompetencesNoms renvoie data:[] et error:null (asymétrie fidèle : .single() erre sur ligne absente, un select-liste renvoie [])", async () => {
    effacerBrouillon();
    const { data, error } = await clientVisiteur.lirePersonnageCompetencesNoms(PERSONNAGE_LOCAL_ID);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
