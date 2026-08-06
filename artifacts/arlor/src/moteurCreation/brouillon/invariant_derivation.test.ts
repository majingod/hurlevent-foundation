/**
 * INVARIANT DE DÉRIVATION — le test-filet anti-« famille oubliée » (lot XP s311).
 *
 * Construit UN brouillon complet couvrant TOUTES les familles de dépense
 * (traits, compétence simple, Acquisition de Cercle AVEC rabais, gratuité de
 * classe, sort, prière, piège, recette, assemblage) plus les compteurs
 * d'expérience déclarés à l'étape 1, puis vérifie AU XP PRÈS les trois scalaires
 * dérivés :
 *   - `xpTotal`   = formule serveur (annexe A : xp_depart + gn×15 + mini×15 + ouv×10) ;
 *   - `xpDepense` = somme calculée à la main, famille par famille (ci-dessous) ;
 *   - `xpDispo`   = xpTotal − xpDepense.
 *
 * Toute famille future NON comptée par `deriverEtat` fera diverger `xpDepense`
 * et cassera ce test — c'est le but.
 *
 * Vérifie aussi (TOP 1b, point 3) que le REMBOURSEMENT de désachat repose sur le
 * `xpDepense` dérivé : désacheter l'Acquisition de Cercle rend le tarif RÉDUIT
 * (rabais), pas le plein tarif catalogue.
 *
 * Ancres = ids réels du snapshot bundlé (vérifiés s311, cf. regressionBugsS311).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getSnapshot } from "../snapshot";
import { creerBrouillonVide } from "./types";
import type { BrouillonVisiteur } from "./types";
import { deriverEtat } from "./deriver";
import { calculerCoutXP } from "@/utils/calculsMagie";
import { clientVisiteur, PERSONNAGE_LOCAL_ID } from "@/creation/visiteur/clientVisiteur";
import { sauverBrouillon } from "@/creation/visiteur/stockageBrouillon";

const snap = getSnapshot();
const idRace = (nom: string) => snap.tables.races.find((r) => r.nom === nom)!.id;
const idClasse = (nom: string) => snap.tables.classes.find((c) => c.nom === nom)!.id;

// ── Ancres (ids réels s311) ────────────────────────────────────────────────
const RACE_HUMAIN = idRace("Humain"); // xp_depart 80, nb_traits_raciaux 1
const CLASSE_MAGE = idClasse("Mage"); // gratuités : Linguistique (0), Décryptage (0, choix)

const TRAIT_HUMAIN = "4675941e-481c-410d-a14f-9c2672d219ba"; // Coup du destin (10 XP)
const TRAIT_HUMAIN2 = "fad7ba5d-df90-4f24-88b4-987eb9a4891f"; // Fortuné (10 XP)

const COMP_BOTTE = "04cadb85-598c-4dbf-b982-3b5f9d5736f2"; // Botte Secrète (simple : niv1 9)
const COMP_CERCLE = "9fc3a181-4e29-4d94-8639-65b9a9a7c787"; // Acquisition de Cercle (niv2 base 10)
const COMP_DECRYPTAGE = "0b0fba09-77d5-4078-946f-9add150f695d"; // gratuité Mage (choix langue_ancienne)

const SORT_FEU = "018f508e-fe3f-414a-9a95-3248692c5d3b"; // Bouclier de Feu (cercle Feu, cout_xp_base 0.5)
const PRIERE = "00d4c3ea-1f4e-44ec-a320-230ba2d97c00"; // Ami/Ennemi (domaine Chaos, cout_xp_base 1)
const PIEGE = "0103730b-4829-41e9-b3cb-8f0e3e1c653f"; // Piège brise-doigts, palier 3 (cout_xp 7 catalogue)
const RECETTE = "046e79fe-1a66-4864-a6ca-db495b0d6e37"; // recette palier 2 (cout_xp 3 catalogue)
const ASSEMBLAGE = "073c3517-e1ba-4172-9e18-37d7975c2a92"; // assemblage (cout_xp 4 catalogue)

// [D48-bis] La cascade artisanat purge tout item orphelin (compétence d'artisanat
// absente) sur CHAQUE désachat, même sans rapport — cf. commentaire migration
// 20260806073711 (« Purge aussi les orphelins preexistants »). Le brouillon doit
// donc porter les compétences d'artisanat qui légitiment PIEGE/RECETTE/ASSEMBLAGE
// (paliers exacts), sans quoi ce test-filet se ferait purger ses propres items.
// `cascadeParPrerequis` (boucle prérequis du désachat, cf. prerequis.ts) tourne
// aussi sur CHAQUE désachat et retire toute compétence dont les prérequis ne sont
// pas satisfaits — il faut donc AUSSI porter les prérequis de ces 3 compétences.
const COMP_PIEGES = "5b82c487-dd4c-48cb-a472-255019bbe835"; // Création et désarmement de piège (aucun prérequis)
const COMP_ALCHIMIE = "3f018622-a2ad-443a-882b-483ef3e2bd23"; // Alchimie (prérequis : Herbes Communes/Rares)
const COMP_RUNES = "16361c8e-a173-40b2-ae6f-4f670d8010d4"; // Assemblage de Runes, mage (prérequis : Runes/Canalisation)
const COMP_HERBES_COMMUNES = "c601901b-2a26-46e0-a42e-2e3077fe99e2"; // prérequis Alchimie niv 1
const COMP_HERBES_RARES = "72a3db25-ed40-49c1-96f0-ec9f60f62fa3"; // prérequis Alchimie niv 2
const COMP_CONNAISSANCE_RUNES = "1135db5a-9161-4cc3-bc50-e0e0bed3ce5a"; // prérequis Runes niv 1
const COMP_CANALISATION = "4250ebd9-a93d-4611-94d5-feba449407fc"; // prérequis Runes niv 1

// Choix magie communs sort + prière (labels réels des barèmes).
const ZONE = "Personnelle"; // COUT_ZONE 1
const PORTEE = "Toucher"; //    PORTEES   0
const DUREE = "Instantanée"; //  DUREES    1

/** Brouillon complet : une entrée par famille de dépense + compteurs étape 1. */
function construireBrouillonComplet(): BrouillonVisiteur {
  const b = creerBrouillonVide();
  return {
    ...b,
    etape1: {
      ...b.etape1,
      nom: "Aldric",
      // 2 GN + 1 mini-GN + 1 ouverture (comptés par le serveur).
      gnCompletes: 2,
      miniGnCompletes: 1,
      ouverturesTerrain: 1,
    },
    etape2: { raceId: RACE_HUMAIN },
    etape3: {
      // Humain : nb_traits_raciaux = 1 → index 0 gratuit, index 1 payant (10 XP).
      traitsRaciauxChoisis: [
        { trait_id: TRAIT_HUMAIN },
        { trait_id: TRAIT_HUMAIN2 },
      ],
    },
    etape4: {
      classeId: CLASSE_MAGE,
      // La gratuité Mage « Décryptage » exige un choix langue_ancienne.
      choixParCompetence: { [COMP_DECRYPTAGE]: "L'Ancien" },
    },
    acquisitions: {
      competences: [
        // Compétence payante simple (Botte Secrète niv 1 = 9 XP).
        { instanceId: crypto.randomUUID(), competenceId: COMP_BOTTE, niveauAcquis: 1, choixAchat: null },
        // Acquisition de Cercle « Feu » niveau 2 : base 10, RABAIS = 1 sort Feu
        // déjà possédé (niveau ≤ 5) → coût effectif 9. (gratuité Mage = provenance.)
        { instanceId: crypto.randomUUID(), competenceId: COMP_CERCLE, niveauAcquis: 2, choixAchat: "Feu" },
        // Compétences d'artisanat (paliers exacts requis par PIEGE/RECETTE/ASSEMBLAGE
        // ci-dessous), + leurs prérequis — cf. note [D48-bis] plus haut.
        { instanceId: crypto.randomUUID(), competenceId: COMP_PIEGES, niveauAcquis: 3, choixAchat: null },
        { instanceId: crypto.randomUUID(), competenceId: COMP_ALCHIMIE, niveauAcquis: 2, choixAchat: null },
        { instanceId: crypto.randomUUID(), competenceId: COMP_RUNES, niveauAcquis: 1, choixAchat: null },
        { instanceId: crypto.randomUUID(), competenceId: COMP_HERBES_COMMUNES, niveauAcquis: 1, choixAchat: null },
        { instanceId: crypto.randomUUID(), competenceId: COMP_HERBES_RARES, niveauAcquis: 1, choixAchat: null },
        { instanceId: crypto.randomUUID(), competenceId: COMP_CONNAISSANCE_RUNES, niveauAcquis: 1, choixAchat: null },
        { instanceId: crypto.randomUUID(), competenceId: COMP_CANALISATION, niveauAcquis: 1, choixAchat: null },
      ],
      // 1 sort Feu (sert aussi de matière au rabais du cercle ci-dessus).
      sorts: [
        {
          instanceId: crypto.randomUUID(),
          sortId: SORT_FEU,
          niveauSort: 1,
          zoneChoisie: ZONE,
          porteeChoisie: PORTEE,
          dureeChoisie: DUREE,
        },
      ],
      prieres: [
        {
          instanceId: crypto.randomUUID(),
          priereId: PRIERE,
          niveauPriere: 1,
          zoneChoisie: ZONE,
          porteeChoisie: PORTEE,
          dureeChoisie: DUREE,
        },
      ],
      pieges: [{ instanceId: crypto.randomUUID(), piegeId: PIEGE }],
      recettes: [{ instanceId: crypto.randomUUID(), recetteId: RECETTE }],
      assemblages: [{ instanceId: crypto.randomUUID(), assemblageId: ASSEMBLAGE }],
    },
  };
}

// Coûts magie recalculés par la MÊME fonction que le moteur (pas de nombre inventé).
// Sort  Bouclier de Feu : ceil((1 + 0 + 1 + 1) × 0.5) = ceil(1.5) = 2.
const COUT_SORT = calculerCoutXP(ZONE, PORTEE, DUREE, 1, 0.5);
// Prière Ami/Ennemi      : ceil((1 + 0 + 1 + 1) × 1)   = ceil(3)   = 3.
const COUT_PRIERE = calculerCoutXP(ZONE, PORTEE, DUREE, 1, 1);

// ── Somme xpDepense, calculée À LA MAIN, ligne par ligne ────────────────────
const XP_TRAIT_PAYANT = 10; // Fortuné (le 2e trait ; le 1er est gratuit)
const XP_BOTTE = 9; //         Botte Secrète niveau 1
const XP_CERCLE_RABAIS = 10 - 1; // Acquisition de Cercle niv 2 : base 10 − 1 sort Feu = 9
const XP_GRATUITES = 0; //     Linguistique + Décryptage (provenance classe)
const XP_SORT = 2; //          COUT_SORT (cross-vérifié ci-dessous)
const XP_PRIERE = 3; //        COUT_PRIERE
const XP_COMP_PIEGES = 18; //  Création et désarmement de piège niveau 3
const XP_COMP_ALCHIMIE = 14; // Alchimie niveau 2
const XP_COMP_RUNES = 8; //    Assemblage de Runes niveau 1
const XP_COMP_HERBES_COMMUNES = 6; // prérequis Alchimie niv 1
const XP_COMP_HERBES_RARES = 9; //    prérequis Alchimie niv 2
const XP_COMP_CONNAISSANCE_RUNES = 12; // prérequis Runes niv 1
const XP_COMP_CANALISATION = 6; //       prérequis Runes niv 1
const XP_PIEGE = 0; //         Piège brise-doigts palier 3 (quota 1 au niveau 3 → gratuit)
const XP_RECETTE = 0; //       recette palier 2 (quota 4 au niveau Alchimie 2 → gratuite)
const XP_ASSEMBLAGE = 0; //    assemblage (quota 2 au niveau Runes 1 → gratuit)

const XP_DEPENSE_ATTENDU =
  XP_TRAIT_PAYANT + // 10
  XP_BOTTE + //         9
  XP_CERCLE_RABAIS + //  9
  XP_GRATUITES + //      0
  XP_SORT + //           2
  XP_PRIERE + //         3
  XP_COMP_PIEGES + //   18
  XP_COMP_ALCHIMIE + // 14
  XP_COMP_RUNES + //     8
  XP_COMP_HERBES_COMMUNES + //     6
  XP_COMP_HERBES_RARES + //        9
  XP_COMP_CONNAISSANCE_RUNES + // 12
  XP_COMP_CANALISATION + //        6
  XP_PIEGE + //          0
  XP_RECETTE + //        0
  XP_ASSEMBLAGE; //      0   ⇒ TOTAL 106

// xpTotal = xp_depart(Humain 80) + gn(2×15 + 1×15 + 1×10 = 55) = 135.
const XP_DEPART_HUMAIN = snap.tables.races.find((r) => r.id === RACE_HUMAIN)!.xp_depart ?? 0;
const XP_GN = 2 * 15 + 1 * 15 + 1 * 10; // 55
const XP_TOTAL_ATTENDU = XP_DEPART_HUMAIN + XP_GN; // 135

describe("invariant de dérivation — filet anti-« famille oubliée »", () => {
  it("garde-fous : les coûts magie recalculés valent bien 2 et 3", () => {
    expect(COUT_SORT).toBe(XP_SORT);
    expect(COUT_PRIERE).toBe(XP_PRIERE);
    expect(XP_DEPART_HUMAIN).toBe(80);
    expect(XP_DEPENSE_ATTENDU).toBe(106);
    expect(XP_TOTAL_ATTENDU).toBe(135);
  });

  it("xpTotal exact = xp_depart + compteurs GN déclarés (étape 1)", () => {
    const d = deriverEtat(construireBrouillonComplet());
    expect(d.xpTotal).toBe(XP_TOTAL_ATTENDU); // 135
  });

  it("xpDepense exact = somme famille par famille (rabais cercle inclus)", () => {
    const d = deriverEtat(construireBrouillonComplet());
    expect(d.xpDepense).toBe(XP_DEPENSE_ATTENDU); // 106
  });

  it("xpDispo = xpTotal − xpDepense", () => {
    const d = deriverEtat(construireBrouillonComplet());
    expect(d.xpDispo).toBe(XP_TOTAL_ATTENDU - XP_DEPENSE_ATTENDU); // 29
    expect(d.xpDispo).toBe(d.xpTotal - d.xpDepense);
  });

  it("une gratuité de classe (provenance, 0 XP) est bien présente", () => {
    const d = deriverEtat(construireBrouillonComplet());
    expect(d.gratuites.length).toBeGreaterThan(0);
  });
});

describe("remboursement de désachat fidèle au rabais (TOP 1b)", () => {
  beforeEach(() => {
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
  });

  it("désacheter l'Acquisition de Cercle rend le tarif RÉDUIT (9), pas le plein (10)", async () => {
    sauverBrouillon(construireBrouillonComplet());

    // Retrouve l'id encodé de l'Acquisition de Cercle niveau 2 (choix Feu).
    const comps = (await clientVisiteur.lirePersonnageCompetences(PERSONNAGE_LOCAL_ID))
      .data as unknown as Array<{
      id: string;
      competence_id: string;
      niveau_acquis: number;
      xp_depense: number;
    }>;
    const cercle = comps.find(
      (c) => c.competence_id === COMP_CERCLE && c.niveau_acquis === 2,
    )!;
    expect(cercle).toBeDefined();
    // La LECTURE elle-même expose déjà le xp_depense réduit (badge « Gratuit » fidèle).
    expect(cercle.xp_depense).toBe(9);

    const rep = (
      await clientVisiteur.desacheterCompetence({
        p_personnage_competence_id: cercle.id,
        p_dry_run: true,
      })
    ).data as unknown as {
      succes: boolean;
      donnees: {
        xp_rembourse: number;
        items_detail: Array<{ type: string; nom: string; xp_total: number }>;
      };
    };
    expect(rep.succes).toBe(true);

    // CŒUR DE LA PREUVE (B.3) : l'item compétence remboursé porte le tarif RÉDUIT
    // (9 = base 10 − 1 sort), PAS le coût catalogue (10). Avant le fix, le débit
    // facturait 10 mais le remboursement en rendait 10 aussi ; ici les deux valent 9.
    const itemCercle = rep.donnees.items_detail.find((i) => i.type === "competence")!;
    expect(itemCercle.nom).toBe("Acquisition de Cercle");
    expect(itemCercle.xp_total).toBe(XP_CERCLE_RABAIS); // 9, jamais 10

    // La part « compétence » du remboursement = 9 : c'est ce montant réduit, pas le
    // plein tarif, qui remonte dans xp_rembourse. NB (Lot A) : le sort Feu n'est PLUS
    // balayé par la « fermeture » du cercle — le serveur ne purge que sur chute
    // d'« Acquisition de Sort/Prière » ; le sort orphelin survit ici, seul l'item
    // compétence figure dans le détail.
    expect(rep.donnees.items_detail.every((i) => i.type === "competence")).toBe(true);
    const partComp = rep.donnees.items_detail
      .filter((i) => i.type === "competence")
      .reduce((s, i) => s + i.xp_total, 0);
    expect(partComp).toBe(XP_CERCLE_RABAIS); // 9
    // Remboursement total = uniquement la compétence (aucun sort/prière balayé).
    expect(rep.donnees.xp_rembourse).toBe(XP_CERCLE_RABAIS);
  });
});
