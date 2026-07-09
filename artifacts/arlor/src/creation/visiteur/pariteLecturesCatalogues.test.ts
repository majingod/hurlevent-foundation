/**
 * Parité visiteur — LECTURES CATALOGUE (verrouillage de régression).
 *
 * Chaque `lire*` catalogue du client visiteur doit reproduire fidèlement le
 * contrat de son SELECT serveur : même FILTRE (`est_actif`, bornes…), même
 * TRI (`.order(col)` ≈ `localeCompare("fr")` / numérique) et, pour les lectures
 * projetées, le même JEU DE COLONNES. On l'atteste contre le snapshot embarqué
 * (source de vérité offline), sans réseau.
 *
 * Périmètre : uniquement les lectures marquées FIDÈLES (`✅`) dans
 * docs/PARITE_VISITEUR_AUDIT_s311.md. Les lectures divergentes (`⚠️`/`💥`)
 * sont EXCLUES : les tester verrouillerait la divergence (cf. avertissement de
 * l'audit). Les `💥` de l'audit sont par ailleurs déjà corrigés + couverts par
 * lot2Lectures.test.ts (Lots B/C/D) et par le port XP (calculerXp / rabais).
 *
 * Le comparateur `cmp`/`trierPar` est RÉPLIQUÉ ici (pas importé) pour que le
 * contrôle d'ordre reste indépendant de l'implémentation du client.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { clientVisiteur } from "./clientVisiteur";
import { getSnapshot } from "@/moteurCreation/snapshot";

// ── localStorage stub (config vitest = node) — les lectures catalogue n'y
//    touchent pas, mais on l'installe par prudence (parité avec les autres suites).
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
beforeEach(() => installerLocalStorage());

// ── snapshot + comparateur répliqué (miroir de clientVisiteur.cmp/trierPar) ──
type Row = Record<string, unknown>;
const T = getSnapshot().tables as unknown as Record<string, Row[]>;

function cmp(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), "fr");
}
function trierPar<X>(rows: X[], ...cles: Array<(r: X) => unknown>): X[] {
  return [...rows].sort((x, y) => {
    for (const cle of cles) {
      const d = cmp(cle(x), cle(y));
      if (d !== 0) return d;
    }
    return 0;
  });
}

const ids = (rows: Row[]): unknown[] => rows.map((r) => r.id);

/**
 * Attend que `data` = `T[table]` filtré par `pred` puis trié par `cles`
 * (mêmes id, même ordre). Vérifie aussi la non-vacuité (sinon le cas ne prouve rien).
 */
function attendreParite(
  data: unknown,
  table: string,
  pred: (r: Row) => boolean,
  cles: Array<(r: Row) => unknown>,
): void {
  const attendu = trierPar((T[table] ?? []).filter(pred), ...cles);
  expect(Array.isArray(data)).toBe(true);
  const recu = data as Row[];
  expect(attendu.length).toBeGreaterThan(0); // garde anti-vacuité
  expect(recu.length).toBe(attendu.length); // complétude
  expect(ids(recu)).toEqual(ids(attendu)); // mêmes lignes, même ordre
}

/** Jeu de colonnes exact de la 1re ligne (toutes les lignes ont la même forme). */
function attendreProjection(data: unknown, colonnes: string[]): void {
  const recu = data as Row[];
  expect(recu.length).toBeGreaterThan(0);
  expect(Object.keys(recu[0]).sort()).toEqual([...colonnes].sort());
}

// ── args réels tirés du snapshot ──
const CERCLE = "Protection"; // sorts niv 1..6
const DOMAINE = "Chaos"; // prières niv 1..
const NIV_BORNE = 3; // borne .lte non triviale (des sorts/prières > 3 existent)

// ============================================================
// Table — lectures catalogue à contrat uniforme (filtre + tri [+ projection])
// ============================================================
interface Cas {
  nom: string;
  lire: () => Promise<{ data: unknown; error: unknown }>;
  table: string;
  pred: (r: Row) => boolean;
  cles: Array<(r: Row) => unknown>;
  projection?: string[];
}

const A = (r: Row) => r.est_actif === true;

const CATALOGUES: Cas[] = [
  {
    nom: "lireCompetences (est_actif, tri nom)",
    lire: () => clientVisiteur.lireCompetences(),
    table: "competences",
    pred: A,
    cles: [(r) => r.nom],
  },
  {
    nom: "lireReligions (est_actif, tri nom)",
    lire: () => clientVisiteur.lireReligions(),
    table: "religions",
    pred: A,
    cles: [(r) => r.nom],
  },
  {
    nom: "lirePieges (est_actif, tri nom puis niveau)",
    lire: () => clientVisiteur.lirePieges(),
    table: "pieges",
    pred: A,
    cles: [(r) => r.nom, (r) => r.niveau],
  },
  {
    nom: "lireObjetsJoaillerie (est_actif, tri temps puis nom)",
    lire: () => clientVisiteur.lireObjetsJoaillerie(),
    table: "objets_joaillerie",
    pred: A,
    cles: [(r) => r.temps_fabrication_minutes, (r) => r.nom],
  },
  {
    nom: "lireAssemblagesRunes (est_actif, tri nom)",
    lire: () => clientVisiteur.lireAssemblagesRunes(),
    table: "assemblages_runes",
    pred: A,
    cles: [(r) => r.nom],
  },
  {
    nom: "lireClasses (est_actif, tri nom)",
    lire: () => clientVisiteur.lireClasses(),
    table: "classes",
    pred: A,
    cles: [(r) => r.nom],
  },
  {
    // lireRaces : filtre + tri FIDÈLES ; la projection (ligne snapshot complète)
    // est un ⚠️ documenté (colonnes en trop, appelant tolérant) → non verrouillée.
    nom: "lireRaces (est_actif && est_jouable, tri nom)",
    lire: () => clientVisiteur.lireRaces(),
    table: "races",
    pred: (r) => r.est_actif === true && r.est_jouable === true,
    cles: [(r) => r.nom],
  },
  {
    nom: "lireRecettesAlchimie(3) (est_actif && niveau_requis<=3, tri niveau_requis puis nom)",
    lire: () => clientVisiteur.lireRecettesAlchimie(NIV_BORNE),
    table: "recettes_alchimie",
    pred: (r) => r.est_actif === true && (r.niveau_requis as number) <= NIV_BORNE,
    cles: [(r) => r.niveau_requis, (r) => r.nom],
  },
  {
    nom: "lireSorts(Protection,3) (cercle && niveau<=3 && est_actif, tri nom)",
    lire: () => clientVisiteur.lireSorts(CERCLE, NIV_BORNE),
    table: "sorts",
    pred: (r) =>
      r.cercle === CERCLE && (r.niveau as number) <= NIV_BORNE && r.est_actif === true,
    cles: [(r) => r.nom],
  },
  {
    nom: "lirePrieres(Chaos,3) (domaine && niveau<=3 && est_actif, tri nom)",
    lire: () => clientVisiteur.lirePrieres(DOMAINE, NIV_BORNE),
    table: "prieres",
    pred: (r) =>
      r.domaine === DOMAINE && (r.niveau as number) <= NIV_BORNE && r.est_actif === true,
    cles: [(r) => r.nom],
  },
  // — projections —
  {
    nom: "lireReligionsCatalogue (est_actif, tri nom, 13 colonnes)",
    lire: () => clientVisiteur.lireReligionsCatalogue(),
    table: "religions",
    pred: A,
    cles: [(r) => r.nom],
    projection: [
      "id", "nom", "description", "dirigeant", "fondateur", "symbole_sacre",
      "pouvoir_symbole", "domaines_principaux", "domaines_proscrits", "lore_fiche",
      "rituels_fiche", "lore_manuel", "rituels_manuel",
    ],
  },
  {
    nom: "lireReligionsFiches (est_actif, ordre snapshot, 12 colonnes)",
    lire: () => clientVisiteur.lireReligionsFiches(),
    table: "religions",
    pred: A,
    cles: [], // aucun contrat d'ordre côté serveur
    projection: [
      "id", "nom", "dirigeant", "fondateur", "symbole_sacre", "pouvoir_symbole",
      "domaines_principaux", "domaines_proscrits", "lore_fiche", "rituels_fiche",
      "lore_manuel", "rituels_manuel",
    ],
  },
  {
    nom: "lireLangues (est_actif, tri ordre, projection {id,nom,est_ancienne})",
    lire: () => clientVisiteur.lireLangues(),
    table: "langues",
    pred: A,
    cles: [(r) => r.ordre],
    projection: ["id", "nom", "est_ancienne"],
  },
  {
    nom: "lireLanguesAnciennes (est_ancienne && est_actif, tri ordre puis nom, projection {id,nom,ordre})",
    lire: () => clientVisiteur.lireLanguesAnciennes(),
    table: "langues",
    pred: (r) => r.est_ancienne === true && r.est_actif === true,
    cles: [(r) => r.ordre, (r) => r.nom],
    projection: ["id", "nom", "ordre"],
  },
  {
    nom: "lireCategoriesCreatures (est_actif, tri ordre, projection {id,nom,ordre})",
    lire: () => clientVisiteur.lireCategoriesCreatures(),
    table: "categories_creatures",
    pred: A,
    cles: [(r) => r.ordre],
    projection: ["id", "nom", "ordre"],
  },
  {
    nom: "lireFamillesCriminelles (est_actif, tri nom, projection {id,nom})",
    lire: () => clientVisiteur.lireFamillesCriminelles(),
    table: "familles_criminelles",
    pred: A,
    cles: [(r) => r.nom],
    projection: ["id", "nom"],
  },
];

describe("Parité lectures catalogue — filtre + tri + projection", () => {
  for (const cas of CATALOGUES) {
    it(cas.nom, async () => {
      const { data, error } = await cas.lire();
      expect(error).toBeNull();
      attendreParite(data, cas.table, cas.pred, cas.cles);
      if (cas.projection) attendreProjection(data, cas.projection);
    });
  }
});

// ============================================================
// Bornes .lte réellement excluantes (sinon le filtre niveau serait vacant)
// ============================================================
describe("Parité lectures catalogue — bornes de niveau", () => {
  it("lireSorts : la borne .lte exclut bien les niveaux supérieurs", async () => {
    // précondition : au moins un sort actif du cercle dépasse la borne.
    expect(
      (T.sorts ?? []).some(
        (s) => s.cercle === CERCLE && s.est_actif === true && (s.niveau as number) > NIV_BORNE,
      ),
    ).toBe(true);
    const { data } = await clientVisiteur.lireSorts(CERCLE, NIV_BORNE);
    expect((data as Row[]).every((s) => (s.niveau as number) <= NIV_BORNE)).toBe(true);
  });

  it("lirePrieres : la borne .lte exclut bien les niveaux supérieurs", async () => {
    expect(
      (T.prieres ?? []).some(
        (p) => p.domaine === DOMAINE && p.est_actif === true && (p.niveau as number) > NIV_BORNE,
      ),
    ).toBe(true);
    const { data } = await clientVisiteur.lirePrieres(DOMAINE, NIV_BORNE);
    expect((data as Row[]).every((p) => (p.niveau as number) <= NIV_BORNE)).toBe(true);
  });
});

// ============================================================
// lireCompetencesParIds : filtre .in(id), sans tri, projection 5 colonnes
// ============================================================
describe("Parité lectures catalogue — lireCompetencesParIds", () => {
  it("renvoie exactement les ids demandés (ordre snapshot) et 5 colonnes", async () => {
    const idsDemandes = (T.competences ?? []).slice(0, 3).map((c) => c.id as string);
    const { data, error } = await clientVisiteur.lireCompetencesParIds(idsDemandes);
    expect(error).toBeNull();
    const attendu = (T.competences ?? []).filter((c) => idsDemandes.includes(c.id as string));
    expect(ids(data as Row[])).toEqual(ids(attendu)); // ordre snapshot préservé, pas de tri
    attendreProjection(data, ["id", "nom", "type_choix", "type_achat", "niveaux"]);
  });
});

// ============================================================
// Lectures unitaires (.single / .maybeSingle) : projection + erreur introuvable
// ============================================================
describe("Parité lectures catalogue — lectures unitaires", () => {
  it("lireRace : trouvé → {id,nom,restrictions_classes} ; inconnu → 'Race introuvable.'", async () => {
    const r = (T.races ?? [])[0];
    const ok = await clientVisiteur.lireRace(r.id as string);
    expect(ok.error).toBeNull();
    expect(Object.keys(ok.data as Row).sort()).toEqual(
      ["id", "nom", "restrictions_classes"].sort(),
    );
    const ko = await clientVisiteur.lireRace("00000000-0000-0000-0000-000000000000");
    expect(ko.data).toBeNull();
    expect((ko.error as { message: string }).message).toBe("Race introuvable.");
  });

  it("lireClasse : trouvé → {id,nom} ; inconnu → 'Classe introuvable.'", async () => {
    const c = (T.classes ?? [])[0];
    const ok = await clientVisiteur.lireClasse(c.id as string);
    expect(ok.error).toBeNull();
    expect(Object.keys(ok.data as Row).sort()).toEqual(["id", "nom"].sort());
    const ko = await clientVisiteur.lireClasse("00000000-0000-0000-0000-000000000000");
    expect(ko.data).toBeNull();
    expect((ko.error as { message: string }).message).toBe("Classe introuvable.");
  });

  it("lireReligionProscrits : trouvé → {domaines_proscrits} ; inconnu → 'Religion introuvable.'", async () => {
    const rel = (T.religions ?? [])[0];
    const ok = await clientVisiteur.lireReligionProscrits(rel.id as string);
    expect(ok.error).toBeNull();
    expect(Object.keys(ok.data as Row)).toEqual(["domaines_proscrits"]);
    const ko = await clientVisiteur.lireReligionProscrits(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(ko.data).toBeNull();
    expect((ko.error as { message: string }).message).toBe("Religion introuvable.");
  });

  it("lireParametresJeu : projection {lien_facebook,lien_discord,texte_envoi_photos_race}", async () => {
    const { data, error } = await clientVisiteur.lireParametresJeu();
    expect(error).toBeNull();
    expect(Object.keys(data as Row).sort()).toEqual(
      ["lien_facebook", "lien_discord", "texte_envoi_photos_race"].sort(),
    );
  });
});
