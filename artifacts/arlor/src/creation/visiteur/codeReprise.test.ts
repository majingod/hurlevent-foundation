/**
 * Tests du code de reprise (lot HL-A3, s321) — TS pur, aucun localStorage requis
 * (ce module n'y touche jamais).
 */

import { describe, it, expect } from "vitest";
import { deflateSync, strToU8 } from "fflate";
import { getSnapshot } from "@/moteurCreation/snapshot";
import { creerBrouillonVide } from "@/moteurCreation/brouillon/types";
import type { BrouillonVisiteur } from "@/moteurCreation/brouillon/types";
import { interpreterBrouillonBrut } from "./stockageBrouillon";
import {
  PREFIXE_CODE,
  genererCodeReprise,
  interpreterTexteColle,
} from "./codeReprise";

const snap = getSnapshot();
const idRace = (nom: string) => snap.tables.races.find((r) => r.nom === nom)!.id;
const idClasse = (nom: string) => snap.tables.classes.find((c) => c.nom === nom)!.id;

/** Brouillon v2 réaliste : identité + race/classe + quelques acquisitions. */
function brouillonRealiste(): BrouillonVisiteur {
  const b = creerBrouillonVide();
  b.etape1.nom = "Aldric du Val-Brumeux";
  b.etape1.gnCompletes = 3;
  b.etape1.estCroyant = true;
  b.etape2.raceId = idRace("Humain");
  b.etape4.classeId = idClasse("Guerrier");
  b.meta.etapeCourante = 5;
  b.acquisitions.competences.push({
    instanceId: crypto.randomUUID(),
    competenceId: "comp-1",
    niveauAcquis: 1,
    choixAchat: null,
  });
  b.acquisitions.sorts.push({
    instanceId: crypto.randomUUID(),
    sortId: "sort-1",
    niveauSort: 1,
    zoneChoisie: "unique",
    porteeChoisie: "contact",
    dureeChoisie: "instantanee",
  });
  return b;
}

describe("round-trip", () => {
  it("genererCodeReprise → interpreterTexteColle est deep-equal strict au brouillon (meta comprise)", () => {
    const b = brouillonRealiste();
    const code = genererCodeReprise(b);
    expect(code.startsWith(PREFIXE_CODE)).toBe(true);

    const resultat = interpreterTexteColle(code);
    expect(resultat.ok).toBe(true);
    if (resultat.ok) {
      expect(resultat.brouillon).toEqual(b);
    }
  });
});

describe("tolérance à l'espacement", () => {
  it("code avec \\n et espaces injectés tous les 60 caractères → import identique", () => {
    const b = brouillonRealiste();
    const code = genererCodeReprise(b);

    let espace = "";
    for (let i = 0; i < code.length; i += 60) {
      espace += code.slice(i, i + 60) + (i % 120 === 0 ? "\n" : "  ");
    }

    const resultat = interpreterTexteColle(espace);
    expect(resultat.ok).toBe(true);
    if (resultat.ok) {
      expect(resultat.brouillon).toEqual(b);
    }
  });
});

describe("codes invalides", () => {
  it("préfixe inconnu (HV9.xxx) → ok:false avec message français", () => {
    const resultat = interpreterTexteColle("HV9.xxxyyyzzz");
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.erreur).toEqual(expect.any(String));
      expect(resultat.erreur.length).toBeGreaterThan(0);
      // Message joueur, pas de stack technique.
      expect(resultat.erreur).not.toMatch(/at \S+ \(|\.ts:\d+|Error:/);
    }
  });

  it("code tronqué (30% coupé en fin) → ok:false, aucun throw", () => {
    const b = brouillonRealiste();
    const code = genererCodeReprise(b);
    const tronque = code.slice(0, Math.floor(code.length * 0.7));

    expect(() => interpreterTexteColle(tronque)).not.toThrow();
    const resultat = interpreterTexteColle(tronque);
    expect(resultat.ok).toBe(false);
  });
});

describe("migration v1 → v2 à l'import", () => {
  it("un brouillon v1 (sans instanceId) encodé dans un code → ok:true, chaque acquisition porte un instanceId", () => {
    // Fabrique un brouillon v1 « à la main » : forme AVANT l'identité d'instance.
    const b2 = brouillonRealiste();
    const v1 = {
      ...b2,
      schemaVersion: 1,
      acquisitions: {
        competences: b2.acquisitions.competences.map(({ instanceId, ...rest }) => rest),
        sorts: b2.acquisitions.sorts.map(({ instanceId, ...rest }) => rest),
        prieres: [],
        pieges: [],
        recettes: [],
        assemblages: [],
      },
    };

    const compresse = deflateSync(strToU8(JSON.stringify(v1)));
    const code = PREFIXE_CODE + btoa(String.fromCharCode(...compresse));

    const resultat = interpreterTexteColle(code);
    expect(resultat.ok).toBe(true);
    if (resultat.ok) {
      expect(resultat.brouillon.schemaVersion).toBe(2);
      expect(resultat.brouillon.acquisitions.competences).toHaveLength(1);
      expect(resultat.brouillon.acquisitions.competences[0].instanceId).toEqual(expect.any(String));
      expect(resultat.brouillon.acquisitions.sorts).toHaveLength(1);
      expect(resultat.brouillon.acquisitions.sorts[0].instanceId).toEqual(expect.any(String));
    }
  });
});

describe("JSON brut collé (contenu d'un fichier .json)", () => {
  it("un JSON brut (commence par '{') → ok:true", () => {
    const b = brouillonRealiste();
    const json = JSON.stringify(b, null, 2);

    const resultat = interpreterTexteColle(json);
    expect(resultat.ok).toBe(true);
    if (resultat.ok) {
      expect(resultat.brouillon).toEqual(b);
    }
  });

  it("un JSON brut précédé d'espaces/retours à la ligne → ok:true", () => {
    const b = brouillonRealiste();
    const json = `\n  \n${JSON.stringify(b)}\n`;

    const resultat = interpreterTexteColle(json);
    expect(resultat.ok).toBe(true);
  });
});

describe("garde-fou de poids", () => {
  it("brouillon saturé (~35 compétences, 25 sorts, 25 prières, 10 pièges, 20 recettes, 15 assemblages, historique 3000 car.) → code < 20 000 caractères", () => {
    const b = creerBrouillonVide();
    b.etape1.nom = "Personnage Test Saturé";
    b.etape1.historique = "x".repeat(3000);
    b.etape2.raceId = idRace("Humain");
    b.etape4.classeId = idClasse("Guerrier");

    for (let i = 0; i < 35; i++) {
      b.acquisitions.competences.push({
        instanceId: crypto.randomUUID(),
        competenceId: `competence-${i}`,
        niveauAcquis: (i % 5) + 1,
        choixAchat: i % 3 === 0 ? `choix-${i}` : null,
      });
    }
    for (let i = 0; i < 25; i++) {
      b.acquisitions.sorts.push({
        instanceId: crypto.randomUUID(),
        sortId: `sort-${i}`,
        niveauSort: (i % 5) + 1,
        zoneChoisie: "unique",
        porteeChoisie: "contact",
        dureeChoisie: "instantanee",
        nomPersonnalise: `Sort personnalisé numéro ${i}`,
      });
    }
    for (let i = 0; i < 25; i++) {
      b.acquisitions.prieres.push({
        instanceId: crypto.randomUUID(),
        priereId: `priere-${i}`,
        niveauPriere: (i % 5) + 1,
        zoneChoisie: "unique",
        porteeChoisie: "contact",
        dureeChoisie: "instantanee",
      });
    }
    for (let i = 0; i < 10; i++) {
      b.acquisitions.pieges.push({ instanceId: crypto.randomUUID(), piegeId: `piege-${i}` });
    }
    for (let i = 0; i < 20; i++) {
      b.acquisitions.recettes.push({ instanceId: crypto.randomUUID(), recetteId: `recette-${i}` });
    }
    for (let i = 0; i < 15; i++) {
      b.acquisitions.assemblages.push({ instanceId: crypto.randomUUID(), assemblageId: `assemblage-${i}` });
    }

    const code = genererCodeReprise(b);
    expect(code.length).toBeLessThan(20_000);

    // Et le code généré reste importable.
    const resultat = interpreterTexteColle(code);
    expect(resultat.ok).toBe(true);
  });
});

describe("interpreterBrouillonBrut — non-régression de chargerBrouillon", () => {
  it("schemaVersion inconnu → null (jeté, pas de crash)", () => {
    const b = creerBrouillonVide();
    expect(interpreterBrouillonBrut({ ...b, schemaVersion: 999 })).toBeNull();
  });

  it("valeur non-objet → null", () => {
    expect(interpreterBrouillonBrut(null)).toBeNull();
    expect(interpreterBrouillonBrut("pas un objet")).toBeNull();
    expect(interpreterBrouillonBrut(42)).toBeNull();
  });

  it("brouillon v1 (sans instanceId) → migré vers v2 avec instanceId par acquisition", () => {
    const b2 = brouillonRealiste();
    const v1 = {
      ...b2,
      schemaVersion: 1,
      acquisitions: {
        competences: b2.acquisitions.competences.map(({ instanceId, ...rest }) => rest),
        sorts: [],
        prieres: [],
        pieges: [],
        recettes: [],
        assemblages: [],
      },
    };

    const migre = interpreterBrouillonBrut(v1);
    expect(migre).not.toBeNull();
    expect(migre!.schemaVersion).toBe(2);
    expect(migre!.acquisitions.competences[0].instanceId).toEqual(expect.any(String));
  });

  it("brouillon v2 valide → renvoyé tel quel", () => {
    const b = brouillonRealiste();
    expect(interpreterBrouillonBrut(b)).toEqual(b);
  });
});
