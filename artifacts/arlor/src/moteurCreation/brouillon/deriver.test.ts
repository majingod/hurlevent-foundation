/**
 * Tests de dérivation du brouillon visiteur — propriétés reines.
 * S'appuient EXCLUSIVEMENT sur le snapshot bundlé (aucun id / coût inventé).
 */

import { describe, it, expect } from "vitest";
import { getSnapshot } from "../snapshot";
import { peutAcheterCompetence } from "../gatesCompetences";
import { creerBrouillonVide } from "./types";
import type { BrouillonVisiteur } from "./types";
import { deriverEtat } from "./deriver";
import {
  appliquerAchatCompetence,
  retirerCompetence,
  changerClasse,
  appliquerEtape2,
} from "./appliquer";

const snapshot = getSnapshot();

function classe(nom: string) {
  const c = snapshot.tables.classes.find((x) => x.nom === nom);
  if (!c) throw new Error(`classe « ${nom} » absente du snapshot`);
  return c;
}

function idsGratuits(nom: string): string[] {
  return (
    (classe(nom).competences_gratuites as Array<{ competence_id: string }>) ?? []
  ).map((g) => g.competence_id);
}

/** Compétences générales « simple » sans choix, coût niveau 1 > 0, hors gratuités. */
function competencesPayantes(exclureClasse: string, n: number) {
  const grat = new Set(idsGratuits(exclureClasse));
  const dispo = snapshot.tables.competences.filter((c) => {
    const niveaux = c.niveaux as Array<{ niveau: number; cout_xp: number }> | null;
    return (
      c.est_actif &&
      c.est_general &&
      c.type_achat === "simple" &&
      c.type_choix == null &&
      !grat.has(c.id) &&
      Array.isArray(niveaux) &&
      niveaux.some((x) => x.niveau === 1 && x.cout_xp > 0)
    );
  });
  if (dispo.length < n) throw new Error("pas assez de compétences payantes");
  return dispo.slice(0, n);
}

function coutNiveau1(competenceId: string): number {
  const c = snapshot.tables.competences.find((x) => x.id === competenceId)!;
  const niveaux = c.niveaux as Array<{ niveau: number; cout_xp: number }>;
  return niveaux.find((n) => n.niveau === 1)!.cout_xp;
}

/** Race la plus riche en xp_depart pour couvrir le coût des achats de test. */
function raceRiche() {
  return [...snapshot.tables.races].sort(
    (a, b) => (b.xp_depart ?? 0) - (a.xp_depart ?? 0)
  )[0];
}

function brouillonBase(classeNom: string): BrouillonVisiteur {
  let b = creerBrouillonVide();
  b = appliquerEtape2(b, { raceId: raceRiche().id });
  b = changerClasse(b, classe(classeNom).id);
  return b;
}

// ============================================================
// 1. Recompute from scratch (propriété reine)
// ============================================================

describe("recompute from scratch", () => {
  it("acheter A,B,C puis retirer B ≡ acheter A puis C", () => {
    const [a, bComp, c] = competencesPayantes("Guerrier", 3);
    const base = brouillonBase("Guerrier");

    let abc = appliquerAchatCompetence(base, {
      competenceId: a.id,
      niveauDesire: 1,
      choixAchat: null,
    });
    abc = appliquerAchatCompetence(abc, {
      competenceId: bComp.id,
      niveauDesire: 1,
      choixAchat: null,
    });
    abc = appliquerAchatCompetence(abc, {
      competenceId: c.id,
      niveauDesire: 1,
      choixAchat: null,
    });
    // Identité d'instance : on retire LA ligne B par son instanceId (posé à l'achat).
    const instanceB = abc.acquisitions.competences.find(
      (c) => c.competenceId === bComp.id,
    )!.instanceId;
    const abcSansB = retirerCompetence(abc, instanceB);

    let ac = appliquerAchatCompetence(base, {
      competenceId: a.id,
      niveauDesire: 1,
      choixAchat: null,
    });
    ac = appliquerAchatCompetence(ac, {
      competenceId: c.id,
      niveauDesire: 1,
      choixAchat: null,
    });

    // L'état DÉRIVÉ (contextes + scalaires) est strictement égal ; les métadonnées
    // (modifieLe…) ne participent pas à la dérivation.
    expect(deriverEtat(abcSansB)).toEqual(deriverEtat(ac));
  });
});

// ============================================================
// 2. Gratuités suivent la classe (données réelles du snapshot)
// ============================================================

describe("gratuités dérivées de la classe", () => {
  it("classe Guerrier → gratuités Guerrier ; changerClasse(Voleur) → bascule", () => {
    const bGuerrier = brouillonBase("Guerrier");
    const gratG = deriverEtat(bGuerrier).gratuites.map((g) => g.competenceId);
    for (const id of idsGratuits("Guerrier")) expect(gratG).toContain(id);

    const bVoleur = changerClasse(bGuerrier, classe("Voleur").id);
    const gratV = deriverEtat(bVoleur).gratuites.map((g) => g.competenceId);

    // Celles du Voleur présentes…
    for (const id of idsGratuits("Voleur")) expect(gratV).toContain(id);
    // …et aucune gratuité PROPRE au Guerrier ne subsiste.
    const propresGuerrier = idsGratuits("Guerrier").filter(
      (id) => !idsGratuits("Voleur").includes(id)
    );
    for (const id of propresGuerrier) expect(gratV).not.toContain(id);
  });
});

// ============================================================
// 3. Cohérence XP (coûts lus du snapshot, jamais en dur)
// ============================================================

describe("cohérence XP", () => {
  it("xpDispo = xpTotal − Σ coûts (compétences payantes)", () => {
    const [a, bComp] = competencesPayantes("Guerrier", 2);
    let b = brouillonBase("Guerrier");
    b = appliquerAchatCompetence(b, {
      competenceId: a.id,
      niveauDesire: 1,
      choixAchat: null,
    });
    b = appliquerAchatCompetence(b, {
      competenceId: bComp.id,
      niveauDesire: 1,
      choixAchat: null,
    });

    const d = deriverEtat(b);
    const coutAttendu = coutNiveau1(a.id) + coutNiveau1(bComp.id);

    expect(d.xpTotal).toBe(raceRiche().xp_depart ?? 0);
    expect(d.xpDepense).toBe(coutAttendu); // gratuités = coût 0
    expect(d.xpDispo).toBe(d.xpTotal - coutAttendu);
  });
});

// ============================================================
// 6. Compatibilité gates (shape des contextes)
// ============================================================

describe("compat gates", () => {
  it("peutAcheterCompetence accepte le contextePersonnage dérivé", () => {
    const [a] = competencesPayantes("Guerrier", 1);
    const d = deriverEtat(brouillonBase("Guerrier"));

    const verdict = peutAcheterCompetence(d.contextePersonnage, {
      competenceId: a.id,
      niveauDesire: 1,
      choixAchat: null,
    });

    expect(typeof verdict.peutAcheter).toBe("boolean");
    expect(typeof verdict.raison).toBe("string");
  });
});
