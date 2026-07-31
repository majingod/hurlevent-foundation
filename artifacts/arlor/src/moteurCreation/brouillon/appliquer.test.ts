/**
 * Tests des applicateurs purs + invariant structurel « aucun champ dérivé persisté ».
 */

import { describe, it, expect } from "vitest";
import { getSnapshot } from "../snapshot";
import { creerBrouillonVide } from "./types";
import {
  appliquerAchatCompetence,
  appliquerAchatSort,
  appliquerAchatPiege,
  modifierSort,
  changerClasse,
} from "./appliquer";

const snapshot = getSnapshot();

// ============================================================
// Immuabilité
// ============================================================

describe("applicateurs immuables", () => {
  it("appliquerAchatCompetence ne mute pas le brouillon d'entrée", () => {
    const b = creerBrouillonVide();
    const avant = JSON.parse(JSON.stringify(b));
    const b2 = appliquerAchatCompetence(b, {
      competenceId: "x",
      niveauDesire: 1,
      choixAchat: null,
    });
    expect(b).toEqual(avant); // inchangé
    expect(b2).not.toBe(b);
    expect(b2.acquisitions.competences).toHaveLength(1);
    expect(b2.meta.modifieLe).not.toBe(""); // rafraîchi
  });

  it("modifierSort remplace les choix zone/portée/durée (ciblé par instanceId)", () => {
    let b = appliquerAchatSort(creerBrouillonVide(), {
      sortId: "s1",
      niveauSort: 1,
      zoneChoisie: "Z1",
      porteeChoisie: "P1",
      dureeChoisie: "D1",
    });
    const instanceId = b.acquisitions.sorts[0].instanceId;
    expect(instanceId).toBeTruthy(); // uuid local posé à l'achat
    b = modifierSort(b, instanceId, {
      zoneChoisie: "Z2",
      porteeChoisie: "P2",
      dureeChoisie: "D2",
      niveauSort: 2,
    });
    expect(b.acquisitions.sorts[0]).toEqual({
      instanceId,
      sortId: "s1",
      niveauSort: 2,
      zoneChoisie: "Z2",
      porteeChoisie: "P2",
      dureeChoisie: "D2",
    });
  });

  it("changerClasse ne touche que etape4.classeId", () => {
    const guerrier = snapshot.tables.classes.find((c) => c.nom === "Guerrier")!;
    const b = creerBrouillonVide();
    const b2 = changerClasse(b, guerrier.id);
    expect(b2.etape4.classeId).toBe(guerrier.id);
    expect(b2.etape1).toEqual(b.etape1);
    expect(b2.etape2).toEqual(b.etape2);
  });
});

// ============================================================
// 4. Aucun champ dérivé persisté (test structurel)
// ============================================================

describe("aucun champ dérivé dans le brouillon sérialisé", () => {
  it("le JSON ne contient ni xpDispo, ni pvMax, ni gratuités, ni quotas", () => {
    let b = creerBrouillonVide();
    b = appliquerAchatCompetence(b, {
      competenceId: "c1",
      niveauDesire: 2,
      choixAchat: "choix",
    });
    b = appliquerAchatPiege(b, "p1");

    const json = JSON.stringify(b);
    for (const interdit of [
      "xpDispo",
      "xpTotal",
      "xpDepense",
      "pvMax",
      "psMax",
      "gratuites",
      "quotas",
      "inapteMagie",
      "niveauxArtisanat",
    ]) {
      expect(json.includes(interdit)).toBe(false);
    }
  });
});
