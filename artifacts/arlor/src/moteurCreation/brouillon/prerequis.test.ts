/**
 * `calculerPrerequis` — 3 branches EXCLUSIVES "special" ([VIS-3], s322).
 *
 * Parité avec `assembler_prerequis_labels` (migration 20260530220942) +
 * `verifier_prerequis_competences` (migration 20260706195514) : Dépeçage niv 1/2
 * et Développement Spirituel Supérieur niv 1 émettent des pastilles `special`
 * (libellés `formater_prereq_label` byte-exact) EN PLACE du cas général structuré
 * — jamais les deux. Le cas général (compétence ordinaire) est non-régressé.
 */

import { describe, it, expect } from "vitest";
import { getSnapshot } from "../snapshot";
import { creerBrouillonVide } from "./types";
import type { BrouillonVisiteur, BrouillonCompetence } from "./types";
import { deriverEtat } from "./deriver";
import { calculerPrerequis } from "./prerequis";

const snap = getSnapshot();
const idClasse = (nom: string) => snap.tables.classes.find((c) => c.nom === nom)!.id;

const MAGE = idClasse("Mage");

// ── Ancres réelles (ids résolus depuis le snapshot bundlé) ──
const DEPECAGE = "82159693-1e88-4a8d-9dca-e6dcc25a4a42"; // Dépeçage, niv 1+2
const DEV_SPI_SUP = "0eeecf81-7953-45b1-9928-13ed02eaaa69"; // Développement Spirituel Supérieur (mage)
const DEV_SPI = "506f7bc1-af9d-403b-a495-fee5cb5f751d"; // Développement Spirituel (mono-niveau, rachetable)
const CONNAISSANCES_CREATURES = "d017baba-28f0-4070-9124-87814e7544d2"; // 2 niveaux
const PREMIERS_SOINS = "fe5d2c38-89c9-4af1-bbc7-343497e7969c"; // 3 niveaux
const PIEGE_SECURISE = "1427677e-98fd-4ba5-86ca-3145fc4aa178"; // cas général : prereq Création et désarmement de piège niv1
const CREATION_PIEGE = "5b82c487-dd4c-48cb-a472-255019bbe835";

type Resultat = Record<
  string,
  {
    niveau_max_achetable: number;
    raisons_par_niveau: Record<string, string>;
    prereqs_par_niveau: Record<string, Array<{ label: string; statut: string; competence_id: string | null }>>;
  }
>;

let seq = 0;
const iid = () => `iid-${seq++}`;
const comp = (competenceId: string, niveauAcquis: number): BrouillonCompetence => ({
  instanceId: iid(),
  competenceId,
  niveauAcquis,
  choixAchat: null,
});

function brouillon(classeId: string, competences: BrouillonCompetence[] = []): BrouillonVisiteur {
  const b = creerBrouillonVide();
  return {
    ...b,
    etape4: { classeId },
    acquisitions: { ...b.acquisitions, competences },
  };
}

function verifier(b: BrouillonVisiteur): Resultat {
  return calculerPrerequis(b, deriverEtat) as Resultat;
}

// ============================================================
// Brouillon nu — pastilles special manquantes
// ============================================================
describe("calculerPrerequis — pastilles special (brouillon nu)", () => {
  it("Dépeçage niv 1 : exactement 2 pastilles special manquant, labels byte-exact", () => {
    const res = verifier(brouillon(""));
    const niv1 = res[DEPECAGE].prereqs_par_niveau["1"];
    expect(niv1).toEqual([
      { label: "Connaissances des Créatures Niv 1 (famille appropriée)", statut: "manquant", competence_id: null },
      { label: "Premiers Soins Niv 1", statut: "manquant", competence_id: null },
    ]);
  });

  it("Dépeçage niv 2 : exactement 1 pastille special manquant", () => {
    const res = verifier(brouillon(""));
    const niv2 = res[DEPECAGE].prereqs_par_niveau["2"];
    expect(niv2).toEqual([
      { label: "Connaissances des Créatures Niv 2 (famille appropriée)", statut: "manquant", competence_id: null },
    ]);
  });

  it("Développement Spirituel Supérieur niv 1 : pastille « 20 PS via Développement Spirituel » manquant", () => {
    const res = verifier(brouillon(""));
    // niv1 porte aussi la pastille de CLASSE (mage) — hors périmètre [VIS-3], non touchée.
    const niv1 = res[DEV_SPI_SUP].prereqs_par_niveau["1"];
    const pastilleSpecial = niv1.find((p) => p.competence_id === null && p.label === "20 PS via Développement Spirituel");
    expect(pastilleSpecial).toEqual({ label: "20 PS via Développement Spirituel", statut: "manquant", competence_id: null });
  });
});

// ============================================================
// Statuts dérivés de l'état acquis
// ============================================================
describe("calculerPrerequis — pastilles special (statuts acquis)", () => {
  it("Connaissances des Créatures niv1 + Premiers Soins niv1 acquis → Dépeçage niv1 acquis, creat2 niv2 reste manquant", () => {
    const b = brouillon("", [comp(CONNAISSANCES_CREATURES, 1), comp(PREMIERS_SOINS, 1)]);
    const res = verifier(b);

    const niv1 = res[DEPECAGE].prereqs_par_niveau["1"];
    expect(niv1).toEqual([
      { label: "Connaissances des Créatures Niv 1 (famille appropriée)", statut: "acquis", competence_id: null },
      { label: "Premiers Soins Niv 1", statut: "acquis", competence_id: null },
    ]);

    const niv2 = res[DEPECAGE].prereqs_par_niveau["2"];
    expect(niv2).toEqual([
      { label: "Connaissances des Créatures Niv 2 (famille appropriée)", statut: "manquant", competence_id: null },
    ]);
  });

  it("psMax >= 20 → dev_spirituel_20ps acquis", () => {
    // Mage (ps_depart 10) + 10 achats de Développement Spirituel (mono-niveau,
    // rachetable, +1 PS/achat) → psMax = 20.
    const achats = Array.from({ length: 10 }, () => comp(DEV_SPI, 1));
    const b = brouillon(MAGE, achats);
    const res = verifier(b);

    const niv1 = res[DEV_SPI_SUP].prereqs_par_niveau["1"];
    const pastilleSpecial = niv1.find((p) => p.label === "20 PS via Développement Spirituel");
    expect(pastilleSpecial?.statut).toBe("acquis");
  });
});

// ============================================================
// Exclusivité : AUCUN item du cas général en plus des special
// ============================================================
describe("calculerPrerequis — exclusivité special / cas général", () => {
  it("Dépeçage niv1/niv2 n'émettent QUE les items special (pas de cas général en plus)", () => {
    const res = verifier(brouillon(""));
    expect(res[DEPECAGE].prereqs_par_niveau["1"]).toHaveLength(2);
    expect(res[DEPECAGE].prereqs_par_niveau["2"]).toHaveLength(1);
  });
});

// ============================================================
// Non-régression : cas général (compétence ordinaire, prérequis structurés)
// ============================================================
describe("calculerPrerequis — cas général (non-régression)", () => {
  it("Piège sécurisé niv1 : prérequis structuré manquant, libellé et statut inchangés", () => {
    const res = verifier(brouillon(""));
    const niv1 = res[PIEGE_SECURISE].prereqs_par_niveau["1"];
    expect(niv1).toEqual([
      { label: "Création et désarmement de piège niveau 1", statut: "manquant", competence_id: null },
    ]);
    expect(res[PIEGE_SECURISE].niveau_max_achetable).toBe(0);
  });

  it("Piège sécurisé niv1 : prérequis structuré satisfait → acquis, niveau_max_achetable non réduit", () => {
    const b = brouillon("", [comp(CREATION_PIEGE, 1)]);
    const res = verifier(b);
    const niv1 = res[PIEGE_SECURISE]?.prereqs_par_niveau["1"];
    expect(niv1).toEqual([
      { label: "Création et désarmement de piège niveau 1", statut: "acquis", competence_id: null },
    ]);
  });
});
