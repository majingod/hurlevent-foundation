/**
 * Tests d'attestation (prompt s378, fenêtre cascade & miroir) — cascade
 * artisanat au désachat d'une compétence, portée FIDÈLE au serveur (D48-bis,
 * migration 20260806073711) dans le client visiteur hors ligne.
 *
 * T1 : désachat d'Alchimie avec des recettes intermédiaires au brouillon →
 *      `items_detail` contient les recettes, elles disparaissent du brouillon,
 *      l'XP est re-créditée.
 * T2 : désachat Pièges 2→1 : le palier 2 PAYANT reste, le palier 2 GRATUIT
 *      hors quota tombe et apparaît dans `items_detail`.
 *
 * Ancres = ids réels du snapshot bundlé (vérifiés en lisant
 * `src/data/snapshotVisiteur.json`).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { clientVisiteur, PERSONNAGE_LOCAL_ID } from "./clientVisiteur";
import { chargerBrouillon } from "./stockageBrouillon";
import { deriverEtat } from "@/moteurCreation/brouillon/deriver";
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
const RACE_HUMAIN = idRace("Humain");
const TRAIT_HUMAIN = "4675941e-481c-410d-a14f-9c2672d219ba"; // Coup du destin

// Alchimie + prérequis (aucun rapport avec la classe : classes_requises null).
const COMP_ALCHIMIE = "3f018622-a2ad-443a-882b-483ef3e2bd23"; // niv1=10, niv2=14
const COMP_HERBES_COMMUNES = "c601901b-2a26-46e0-a42e-2e3077fe99e2"; // prérequis Alchimie niv1
const COMP_HERBES_RARES = "72a3db25-ed40-49c1-96f0-ec9f60f62fa3"; // prérequis Alchimie niv2

// 5 recettes palier 2 (quota gratuit = 4 à Alchimie niveau 2 → la 5e est payante).
const RECETTE_1 = "046e79fe-1a66-4864-a6ca-db495b0d6e37"; // Potion d'endurance guerrière accrue
const RECETTE_2 = "12bf3468-682f-46f0-802b-b16696e4d8d7"; // Fortifiant d'endurance aux toxines
const RECETTE_3 = "34065ea6-e3f8-4ffe-867b-449c833cac0e"; // Catalyseur à potion
const RECETTE_4 = "63ab6b91-2c2f-448c-90fb-6d09efa9ff37"; // Catalyseur à poison
const RECETTE_5 = "68b96918-e00a-46d8-ad80-05e86a6ff618"; // Poison de gangrène (payante, cout 3)

// Création et désarmement de piège (comp) + 3 familles avec palier 1 et 2.
const COMP_PIEGES = "5b82c487-dd4c-48cb-a472-255019bbe835"; // niv1=11, niv2=16
const PIEGE_BRISE_1 = "15700b76-94ef-4c15-ba73-e105e315b6f2"; // Piège brise-doigts niv1 (3)
const PIEGE_BRISE_2 = "d452d66b-45a1-43b8-aa42-4c95111e7e9a"; // Piège brise-doigts niv2 (4)
const PIEGE_HEBETEMENT_1 = "2d2f4f47-223b-49e1-aed5-ab5cd8d8a731"; // Piège d'hébêtement niv1 (2)
const PIEGE_HEBETEMENT_2 = "952214a6-705b-46df-ad7f-ee2fac7e9345"; // Piège d'hébêtement niv2 (4)
const PIEGE_AIGUILLE_1 = "a4164cb7-7c9d-4083-9145-87ba736d56c0"; // Aiguille empoisonnée niv1 (2)
const PIEGE_AIGUILLE_2 = "9e54ff02-069a-4990-a936-309962b377b5"; // Aiguille empoisonnée niv2 (5)

const nul = null as unknown as string;

interface Env {
  succes: boolean;
  erreurs: Array<{ code?: string; message: string }>;
  donnees: Record<string, unknown> | null;
}
const env = (data: unknown) => data as Env;

interface RecetteRow {
  id: string;
  recette_id: string;
}
async function lireRecettes(): Promise<RecetteRow[]> {
  const { data } = await clientVisiteur.lirePersonnageRecettes(PERSONNAGE_LOCAL_ID);
  return data as unknown as RecetteRow[];
}
interface PiegeRow {
  id: string;
  piege_id: string;
  piege_nom: string;
  niveau_acquis: number;
  est_gratuit: boolean;
}
async function lirePieges(): Promise<PiegeRow[]> {
  const { data } = await clientVisiteur.lirePersonnagePieges(PERSONNAGE_LOCAL_ID);
  return data as unknown as PiegeRow[];
}

beforeEach(() => {
  installerLocalStorage();
});

async function wizardEtape5(classeId: string): Promise<void> {
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
    p_choix_par_competence: nul as unknown as Record<string, string>,
  });
}

const acheterComp = (id: string, niveau: number) =>
  clientVisiteur.acheterCompetence({
    p_personnage_id: PERSONNAGE_LOCAL_ID, p_competence_id: id, p_niveau_desire: niveau,
  });
const acheterRecette = (id: string) =>
  clientVisiteur.acheterRecette({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_recette_id: id });
const acheterPiege = (id: string) =>
  clientVisiteur.acheterPiege({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_piege_id: id });

describe("T1 — désachat d'Alchimie emporte les recettes intermédiaires", () => {
  it("recettes du palier fermé → items_detail, disparition du brouillon, XP recréditée", async () => {
    await wizardEtape5(CLASSE_GUERRIER);
    expect(env((await acheterComp(COMP_HERBES_COMMUNES, 1)).data).succes, "communes").toBe(true);
    expect(env((await acheterComp(COMP_HERBES_RARES, 1)).data).succes, "rares").toBe(true);
    expect(env((await acheterComp(COMP_ALCHIMIE, 1)).data).succes, "alchimie1").toBe(true);
    expect(env((await acheterComp(COMP_ALCHIMIE, 2)).data).succes, "alchimie2").toBe(true);
    for (const r of [RECETTE_1, RECETTE_2, RECETTE_3, RECETTE_4, RECETTE_5]) {
      expect(env((await acheterRecette(r)).data).succes, r).toBe(true);
    }
    expect((await lireRecettes()).length).toBe(5);

    const xpAvant = deriverEtat(chargerBrouillon()!).xpDispo;
    const cibleAlchimie1 = (
      await clientVisiteur.lirePersonnageCompetences(PERSONNAGE_LOCAL_ID)
    ).data as unknown as Array<{ id: string; competence_id: string; niveau_acquis: number }>;
    const ligneNiveau1 = cibleAlchimie1.find(
      (c) => c.competence_id === COMP_ALCHIMIE && c.niveau_acquis === 1,
    )!;
    expect(ligneNiveau1).toBeDefined();

    const rep = env(
      (
        await clientVisiteur.desacheterCompetence({
          p_personnage_competence_id: ligneNiveau1.id,
        })
      ).data,
    );
    expect(rep.succes, JSON.stringify(rep.erreurs)).toBe(true);
    const d = rep.donnees!;

    // Les 5 recettes tombent (palier 2 > niveau Alchimie 0 après cascade).
    expect(d.count_recettes).toBe(5);
    const itemsRecettes = (d.items_detail as Array<{ type: string; nom: string }>).filter(
      (i) => i.type === "recette",
    );
    expect(itemsRecettes.length).toBe(5);
    expect(itemsRecettes.map((i) => i.nom).sort()).toEqual(
      [
        "Potion d'endurance guerrière accrue",
        "Fortifiant d'endurance aux toxines",
        "Catalyseur à potion",
        "Catalyseur à poison",
        "Poison de gangrène",
      ].sort(),
    );

    // XP recréditée : compétence Alchimie (10+14) + la recette payante (3) = 27.
    expect(d.xp_rembourse).toBe(27);

    // Disparues du brouillon.
    expect((await lireRecettes()).length).toBe(0);

    // XP disponible recrédité d'autant.
    const xpApres = deriverEtat(chargerBrouillon()!).xpDispo;
    expect(xpApres).toBe(xpAvant + 27);
  });
});

describe("T2 — désachat Pièges 2→1 : payant reste, gratuit hors quota tombe", () => {
  it("palier 2 payant (Aiguille) reste ; paliers 2 gratuits (Brise-doigts, Hébêtement) tombent", async () => {
    await wizardEtape5(CLASSE_GUERRIER);
    expect(env((await acheterComp(COMP_PIEGES, 1)).data).succes, "piege comp niv1").toBe(true);
    expect(env((await acheterComp(COMP_PIEGES, 2)).data).succes, "piege comp niv2").toBe(true);

    // Palier 1 : quota 3 → les 3 sont gratuits.
    for (const p of [PIEGE_BRISE_1, PIEGE_HEBETEMENT_1, PIEGE_AIGUILLE_1]) {
      expect(env((await acheterPiege(p)).data).succes, p).toBe(true);
    }
    // Palier 2 : quota 2 → Brise-doigts et Hébêtement gratuits, Aiguille (3e) payante.
    expect(env((await acheterPiege(PIEGE_BRISE_2)).data).succes, "brise2").toBe(true);
    expect(env((await acheterPiege(PIEGE_HEBETEMENT_2)).data).succes, "hebetement2").toBe(true);
    expect(env((await acheterPiege(PIEGE_AIGUILLE_2)).data).succes, "aiguille2").toBe(true);

    const avant = await lirePieges();
    expect(avant.length).toBe(6);
    const aiguille2Avant = avant.find((p) => p.piege_id === PIEGE_AIGUILLE_2)!;
    expect(aiguille2Avant.est_gratuit, "Aiguille palier 2 doit être payante (3e du quota 2)").toBe(false);
    const brise2Avant = avant.find((p) => p.piege_id === PIEGE_BRISE_2)!;
    expect(brise2Avant.est_gratuit, "Brise-doigts palier 2 doit être gratuit").toBe(true);

    const xpAvant = deriverEtat(chargerBrouillon()!).xpDispo;
    const comps = (await clientVisiteur.lirePersonnageCompetences(PERSONNAGE_LOCAL_ID))
      .data as unknown as Array<{ id: string; competence_id: string; niveau_acquis: number }>;
    const ligneNiveau2 = comps.find(
      (c) => c.competence_id === COMP_PIEGES && c.niveau_acquis === 2,
    )!;
    expect(ligneNiveau2).toBeDefined();

    const rep = env(
      (
        await clientVisiteur.desacheterCompetence({
          p_personnage_competence_id: ligneNiveau2.id,
        })
      ).data,
    );
    expect(rep.succes, JSON.stringify(rep.erreurs)).toBe(true);
    const d = rep.donnees!;

    // 2 pièges tombent : les GRATUITS de palier 2 hors du nouveau quota (0).
    expect(d.count_pieges).toBe(2);
    const itemsPieges = (d.items_detail as Array<{ type: string; nom: string }>).filter(
      (i) => i.type === "piege",
    );
    expect(itemsPieges.map((i) => i.nom)).toEqual([
      "Piège brise-doigts (palier 2)",
      "Piège d'hébêtement (palier 2)",
    ]);

    // Le payant (Aiguille palier 2) reste ; les 3 paliers 1 restent aussi.
    const apres = await lirePieges();
    expect(apres.length).toBe(4);
    expect(apres.some((p) => p.piege_id === PIEGE_AIGUILLE_2)).toBe(true);
    expect(apres.some((p) => p.piege_id === PIEGE_BRISE_2)).toBe(false);
    expect(apres.some((p) => p.piege_id === PIEGE_HEBETEMENT_2)).toBe(false);
    expect(apres.filter((p) => p.niveau_acquis === 1).length).toBe(3);

    // XP recréditée : compétence Pièges niv2 (16) seulement, les 2 tombés étaient gratuits.
    expect(d.xp_rembourse).toBe(16);
    const xpApres = deriverEtat(chargerBrouillon()!).xpDispo;
    expect(xpApres).toBe(xpAvant + 16);
  });
});
