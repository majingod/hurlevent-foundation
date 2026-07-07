/**
 * LOT 2 — parité visiteur : lectures fidèles + réparations forge + COALESCE
 * modif + protection du personnage finalisé (audit s311 TOP 4 + TOP 5).
 *
 *  - Lot B : `lireObjetsForge` attache `reparation` (jointure locale sur le
 *            snapshot `reparations_forge`) — non-null si `reparation_id`, null sinon.
 *  - Lot C : `lireArtisanatQuotas` dérive les `quota_*_utilises` (items GRATUITS,
 *            ventilés comme la vue serveur) au lieu de `null`.
 *  - Lot D : `lirePersonnagePrieres.duree_incantation_calculee` = valeur du port
 *            `calculerDureeIncantation` (plus `null`).
 *  - Lot E : `modifierPriere` sans `p_nom_personnalise` → COALESCE : le nom
 *            personnalisé existant survit.
 *  - Lot F : `demarrerCreationPersonnage` REFUSE (`FINALISE_EXISTANT`) d'écraser
 *            un brouillon finalisé ; après vidage explicite → redémarrage OK.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { clientVisiteur, PERSONNAGE_LOCAL_ID } from "./clientVisiteur";
import {
  chargerBrouillon,
  sauverBrouillon,
  effacerBrouillon,
} from "./stockageBrouillon";
import { creerBrouillonVide } from "@/moteurCreation/brouillon/types";
import { getSnapshot } from "@/moteurCreation/snapshot";
import { calculerDureeIncantation } from "@/utils/calculsMagie";

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
const TRAIT_HUMAIN = "4675941e-481c-410d-a14f-9c2672d219ba"; // Coup du destin (gratuit si seul)
const COMP_PIEGE = "5b82c487-dd4c-48cb-a472-255019bbe835"; // Création et désarmement de piège
// 4 pièges niv1 distincts (quota niv1 = 3 → 3 gratuits + 1 payant).
const PIEGES_NIV1 = [
  "5c2c4507-e81c-40f2-b9f0-8648f9d420f8", // Fumée toxique
  "15700b76-94ef-4c15-ba73-e105e315b6f2", // Piège brise-doigts
  "2d2f4f47-223b-49e1-aed5-ab5cd8d8a731", // Piège d'hébêtement
  "4cb310dc-1f57-4c00-916a-4b52f8cf1786", // Piège aveuglant (4e → payant)
];

// Prière + domaine pour Lots D/E.
const RELIGION_FAERIES = "8f211631-f901-4b00-87d4-f2f85956dfb4"; // Chaos non proscrit
const COMP_ACQ_DOMAINE = "069a0cd4-a368-4134-96ff-467c6a98b2ad"; // Acquisition de Domaine
const PRIERE_ANTI_DETECTION = "3b42ff6b-07ac-479a-8af1-dde008c8df63"; // domaine Chaos, niv 1

const nul = null as unknown as string;

interface Env {
  succes: boolean;
  erreurs: Array<{ code?: string; message: string }>;
  avertissements: Array<{ code?: string; message: string }>;
  donnees: Record<string, unknown> | null;
}
const env = (data: unknown) => data as Env;

beforeEach(() => {
  installerLocalStorage();
});

// ============================================================
// Lot B — lireObjetsForge : jointure réparation locale
// ============================================================
describe("Lot B — lireObjetsForge attache la réparation depuis le snapshot", () => {
  it("objet réparable → reparation.nom_affichage non null ; non réparable → null", async () => {
    const { data } = await clientVisiteur.lireObjetsForge();
    const rows = data as unknown as Array<{
      id: string;
      reparation_id: string | null;
      reparation: { nom_affichage: string } | null;
    }>;

    const reparable = rows.find((o) => o.reparation_id != null)!;
    const nonReparable = rows.find((o) => o.reparation_id == null)!;

    expect(reparable).toBeTruthy();
    expect(nonReparable).toBeTruthy();
    expect(reparable.reparation).not.toBeNull();
    expect(reparable.reparation!.nom_affichage).toBeTruthy();
    // La réparation jointe correspond bien à la ligne reparations_forge ciblée.
    const cible = snap.tables.reparations_forge.find(
      (r) => r.id === reparable.reparation_id,
    )!;
    expect(reparable.reparation!.nom_affichage).toBe(cible.nom_affichage);
    // Objet sans reparation_id → reparation null (miroir du LEFT JOIN serveur).
    expect(nonReparable.reparation).toBeNull();
  });
});

// ============================================================
// Lot C — lireArtisanatQuotas : quota_*_utilises dérivés (gratuits)
// ============================================================
describe("Lot C — lireArtisanatQuotas compte les items gratuits utilisés", () => {
  async function wizardGuerrierPieges() {
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
    // niveauPieges = 1 → quota niv1 = 3 gratuits.
    expect(env((await clientVisiteur.acheterCompetence({
      p_personnage_id: PERSONNAGE_LOCAL_ID, p_competence_id: COMP_PIEGE, p_niveau_desire: 1,
    })).data).succes).toBe(true);
    // 4 pièges niv1 distincts : 3 gratuits (quota) + 1 payant.
    for (const piegeId of PIEGES_NIV1) {
      expect(env((await clientVisiteur.acheterPiege({
        p_personnage_id: PERSONNAGE_LOCAL_ID, p_piege_id: piegeId,
      })).data).succes).toBe(true);
    }
  }

  it("3 pièges niv1 gratuits + 1 payant → quota_pieges_niv1_utilises = 3 (pas null)", async () => {
    await wizardGuerrierPieges();
    const { data } = await clientVisiteur.lireArtisanatQuotas(PERSONNAGE_LOCAL_ID);
    const row = data as unknown as Record<string, number | null>;

    // Le compteur « utilisés » ne suit QUE les gratuités (3), pas les 4 achats.
    expect(row.quota_pieges_niv1_utilises).toBe(3);
    expect(row.quota_pieges_niv1_total).toBe(3);
    // Familles non touchées → 0 (dérivé), jamais figé faussement à autre chose.
    expect(row.quota_pieges_amelioration_niv2_utilises).toBe(0);
    expect(row.quota_pieges_amelioration_niv3_utilises).toBe(0);
    expect(row.quota_alchimie_mineure_utilises).toBe(0);
    expect(row.quota_alchimie_intermediaire_utilises).toBe(0);
    expect(row.quota_alchimie_majeure_utilises).toBe(0);
    expect(row.quota_assemblages_utilises).toBe(0);

    // Les 4 achats sont bien présents (le compteur gratuits est découplé du total).
    const b = chargerBrouillon()!;
    expect(b.acquisitions.pieges).toHaveLength(4);
  });
});

// ============================================================
// Lot D / Lot E — prières : incantation + COALESCE nom_personnalise
// ============================================================

/** Brouillon prêtre avec le domaine « Chaos » débloqué + une prière acquise. */
function brouillonAvecPriere(nomPersonnalise?: string) {
  const b = creerBrouillonVide();
  b.etape1 = { ...b.etape1, nom: "Eldael", estCroyant: true, religionId: RELIGION_FAERIES };
  b.etape2 = { raceId: RACE_HUMAIN };
  b.etape4 = { classeId: idClasse("Prêtre") };
  b.acquisitions.competences = [
    { competenceId: COMP_ACQ_DOMAINE, niveauAcquis: 1, choixAchat: "Chaos" },
  ];
  b.acquisitions.prieres = [
    {
      priereId: PRIERE_ANTI_DETECTION,
      niveauPriere: 1,
      zoneChoisie: "Personnelle",
      porteeChoisie: "Toucher",
      dureeChoisie: "Instantanée",
      nomPersonnalise,
    },
  ];
  return b;
}

describe("Lot D — lirePersonnagePrieres.duree_incantation_calculee branchée", () => {
  it("prière acquise → duree_incantation_calculee = calculerDureeIncantation (pas null)", async () => {
    sauverBrouillon(brouillonAvecPriere());
    const { data } = await clientVisiteur.lirePersonnagePrieres(PERSONNAGE_LOCAL_ID);
    const rows = data as unknown as Array<{ duree_incantation_calculee: number | null }>;

    expect(rows).toHaveLength(1);
    const attendu = calculerDureeIncantation("Toucher", "Personnelle", "Instantanée", 1);
    expect(rows[0].duree_incantation_calculee).not.toBeNull();
    expect(rows[0].duree_incantation_calculee).toBe(attendu);
  });
});

describe("Lot E — modifierPriere sans nom_personnalise conserve l'existant", () => {
  it("param nom_personnalise absent → COALESCE : le nom perso survit", async () => {
    sauverBrouillon(brouillonAvecPriere("Voile des ombres"));

    // Modification qui n'envoie PAS p_nom_personnalise (écran : nom inchangé).
    const r = env(
      (await clientVisiteur.modifierPriere({
        p_personnage_priere_id: (
          (await clientVisiteur.lirePersonnagePrieres(PERSONNAGE_LOCAL_ID))
            .data as unknown as Array<{ id: string }>
        )[0].id,
        p_niveau_priere: 1,
        p_zone_choisie: "Personnelle",
        p_portee_choisie: "Toucher",
        p_duree_choisie: "Instantanée",
        // p_nom_personnalise volontairement omis (undefined)
      } as never)).data,
    );
    expect(r.succes).toBe(true);

    const b = chargerBrouillon()!;
    expect(b.acquisitions.prieres[0].nomPersonnalise).toBe("Voile des ombres");
  });
});

// ============================================================
// Lot F — protection du personnage finalisé (TOP 5d)
// ============================================================
describe("Lot F — demarrerCreationPersonnage protège le brouillon finalisé", () => {
  it("brouillon finalisé → refus FINALISE_EXISTANT ; après vidage → redémarrage OK", async () => {
    // Brouillon finalisé (etapeCourante = 11).
    const finalise = creerBrouillonVide();
    finalise.meta.etapeCourante = 11;
    finalise.etape1 = { ...finalise.etape1, nom: "Perso fini" };
    sauverBrouillon(finalise);

    const refus = env((await clientVisiteur.demarrerCreationPersonnage({})).data);
    expect(refus.succes).toBe(false);
    expect(refus.erreurs[0].code).toBe("FINALISE_EXISTANT");
    expect(refus.erreurs[0].message).toBe(
      "Un personnage finalisé existe déjà sur cet appareil.",
    );
    // Le brouillon finalisé N'A PAS été écrasé.
    expect(chargerBrouillon()!.meta.etapeCourante).toBe(11);
    expect(chargerBrouillon()!.etape1.nom).toBe("Perso fini");

    // Vidage explicite → redémarrage autorisé (nouveau brouillon vide, étape 1).
    effacerBrouillon();
    const ok = env((await clientVisiteur.demarrerCreationPersonnage({})).data);
    expect(ok.succes).toBe(true);
    expect((ok.donnees as { etape_creation: number }).etape_creation).toBe(1);
    expect(chargerBrouillon()!.meta.etapeCourante).toBe(1);
  });
});
