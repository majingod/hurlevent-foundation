/**
 * [VIS-8 PR-B s365] Tests de `convertirTirageEnBrouillon` — mapping pur.
 *
 * Style : tirages/compositions FABRIQUÉS chirurgicalement (le bout-en-bout sur
 * de VRAIS tirages seedés vit dans `appliquerComposition.test.ts`, qui monte
 * déjà les fixtures du résolveur). Les ids attendus des gratuites à choix ne
 * sont JAMAIS codés en dur : ils sont RETROUVÉS dans le snapshot par
 * `type_choix` — exactement le chemin du convertisseur, mais depuis la classe,
 * pour que le test rougisse si l'un des deux se trompe de compétence.
 *
 * Preuves par le contraire (s355) : prêtre sans religion, classe inconnue,
 * zéro langue ancienne → `ErreurConversionTirage`, jamais un brouillon amputé.
 */

import { describe, expect, it } from "vitest";

import type { Classe } from "../snapshot";
import { getSnapshot } from "../snapshot";
import type { Alea, TiragePersonnage } from "./resoudre";
import type { AchatMagiePlanifie, AchatPlanifie, CompositionOk } from "./types";
import {
  convertirTirageEnBrouillon,
  ErreurConversionTirage,
} from "./versBrouillon";

/* ------------------------------------------------------------------ */
/* Fabricants minimaux + repères snapshot                              */
/* ------------------------------------------------------------------ */

const snap = getSnapshot();

const classeParNom = (nom: string): Classe => {
  const c = snap.tables.classes.find((x) => x.nom === nom);
  if (!c) throw new Error(`classe introuvable au snapshot : ${nom}`);
  return c;
};

/** La gratuite à `type_choix` donné d'une classe — retrouvée, jamais en dur. */
const gratuiteAChoix = (classe: Classe, typeChoix: string) => {
  const gratuites =
    (classe.competences_gratuites as Array<{ competence_id?: string }> | null) ?? [];
  const parId = new Map(snap.tables.competences.map((c) => [c.id, c]));
  const comp = gratuites
    .map((g) => (g.competence_id ? parId.get(g.competence_id) : undefined))
    .find((c) => c?.type_choix === typeChoix);
  if (!comp) throw new Error(`aucune gratuite ${typeChoix} pour ${classe.nom}`);
  return comp;
};

/** Les langues anciennes actives, triées par id — l'ordre du convertisseur. */
const languesAnciennesTriees = snap.tables.langues
  .filter((l) => l.est_ancienne === true && l.est_actif === true)
  .map((l) => l.id)
  .sort((a, b) => a.localeCompare(b));

const tirage = (
  sur: Partial<TiragePersonnage> & Pick<TiragePersonnage, "classe">,
): TiragePersonnage => ({
  raceId: "race-test",
  raceNom: "Race de test",
  budget: 60,
  roleId: "rTest",
  inapteMagie: false,
  traitsIncompatibles: [],
  ...sur,
});

const compo = (sur: Partial<CompositionOk> = {}): CompositionOk => ({
  ok: true,
  gratuites: [],
  achats: [],
  achatsMagie: [],
  budget: 60,
  totalDepense: 0,
  reliquat: 60,
  alertes: [],
  ...sur,
});

const achat = (
  competenceId: string,
  niveau: number,
  choix?: string,
): AchatPlanifie => ({
  competenceId,
  nom: "Compétence de test",
  niveau,
  coutXp: 2,
  couche: 2,
  motif: "test",
  ...(choix !== undefined ? { choix } : {}),
});

const magie = (
  type: AchatMagiePlanifie["type"],
  modeleId: string,
  config: Partial<AchatMagiePlanifie["config"]> = {},
): AchatMagiePlanifie => ({
  type,
  modeleId,
  nom: "Magie de test",
  config: {
    niveau: 1,
    zone: "1 Cible",
    portee: "Toucher",
    duree: "1 Minute",
    ...config,
  },
  coutXp: 3,
  coutPS: 2,
  couche: 2,
  motif: "test",
});

/** Aléa constant — le convertisseur ne consomme l'aléa QUE pour la langue. */
const aleaFixe =
  (v: number): Alea =>
  () =>
    v;

/* ------------------------------------------------------------------ */
/* Identité vierge + squelette                                         */
/* ------------------------------------------------------------------ */

describe("convertirTirageEnBrouillon — identité et squelette", () => {
  it("guerrier : identité VIERGE (le joueur nomme au wizard), étape courante 1", () => {
    const b = convertirTirageEnBrouillon(
      snap,
      { tirage: tirage({ classe: "guerrier" }), composition: compo() },
      aleaFixe(0),
    );
    expect(b.schemaVersion).toBe(2);
    expect(b.meta.etapeCourante).toBe(1);
    expect(b.meta.snapshotGenereLe).toBe(snap.manifest.genere_le);
    expect(b.etape1).toEqual({
      nom: "",
      gnCompletes: 0,
      miniGnCompletes: 0,
      ouverturesTerrain: 0,
      estCroyant: false,
      religionId: null,
    });
    expect(b.etape2.raceId).toBe("race-test");
    expect(b.etape2.sousTypeChimeride).toBeUndefined();
    expect(b.etape3.traitsRaciauxChoisis).toEqual([]);
    expect(b.etape4.classeId).toBe(classeParNom("Guerrier").id);
    // Guerrier : aucune gratuite à type_choix → pas de map du tout.
    expect(b.etape4.choixParCompetence).toBeUndefined();
    expect(b.acquisitions.pieges).toEqual([]);
    expect(b.acquisitions.recettes).toEqual([]);
    expect(b.acquisitions.assemblages).toEqual([]);
  });

  it("mappe le ClasseId moteur (sans accent) vers l'uuid du snapshot (avec accent)", () => {
    const b = convertirTirageEnBrouillon(
      snap,
      { tirage: tirage({ classe: "pretre", religionId: "rel-1" }), composition: compo() },
      aleaFixe(0),
    );
    expect(b.etape4.classeId).toBe(classeParNom("Prêtre").id);
  });
});

/* ------------------------------------------------------------------ */
/* Achats — granularité mesurée à la sonde                             */
/* ------------------------------------------------------------------ */

describe("convertirTirageEnBrouillon — achats", () => {
  it("UNE ligne par NIVEAU : « Mineur 1 » + « Mineur 2 » = 2 lignes distinctes", () => {
    const b = convertirTirageEnBrouillon(
      snap,
      {
        tirage: tirage({ classe: "guerrier" }),
        composition: compo({
          achats: [achat("comp-A", 1), achat("comp-A", 2), achat("comp-B", 1)],
        }),
      },
      aleaFixe(0),
    );
    expect(b.acquisitions.competences).toHaveLength(3);
    expect(
      b.acquisitions.competences.map((c) => [c.competenceId, c.niveauAcquis]),
    ).toEqual([
      ["comp-A", 1],
      ["comp-A", 2],
      ["comp-B", 1],
    ]);
    const ids = new Set(b.acquisitions.competences.map((c) => c.instanceId));
    expect(ids.size).toBe(3);
  });

  it("jauge répétée : 8 achats de la MÊME compétence au MÊME niveau → 8 lignes, 8 identités", () => {
    const b = convertirTirageEnBrouillon(
      snap,
      {
        tirage: tirage({ classe: "pretre", religionId: "rel-1" }),
        composition: compo({
          achats: Array.from({ length: 8 }, () => achat("dev-spirituel", 1)),
        }),
      },
      aleaFixe(0),
    );
    expect(b.acquisitions.competences).toHaveLength(8);
    expect(
      new Set(b.acquisitions.competences.map((c) => c.instanceId)).size,
    ).toBe(8);
    expect(
      b.acquisitions.competences.every(
        (c) => c.competenceId === "dev-spirituel" && c.niveauAcquis === 1,
      ),
    ).toBe(true);
  });

  it("le choix du cercle/domaine voyage VERBATIM ; sans choix → null", () => {
    const b = convertirTirageEnBrouillon(
      snap,
      {
        tirage: tirage({ classe: "pretre", religionId: "rel-1" }),
        composition: compo({
          achats: [achat("acq-domaine", 1, "Ordre"), achat("comp-B", 1)],
        }),
      },
      aleaFixe(0),
    );
    expect(b.acquisitions.competences[0].choixAchat).toBe("Ordre");
    expect(b.acquisitions.competences[1].choixAchat).toBeNull();
  });

  it("achatsMagie (tableau SÉPARÉ — piège s363) se ventile sorts/prières, config verbatim", () => {
    const b = convertirTirageEnBrouillon(
      snap,
      {
        tirage: tirage({ classe: "pretre", religionId: "rel-1" }),
        composition: compo({
          achatsMagie: [
            magie("sort", "sort-1", { zone: "Zone", portee: "10 Pieds", duree: "Instantanée" }),
            magie("priere", "priere-1"),
          ],
        }),
      },
      aleaFixe(0),
    );
    expect(b.acquisitions.sorts).toHaveLength(1);
    expect(b.acquisitions.sorts[0]).toMatchObject({
      sortId: "sort-1",
      niveauSort: 1,
      zoneChoisie: "Zone",
      porteeChoisie: "10 Pieds",
      dureeChoisie: "Instantanée",
    });
    expect(b.acquisitions.prieres).toHaveLength(1);
    expect(b.acquisitions.prieres[0]).toMatchObject({
      priereId: "priere-1",
      niveauPriere: 1,
      zoneChoisie: "1 Cible",
      porteeChoisie: "Toucher",
      dureeChoisie: "1 Minute",
    });
  });
});

/* ------------------------------------------------------------------ */
/* Décision 32 — les deux gratuites à choix                            */
/* ------------------------------------------------------------------ */

describe("convertirTirageEnBrouillon — décision 32 (gratuites à choix)", () => {
  it("prêtre : la religion TIRÉE est gravée sur la gratuite `religion` + étape 1 croyante", () => {
    const b = convertirTirageEnBrouillon(
      snap,
      {
        tirage: tirage({ classe: "pretre", religionId: "religion-tiree" }),
        composition: compo(),
      },
      aleaFixe(0),
    );
    const connReligions = gratuiteAChoix(classeParNom("Prêtre"), "religion");
    expect(b.etape4.choixParCompetence).toEqual({
      [connReligions.id]: "religion-tiree",
    });
    expect(b.etape1.estCroyant).toBe(true);
    expect(b.etape1.religionId).toBe("religion-tiree");
  });

  it("mage : une langue ancienne ACTIVE, uniforme sur l'aléa injecté (bornes 0 et ~1)", () => {
    const decryptage = gratuiteAChoix(classeParNom("Mage"), "langue_ancienne");
    const premiere = convertirTirageEnBrouillon(
      snap,
      { tirage: tirage({ classe: "mage" }), composition: compo() },
      aleaFixe(0),
    );
    const derniere = convertirTirageEnBrouillon(
      snap,
      { tirage: tirage({ classe: "mage" }), composition: compo() },
      aleaFixe(0.999999),
    );
    expect(premiere.etape4.choixParCompetence?.[decryptage.id]).toBe(
      languesAnciennesTriees[0],
    );
    expect(derniere.etape4.choixParCompetence?.[decryptage.id]).toBe(
      languesAnciennesTriees[languesAnciennesTriees.length - 1],
    );
    // Appartenance : toute valeur tirée est l'une des langues anciennes actives.
    for (const v of Object.values(premiere.etape4.choixParCompetence ?? {})) {
      expect(languesAnciennesTriees).toContain(v);
    }
    // Le mage n'est PAS croyant d'office : pas de religion au tirage.
    expect(premiere.etape1.estCroyant).toBe(false);
    expect(premiere.etape1.religionId).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Preuves par le contraire — échec BRUYANT, jamais un brouillon amputé */
/* ------------------------------------------------------------------ */

describe("convertirTirageEnBrouillon — échecs bruyants", () => {
  it("prêtre SANS religion au tirage → ErreurConversionTirage", () => {
    expect(() =>
      convertirTirageEnBrouillon(
        snap,
        { tirage: tirage({ classe: "pretre" }), composition: compo() },
        aleaFixe(0),
      ),
    ).toThrowError(ErreurConversionTirage);
  });

  it("classe inconnue du snapshot → ErreurConversionTirage", () => {
    expect(() =>
      convertirTirageEnBrouillon(
        snap,
        {
          tirage: tirage({
            classe: "paladin" as TiragePersonnage["classe"],
          }),
          composition: compo(),
        },
        aleaFixe(0),
      ),
    ).toThrowError(ErreurConversionTirage);
  });

  it("zéro langue ancienne active → ErreurConversionTirage (mage)", () => {
    const sansLangues = {
      ...snap,
      tables: { ...snap.tables, langues: [] },
    };
    expect(() =>
      convertirTirageEnBrouillon(
        sansLangues,
        { tirage: tirage({ classe: "mage" }), composition: compo() },
        aleaFixe(0),
      ),
    ).toThrowError(ErreurConversionTirage);
  });
});
