/**
 * HARNAIS DE PARITÉ « à travers clientVisiteur » (P2-a3-ii §D.1).
 *
 * Rejoue les fixtures de parité serveur (`moteurCreation/fixtures/parite*.json`)
 * NON PAS contre les gates directement (déjà fait par `moteurCreation/parite*.test`),
 * mais à travers le VRAI chemin public de `clientVisiteur` : on stube la dérivation
 * sur le contexte de chaque fixture (via la couture `creerClientVisiteur({ deriver })`),
 * on appelle la méthode guichet en forme RPC, et on vérifie que le message / code du
 * verdict serveur transite AU CARACTÈRE PRÈS dans la `Reponse.data` (enveloppe
 * `{succes, erreurs, avertissements, donnees}`).
 *
 * Pourquoi la couture : les fixtures fournissent des contextes de gate ARBITRAIRES
 * (xp_dispo, est_gratuit fixés) que `deriverEtat` — qui recompute from scratch depuis
 * des choix bruts — ne peut pas reproduire. Cf. l'en-tête de `clientVisiteur.ts`.
 *
 * Couverture : les 6 familles d'ACHAT qui ont une méthode guichet
 * (compétences 88 + sorts 59 + prières 33 + pièges 7 + recettes 13 + assemblages 10
 * = 210 verdicts). Les 18 traits raciaux n'ont PAS de RPC d'achat (ils passent par
 * `sauvegarder_etape_3`) : leur parité reste couverte par `pariteTraits.test.ts`.
 * Aucune fixture n'est modifiée.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  creerClientVisiteur,
  PERSONNAGE_LOCAL_ID,
} from "./clientVisiteur";
import { creerBrouillonVide } from "@/moteurCreation/brouillon/types";
import { sauverBrouillon } from "./stockageBrouillon";
import type { EtatDeriveVisiteur } from "@/moteurCreation/brouillon/deriver";
import type { AcquisCompetence } from "@/moteurCreation/types";

import compFx from "@/moteurCreation/fixtures/pariteCompetences.json";
import sortsFx from "@/moteurCreation/fixtures/pariteSorts.json";
import prieresFx from "@/moteurCreation/fixtures/paritePrieres.json";
import piegesFx from "@/moteurCreation/fixtures/paritePieges.json";
import recettesFx from "@/moteurCreation/fixtures/pariteRecettes.json";
import assemblagesFx from "@/moteurCreation/fixtures/pariteAssemblages.json";

// ── localStorage stub (config vitest = node), même pattern que stockageBrouillon.test ──
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

// ── Fabrique d'un EtatDeriveVisiteur neutre dont on surcharge un contexte ──
function etatBase(): EtatDeriveVisiteur {
  return {
    contextePersonnage: { classeNom: null, raceInapteMagie: false, xpDispo: 0, psMax: 0, competencesAcquises: [] },
    contexteMagie: { xpDispo: 0, competencesAcquises: [] },
    contextePiege: { xpDispo: 0, competencesAcquises: [], piegesAcquis: [] },
    contexteRecette: { xpDispo: 0, competencesAcquises: [], recettesAcquises: [] },
    contexteAssemblage: { xpDispo: 0, competencesAcquises: [], assemblagesAcquis: [] },
    xpTotal: 0,
    xpDepense: 0,
    xpDispo: 0,
    pvMax: 0,
    psMax: 0,
    raceInapteMagie: false,
    niveauxArtisanat: { niveauAlchimie: 0, niveauRunes: 0, niveauPieges: 0 },
    quotas: { piegesParNiveau: { 1: 0, 2: 0, 3: 0 }, recettesParPalier: { 1: 0, 2: 0, 3: 0 }, assemblagesTotal: 0 },
    gratuites: [],
  };
}

interface FxAcquis {
  competence_id: string;
  competence_nom: string;
  categorie: string | null;
  niveau_acquis: number;
  choix_achat: string | null;
}
function mapAcquis(a: FxAcquis[]): AcquisCompetence[] {
  return a.map((x) => ({
    competenceId: x.competence_id,
    competenceNom: x.competence_nom,
    categorie: x.categorie,
    niveauAcquis: x.niveau_acquis,
    choixAchat: x.choix_achat,
  }));
}

// Le stub renvoyé par la couture lit cette variable (mise à jour avant chaque appel).
let etatCourant: EtatDeriveVisiteur = etatBase();
const client = creerClientVisiteur({ deriver: () => etatCourant });

beforeEach(() => {
  installerLocalStorage();
  sauverBrouillon(creerBrouillonVide()); // brouillon présent (contenu ignoré par le stub)
  etatCourant = etatBase();
});

interface Env {
  succes: boolean;
  erreurs: Array<{ code?: string; message: string }>;
}

/** Vérifie que la Reponse porte le verdict serveur au caractère près. */
function attendreVerdict(
  data: unknown,
  verdict: { peut_acheter: boolean; raison: string; code?: string },
  dump: string,
): void {
  const env = data as Env;
  expect(env.succes, `succes\n${dump}`).toBe(verdict.peut_acheter);
  if (!verdict.peut_acheter) {
    expect(env.erreurs[0]?.message, `raison\n${dump}`).toBe(verdict.raison);
    if (verdict.code !== undefined) {
      expect(env.erreurs[0]?.code, `code\n${dump}`).toBe(verdict.code);
    }
  }
}

// ============================================================
// Compétences (88) → acheterCompetence
// ============================================================
describe("parité clientVisiteur — acheterCompetence (88)", () => {
  const data = compFx as unknown as {
    contextes: Array<{ ref: number; classe_nom: never; race_inapte_magie: boolean; xp_dispo: number; ps_max: number; competences_acquises: FxAcquis[] }>;
    cas: Array<{ ctx: number; demande: { competence_id: string; niveau_desire: number; choix_achat: string | null; competence_nom: string }; verdict: { peut_acheter: boolean; raison: string; code?: string } }>;
  };
  const parRef = new Map(data.contextes.map((c) => [c.ref, c]));

  data.cas.forEach((cas, i) => {
    it(`#${i + 1} « ${cas.demande.competence_nom} » niv ${cas.demande.niveau_desire}`, async () => {
      const ctx = parRef.get(cas.ctx)!;
      etatCourant = etatBase();
      etatCourant.contextePersonnage = {
        classeNom: ctx.classe_nom,
        raceInapteMagie: ctx.race_inapte_magie,
        xpDispo: ctx.xp_dispo,
        psMax: ctx.ps_max,
        competencesAcquises: mapAcquis(ctx.competences_acquises),
      };
      const res = await client.acheterCompetence({
        p_personnage_id: PERSONNAGE_LOCAL_ID,
        p_competence_id: cas.demande.competence_id,
        p_niveau_desire: cas.demande.niveau_desire,
        p_choix_achat: cas.demande.choix_achat ?? undefined,
      });
      attendreVerdict(res.data, cas.verdict, JSON.stringify({ cas, verdict: cas.verdict }, null, 2));
    });
  });
});

// ============================================================
// Sorts (59) → acheterSort
// ============================================================
describe("parité clientVisiteur — acheterSort (59)", () => {
  const data = sortsFx as unknown as {
    contextes: Array<{ ref: number; xp_dispo: number; competences_acquises: FxAcquis[] }>;
    cas: Array<{ ctx: number; demande: { sort_id: string; sort_nom: string; niveau_sort: number; zone_choisie: string; portee_choisie: string; duree_choisie: string }; verdict: { peut_acheter: boolean; raison: string; code?: string } }>;
  };
  const parRef = new Map(data.contextes.map((c) => [c.ref, c]));

  data.cas.forEach((cas, i) => {
    it(`#${i + 1} « ${cas.demande.sort_nom} » niv ${cas.demande.niveau_sort}`, async () => {
      const ctx = parRef.get(cas.ctx)!;
      etatCourant = etatBase();
      etatCourant.contexteMagie = { xpDispo: ctx.xp_dispo, competencesAcquises: mapAcquis(ctx.competences_acquises) };
      const res = await client.acheterSort({
        p_personnage_id: PERSONNAGE_LOCAL_ID,
        p_sort_id: cas.demande.sort_id,
        p_niveau_sort: cas.demande.niveau_sort,
        p_zone_choisie: cas.demande.zone_choisie,
        p_portee_choisie: cas.demande.portee_choisie,
        p_duree_choisie: cas.demande.duree_choisie,
        p_nom_personnalise: "",
      });
      attendreVerdict(res.data, cas.verdict, JSON.stringify({ cas, verdict: cas.verdict }, null, 2));
    });
  });
});

// ============================================================
// Prières (33) → acheterPriere
// ============================================================
describe("parité clientVisiteur — acheterPriere (33)", () => {
  const data = prieresFx as unknown as {
    contextes: Array<{ ref: number; xp_dispo: number; religion_id: string | null; competences_acquises: FxAcquis[] }>;
    cas: Array<{ ctx: number; demande: { priere_id: string; priere_nom: string; niveau_priere: number; zone_choisie: string; portee_choisie: string; duree_choisie: string }; verdict: { peut_acheter: boolean; raison: string; code?: string } }>;
  };
  const parRef = new Map(data.contextes.map((c) => [c.ref, c]));

  data.cas.forEach((cas, i) => {
    it(`#${i + 1} « ${cas.demande.priere_nom} » niv ${cas.demande.niveau_priere}`, async () => {
      const ctx = parRef.get(cas.ctx)!;
      etatCourant = etatBase();
      etatCourant.contexteMagie = {
        xpDispo: ctx.xp_dispo,
        competencesAcquises: mapAcquis(ctx.competences_acquises),
        religionId: ctx.religion_id,
      };
      const res = await client.acheterPriere({
        p_personnage_id: PERSONNAGE_LOCAL_ID,
        p_priere_id: cas.demande.priere_id,
        p_niveau_priere: cas.demande.niveau_priere,
        p_zone_choisie: cas.demande.zone_choisie,
        p_portee_choisie: cas.demande.portee_choisie,
        p_duree_choisie: cas.demande.duree_choisie,
        p_nom_personnalise: "",
      });
      attendreVerdict(res.data, cas.verdict, JSON.stringify({ cas, verdict: cas.verdict }, null, 2));
    });
  });
});

// ============================================================
// Pièges (7) → acheterPiege
// ============================================================
describe("parité clientVisiteur — acheterPiege (7)", () => {
  const data = piegesFx as unknown as {
    contextes: Array<{ ref: number; xp_dispo: number; competences_acquises: FxAcquis[]; pieges_acquis: Array<{ piege_nom: string; niveau_acquis: number; est_gratuit: boolean }> }>;
    cas: Array<{ ctx: number; demande: { piege_id: string; piege_nom: string; niveau: number }; verdict: { peut_acheter: boolean; raison: string; code?: string } }>;
  };
  const parRef = new Map(data.contextes.map((c) => [c.ref, c]));

  data.cas.forEach((cas, i) => {
    it(`#${i + 1} « ${cas.demande.piege_nom} » niv ${cas.demande.niveau}`, async () => {
      const ctx = parRef.get(cas.ctx)!;
      etatCourant = etatBase();
      etatCourant.contextePiege = {
        xpDispo: ctx.xp_dispo,
        competencesAcquises: mapAcquis(ctx.competences_acquises),
        piegesAcquis: ctx.pieges_acquis.map((p) => ({ piegeNom: p.piege_nom, niveauAcquis: p.niveau_acquis, estGratuit: p.est_gratuit })),
      };
      const res = await client.acheterPiege({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_piege_id: cas.demande.piege_id });
      attendreVerdict(res.data, cas.verdict, JSON.stringify({ cas, verdict: cas.verdict }, null, 2));
    });
  });
});

// ============================================================
// Recettes (13) → acheterRecette
// ============================================================
describe("parité clientVisiteur — acheterRecette (13)", () => {
  const data = recettesFx as unknown as {
    contextes: Array<{ ref: number; xp_dispo: number; competences_acquises: FxAcquis[]; recettes_acquises: Array<{ recette_id: string; est_gratuit: boolean }> }>;
    cas: Array<{ ctx: number; demande: { recette_id: string; recette_nom: string; niveau_requis: number }; verdict: { peut_acheter: boolean; raison: string; code?: string } }>;
  };
  const parRef = new Map(data.contextes.map((c) => [c.ref, c]));

  data.cas.forEach((cas, i) => {
    it(`#${i + 1} « ${cas.demande.recette_nom} » palier ${cas.demande.niveau_requis}`, async () => {
      const ctx = parRef.get(cas.ctx)!;
      etatCourant = etatBase();
      etatCourant.contexteRecette = {
        xpDispo: ctx.xp_dispo,
        competencesAcquises: mapAcquis(ctx.competences_acquises),
        recettesAcquises: ctx.recettes_acquises.map((r) => ({ recetteId: r.recette_id, estGratuit: r.est_gratuit })),
      };
      const res = await client.acheterRecette({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_recette_id: cas.demande.recette_id });
      attendreVerdict(res.data, cas.verdict, JSON.stringify({ cas, verdict: cas.verdict }, null, 2));
    });
  });
});

// ============================================================
// Assemblages (10) → acheterAssemblage
// ============================================================
describe("parité clientVisiteur — acheterAssemblage (10)", () => {
  const data = assemblagesFx as unknown as {
    contextes: Array<{ ref: number; xp_dispo: number; competences_acquises: FxAcquis[]; assemblages_acquis: Array<{ assemblage_id: string; est_gratuit: boolean }> }>;
    cas: Array<{ ctx: number; demande: { assemblage_id: string; assemblage_nom: string }; verdict: { peut_acheter: boolean; raison: string; code?: string } }>;
  };
  const parRef = new Map(data.contextes.map((c) => [c.ref, c]));

  data.cas.forEach((cas, i) => {
    it(`#${i + 1} « ${cas.demande.assemblage_nom} »`, async () => {
      const ctx = parRef.get(cas.ctx)!;
      etatCourant = etatBase();
      etatCourant.contexteAssemblage = {
        xpDispo: ctx.xp_dispo,
        competencesAcquises: mapAcquis(ctx.competences_acquises),
        assemblagesAcquis: ctx.assemblages_acquis.map((a) => ({ assemblageId: a.assemblage_id, estGratuit: a.est_gratuit })),
      };
      const res = await client.acheterAssemblage({ p_personnage_id: PERSONNAGE_LOCAL_ID, p_assemblage_id: cas.demande.assemblage_id });
      attendreVerdict(res.data, cas.verdict, JSON.stringify({ cas, verdict: cas.verdict }, null, 2));
    });
  });
});
