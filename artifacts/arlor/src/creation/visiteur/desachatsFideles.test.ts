/**
 * Désachats FIDÈLES au serveur (lot fix-visiteur-lot-desachats) — TOP 3 de
 * `docs/PARITE_VISITEUR_AUDIT_s311.md`.
 *
 * Lot A (TOP 3b) — `desacheter_competence` ne purge les sorts/prières QUE sur
 *   chute d'« Acquisition de Sort/Prière » (bool_or serveur). AUCUNE purge
 *   inventée par cercle/domaine « fermé » : un sort orphelin d'un cercle
 *   redescendu SURVIT au désachat, et c'est `validerEtape(6)` qui le refuse.
 * Lot B (TOP 3a) — `desacheter_piege` : cascade ASCENDANTE (palier ciblé + tous
 *   les paliers ≥ N de la même famille), remboursement = somme, `donnees` fidèle.
 * Lot C (TOP 3c) — identité d'instance : les désachats retirent UNE ligne
 *   (`instanceId`), jamais toutes les copies du catalogue.
 *
 * Ancres = ids réels du snapshot bundlé (vérifiés s311).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { clientVisiteur, PERSONNAGE_LOCAL_ID } from "./clientVisiteur";
import {
  CLE_BROUILLON,
  chargerBrouillon,
  sauverBrouillon,
} from "./stockageBrouillon";
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
const CLASSE_MAGE = idClasse("Mage");
const RACE_HUMAIN = idRace("Humain");
const TRAIT_HUMAIN = "4675941e-481c-410d-a14f-9c2672d219ba"; // Coup du destin

// Compétences / magie / artisanat (ids réels s311).
const COMP_CERCLE = "9fc3a181-4e29-4d94-8639-65b9a9a7c787"; // Acquisition de Cercle (multiple_avec_choix_par_niveau)
const COMP_SORT = "d9a446cc-abdd-40d1-be68-42240b7c9bae"; // Acquisition de Sort (desachat_force, coût 0)
const COMP_DECRYPTAGE = "0b0fba09-77d5-4078-946f-9add150f695d"; // gratuité Mage (choix langue_ancienne)
const COMP_DEV_SPI = "0db39587-68ad-4025-afe4-bbcbff67ad8a"; // Développement Spirituel (multiple_sans_choix, niv1 = 2 XP)
const COMP_PIEGE = "5b82c487-dd4c-48cb-a472-255019bbe835"; // Création et désarmement de piège

const SORT_FEU_N1 = "018f508e-fe3f-414a-9a95-3248692c5d3b"; // Bouclier de Feu (cercle Feu, niveau 1)
const SORT_FEU_N6 = "22eb225f-d6d7-4392-9606-20679f26d15d"; // Réchauffement du Métal (cercle Feu, niveau 6)

// Famille de pièges « Piège brise-doigts » : paliers 1/2/3.
const PIEGE_N1 = "15700b76-94ef-4c15-ba73-e105e315b6f2"; // niv 1, cout 3
const PIEGE_N2 = "d452d66b-45a1-43b8-aa42-4c95111e7e9a"; // niv 2, cout 4
const PIEGE_N3 = "0103730b-4829-41e9-b3cb-8f0e3e1c653f"; // niv 3, cout 7

const ZONE = "Personnelle";
const PORTEE = "Toucher";
const DUREE = "Instantanée";
const nul = null as unknown as string;

interface Env {
  succes: boolean;
  erreurs: Array<{ code?: string; message: string }>;
  avertissements: Array<{ code?: string; message: string }>;
  donnees: Record<string, unknown> | null;
}
const env = (data: unknown) => data as Env;

interface CompRow {
  id: string;
  competence_id: string;
  niveau_acquis: number;
  choix_achat: string | null;
  xp_depense: number;
}
async function lireComps(): Promise<CompRow[]> {
  const { data } = await clientVisiteur.lirePersonnageCompetences(PERSONNAGE_LOCAL_ID);
  return data as unknown as CompRow[];
}
interface SortRow {
  id: string;
  sort_id: string;
  niveau_sort: number;
}
async function lireSorts(): Promise<SortRow[]> {
  const { data } = await clientVisiteur.lirePersonnageSorts(PERSONNAGE_LOCAL_ID);
  return data as unknown as SortRow[];
}
interface PiegeRow {
  id: string;
  piege_id: string;
  piege_nom: string;
  niveau_acquis: number;
}
async function lirePieges(): Promise<PiegeRow[]> {
  const { data } = await clientVisiteur.lirePersonnagePieges(PERSONNAGE_LOCAL_ID);
  return data as unknown as PiegeRow[];
}

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
const acheterPiege = (piegeId: string) =>
  clientVisiteur.acheterPiege({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_piege_id: piegeId });

// ============================================================
// Lot A — pas de purge cercle/domaine inventée (TOP 3b)
// ============================================================
describe("Lot A — purge sorts/prières fidèle (bool_or « Acquisition de Sort »)", () => {
  it("désacheter Acquisition de Cercle niv 2 → le sort du cercle 2 SURVIT, validerEtape(6) refuse", async () => {
    await wizardEtape5(CLASSE_MAGE, { [COMP_DECRYPTAGE]: "L'Ancien" });
    // Cercle « Feu » débloqué jusqu'au niveau 2 (max sort 10).
    expect(env((await acheterComp(COMP_CERCLE, 1, "Feu")).data).succes, "cercle niv1").toBe(true);
    expect(env((await acheterComp(COMP_CERCLE, 2, "Feu")).data).succes, "cercle niv2").toBe(true);
    // Sort de niveau 6 (exige le cercle niveau 2).
    expect(env((await acheterSort(SORT_FEU_N6, 6)).data).succes, "sort niv6").toBe(true);

    // Désacheter le NIVEAU 2 de l'Acquisition de Cercle (niveau 1 survit → max 5).
    const cercleN2 = (await lireComps()).find(
      (c) => c.competence_id === COMP_CERCLE && c.niveau_acquis === 2,
    )!;
    expect(cercleN2).toBeDefined();
    const rep = env((await clientVisiteur.desacheterCompetence({ p_personnage_competence_id: cercleN2.id })).data);
    expect(rep.succes, JSON.stringify(rep.erreurs)).toBe(true);

    // Le sort orphelin SURVIT (aucune purge par cercle fermé).
    const sorts = await lireSorts();
    expect(sorts.some((s) => s.sort_id === SORT_FEU_N6)).toBe(true);
    // Le niveau 1 de l'Acquisition de Cercle survit ; le niveau 2 est parti.
    const comps = await lireComps();
    expect(comps.some((c) => c.competence_id === COMP_CERCLE && c.niveau_acquis === 1)).toBe(true);
    expect(comps.some((c) => c.competence_id === COMP_CERCLE && c.niveau_acquis === 2)).toBe(false);

    // C'est validerEtape(6) qui attrape le sort désormais hors plage (max 5).
    const val = env((await clientVisiteur.avancerEtape({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_etape_courante: 6 })).data);
    expect(val.succes).toBe(false);
    expect(val.erreurs[0].message).toBe(
      "Le sort Réchauffement du Métal (niveau 6) dépasse le max 5 du cercle Feu",
    );
  });

  it("contre-test : désacheter « Acquisition de Sort » → TOUS les sorts tombent (purge totale)", async () => {
    await wizardEtape5(CLASSE_MAGE, { [COMP_DECRYPTAGE]: "L'Ancien" });
    expect(env((await acheterComp(COMP_CERCLE, 1, "Feu")).data).succes).toBe(true);
    // D54 (s382) : acheter le Cercle pose déjà « Acquisition de Sort »
    // d'office (tg_poser_porte_magique) — la racheter à la main échouerait
    // (déjà possédée) et n'est plus le geste joueur (B.1).
    expect((await lireComps()).some((c) => c.competence_id === COMP_SORT)).toBe(true);
    expect(env((await acheterSort(SORT_FEU_N1, 1)).data).succes).toBe(true);
    expect((await lireSorts()).length).toBe(1);

    // « Acquisition de Sort » a desachat_force → désachetable ; sa chute purge TOUT.
    const sortComp = (await lireComps()).find((c) => c.competence_id === COMP_SORT)!;
    const rep = env((await clientVisiteur.desacheterCompetence({ p_personnage_competence_id: sortComp.id })).data);
    expect(rep.succes, JSON.stringify(rep.erreurs)).toBe(true);
    expect(rep.donnees!.count_sorts).toBe(1);
    expect((await lireSorts()).length).toBe(0); // purge totale
  });
});

// ============================================================
// Lot B — cascade ascendante desacheter_piege (TOP 3a)
// ============================================================
describe("Lot B — desacheter_piege cascade ascendante", () => {
  it("famille paliers 1+2+3 → désachat du palier 2 emporte 2 et 3, palier 1 survit seul", async () => {
    await wizardEtape5(CLASSE_GUERRIER);
    // Création et désarmement de piège niveau 1 (quota niv2/niv3 = 0 → paliers payants).
    expect(env((await acheterComp(COMP_PIEGE, 1)).data).succes, "comp piege").toBe(true);
    expect(env((await acheterPiege(PIEGE_N1)).data).succes, "palier1").toBe(true);
    expect(env((await acheterPiege(PIEGE_N2)).data).succes, "palier2").toBe(true);
    expect(env((await acheterPiege(PIEGE_N3)).data).succes, "palier3").toBe(true);
    expect((await lirePieges()).length).toBe(3);

    const xpAvant = deriverEtat(chargerBrouillon()!).xpDepense;
    const cibleN2 = (await lirePieges()).find((p) => p.niveau_acquis === 2)!;
    expect(cibleN2).toBeDefined();

    const rep = env((await clientVisiteur.desacheterPiege({ p_personnage_piege_id: cibleN2.id })).data);
    expect(rep.succes, JSON.stringify(rep.erreurs)).toBe(true);
    const d = rep.donnees!;
    // Cascade : paliers 2 ET 3 supprimés (niveau ≥ 2), annoncés en DESC.
    expect(d.nb_paliers_supprimes).toBe(2);
    expect((d.lignes_supprimees as Array<{ niveau_acquis: number }>).map((l) => l.niveau_acquis)).toEqual([3, 2]);
    expect(d.piege_nom).toBe("Piège brise-doigts");

    // XP exact : remboursement = delta de dérivation (paliers 2+3 payants = 4+7).
    const xpApres = deriverEtat(chargerBrouillon()!).xpDepense;
    expect(d.xp_rembourse).toBe(xpAvant - xpApres);
    expect(d.xp_rembourse).toBe(11); // cout(palier2)=4 + cout(palier3)=7

    // Palier 1 survit SEUL.
    const restants = await lirePieges();
    expect(restants.length).toBe(1);
    expect(restants[0].niveau_acquis).toBe(1);
  });
});

// ============================================================
// Lot C — identité d'instance (TOP 3c)
// ============================================================
describe("Lot C — identité d'instance", () => {
  it("2 copies d'une compétence multiple_sans_choix → désacheter 1 → 1 survit, XP unitaire", async () => {
    await wizardEtape5(CLASSE_GUERRIER);
    expect(env((await acheterComp(COMP_DEV_SPI, 1)).data).succes, "copie 1").toBe(true);
    expect(env((await acheterComp(COMP_DEV_SPI, 1)).data).succes, "copie 2").toBe(true);

    const copies = (await lireComps()).filter((c) => c.competence_id === COMP_DEV_SPI);
    expect(copies.length).toBe(2);
    expect(copies[0].id).not.toBe(copies[1].id); // instanceIds distincts

    const xpAvant = deriverEtat(chargerBrouillon()!).xpDepense;
    const rep = env((await clientVisiteur.desacheterCompetence({ p_personnage_competence_id: copies[0].id })).data);
    expect(rep.succes, JSON.stringify(rep.erreurs)).toBe(true);

    // UNE copie survit (pas les deux effacées d'un coup).
    const restantes = (await lireComps()).filter((c) => c.competence_id === COMP_DEV_SPI);
    expect(restantes.length).toBe(1);
    expect(restantes[0].id).toBe(copies[1].id);

    // Remboursement = coût UNITAIRE (2 XP), cohérent avec la re-dérivation.
    const xpApres = deriverEtat(chargerBrouillon()!).xpDepense;
    expect(rep.donnees!.xp_rembourse).toBe(2);
    expect(rep.donnees!.xp_rembourse).toBe(xpAvant - xpApres);
    expect(rep.donnees!.count_competences).toBe(1);
  });

  it("2 sorts identiques (même sortId) → désacheter 1 → 1 survit", async () => {
    await wizardEtape5(CLASSE_MAGE, { [COMP_DECRYPTAGE]: "L'Ancien" });
    expect(env((await acheterComp(COMP_CERCLE, 1, "Feu")).data).succes).toBe(true);
    expect(env((await acheterSort(SORT_FEU_N1, 1)).data).succes, "sort 1").toBe(true);
    expect(env((await acheterSort(SORT_FEU_N1, 1)).data).succes, "sort 2").toBe(true);

    const sorts = await lireSorts();
    expect(sorts.filter((s) => s.sort_id === SORT_FEU_N1).length).toBe(2);
    expect(sorts[0].id).not.toBe(sorts[1].id); // instanceIds distincts

    const rep = env((await clientVisiteur.desacheterSort({ p_personnage_sort_id: sorts[0].id })).data);
    expect(rep.succes).toBe(true);
    const restants = await lireSorts();
    expect(restants.filter((s) => s.sort_id === SORT_FEU_N1).length).toBe(1);
    expect(restants[0].id).toBe(sorts[1].id);
  });

  it("round-trip : acheter → lire (id=instanceId) → désacheter par cet id → parti", async () => {
    await wizardEtape5(CLASSE_GUERRIER);
    expect(env((await acheterComp(COMP_DEV_SPI, 1)).data).succes).toBe(true);
    const row = (await lireComps()).find((c) => c.competence_id === COMP_DEV_SPI)!;
    // L'id exposé EST l'instanceId stocké dans le brouillon.
    expect(row.id).toBe(chargerBrouillon()!.acquisitions.competences[0].instanceId);
    expect(env((await clientVisiteur.desacheterCompetence({ p_personnage_competence_id: row.id })).data).succes).toBe(true);
    expect((await lireComps()).some((c) => c.competence_id === COMP_DEV_SPI)).toBe(false);
  });

  it("migration v1→v2 : un brouillon SANS instanceId ne perd rien + dérivation identique", async () => {
    // Fixture de l'ANCIENNE forme (schemaVersion 1, aucune acquisition n'a d'instanceId).
    const brouillonV1 = {
      schemaVersion: 1,
      meta: {
        creeLe: "2026-07-01T10:00:00.000Z",
        modifieLe: "2026-07-01T10:00:00.000Z",
        snapshotGenereLe: snap.manifest.genere_le,
        etapeCourante: 5,
      },
      etape1: {
        nom: "Ancien", gnCompletes: 0, miniGnCompletes: 0, ouverturesTerrain: 0,
        estCroyant: false, religionId: null,
      },
      etape2: { raceId: RACE_HUMAIN },
      etape3: { traitsRaciauxChoisis: [{ trait_id: TRAIT_HUMAIN, est_gratuit: true, xp_depense: 0 }] },
      etape4: { classeId: CLASSE_GUERRIER },
      acquisitions: {
        competences: [
          { competenceId: COMP_DEV_SPI, niveauAcquis: 1, choixAchat: null },
          { competenceId: COMP_DEV_SPI, niveauAcquis: 1, choixAchat: null },
        ],
        sorts: [],
        prieres: [],
        pieges: [],
        recettes: [],
        assemblages: [],
      },
    };
    localStorage.setItem(CLE_BROUILLON, JSON.stringify(brouillonV1));

    const migre = chargerBrouillon();
    expect(migre).not.toBeNull();
    expect(migre!.schemaVersion).toBe(2);
    // Rien perdu : les 2 acquisitions sont là, dans l'ordre.
    expect(migre!.acquisitions.competences.length).toBe(2);
    expect(migre!.acquisitions.competences.map((c) => c.competenceId)).toEqual([COMP_DEV_SPI, COMP_DEV_SPI]);
    // Chaque acquisition a reçu un instanceId UNIQUE.
    const ids = migre!.acquisitions.competences.map((c) => c.instanceId);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(2);

    // Dérivation identique avant/après migration (l'identité n'est pas un champ dérivé).
    const deriveMigre = deriverEtat(migre!);
    const brouillonV2Equivalent = {
      ...migre!,
      acquisitions: {
        ...migre!.acquisitions,
        competences: migre!.acquisitions.competences.map((c) => ({ ...c, instanceId: "autre-id" })),
      },
    };
    expect(deriverEtat(brouillonV2Equivalent)).toEqual(deriveMigre);
  });
});
