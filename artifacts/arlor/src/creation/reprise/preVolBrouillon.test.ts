/**
 * [VIS-6] Lot 2 — tests du PRÉ-VOL `preVolerBrouillon`.
 *
 * Le pré-vol rejoue le brouillon sur un client visiteur EN MÉMOIRE : ancres = ids
 * RÉELS du snapshot bundlé (mêmes que `desachatsFideles.test.ts`, vérifiés s311).
 * On prouve :
 *  - brouillon propre → `valide:true`, delta 0 (aucune Acquisition niv 2/3) ;
 *  - item absent du catalogue → échec listé (message serveur), `valide:false` ;
 *  - divergence de rabais construite (Acq Cercle niv 2 + un sort de niveau 2 non
 *    encore rejoué au palier) → `xpTotalAttendu = xpTotalOffline + 1`, montant
 *    exact issu de `rabais.ts` ;
 *  - le slot `localStorage` n'est JAMAIS écrit (spy).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { preVolerBrouillon } from "./preVolBrouillon";
import { CLE_BROUILLON } from "../visiteur/stockageBrouillon";
import { getSnapshot } from "@/moteurCreation/snapshot";
import {
  creerBrouillonVide,
  type BrouillonVisiteur,
} from "@/moteurCreation/brouillon/types";

const snap = getSnapshot();
const idClasse = (nom: string) => snap.tables.classes.find((c) => c.nom === nom)!.id;
const idRace = (nom: string) => snap.tables.races.find((r) => r.nom === nom)!.id;

const CLASSE_MAGE = idClasse("Mage");
const RACE_HUMAIN = idRace("Humain");
const TRAIT_HUMAIN = "4675941e-481c-410d-a14f-9c2672d219ba"; // Coup du destin
const COMP_CERCLE = "9fc3a181-4e29-4d94-8639-65b9a9a7c787"; // Acquisition de Cercle (niv 1=5, 2=10, 3=15)
const COMP_DECRYPTAGE = "0b0fba09-77d5-4078-946f-9add150f695d"; // gratuité Mage (choix langue)
const COMP_DEV_SPI = "0db39587-68ad-4025-afe4-bbcbff67ad8a"; // Développement Spirituel (niv1 = 2 XP)
const SORT_FEU_N1 = "018f508e-fe3f-414a-9a95-3248692c5d3b"; // Bouclier de Feu (cercle Feu)

let compteur = 0;
const inst = () => `inst-${++compteur}`;

/** Brouillon Mage/Humain valide jusqu'à l'étape 4 (XP large pour couvrir les achats). */
function baseBrouillon(): BrouillonVisiteur {
  const b = creerBrouillonVide();
  b.etape1 = {
    nom: "Aldric",
    gnCompletes: 100,
    miniGnCompletes: 0,
    ouverturesTerrain: 0,
    estCroyant: false,
    religionId: null,
  };
  b.etape2 = { raceId: RACE_HUMAIN, sousTypeChimeride: null };
  b.etape3 = { traitsRaciauxChoisis: [{ trait_id: TRAIT_HUMAIN, est_gratuit: true, xp_depense: 0 }] };
  b.etape4 = { classeId: CLASSE_MAGE, choixParCompetence: { [COMP_DECRYPTAGE]: "L'Ancien" } };
  return b;
}
const comp = (competenceId: string, niveauAcquis: number, choixAchat: string | null) => ({
  instanceId: inst(),
  competenceId,
  niveauAcquis,
  choixAchat,
});
const sort = (sortId: string, niveauSort: number) => ({
  instanceId: inst(),
  sortId,
  niveauSort,
  zoneChoisie: "Personnelle",
  porteeChoisie: "Toucher",
  dureeChoisie: "Instantanée",
});

describe("preVolerBrouillon — brouillon propre", () => {
  it("aucune Acquisition niv 2/3 → valide, echecs vides, delta 0, non périmé", async () => {
    const b = baseBrouillon();
    b.acquisitions.competences = [comp(COMP_DEV_SPI, 1, null)];

    const r = await preVolerBrouillon(b);
    expect(r.echecs, JSON.stringify(r.echecs)).toEqual([]);
    expect(r.valide).toBe(true);
    expect(r.xpTotalOffline).toBeGreaterThan(0);
    expect(r.xpTotalAttendu).toBe(r.xpTotalOffline); // delta 0
    expect(r.peremption).toBe(false);
  });
});

describe("preVolerBrouillon — item retiré du catalogue", () => {
  it("un sort absent du snapshot → échec listé (verbatim), valide:false", async () => {
    const b = baseBrouillon();
    b.acquisitions.sorts = [sort("sort-inexistant-xyz", 1)];

    const r = await preVolerBrouillon(b);
    expect(r.valide).toBe(false);
    expect(r.echecs).toHaveLength(1);
    expect(r.echecs[0].type).toBe("sort");
    expect(r.echecs[0].code).toBe("sort_introuvable");
    expect(r.echecs[0].message).toBe("Sort introuvable");
  });
});

describe("preVolerBrouillon — divergence de rabais (ordre d'achat serveur)", () => {
  it("Acq Cercle niv 2 + sort niveau 2 non rejoué au palier → attendu = offline + 1", async () => {
    const b = baseBrouillon();
    // Acquisition de Cercle « Feu » niv 1 puis 2 : le cercle passe à max 10.
    b.acquisitions.competences = [
      comp(COMP_CERCLE, 1, "Feu"),
      comp(COMP_CERCLE, 2, "Feu"),
    ];
    // Sort du cercle Feu au niveau 2 : éligible au rabais du palier niv 2
    // (seuil 5) MAIS pas pré-rejoué avant lui (seuil pré-rejeu = niv ≤ 1). Le
    // serveur l'achète APRÈS le palier → 1 XP de rabais en moins qu'en offline.
    b.acquisitions.sorts = [sort(SORT_FEU_N1, 2)];

    const r = await preVolerBrouillon(b);
    expect(r.echecs, JSON.stringify(r.echecs)).toEqual([]);
    expect(r.valide).toBe(true);
    expect(r.xpTotalAttendu).toBe(r.xpTotalOffline + 1);
  });
});

describe("preVolerBrouillon — n'écrit jamais le slot localStorage", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn((k: string) => (store.has(k) ? store.get(k)! : null)),
        setItem: vi.fn((k: string, v: string) => void store.set(k, String(v))),
        removeItem: vi.fn((k: string) => void store.delete(k)),
        clear: () => store.clear(),
        key: (i: number) => [...store.keys()][i] ?? null,
        get length() {
          return store.size;
        },
      },
    });
  });

  it("le pré-vol ne touche NI setItem NI removeItem sur la clé du brouillon", async () => {
    const b = baseBrouillon();
    b.acquisitions.competences = [comp(COMP_DEV_SPI, 1, null)];

    await preVolerBrouillon(b);

    const ls = globalThis.localStorage as unknown as {
      setItem: ReturnType<typeof vi.fn>;
      removeItem: ReturnType<typeof vi.fn>;
    };
    const ecritBrouillon = ls.setItem.mock.calls.some((c) => c[0] === CLE_BROUILLON);
    const effaceBrouillon = ls.removeItem.mock.calls.some((c) => c[0] === CLE_BROUILLON);
    expect(ecritBrouillon).toBe(false);
    expect(effaceBrouillon).toBe(false);
  });
});
