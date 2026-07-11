/**
 * Garde de `FicheVisiteur` (s322) : la fiche visiteur n'est consultable que si
 * un brouillon existe ET est finalisé (étape 11, cf. BUG C — s311). Mêmes
 * conventions que `regressionBugsS311.test.ts` : stockage `localStorage`
 * mocké (config vitest = node) + moteur `clientVisiteur` réel pour produire
 * un brouillon authentiquement finalisé.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { clientVisiteur, PERSONNAGE_LOCAL_ID } from "@/creation/visiteur/clientVisiteur";
import { getSnapshot } from "@/moteurCreation/snapshot";
import { brouillonFinaliseDisponible } from "@/creation/visiteur/gardeFicheVisiteur";

// ── localStorage stub (config vitest = node) ──
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

const snap = getSnapshot();
const idClasse = (nom: string) => snap.tables.classes.find((c) => c.nom === nom)!.id;
const idRace = (nom: string) => snap.tables.races.find((r) => r.nom === nom)!.id;

const CLASSE_GUERRIER = idClasse("Guerrier");
const RACE_HUMAIN = idRace("Humain");
const TRAIT_HUMAIN = "4675941e-481c-410d-a14f-9c2672d219ba"; // Coup du destin (gratuit si seul choisi)

const nul = null as unknown as string;

beforeEach(() => {
  installerLocalStorage();
});

async function finaliserBrouillonVisiteur(): Promise<void> {
  await clientVisiteur.demarrerCreationPersonnage({});
  await clientVisiteur.sauvegarderEtape1({
    p_personnage_id: PERSONNAGE_LOCAL_ID, p_nom: "Aldric",
    p_gn_completes: 0, p_mini_gn_completes: 0, p_ouvertures_terrain: 0,
    p_est_croyant: false, p_religion_id: nul,
  });
  await clientVisiteur.sauvegarderEtape2({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_race_id: RACE_HUMAIN });
  await clientVisiteur.sauvegarderEtape3({
    p_personnage_id: PERSONNAGE_LOCAL_ID,
    p_traits_raciaux_choisis: [{ trait_id: TRAIT_HUMAIN, est_gratuit: true, xp_depense: 0 }],
  });
  await clientVisiteur.sauvegarderEtape4({
    p_personnage_id: PERSONNAGE_LOCAL_ID, p_classe_id: CLASSE_GUERRIER,
    p_choix_par_competence: null as unknown as Record<string, string>,
  });
  const fin = await clientVisiteur.validerPersonnageFinal({ p_personnage_id: PERSONNAGE_LOCAL_ID });
  expect((fin.data as unknown as { valide: boolean }).valide).toBe(true);
}

describe("brouillonFinaliseDisponible — garde de FicheVisiteur (s322)", () => {
  it("aucun brouillon sur l'appareil → indisponible", () => {
    expect(brouillonFinaliseDisponible()).toBe(false);
  });

  it("brouillon en cours (non finalisé) → indisponible", async () => {
    await clientVisiteur.demarrerCreationPersonnage({});
    expect(brouillonFinaliseDisponible()).toBe(false);
  });

  it("brouillon finalisé (étape 11) → disponible", async () => {
    await finaliserBrouillonVisiteur();
    expect(brouillonFinaliseDisponible()).toBe(true);
  });
});
