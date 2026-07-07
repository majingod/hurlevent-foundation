/**
 * Régressions du premier test joueur (s311) — 3 bugs visiteur.
 *
 * BUG A : un achat à 0 XP (« Acquisition de Sort », coût 0 par design) était
 *   jeté à CHAQUE dérivation par la purge des gratuités (`xpDepense > 0`). Fix :
 *   la provenance (`estGratuiteClasse`) pilote la purge, jamais le coût.
 * BUG B : `desacheterCompetence` retirait UNE ligne exacte sans cascade. Fix :
 *   portage fidèle de `desacheter_competence` (A6) — refus gratuité, cascade
 *   niveaux, boucle prérequis, purge sorts/prières, dry_run fidèle.
 * BUG C : après finalisation visiteur, le brouillon reste sauvegardé (étape 11)
 *   et N'EST PAS supprimé — support de la non-navigation (panneau de succès).
 *
 * Ancres réelles résolues depuis le snapshot bundlé (ids vérifiés s311).
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

const TRAIT_HUMAIN = "4675941e-481c-410d-a14f-9c2672d219ba"; // Coup du destin (10 XP, gratuit si seul choisi)
const TRAIT_HUMAIN2 = "fad7ba5d-df90-4f24-88b4-987eb9a4891f"; // Fortuné (10 XP)

// Ancres compétences (ids réels s311).
const COMP_CERCLE = "9fc3a181-4e29-4d94-8639-65b9a9a7c787"; // Acquisition de Cercle (choix « Feu »)
const COMP_SORT = "d9a446cc-abdd-40d1-be68-42240b7c9bae"; // Acquisition de Sort (coût 0)
const COMP_DECRYPTAGE = "0b0fba09-77d5-4078-946f-9add150f695d"; // gratuité Mage (langue_ancienne)
const COMP_LINGUISTIQUE = "c9d9a7b0-145e-48f6-b6fb-0d6811480221"; // gratuité Mage (prereq Cercle)
const COMP_BOTTE = "04cadb85-598c-4dbf-b982-3b5f9d5736f2"; // Botte Secrète (simple : niv1 9, niv2 12)
const COMP_PIEGE = "5b82c487-dd4c-48cb-a472-255019bbe835"; // Création et désarmement de piège
const COMP_PIEGE_SECURISE = "1427677e-98fd-4ba5-86ca-3145fc4aa178"; // prereq : Piège niv1

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
}
async function lireComps(): Promise<CompRow[]> {
  const { data } = await clientVisiteur.lirePersonnageCompetences(PERSONNAGE_LOCAL_ID);
  return data as unknown as CompRow[];
}

beforeEach(() => {
  installerLocalStorage();
});

async function wizardJusquEtape5(
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

// ============================================================
// BUG A — l'achat à 0 XP survit à la dérivation
// ============================================================
describe("BUG A — achat « Acquisition de Sort » (0 XP) préservé", () => {
  it("wizard Mage → Cercle(Feu) puis Sort → les 2 présents, Sort niveau ≥ 1", async () => {
    await wizardJusquEtape5(CLASSE_MAGE, { [COMP_DECRYPTAGE]: "L'Ancien" });

    // Acquisition de Cercle (choix « Feu ») : prereq « Linguistique » = gratuité Mage.
    const achatCercle = env(
      (await clientVisiteur.acheterCompetence({
        p_personnage_id: PERSONNAGE_LOCAL_ID, p_competence_id: COMP_CERCLE,
        p_niveau_desire: 1, p_choix_achat: "Feu",
      })).data,
    );
    expect(achatCercle.succes, JSON.stringify(achatCercle.erreurs)).toBe(true);

    // Acquisition de Sort (coût 0) : prereq « Acquisition de Cercle » niveau 1.
    const achatSort = env(
      (await clientVisiteur.acheterCompetence({
        p_personnage_id: PERSONNAGE_LOCAL_ID, p_competence_id: COMP_SORT, p_niveau_desire: 1,
      })).data,
    );
    expect(achatSort.succes, JSON.stringify(achatSort.erreurs)).toBe(true);

    // Les DEUX achats survivent à la re-dérivation (BUG A : le Sort disparaissait).
    const comps = await lireComps();
    expect(comps.some((c) => c.competence_id === COMP_CERCLE)).toBe(true);
    expect(comps.some((c) => c.competence_id === COMP_SORT)).toBe(true);

    // Étape 6 (sorts) débloquée : niveau de la compétence lisible et ≥ 1.
    const niv = (await clientVisiteur.lireNiveauCompetenceParNom(
      PERSONNAGE_LOCAL_ID, "Acquisition de Sort",
    )).data as unknown as Array<{ niveau_acquis: number }>;
    expect(niv.length).toBe(1);
    expect(niv[0].niveau_acquis).toBeGreaterThanOrEqual(1);
  });

  it("changement de classe → gratuités de l'ANCIENNE classe purgées (non-régression)", async () => {
    await wizardJusquEtape5(CLASSE_MAGE, { [COMP_DECRYPTAGE]: "L'Ancien" });
    // Les gratuités Mage (Linguistique + Décryptage) sont dérivées.
    let comps = await lireComps();
    expect(comps.some((c) => c.competence_id === COMP_LINGUISTIQUE)).toBe(true);
    expect(comps.some((c) => c.competence_id === COMP_DECRYPTAGE)).toBe(true);

    // Bascule vers Guerrier : les gratuités Mage disparaissent (recompute par provenance).
    await clientVisiteur.changerClassePersonnage({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_classe_id: CLASSE_GUERRIER });
    comps = await lireComps();
    expect(comps.some((c) => c.competence_id === COMP_LINGUISTIQUE)).toBe(false);
    expect(comps.some((c) => c.competence_id === COMP_DECRYPTAGE)).toBe(false);
  });
});

// ============================================================
// BUG B — désachat serveur-fidèle (cascade + dry_run)
// ============================================================
describe("BUG B — cascade de désachat fidèle au serveur", () => {
  it("Botte Secrète niv1+niv2 → dry_run niv1 = cascade 2 lignes ; désachat réel = 0 restante", async () => {
    await wizardJusquEtape5(CLASSE_GUERRIER);
    expect(env((await clientVisiteur.acheterCompetence({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_competence_id: COMP_BOTTE, p_niveau_desire: 1 })).data).succes).toBe(true);
    expect(env((await clientVisiteur.acheterCompetence({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_competence_id: COMP_BOTTE, p_niveau_desire: 2 })).data).succes).toBe(true);

    const cibleNiv1 = (await lireComps()).find((c) => c.competence_id === COMP_BOTTE && c.niveau_acquis === 1)!;
    expect(cibleNiv1).toBeDefined();

    // dry_run : la cascade « simple » emporte niv1 ET niv2 (niveau_acquis >= cible).
    const apercu = env(
      (await clientVisiteur.desacheterCompetence({ p_personnage_competence_id: cibleNiv1.id, p_dry_run: true })).data,
    );
    expect(apercu.succes).toBe(true);
    const d = apercu.donnees!;
    expect(d.competence_cible).toBe("Botte Secrète");
    expect(d.count_competences).toBe(2);
    expect(d.count_competences_distinctes).toBe(1);
    expect((d.items_detail as unknown[]).length).toBeGreaterThan(0);
    const item = (d.items_detail as Array<{ nom: string; quantite: number; niveaux: number[]; xp_total: number }>)[0];
    expect(item.quantite).toBe(2);
    expect(item.niveaux).toEqual([1, 2]);
    expect(item.xp_total).toBe(21); // 9 + 12

    // dry_run ne modifie rien : les 2 lignes sont toujours là.
    expect((await lireComps()).filter((c) => c.competence_id === COMP_BOTTE).length).toBe(2);

    // Désachat RÉEL : 0 ligne Botte restante.
    const reel = env((await clientVisiteur.desacheterCompetence({ p_personnage_competence_id: cibleNiv1.id })).data);
    expect(reel.succes).toBe(true);
    expect((await lireComps()).filter((c) => c.competence_id === COMP_BOTTE).length).toBe(0);
  });

  it("boucle prérequis : désachat Piège niv1 emporte Piège sécurisé (dépendant)", async () => {
    await wizardJusquEtape5(CLASSE_GUERRIER);
    expect(env((await clientVisiteur.acheterCompetence({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_competence_id: COMP_PIEGE, p_niveau_desire: 1 })).data).succes).toBe(true);
    expect(env((await clientVisiteur.acheterCompetence({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_competence_id: COMP_PIEGE_SECURISE, p_niveau_desire: 1 })).data).succes).toBe(true);

    const ciblePiege = (await lireComps()).find((c) => c.competence_id === COMP_PIEGE && c.niveau_acquis === 1)!;

    // dry_run : la boucle prérequis fait tomber « Piège sécurisé » (2 compétences distinctes).
    const apercu = env((await clientVisiteur.desacheterCompetence({ p_personnage_competence_id: ciblePiege.id, p_dry_run: true })).data);
    expect(apercu.donnees!.count_competences).toBe(2);
    expect(apercu.donnees!.count_competences_distinctes).toBe(2);
    expect(apercu.donnees!.cascade).toBe(true);

    // Désachat réel : ni Piège ni Piège sécurisé ne subsistent.
    expect(env((await clientVisiteur.desacheterCompetence({ p_personnage_competence_id: ciblePiege.id })).data).succes).toBe(true);
    const comps = await lireComps();
    expect(comps.some((c) => c.competence_id === COMP_PIEGE)).toBe(false);
    expect(comps.some((c) => c.competence_id === COMP_PIEGE_SECURISE)).toBe(false);
  });

  it("refus gratuité de classe : désachat d'une gratuité → message VERBATIM serveur", async () => {
    // Mage : « Linguistique et Mathématique » est une gratuité de classe (coût 0, non desachat_force).
    await wizardJusquEtape5(CLASSE_MAGE, { [COMP_DECRYPTAGE]: "L'Ancien" });
    const grat = (await lireComps()).find((c) => c.competence_id === COMP_LINGUISTIQUE)!;
    expect(grat).toBeDefined();
    const r = env((await clientVisiteur.desacheterCompetence({ p_personnage_competence_id: grat.id })).data);
    expect(r.succes).toBe(false);
    expect(r.erreurs[0].code).toBe("competence_gratuite");
    expect(r.erreurs[0].message).toBe(
      "Une compétence acquise gratuitement (de classe) ne peut pas être désachetée",
    );
  });

  it("achat à 0 XP désachetable (desachat_force) : « Acquisition de Sort » n'est PAS refusé", async () => {
    await wizardJusquEtape5(CLASSE_MAGE, { [COMP_DECRYPTAGE]: "L'Ancien" });
    await clientVisiteur.acheterCompetence({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_competence_id: COMP_CERCLE, p_niveau_desire: 1, p_choix_achat: "Feu" });
    await clientVisiteur.acheterCompetence({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_competence_id: COMP_SORT, p_niveau_desire: 1 });
    const cible = (await lireComps()).find((c) => c.competence_id === COMP_SORT)!;
    const r = env((await clientVisiteur.desacheterCompetence({ p_personnage_competence_id: cible.id })).data);
    expect(r.succes, JSON.stringify(r.erreurs)).toBe(true);
    expect((await lireComps()).some((c) => c.competence_id === COMP_SORT)).toBe(false);
  });
});

// ============================================================
// BUG C — finalisation visiteur : brouillon conservé (support non-navigation)
// ============================================================
describe("BUG C — état post-finalisation du brouillon visiteur", () => {
  it("validerPersonnageFinal → brouillon conservé en étape 11 (non supprimé)", async () => {
    await wizardJusquEtape5(CLASSE_GUERRIER);
    const fin = env((await clientVisiteur.validerPersonnageFinal({ p_personnage_id: PERSONNAGE_LOCAL_ID })).data);
    expect((fin as unknown as { valide: boolean }).valide).toBe(true);

    // Le brouillon reste sauvegardé sur l'appareil, marqué finalisé (étape 11).
    const brouillon = chargerBrouillon();
    expect(brouillon).not.toBeNull();
    expect(brouillon!.meta.etapeCourante).toBe(11);

    // Rouvrir la lecture ne casse rien (support de l'affichage du panneau/récap).
    const { data } = await clientVisiteur.lirePersonnage(PERSONNAGE_LOCAL_ID);
    expect((data as unknown as { etape_creation: number }).etape_creation).toBe(11);
  });
});

// ============================================================
// VIS-3 — coût des traits raciaux absent de la dérivation XP
//
// `deriver.ts` ne sommait jamais le coût des traits raciaux choisis dans
// `autresDepensesXp` → un joueur prenant un trait payant voyait « 0 dépensés »
// dès l'étape suivante. Règle serveur (sauvegarder_etape_3, migration
// 20260617043319) : les N premiers traits CHOISIS DANS L'ORDRE (N =
// races.nb_traits_raciaux) sont gratuits, les suivants coûtent
// traits_raciaux.cout_xp — peu importe LEQUEL des traits est en 2e position.
// ============================================================
describe("VIS-3 — coût des traits raciaux dans la dérivation XP", () => {
  // Humain : nb_traits_raciaux = 1. TRAIT_HUMAIN (Coup du destin) et
  // TRAIT_HUMAIN2 (Fortuné) coûtent chacun 10 XP.
  async function wizardEtape3Traits(
    traits: Array<{ trait_id: string; est_gratuit: boolean; xp_depense: number }>,
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
      p_traits_raciaux_choisis: traits,
    });
  }

  async function xpDepense(): Promise<number> {
    const { data } = await clientVisiteur.lirePersonnage(PERSONNAGE_LOCAL_ID);
    return (data as unknown as { xp_depense: number }).xp_depense;
  }

  it("1 seul trait choisi (quota Humain = 1) → gratuit, xpDepense inchangé", async () => {
    await wizardEtape3Traits([{ trait_id: TRAIT_HUMAIN, est_gratuit: true, xp_depense: 0 }]);
    expect(await xpDepense()).toBe(0);
  });

  it("2 traits choisis → le 2e de la liste coûte +10 (BUG VIS-3 : restait à 0)", async () => {
    await wizardEtape3Traits([
      { trait_id: TRAIT_HUMAIN, est_gratuit: true, xp_depense: 0 },
      { trait_id: TRAIT_HUMAIN2, est_gratuit: false, xp_depense: 10 },
    ]);
    expect(await xpDepense()).toBe(10);
  });

  it("ordre inverse [TRAIT_HUMAIN2, TRAIT_HUMAIN] → toujours +10 (le 2e paie, peu importe lequel)", async () => {
    await wizardEtape3Traits([
      { trait_id: TRAIT_HUMAIN2, est_gratuit: true, xp_depense: 0 },
      { trait_id: TRAIT_HUMAIN, est_gratuit: false, xp_depense: 10 },
    ]);
    expect(await xpDepense()).toBe(10);
  });

  it("le +10 persiste à travers sauvegarderEtape4 + achat de compétence", async () => {
    await wizardEtape3Traits([
      { trait_id: TRAIT_HUMAIN, est_gratuit: true, xp_depense: 0 },
      { trait_id: TRAIT_HUMAIN2, est_gratuit: false, xp_depense: 10 },
    ]);
    await clientVisiteur.sauvegarderEtape4({
      p_personnage_id: PERSONNAGE_LOCAL_ID, p_classe_id: CLASSE_GUERRIER,
      p_choix_par_competence: null as unknown as Record<string, string>,
    });
    const avantAchat = await xpDepense();
    expect(avantAchat).toBe(10);

    const achat = env((await clientVisiteur.acheterCompetence({
      p_personnage_id: PERSONNAGE_LOCAL_ID, p_competence_id: COMP_BOTTE, p_niveau_desire: 1,
    })).data);
    expect(achat.succes, JSON.stringify(achat.erreurs)).toBe(true);

    // Botte Secrète niv1 = 9 XP (cf. BUG B ci-dessus) : le compteur global
    // reste cohérent d'étape en étape (10 traits + 9 compétence = 19).
    expect(await xpDepense()).toBe(19);
  });

  it("rechargement localStorage (re-parse du brouillon persisté) → xpDepense identique", async () => {
    await wizardEtape3Traits([
      { trait_id: TRAIT_HUMAIN, est_gratuit: true, xp_depense: 0 },
      { trait_id: TRAIT_HUMAIN2, est_gratuit: false, xp_depense: 10 },
    ]);
    const avant = await xpDepense();
    expect(avant).toBe(10);

    // `chargerBrouillon` re-parse le JSON stocké à chaque appel (aucun cache
    // mémoire) : relire le personnage rejoue fidèlement un rechargement.
    expect(await xpDepense()).toBe(avant);
  });
});
