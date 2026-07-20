/**
 * Lecteur de la carte équipement (VIS-8 lot 0) — cœur pur + liaison snapshot.
 *
 * Les cas chiffrés reproduisent la carte réelle seedée en prod (migrations
 * 20260720225722/…738) et le scénario ATTESTÉ EN SQL le 2026-07-20 :
 * inventaire {fioles, contondante_courte} → Alchimie@1, Assommer@2, etc.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  exigencesCompetences,
  exigencesRaces,
  lireVariantes,
  niveauEntree,
  niveauEntreeCompetence,
  objetsGenerateur,
  raceAccessible,
  type ExigenceObjets,
} from "./exigences";

const CLE = "__SNAPSHOT_HORS_LIGNE__";

type GlobalOverridable = typeof globalThis & { [CLE]?: unknown };

afterEach(() => {
  delete (globalThis as GlobalOverridable)[CLE];
});

// --- cœur pur -----------------------------------------------------------

const ASSOMMER: ExigenceObjets = {
  libelleManque: "une arme contondante longue ou un bâton…",
  variantes: [
    { objets: ["contondante_longue"], niveau_min: 1 },
    { objets: ["baton_hast"], niveau_min: 1 },
    { objets: ["contondante_courte"], niveau_min: 2 },
    { objets: [], niveau_min: 3 },
  ],
};

describe("niveauEntree", () => {
  it("variante simple : satisfaite → son niveau, sinon null (grisée)", () => {
    const fioles: ExigenceObjets = {
      libelleManque: "des fioles",
      variantes: [{ objets: ["fioles"], niveau_min: 1 }],
    };
    expect(niveauEntree(fioles, new Set(["fioles"]))).toBe(1);
    expect(niveauEntree(fioles, new Set(["hache"]))).toBeNull();
  });

  it("OU entre variantes : un seul bouclier suffit", () => {
    const bouclier: ExigenceObjets = {
      libelleManque: "un bouclier, n'importe lequel",
      variantes: [
        { objets: ["targe"], niveau_min: 1 },
        { objets: ["ecu"], niveau_min: 1 },
        { objets: ["pavois"], niveau_min: 1 },
      ],
    };
    expect(niveauEntree(bouclier, new Set(["pavois"]))).toBe(1);
    expect(niveauEntree(bouclier, new Set(["fioles"]))).toBeNull();
  });

  it("ET dans une variante : le Drow exige oreilles + maquillage ENSEMBLE", () => {
    const drow: ExigenceObjets = {
      libelleManque: "un masque, ou des oreilles pointues avec un maquillage foncé",
      variantes: [
        { objets: ["masque"], niveau_min: 1 },
        { objets: ["oreilles_pointues", "maquillage_fonce"], niveau_min: 1 },
      ],
    };
    expect(niveauEntree(drow, new Set(["oreilles_pointues"]))).toBeNull();
    expect(niveauEntree(drow, new Set(["oreilles_pointues", "maquillage_fonce"]))).toBe(1);
    expect(niveauEntree(drow, new Set(["masque"]))).toBe(1);
  });

  it("mains nues (objets: []) : Assommer entre au 3 sans rien, au 2 avec matraque, au 1 avec massue ou bâton", () => {
    expect(niveauEntree(ASSOMMER, new Set())).toBe(3);
    expect(niveauEntree(ASSOMMER, new Set(["contondante_courte"]))).toBe(2);
    expect(niveauEntree(ASSOMMER, new Set(["contondante_longue"]))).toBe(1);
    // Décision s347 : le bâton (contondant, décision s339) ouvre Assommer au 1.
    expect(niveauEntree(ASSOMMER, new Set(["baton_hast"]))).toBe(1);
  });
});

describe("lireVariantes (jsonb défensif)", () => {
  it("ignore les entrées malformées, garde les valides", () => {
    const brut = [
      { objets: ["fioles"], niveau_min: 1 },
      { objets: "pas-un-tableau", niveau_min: 1 },
      { niveau_min: 2 },
      { objets: ["hache"] },
      null,
      { objets: [], niveau_min: 3 },
    ];
    expect(lireVariantes(brut)).toEqual([
      { objets: ["fioles"], niveau_min: 1 },
      { objets: [], niveau_min: 3 },
    ]);
  });

  it("non-tableau → []", () => {
    expect(lireVariantes(null)).toEqual([]);
    expect(lireVariantes({})).toEqual([]);
    expect(lireVariantes("x")).toEqual([]);
  });
});

// --- liaison snapshot ---------------------------------------------------

function snapshotFactice(tables: Record<string, unknown[]>) {
  return {
    manifest: {
      genere_le: "2026-07-20T00:00:00+00:00",
      comptes: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
    },
    tables,
  };
}

describe("liaison snapshot", () => {
  it("snapshot antérieur au lot 0 (clés absentes) → rien de grisé (dégradation douce)", () => {
    (globalThis as GlobalOverridable)[CLE] = snapshotFactice({ competences: [] });
    expect(exigencesCompetences().size).toBe(0);
    expect(exigencesRaces().size).toBe(0);
    expect(objetsGenerateur()).toEqual([]);
    expect(niveauEntreeCompetence("peu-importe", new Set())).toBe(1);
    expect(raceAccessible("peu-importe", new Set())).toBe(true);
  });

  it("snapshot avec carte → filtre appliqué (scénario attesté en prod)", () => {
    (globalThis as GlobalOverridable)[CLE] = snapshotFactice({
      objets_generateur: [
        { id: "fioles", libelle: "Fioles", groupe: "accessoires", ordre: 1, est_actif: true },
        { id: "contondante_courte", libelle: "Contondante courte", groupe: "armes", ordre: 6, est_actif: true },
        { id: "retire", libelle: "Retiré", groupe: "armes", ordre: 7, est_actif: false },
      ],
      objets_requis: [
        {
          id: "r1",
          competence_id: "c-alchimie",
          race_id: null,
          libelle_manque: "des fioles",
          variantes: [{ objets: ["fioles"], niveau_min: 1 }],
          commentaire: null,
        },
        {
          id: "r2",
          competence_id: "c-assommer",
          race_id: null,
          libelle_manque: "une arme contondante longue ou un bâton…",
          variantes: [
            { objets: ["contondante_longue"], niveau_min: 1 },
            { objets: ["baton_hast"], niveau_min: 1 },
            { objets: ["contondante_courte"], niveau_min: 2 },
            { objets: [], niveau_min: 3 },
          ],
          commentaire: null,
        },
        {
          id: "r3",
          competence_id: null,
          race_id: "race-drow",
          libelle_manque: "un masque, ou des oreilles pointues avec un maquillage foncé",
          variantes: [
            { objets: ["masque"], niveau_min: 1 },
            { objets: ["oreilles_pointues", "maquillage_fonce"], niveau_min: 1 },
          ],
          commentaire: null,
        },
      ],
    });

    const inv = new Set(["fioles", "contondante_courte"]);
    // Scénario attesté en SQL (2026-07-20) : Alchimie débloquée au 1,
    // Assommer entre au 2 (matraque), une compétence sans ligne reste au 1.
    expect(niveauEntreeCompetence("c-alchimie", inv)).toBe(1);
    expect(niveauEntreeCompetence("c-assommer", inv)).toBe(2);
    expect(niveauEntreeCompetence("c-sans-exigence", inv)).toBe(1);
    // Le Drow reste grisé : ni masque ni le duo oreilles+maquillage.
    expect(raceAccessible("race-drow", inv)).toBe(false);
    expect(exigencesRaces().get("race-drow")?.libelleManque).toContain("masque");
    // objetsGenerateur : filtre est_actif + tri groupe (armes avant accessoires).
    expect(objetsGenerateur().map((o) => o.id)).toEqual(["contondante_courte", "fioles"]);
  });
});
