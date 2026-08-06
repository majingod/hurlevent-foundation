/**
 * s379 (prompt CC_SONNET, D51 — fenêtre « accès magiques dormants ») : portage
 * miroir visiteur des migrations 20260806203944 (`valider_etape_6`), 20260806204004
 * (`valider_etape_7`) et 20260806204026 (`valider_personnage_final` p_dry_run).
 *
 * §5.3 — le dry-run ne touche pas le brouillon.
 * §5.5 — parité serveur/miroir : la phrase de l'avertissement, au mot près.
 * §5.6 — cas Mélias (mesuré en prod 2026-08-06) : un personnage qui possède des
 *   sorts dans D'AUTRES cercles mais aucun dans le cercle payé produit UN
 *   avertissement. Sur `origin/main` (avant ce lot), l'ancien code regardait le
 *   TOTAL de sorts (`b.acquisitions.sorts.length === 0`) et en produisait ZÉRO
 *   dès qu'un seul sort existait, peu importe le cercle — piège C78.
 *
 * Ancres = ids réels du snapshot bundlé (déjà vérifiés dans
 * `desachatsFideles.test.ts` / `regressionBugsS311.test.ts`, s311).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { clientVisiteur, PERSONNAGE_LOCAL_ID } from "./clientVisiteur";
import { chargerBrouillon } from "./stockageBrouillon";
import { getSnapshot } from "@/moteurCreation/snapshot";

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
const CLASSE_MAGE = idClasse("Mage");
const RACE_HUMAIN = idRace("Humain");
const TRAIT_HUMAIN = "4675941e-481c-410d-a14f-9c2672d219ba"; // Coup du destin

const COMP_CERCLE = "9fc3a181-4e29-4d94-8639-65b9a9a7c787"; // Acquisition de Cercle (multiple_avec_choix_par_niveau)
const COMP_DECRYPTAGE = "0b0fba09-77d5-4078-946f-9add150f695d"; // gratuité Mage (choix langue_ancienne)

const SORT_EAU_N1 = "121584cc-bc10-464f-8296-75ad3baea69d"; // Projectile de glace (cercle Eau, niveau 1)

const ZONE = "Personnelle";
const PORTEE = "Toucher";
const DUREE = "Instantanée";
const nul = null as unknown as string;

interface Env {
  succes?: boolean;
  valide?: boolean;
  erreurs: Array<{ code?: string; message: string }>;
  avertissements: Array<{ code?: string; message: string; voie?: string; niveaux?: number[]; xp?: number }>;
  donnees: Record<string, unknown> | null;
}
const env = (data: unknown) => data as Env;

beforeEach(() => {
  installerLocalStorage();
});

async function wizardEtape5(
  classeId: string,
  choixParCompetence?: Record<string, string>,
): Promise<void> {
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
    p_personnage_id: PERSONNAGE_LOCAL_ID, p_classe_id: classeId,
    p_choix_par_competence: (choixParCompetence ?? null) as unknown as Record<string, string>,
  });
}

const acheterComp = (id: string, niveau: number, choix?: string) =>
  clientVisiteur.acheterCompetence({
    p_personnage_id: PERSONNAGE_LOCAL_ID, p_competence_id: id,
    p_niveau_desire: niveau, p_choix_achat: choix,
  });
const acheterSort = (sortId: string, niveau: number) =>
  clientVisiteur.acheterSort({
    p_personnage_id: PERSONNAGE_LOCAL_ID, p_sort_id: sortId, p_niveau_sort: niveau,
    p_zone_choisie: ZONE, p_portee_choisie: PORTEE, p_duree_choisie: DUREE,
  });

// ============================================================
// §5.3 — le dry-run ne verrouille rien, ne journalise rien
// ============================================================
describe("validerPersonnageFinal p_dry_run — §5.3", () => {
  it("p_dry_run: true → le brouillon est deep-equal à avant l'appel", async () => {
    await wizardEtape5(CLASSE_GUERRIER);

    const avant = chargerBrouillon();
    const rep = env((await clientVisiteur.validerPersonnageFinal({
      p_personnage_id: PERSONNAGE_LOCAL_ID, p_dry_run: true,
    })).data);
    expect(rep.valide).toBe(true);
    const apres = chargerBrouillon();

    expect(apres).toEqual(avant);
    expect(apres!.meta.etapeCourante).not.toBe(11);

    // Preuve que le dry-run ne bloque pas la finalisation réelle qui suit.
    const finReel = env((await clientVisiteur.validerPersonnageFinal({
      p_personnage_id: PERSONNAGE_LOCAL_ID,
    })).data);
    expect(finReel.valide).toBe(true);
    expect(chargerBrouillon()!.meta.etapeCourante).toBe(11);
  });
});

// ============================================================
// §5.5 — parité serveur/miroir : la phrase au mot près
// ============================================================
describe("avertissement info_cercle_sans_sort — §5.5 (parité de phrase)", () => {
  it("cercle payé 15 XP (niv 1 + niv 2) sans aucun sort → phrase exacte", async () => {
    await wizardEtape5(CLASSE_MAGE, { [COMP_DECRYPTAGE]: "L'Ancien" });
    expect(env((await acheterComp(COMP_CERCLE, 1, "Feu")).data).succes, "cercle niv1").toBe(true);
    expect(env((await acheterComp(COMP_CERCLE, 2, "Feu")).data).succes, "cercle niv2").toBe(true);

    const r = env((await clientVisiteur.avancerEtape({
      p_personnage_id: PERSONNAGE_LOCAL_ID, p_etape_courante: 6,
    })).data);
    expect(r.succes, JSON.stringify(r.erreurs)).toBe(true);
    expect(r.avertissements).toHaveLength(1);
    expect(r.avertissements[0].message).toBe(
      "Cercle Feu (niv 1, 2) : aucun sort acheté dans ce cercle — 15 XP dorment.",
    );
  });
});

// ============================================================
// §5.6 — cas Mélias : sorts dans d'AUTRES cercles, aucun dans le cercle payé
// ============================================================
describe("cas Mélias — §5.6 (rougit sur la version d'avant, C78)", () => {
  it("cercle Feu payé sans sort + cercle Eau payé AVEC un sort → 1 seul avertissement (Feu)", async () => {
    await wizardEtape5(CLASSE_MAGE, { [COMP_DECRYPTAGE]: "L'Ancien" });
    expect(env((await acheterComp(COMP_CERCLE, 1, "Feu")).data).succes, "cercle Feu").toBe(true);
    expect(env((await acheterComp(COMP_CERCLE, 1, "Eau")).data).succes, "cercle Eau").toBe(true);
    expect(env((await acheterSort(SORT_EAU_N1, 1)).data).succes, "sort Eau").toBe(true);

    const r = env((await clientVisiteur.avancerEtape({
      p_personnage_id: PERSONNAGE_LOCAL_ID, p_etape_courante: 6,
    })).data);
    expect(r.succes, JSON.stringify(r.erreurs)).toBe(true);
    expect(r.avertissements).toHaveLength(1);
    expect(r.avertissements[0].code).toBe("info_cercle_sans_sort");
    expect(r.avertissements[0].message).toBe(
      "Cercle Feu (niv 1) : aucun sort acheté dans ce cercle — 5 XP dorment.",
    );
  });
});
