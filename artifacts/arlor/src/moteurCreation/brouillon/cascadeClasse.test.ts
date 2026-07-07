/**
 * Cascade de changement de classe — fidélité serveur `changer_classe_personnage`
 * (migration 20260606052624) + délégation `sauvegarder_etape_4` (20260617153934).
 *
 * Toutes les ancres sont des ids RÉELS du snapshot bundlé (scanné s311/s312) :
 *   - Cachette secrète .......... voleur, classes_requises ["voleur"] (class-locked)
 *   - Botte Secrète ............. guerrier, classes_requises null, niv 1/2/3 (over-cap, D2)
 *   - Grande Messe .............. pretre, prérequis Connaissances des Religions (cascade)
 *   - Acquisition de Cercle/Sort  mage, chaîne prérequis → dormance sorts (D3)
 *   - Bénédiction ............... gratuité Prêtre single (D6 refund)
 *   - Décryptage ................ gratuité Mage multiple_choix_distinct (D6 multi_choix)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getSnapshot } from "../snapshot";
import { creerBrouillonVide } from "./types";
import type { BrouillonVisiteur, BrouillonCompetence, BrouillonSort } from "./types";
import { deriverEtat } from "./deriver";
import { calculerCascadeChangementClasse } from "./cascadeClasse";
import { calculerCoutXP } from "@/utils/calculsMagie";
import { clientVisiteur, PERSONNAGE_LOCAL_ID } from "@/creation/visiteur/clientVisiteur";
import { sauverBrouillon, chargerBrouillon } from "@/creation/visiteur/stockageBrouillon";

const snap = getSnapshot();
const idClasse = (nom: string) => snap.tables.classes.find((c) => c.id && c.nom === nom)!.id;

// ── Classes ────────────────────────────────────────────────────────────────
const GUERRIER = idClasse("Guerrier");
const VOLEUR = idClasse("Voleur");
const MAGE = idClasse("Mage");
const PRETRE = idClasse("Prêtre");

// ── Compétences (ids réels) ──────────────────────────────────────────────────
const CACHETTE = "083212ef-02b7-46d3-86b5-fb0e2aa885af"; // voleur, req ["voleur"], niv1 10
const BOTTE = "04cadb85-598c-4dbf-b982-3b5f9d5736f2"; // guerrier, req null, niv 1:9 2:12 3:12
const GRANDE_MESSE = "212f9ea9-2a25-4943-a114-384e8801b275"; // pretre, prereq Connaissances des Religions
const ACQ_CERCLE = "9fc3a181-4e29-4d94-8639-65b9a9a7c787"; // mage, prereq Linguistique
const ACQ_SORT = "d9a446cc-abdd-40d1-be68-42240b7c9bae"; // mage, prereq Acquisition de Cercle
const BENEDICTION = "b5a7460c-1259-40ca-83cd-098d00d9946d"; // gratuité Prêtre single, niv1 4
const DECRYPTAGE = "0b0fba09-77d5-4078-946f-9add150f695d"; // gratuité Mage multiple_choix_distinct, niv1 9

const SORT_TERRE = "0319b57e-0806-4153-8220-b939a999377f"; // Emprisonnement dans la Terre (cercle Terre, base 1)

// Religion réelle : matérialise la gratuité « Connaissances des Religions » (choix religion).
const RELIGION = "0d412540-c3f0-48e3-9c49-97a8cbc4701f"; // Les Ecclésias d'Acarthas

// Deux langues anciennes réelles (choix Décryptage).
const LANGUE_A = "073762ec-4a6a-4767-85ba-2adf33c9679d"; // L'Ancien Commun
const LANGUE_B = "0dca7806-6956-4b56-9693-9a72311fe6c3"; // Le Démoniaque

const ZONE = "Personnelle";
const PORTEE = "Toucher";
const DUREE = "Instantanée";

let seq = 0;
const iid = () => `iid-${seq++}`;
const comp = (
  competenceId: string,
  niveauAcquis: number,
  choixAchat: string | null = null,
): BrouillonCompetence => ({ instanceId: iid(), competenceId, niveauAcquis, choixAchat });
const sort = (sortId: string, niveauSort = 1): BrouillonSort => ({
  instanceId: iid(),
  sortId,
  niveauSort,
  zoneChoisie: ZONE,
  porteeChoisie: PORTEE,
  dureeChoisie: DUREE,
});

function brouillon(
  classeId: string,
  competences: BrouillonCompetence[] = [],
  sorts: BrouillonSort[] = [],
): BrouillonVisiteur {
  const b = creerBrouillonVide();
  return {
    ...b,
    etape1: { ...b.etape1, nom: "Test", estCroyant: true, religionId: RELIGION },
    etape2: { raceId: snap.tables.races[0].id },
    etape4: { classeId },
    acquisitions: { ...b.acquisitions, competences, sorts },
  };
}

const perdue = (res: ReturnType<typeof calculerCascadeChangementClasse>, nom: string) =>
  res.donnees.perdues.find((p) => p.nom === nom);

// ============================================================
// 1 — class-locked
// ============================================================
describe("1. class-locked", () => {
  it("Cachette secrète (voleur) retirée au passage Voleur → Guerrier, XP effectif remboursé", () => {
    const cachette = comp(CACHETTE, 1);
    const b = brouillon(VOLEUR, [cachette]);
    const res = calculerCascadeChangementClasse(snap, b, GUERRIER);

    expect(res.instanceIdsARetirer).toContain(cachette.instanceId);
    const p = perdue(res, "Cachette secrète")!;
    expect(p.raison).toBe("class_locked");
    expect(p.xp).toBe(10);
    expect(p.niveaux).toEqual([{ niv: 1, xp: 10, gratuit: false }]);
    expect(res.donnees.xp_rembourse).toBe(10);
  });
});

// ============================================================
// 2 — over-cap
// ============================================================
describe("2. over-cap", () => {
  it("Botte Secrète niv 3 hors-classe : seul le niveau 3 est retiré (raison over_cap)", () => {
    const n1 = comp(BOTTE, 1);
    const n2 = comp(BOTTE, 2);
    const n3 = comp(BOTTE, 3);
    const b = brouillon(GUERRIER, [n1, n2, n3]);
    const res = calculerCascadeChangementClasse(snap, b, MAGE);

    // Seul le niveau 3 est retiré ; les niveaux 1 et 2 survivent.
    expect(res.instanceIdsARetirer).toEqual([n3.instanceId]);
    const p = perdue(res, "Botte Secrète")!;
    expect(p.raison).toBe("over_cap");
    expect(p.niveaux).toEqual([{ niv: 3, xp: 12, gratuit: false }]);
    expect(p.xp).toBe(12);
  });
});

// ============================================================
// 3 — cascade transitive
// ============================================================
describe("3. cascade", () => {
  it("Grande Messe suit la perte de son prérequis (gratuité Connaissances des Religions), raison cascade", () => {
    const gm = comp(GRANDE_MESSE, 1);
    const b = brouillon(PRETRE, [gm]);
    const res = calculerCascadeChangementClasse(snap, b, GUERRIER);

    // Grande Messe retirée en cascade : son prérequis (Connaissances des Religions,
    // gratuité Prêtre) disparaît au passage Guerrier.
    expect(res.instanceIdsARetirer).toContain(gm.instanceId);
    const p = perdue(res, "Grande Messe")!;
    expect(p.raison).toBe("cascade");
    expect(p.xp).toBe(8);
    // La gratuité obsolète est LISTÉE (display-only, 0 XP).
    const gratObsolete = perdue(res, "Connaissances des Religions")!;
    expect(gratObsolete.raison).toBe("gratuite_obsolete");
    expect(gratObsolete.xp).toBe(0);
  });
});

// ============================================================
// 4 — D3 dormance
// ============================================================
describe("4. D3 dormance sorts", () => {
  it("Mage → Guerrier : chaîne Acquisition de Cercle/Sort retirée → sorts purgés + dormants renseignés + refund", () => {
    const cercle = comp(ACQ_CERCLE, 1, "Terre");
    const acqSort = comp(ACQ_SORT, 1);
    const s = sort(SORT_TERRE, 1);
    const b = brouillon(MAGE, [cercle, acqSort], [s]);
    const res = calculerCascadeChangementClasse(snap, b, GUERRIER);

    expect(res.purgeSorts).toBe(true);
    expect(res.instanceIdsARetirer).toEqual(
      expect.arrayContaining([cercle.instanceId, acqSort.instanceId]),
    );
    expect(perdue(res, "Acquisition de Sort")!.raison).toBe("cascade");

    const xpSort = calculerCoutXP(ZONE, PORTEE, DUREE, 1, 1);
    expect(res.donnees.dormants).toEqual([
      { type: "sort", nom: "Emprisonnement dans la Terre", niveau: 1, xp: xpSort },
    ]);
    // Refund global = compétences retirées (Acq Cercle 5 + Acq Sort 0) + sort dormant.
    expect(res.donnees.xp_rembourse).toBe(5 + 0 + xpSort);
  });
});

// ============================================================
// 5 — D6 single
// ============================================================
describe("5. D6 single", () => {
  it("Bénédiction payée puis Prêtre l'offre : achat retiré, offertes d6_refund, XP revenu", () => {
    const bene = comp(BENEDICTION, 1);
    const b = brouillon(GUERRIER, [bene]);
    const res = calculerCascadeChangementClasse(snap, b, PRETRE);

    expect(res.d6).toEqual([{ instanceId: bene.instanceId, competenceId: BENEDICTION }]);
    // Le retrait D6 n'est PAS dans instanceIdsARetirer (piste séparée).
    expect(res.instanceIdsARetirer).not.toContain(bene.instanceId);
    const offerte = res.donnees.offertes.find((o) => o.nom === "Bénédiction");
    expect(offerte).toEqual({ nom: "Bénédiction", type: "d6_refund", xp: 4 });
    expect(res.donnees.xp_rembourse).toBe(4);
  });
});

// ============================================================
// 6 — D6 multiple_choix_distinct
// ============================================================
describe("6. D6 multi_choix", () => {
  it("sans choix : erreur verbatim choix_requis + selecteur multi_choix", () => {
    const dA = comp(DECRYPTAGE, 1, LANGUE_A);
    const dB = comp(DECRYPTAGE, 1, LANGUE_B);
    const b = brouillon(GUERRIER, [dA, dB]);
    const res = calculerCascadeChangementClasse(snap, b, MAGE);

    expect(res.erreurs[0]).toEqual({
      code: "choix_requis",
      message: "Choisissez quelle instance de « Décryptage » devient gratuite",
      champ: DECRYPTAGE,
    });
    const mc = res.donnees.multi_choix.find((m) => m.competence_id === DECRYPTAGE)!;
    expect(mc.options).toHaveLength(2);
    expect(mc.options.map((o) => o.choix_achat).sort()).toEqual([LANGUE_A, LANGUE_B].sort());
    expect(mc.options.every((o) => o.xp === 9)).toBe(true);
  });

  it("avec choix : la bonne instance part, choix gravé, gratuité dérivée au bon choix", async () => {
    const dA = comp(DECRYPTAGE, 1, LANGUE_A);
    const dB = comp(DECRYPTAGE, 1, LANGUE_B);
    const b = brouillon(GUERRIER, [dA, dB]);
    const res = calculerCascadeChangementClasse(snap, b, MAGE, { [DECRYPTAGE]: LANGUE_B });

    expect(res.erreurs).toHaveLength(0);
    expect(res.d6).toEqual([
      { instanceId: dB.instanceId, competenceId: DECRYPTAGE, choixAGraver: LANGUE_B },
    ]);

    // Application réelle via le client : l'instance LANGUE_B part, LANGUE_A reste
    // payée, la gratuité dérivée reprend LANGUE_B (choix gravé dans etape4).
    await withLocalStorage(async () => {
      sauverBrouillon(b);
      const rep = await clientVisiteur.changerClassePersonnage({
        p_personnage_id: PERSONNAGE_LOCAL_ID,
        p_classe_id: MAGE,
        p_choix_par_competence: { [DECRYPTAGE]: LANGUE_B },
        p_dry_run: false,
      });
      expect((rep.data as { succes: boolean }).succes).toBe(true);
      const apres = chargerBrouillon()!;
      expect(apres.etape4.choixParCompetence?.[DECRYPTAGE]).toBe(LANGUE_B);
      // LANGUE_A survit comme achat payant, LANGUE_B a été retirée.
      const decs = apres.acquisitions.competences.filter((c) => c.competenceId === DECRYPTAGE);
      expect(decs).toHaveLength(1);
      expect(decs[0].choixAchat).toBe(LANGUE_A);
      // La gratuité dérivée de Décryptage est au bon choix (LANGUE_B).
      const grat = deriverEtat(apres).gratuites.find((g) => g.competenceId === DECRYPTAGE);
      expect(grat?.choixAchat).toBe(LANGUE_B);
    });
  });
});

// ============================================================
// 7 — D2 maître
// ============================================================
describe("7. D2 maître", () => {
  it("hors-classe niveau 2 restant → avertissement verbatim + maitre_en_attente", () => {
    const n1 = comp(BOTTE, 1);
    const n2 = comp(BOTTE, 2);
    const b = brouillon(GUERRIER, [n1, n2]);
    const res = calculerCascadeChangementClasse(snap, b, MAGE);

    expect(res.instanceIdsARetirer).toEqual([]);
    expect(res.donnees.maitre_en_attente).toEqual([{ nom: "Botte Secrète", niveau: 2 }]);
    expect(res.avertissements).toEqual([
      {
        code: "maitre_requis",
        message:
          "« Botte Secrète » niveau 2 passe hors-classe : approbation d'un maître désormais requise.",
      },
    ]);
  });
});

// ============================================================
// 8 — dry_run n'écrit rien
// ============================================================
describe("8. dry_run", () => {
  it("brouillon STRICTEMENT identique avant/après un dry_run à conséquences", async () => {
    await withLocalStorage(async () => {
      const b = brouillon(VOLEUR, [comp(CACHETTE, 1)]);
      sauverBrouillon(b);
      const avant = JSON.stringify(chargerBrouillon());

      const rep = await clientVisiteur.changerClassePersonnage({
        p_personnage_id: PERSONNAGE_LOCAL_ID,
        p_classe_id: GUERRIER,
        p_dry_run: true,
      });
      expect((rep.data as { succes: boolean }).succes).toBe(true);

      const apres = JSON.stringify(chargerBrouillon());
      expect(apres).toBe(avant); // deep equal — aucune écriture
    });
  });
});

// ── Utilitaire localStorage (mock in-memory, comme invariant_derivation.test) ──
function withLocalStorage(fn: () => void | Promise<void>): void | Promise<void> {
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
  return fn();
}

// Réinitialise le compteur d'instanceId entre les tests (déterminisme).
beforeEach(() => {
  seq = 0;
});
