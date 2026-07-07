/**
 * Implémentation VISITEUR du guichet `ClientCreation` — 100 % hors ligne (P2-a3-ii).
 *
 * Adossée à `moteurCreation/` : les règles (gates, coûts, quotas, gratuités,
 * dériveurs) sont IMPORTÉES, jamais recopiées (§4). Le catalogue vient de
 * `getSnapshot()` (§5, zéro donnée fabriquée). Le seul portage de logique autorisé
 * est celui des VALIDATIONS métier des RPC de cycle de vie (§C), avec messages
 * VERBATIM du SQL (migrations citées en commentaire).
 *
 * Code mort jusqu'à P2-b (`clientActif` = `clientServeur`) : les trous documentés
 * dans `TROUS_A3II.md` sont des approximations de preview sans risque prod.
 *
 * ── Couture d'injection (test-only) ─────────────────────────────────────────
 * `creerClientVisiteur({ deriver })` permet de STUBBER la dérivation. En prod le
 * défaut `deriverEtat` recompute tout depuis le brouillon. Le harnais de parité
 * l'utilise pour rejouer les 228 verdicts serveur enregistrés : ces fixtures
 * fournissent des contextes de gate ARBITRAIRES (xp_dispo, est_gratuit fixés) que
 * `deriverEtat` — qui recompute from scratch — ne peut pas reproduire depuis un
 * brouillon de choix bruts. En stubant `deriver` sur le contexte de la fixture on
 * exerce le VRAI chemin public (gate → verdict → `Reponse`) et on prouve que les
 * messages du verdict transitent AU CARACTÈRE PRÈS dans la `Reponse`. L'app, elle,
 * n'utilise jamais la couture : `clientVisiteur = creerClientVisiteur()`.
 */

import type { Json } from "@/integrations/supabase/types";
import type {
  ClientCreation,
  Reponse,
  LigneSortAcquis,
  LignePriereAcquise,
  LigneObjetForge,
  NiveauCompetence,
  CompetenceNom,
} from "../types";

import { getSnapshot } from "@/moteurCreation/snapshot";
import { calculerCoutXP, calculerDureeIncantation } from "@/utils/calculsMagie";
import { genererFormuleMagique } from "@/moteurCreation/formuleMagique";
import {
  deriverEtat,
  coutAchatCompetence,
  type EtatDeriveVisiteur,
} from "@/moteurCreation/brouillon/deriver";
import { calculerLignesRabais } from "@/moteurCreation/rabais";
import {
  deriverCerclesDisponibles,
  deriverDomainesDisponibles,
} from "@/moteurCreation/deriveurs";
import { peutAcheterCompetence } from "@/moteurCreation/gatesCompetences";
import { peutAcheterSort, peutAcheterPriere } from "@/moteurCreation/gatesMagie";
import {
  peutAcheterPiege,
  peutAcheterRecette,
  peutAcheterAssemblage,
} from "@/moteurCreation/gatesArtisanat";
import {
  appliquerAchatCompetence,
  appliquerAchatSort,
  retirerSort,
  modifierSort as applicModifierSort,
  appliquerAchatPriere,
  retirerPriere,
  modifierPriere as applicModifierPriere,
  appliquerAchatPiege,
  retirerPiege,
  appliquerAchatRecette,
  retirerRecette,
  appliquerAchatAssemblage,
  retirerAssemblage,
  appliquerEtape1,
  appliquerEtape2,
  appliquerEtape3,
  appliquerEtape4,
  changerClasse,
} from "@/moteurCreation/brouillon/appliquer";
import {
  creerBrouillonVide,
  type BrouillonVisiteur,
  type BrouillonSort,
  type BrouillonPriere,
} from "@/moteurCreation/brouillon/types";
import {
  chargerBrouillon,
  sauverBrouillon,
} from "./stockageBrouillon";

// ============================================================
// Constantes & couture
// ============================================================

/** Id local unique : toute méthode qui reçoit un autre id renvoie PERSONNAGE_INCONNU. */
export const PERSONNAGE_LOCAL_ID = "visiteur-local";

/**
 * Profil factice passé à `demarrerCreationPersonnage` en mode visiteur. Le client
 * visiteur IGNORE ce paramètre (`_params`) — il n'existe que pour satisfaire la
 * signature partagée `ClientCreation`. UUID nul (jamais écrit, jamais lu).
 */
export const PROFIL_VISITEUR_LOCAL = "00000000-0000-0000-0000-000000000000";

/** Dépendances injectables (test-only). Défauts = comportement prod. */
export interface DepsVisiteur {
  /** Dérivation du brouillon. Défaut : `deriverEtat` (recompute from scratch). */
  deriver?: (b: BrouillonVisiteur) => EtatDeriveVisiteur;
}

// ============================================================
// Enveloppe `Reponse` (miroir du payload jsonb serveur)
// ============================================================

interface ErrItem {
  code?: string;
  message: string;
  champ?: string;
}

function jsonify(payload: unknown): Json {
  // Le payload est structurellement JSON (string/number/bool/null/array/objet).
  return payload as unknown as Json;
}

/** Réponse supabase-js `{ data, error }` avec `data` = payload jsonb. */
function rep(payload: unknown): Reponse<Json> {
  return { data: jsonify(payload), error: null };
}

/** Enveloppe succès `{succes:true, erreurs:[], avertissements, donnees}`. */
function repOk(donnees: unknown, avertissements: ErrItem[] = []): Reponse<Json> {
  return rep({ succes: true, erreurs: [], avertissements, donnees: donnees ?? null });
}

/** Enveloppe refus `{succes:false, erreurs:[err], avertissements, donnees}`. */
function repErr(
  err: ErrItem,
  donnees: unknown = null,
  avertissements: ErrItem[] = [],
): Reponse<Json> {
  return rep({ succes: false, erreurs: [err], avertissements, donnees });
}

/** Brouillon absent : erreur uniforme partagée par toutes les orchestrations A. */
function repBrouillonAbsent(): Reponse<Json> {
  return repErr({
    code: "BROUILLON_ABSENT",
    message: "Aucun brouillon en cours. Démarrez une création.",
  });
}

/**
 * Garde d'identité (§C) : toute méthode accepte `visiteur-local` et refuse tout
 * autre id avec `PERSONNAGE_INCONNU`. Renvoie la `Reponse` d'erreur ou `null`.
 */
function guardPerso(id: string | undefined): Reponse<Json> | null {
  if (id !== undefined && id !== PERSONNAGE_LOCAL_ID) {
    return repErr({ code: "PERSONNAGE_INCONNU", message: "Personnage introuvable." });
  }
  return null;
}

// ============================================================
// Helpers snapshot (lecture pure)
// ============================================================

const snap = () => getSnapshot();

function classes() {
  return snap().tables.classes;
}
function races() {
  return snap().tables.races;
}
function competences() {
  return snap().tables.competences;
}

interface SortCat {
  id: string;
  cercle: string | null;
  cout_xp_base: number | null;
  niveau?: number | null;
  nom?: string | null;
}
interface PriereCat {
  id: string;
  domaine: string | null;
  cout_xp_base: number | null;
  nom?: string | null;
}

function sortsCat(): SortCat[] {
  return snap().tables.sorts as unknown as SortCat[];
}
function prieresCat(): PriereCat[] {
  return snap().tables.prieres as unknown as PriereCat[];
}
function getSortCat(id: string): SortCat | undefined {
  return sortsCat().find((s) => s.id === id);
}
function getPriereCat(id: string): PriereCat | undefined {
  return prieresCat().find((p) => p.id === id);
}
function getCompetenceCat(id: string) {
  return competences().find((c) => c.id === id);
}

/**
 * `type_achat` qui CASCADE en désachat (retrait de tous les niveaux ≥ cible)
 * — miroir du `IN (...)` serveur de `desacheter_competence` (A6).
 */
const TYPES_ACHAT_CASCADE = new Set([
  "simple",
  "unique_avec_choix",
  "multiple_avec_choix_par_niveau",
]);

/** Coût XP d'une compétence à un niveau = `niveaux[niveau].cout_xp` (même donnée que le gate). */
function coutCompetence(competenceId: string, niveau: number): number {
  const niveaux = getCompetenceCat(competenceId)?.niveaux as
    | Array<{ niveau: number; cout_xp: number }>
    | null
    | undefined;
  return niveaux?.find((n) => n && n.niveau === niveau)?.cout_xp ?? 0;
}

/** Comparateur ascendant façon `.order(col)` supabase (localeCompare fr / numérique). */
function cmp(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), "fr");
}
function trierPar<T>(rows: T[], ...cles: Array<(r: T) => unknown>): T[] {
  return [...rows].sort((x, y) => {
    for (const cle of cles) {
      const d = cmp(cle(x), cle(y));
      if (d !== 0) return d;
    }
    return 0;
  });
}

// ============================================================
// Identifiants synthétiques d'acquisition (round-trip désachat)
//
// Hors ligne, il n'y a pas d'id serveur `personnage_<x>_id`. Les lectures d'état
// exposent un id synthétique déterministe ; les désachats le décodent pour retirer
// l'item du brouillon. L'id ne quitte jamais le client (produit puis reconsommé).
// ============================================================

const SEP = "";
function idComp(competenceId: string, niveau: number, choix: string | null): string {
  return ["pc", competenceId, String(niveau), choix ?? ""].join(SEP);
}
function decodeIdComp(
  id: string,
): { competenceId: string; niveauAcquis: number; choixAchat: string | null } | null {
  const [p, competenceId, niveau, choix] = id.split(SEP);
  if (p !== "pc") return null;
  return { competenceId, niveauAcquis: Number(niveau), choixAchat: choix === "" ? null : choix };
}
const idSort = (sortId: string) => `ps${SEP}${sortId}`;
const idPriere = (priereId: string) => `pp${SEP}${priereId}`;
const idPiege = (piegeId: string) => `pt${SEP}${piegeId}`;
const idRecette = (recetteId: string) => `pr${SEP}${recetteId}`;
const idAssemblage = (assemblageId: string) => `pa${SEP}${assemblageId}`;
function decodeId(prefix: string, id: string): string | null {
  const [p, rest] = id.split(SEP);
  return p === prefix ? rest : null;
}

// ============================================================
// Fabrique
// ============================================================

export function creerClientVisiteur(deps: DepsVisiteur = {}): ClientCreation {
  const deriver = deps.deriver ?? deriverEtat;

  /** Coût effectif payé pour une compétence acquise (0 si gratuité de classe). */
  function estGratuite(etat: EtatDeriveVisiteur, competenceId: string, niveau: number, choix: string | null): boolean {
    return etat.gratuites.some(
      (g) =>
        g.competenceId === competenceId &&
        g.niveauAcquis === niveau &&
        g.choixAchat === choix,
    );
  }

  // ── Orchestration uniforme des achats (A) ──
  function orchestrer(
    personnageId: string | undefined,
    corps: (b: BrouillonVisiteur, etat: EtatDeriveVisiteur) => Reponse<Json>,
  ): Reponse<Json> {
    const g = guardPerso(personnageId);
    if (g) return g;
    const b = chargerBrouillon();
    if (!b) return repBrouillonAbsent();
    return corps(b, deriver(b));
  }

  return {
    // ═══════════════════════════════════════════════════════════════════════
    // A — Achats / désachats / modifs
    // ═══════════════════════════════════════════════════════════════════════

    async acheterCompetence(params) {
      return orchestrer(params.p_personnage_id, (b, etat) => {
        const demande = {
          competenceId: params.p_competence_id,
          niveauDesire: params.p_niveau_desire,
          choixAchat: params.p_choix_achat ?? null,
        };
        const v = peutAcheterCompetence(etat.contextePersonnage, demande);
        if (!v.peutAcheter) return repErr({ message: v.raison });
        sauverBrouillon(appliquerAchatCompetence(b, demande));
        return repOk(null);
      });
    },

    async desacheterCompetence(params) {
      // Portage FIDÈLE de `desacheter_competence` (A6, migration 20260610065923) :
      // refus gratuité → cascade niveaux → boucle prérequis → purge sorts/prières
      // → aperçu dry_run reflétant la cascade RÉELLE. Le serveur est la source.
      const b = chargerBrouillon();
      if (!b) return repBrouillonAbsent();
      const cible = decodeIdComp(params.p_personnage_competence_id);
      if (!cible) return repErr({ code: "introuvable", message: "Compétence introuvable." });

      const comp = getCompetenceCat(cible.competenceId);
      if (!comp) {
        return repErr({ code: "competence_introuvable", message: "Compétence introuvable" });
      }

      const memeComp = (
        a: { competenceId: string; niveauAcquis: number; choixAchat: string | null },
        c: { competenceId: string; niveauAcquis: number; choixAchat: string | null },
      ) =>
        a.competenceId === c.competenceId &&
        a.niveauAcquis === c.niveauAcquis &&
        a.choixAchat === c.choixAchat;

      const etat0 = deriver(b);
      const cibleGratuite = estGratuite(etat0, cible.competenceId, cible.niveauAcquis, cible.choixAchat);
      const payantes = b.acquisitions.competences;
      const presente = cibleGratuite || payantes.some((c) => memeComp(c, cible));
      if (!presente) {
        return repErr({ code: "achat_introuvable", message: "Cet achat de compétence n'existe pas" });
      }

      // ── 1. Refus gratuité (sémantique serveur : xp_depense=0 ET NON desachat_force).
      //    xp effectif = 0 pour une gratuité de classe, un achat à 0 XP (« Acquisition
      //    de Sort/Prière ») OU un achat cercle/domaine dont le rabais annule le coût.
      const xpCible = cibleGratuite
        ? 0
        : coutAchatCompetence(b, cible.competenceId, cible.niveauAcquis, cible.choixAchat);
      if (xpCible === 0 && !comp.desachat_force) {
        return repErr({
          code: "competence_gratuite",
          message: "Une compétence acquise gratuitement (de classe) ne peut pas être désachetée",
        });
      }

      // ── 2. Cascade niveaux : retrait initial du set (achats du joueur uniquement,
      //    les gratuités de classe sont re-dérivées et ne sont jamais « retirées »).
      let restantes = payantes;
      if (TYPES_ACHAT_CASCADE.has(comp.type_achat)) {
        restantes = payantes.filter((c) => {
          if (c.competenceId !== cible.competenceId) return true;
          if (c.niveauAcquis < cible.niveauAcquis) return true;
          // multiple_avec_choix_par_niveau : borné au même choix (sauf choix cible null → tous).
          if (
            comp.type_achat === "multiple_avec_choix_par_niveau" &&
            cible.choixAchat != null &&
            c.choixAchat !== cible.choixAchat
          ) {
            return true;
          }
          return false;
        });
      } else {
        restantes = payantes.filter((c) => !memeComp(c, cible));
      }

      // ── 3. Boucle prérequis : tant que ça change, on recalcule les prérequis
      //    (méthode LOCALE `calculerPrerequis`) et on retire les niveaux excédentaires.
      let changed = true;
      while (changed) {
        changed = false;
        const bWork: BrouillonVisiteur = {
          ...b,
          acquisitions: { ...b.acquisitions, competences: restantes },
        };
        const prereq = calculerPrerequis(bWork, deriver) as Record<
          string,
          { niveau_max_achetable?: number }
        >;
        const maxParComp = new Map<string, number>();
        for (const c of restantes) {
          maxParComp.set(c.competenceId, Math.max(maxParComp.get(c.competenceId) ?? 0, c.niveauAcquis));
        }
        for (const [cid, niv] of maxParComp) {
          const entree = prereq[cid];
          if (!entree) continue;
          const max = entree.niveau_max_achetable ?? 3;
          if (niv > max) {
            const avant = restantes.length;
            restantes = restantes.filter((c) => !(c.competenceId === cid && c.niveauAcquis > max));
            if (restantes.length !== avant) changed = true;
          }
        }
      }

      // Set des compétences RETIRÉES (initial + cascade prérequis).
      const retirees = payantes.filter((c) => !restantes.includes(c));

      // ── 4. Purge sorts/prières : si « Acquisition de Sort »/« Acquisition de Prière »
      //    tombe → purge TOTALE (gate global). On conserve AUSSI la purge par
      //    cercle/domaine (une « Acquisition de Cercle/Domaine » retirée ferme son
      //    cercle/domaine → les sorts/prières correspondants tombent).
      const purgeSortsTout = retirees.some(
        (c) => getCompetenceCat(c.competenceId)?.nom === "Acquisition de Sort",
      );
      const purgePrieresTout = retirees.some(
        (c) => getCompetenceCat(c.competenceId)?.nom === "Acquisition de Prière",
      );
      const bApresComp: BrouillonVisiteur = {
        ...b,
        acquisitions: { ...b.acquisitions, competences: restantes },
      };
      const etatApres = deriver(bApresComp);
      const cerclesOk = deriverCerclesDisponibles(etatApres.contexteMagie.competencesAcquises);
      const domainesOk = deriverDomainesDisponibles(
        etatApres.contexteMagie.competencesAcquises,
        etatApres.contexteMagie.religionId ?? null,
      );
      const sortGarde = (s: BrouillonVisiteur["acquisitions"]["sorts"][number]) => {
        if (purgeSortsTout) return false;
        const max = cerclesOk.get(getSortCat(s.sortId)?.cercle ?? "");
        return max != null && s.niveauSort <= max;
      };
      const priereGardee = (p: BrouillonVisiteur["acquisitions"]["prieres"][number]) => {
        if (purgePrieresTout) return false;
        const max = domainesOk.get(getPriereCat(p.priereId)?.domaine ?? "");
        return max != null && p.niveauPriere <= max;
      };
      const sortsGardes = b.acquisitions.sorts.filter(sortGarde);
      const prieresGardees = b.acquisitions.prieres.filter(priereGardee);
      const sortsRetires = b.acquisitions.sorts.filter((s) => !sortGarde(s));
      const prieresRetirees = b.acquisitions.prieres.filter((p) => !priereGardee(p));

      // ── 5. dry_run FIDÈLE : `donnees` reflète la cascade réelle (mêmes clés que le serveur).
      const parNom = new Map<string, { niveaux: number[]; xps: number[] }>();
      for (const c of retirees) {
        const nom = getCompetenceCat(c.competenceId)?.nom ?? "";
        // Remboursement = coût EFFECTIF débité (rabais cercle/domaine inclus),
        // pas le coût catalogue — sinon on rendrait plus que ce qui fut prélevé.
        const xp = coutAchatCompetence(b, c.competenceId, c.niveauAcquis, c.choixAchat);
        const agg = parNom.get(nom) ?? { niveaux: [], xps: [] };
        agg.niveaux.push(c.niveauAcquis);
        agg.xps.push(xp);
        parNom.set(nom, agg);
      }
      const itemsComp = [...parNom.entries()]
        .sort((x, y) => cmp(x[0], y[0]))
        .map(([nom, agg]) => ({
          type: "competence",
          type_label: "Compétence",
          nom,
          quantite: agg.niveaux.length,
          xp_unitaire: Math.min(...agg.xps),
          xp_total: agg.xps.reduce((a, n) => a + n, 0),
          niveaux: [...agg.niveaux].sort((a, n) => a - n),
        }));
      const xpSort = (s: BrouillonVisiteur["acquisitions"]["sorts"][number]) =>
        calculerCoutXP(s.zoneChoisie, s.porteeChoisie, s.dureeChoisie, s.niveauSort, getSortCat(s.sortId)?.cout_xp_base ?? 0);
      const xpPriere = (p: BrouillonVisiteur["acquisitions"]["prieres"][number]) =>
        calculerCoutXP(p.zoneChoisie, p.porteeChoisie, p.dureeChoisie, p.niveauPriere, getPriereCat(p.priereId)?.cout_xp_base ?? 0);
      const itemsSorts = sortsRetires
        .map((s) => ({
          type: "sort",
          type_label: "Sort",
          nom: s.nomPersonnalise ?? getSortCat(s.sortId)?.nom ?? "",
          quantite: 1,
          xp_unitaire: xpSort(s),
          xp_total: xpSort(s),
        }))
        .sort((x, y) => cmp(x.nom, y.nom));
      const itemsPrieres = prieresRetirees
        .map((p) => ({
          type: "priere",
          type_label: "Prière",
          nom: p.nomPersonnalise ?? getPriereCat(p.priereId)?.nom ?? "",
          quantite: 1,
          xp_unitaire: xpPriere(p),
          xp_total: xpPriere(p),
        }))
        .sort((x, y) => cmp(x.nom, y.nom));

      const xpComp = itemsComp.reduce((a, it) => a + it.xp_total, 0);
      const xpSorts = itemsSorts.reduce((a, it) => a + it.xp_total, 0);
      const xpPrieres = itemsPrieres.reduce((a, it) => a + it.xp_total, 0);
      const countComp = retirees.length;
      const countCompDistinctes = itemsComp.length;
      const cascade = countCompDistinctes > 1 || purgeSortsTout || purgePrieresTout;
      const donnees = {
        cascade,
        competence_cible: comp.nom,
        count_competences: countComp,
        count_competences_distinctes: countCompDistinctes,
        count_sorts: sortsRetires.length,
        count_prieres: prieresRetirees.length,
        xp_rembourse: xpComp + xpSorts + xpPrieres,
        items_detail: [...itemsComp, ...itemsSorts, ...itemsPrieres],
      };

      if (params.p_dry_run) return repOk(donnees); // aperçu : pas de sauvegarde

      const b2: BrouillonVisiteur = {
        ...b,
        acquisitions: {
          ...b.acquisitions,
          competences: restantes,
          sorts: sortsGardes,
          prieres: prieresGardees,
        },
        meta: { ...b.meta, modifieLe: new Date().toISOString() },
      };
      sauverBrouillon(b2);
      return repOk(donnees);
    },

    async acheterSort(params) {
      return orchestrer(params.p_personnage_id, (b, etat) => {
        const demande = {
          sortId: params.p_sort_id,
          niveauSort: params.p_niveau_sort,
          zoneChoisie: params.p_zone_choisie,
          porteeChoisie: params.p_portee_choisie,
          dureeChoisie: params.p_duree_choisie,
        };
        const v = peutAcheterSort(etat.contexteMagie, demande);
        if (!v.peutAcheter) return repErr({ code: v.code, message: v.raison });
        const item: BrouillonSort = { ...demande, nomPersonnalise: params.p_nom_personnalise };
        sauverBrouillon(appliquerAchatSort(b, item));
        return repOk(null);
      });
    },

    async desacheterSort(params) {
      const b = chargerBrouillon();
      if (!b) return repBrouillonAbsent();
      const sortId = decodeId("ps", params.p_personnage_sort_id);
      if (!sortId) return repErr({ code: "introuvable", message: "Sort introuvable." });
      const xpAvant = deriver(b).xpDepense;
      const b1 = retirerSort(b, sortId);
      const xpRembourse = xpAvant - deriver(b1).xpDepense;
      // cf. TROUS_A3II §2 : reprise/rabais non portée → aperçu minimal.
      const donnees = {
        bloque: false,
        xp_rembourse: xpRembourse,
        net: xpRembourse,
        reprise_totale: false,
        reprises: [] as unknown[],
        cercle: getSortCat(sortId)?.cercle ?? null,
        message_action: null,
      };
      if (params.p_dry_run) return repOk(donnees);
      sauverBrouillon(b1);
      return repOk(donnees);
    },

    async modifierSort(params) {
      const b = chargerBrouillon();
      if (!b) return repBrouillonAbsent();
      const sortId = decodeId("ps", params.p_personnage_sort_id);
      const existant = sortId
        ? b.acquisitions.sorts.find((s) => s.sortId === sortId)
        : undefined;
      if (!sortId || !existant) {
        return repErr({ code: "sort_introuvable", message: "Sort introuvable" });
      }
      const cat = getSortCat(sortId);
      const base = cat?.cout_xp_base ?? 0;
      const ancienCout = calculerCoutXP(
        existant.zoneChoisie,
        existant.porteeChoisie,
        existant.dureeChoisie,
        existant.niveauSort,
        base,
      );
      const nouveauCout = calculerCoutXP(
        params.p_zone_choisie,
        params.p_portee_choisie,
        params.p_duree_choisie,
        params.p_niveau_sort,
        base,
      );
      const etat = deriver(b);
      const plancher = {
        niveau: existant.niveauSort,
        zone: existant.zoneChoisie,
        portee: existant.porteeChoisie,
        duree: existant.dureeChoisie,
      }; // cf. TROUS_A3II §3 (plancher approximé)
      // Validation niveau/cercle via le gate (le sort courant n'occupe pas le cercle).
      const cercles = deriverCerclesDisponibles(etat.contexteMagie.competencesAcquises);
      const max = cercles.get(cat?.cercle ?? "");
      if (max == null || params.p_niveau_sort > max) {
        return repErr(
          { code: "niveau_invalide", message: "Niveau de sort superieur au maximum autorise pour ce cercle" },
          { plancher },
        );
      }
      const diff = nouveauCout - ancienCout;
      if (diff > 0 && etat.xpDispo < diff) {
        return repErr({ code: "xp_insuffisant", message: "XP insuffisant" }, { plancher });
      }
      sauverBrouillon(
        applicModifierSort(b, sortId, {
          niveauSort: params.p_niveau_sort,
          zoneChoisie: params.p_zone_choisie,
          porteeChoisie: params.p_portee_choisie,
          dureeChoisie: params.p_duree_choisie,
          // COALESCE(p_nom_personnalise, nom_personnalise) — l'écran omet le
          // param quand le nom est inchangé : param absent/null → on conserve
          // le nom existant (sinon le spread l'écraserait avec undefined).
          nomPersonnalise: params.p_nom_personnalise ?? existant.nomPersonnalise,
        }),
      );
      return repOk({ xp_diff: diff });
    },

    async acheterPriere(params) {
      return orchestrer(params.p_personnage_id, (b, etat) => {
        const demande = {
          priereId: params.p_priere_id,
          niveauPriere: params.p_niveau_priere,
          zoneChoisie: params.p_zone_choisie,
          porteeChoisie: params.p_portee_choisie,
          dureeChoisie: params.p_duree_choisie,
        };
        const v = peutAcheterPriere(etat.contexteMagie, demande);
        if (!v.peutAcheter) return repErr({ code: v.code, message: v.raison });
        const item: BrouillonPriere = { ...demande, nomPersonnalise: params.p_nom_personnalise };
        sauverBrouillon(appliquerAchatPriere(b, item));
        return repOk(null);
      });
    },

    async desacheterPriere(params) {
      const b = chargerBrouillon();
      if (!b) return repBrouillonAbsent();
      const priereId = decodeId("pp", params.p_personnage_priere_id);
      if (!priereId) return repErr({ code: "introuvable", message: "Prière introuvable." });
      const xpAvant = deriver(b).xpDepense;
      const b1 = retirerPriere(b, priereId);
      const xpRembourse = xpAvant - deriver(b1).xpDepense;
      const donnees = {
        bloque: false,
        xp_rembourse: xpRembourse,
        net: xpRembourse,
        reprise_totale: false,
        reprises: [] as unknown[],
        domaine: getPriereCat(priereId)?.domaine ?? null,
        message_action: null,
      };
      if (params.p_dry_run) return repOk(donnees);
      sauverBrouillon(b1);
      return repOk(donnees);
    },

    async modifierPriere(params) {
      const b = chargerBrouillon();
      if (!b) return repBrouillonAbsent();
      const priereId = decodeId("pp", params.p_personnage_priere_id);
      const existant = priereId
        ? b.acquisitions.prieres.find((p) => p.priereId === priereId)
        : undefined;
      if (!priereId || !existant) {
        return repErr({ code: "priere_introuvable", message: "Prière introuvable" });
      }
      const cat = getPriereCat(priereId);
      const base = cat?.cout_xp_base ?? 0;
      const ancienCout = calculerCoutXP(
        existant.zoneChoisie,
        existant.porteeChoisie,
        existant.dureeChoisie,
        existant.niveauPriere,
        base,
      );
      const nouveauCout = calculerCoutXP(
        params.p_zone_choisie,
        params.p_portee_choisie,
        params.p_duree_choisie,
        params.p_niveau_priere,
        base,
      );
      const etat = deriver(b);
      const plancher = {
        niveau: existant.niveauPriere,
        zone: existant.zoneChoisie,
        portee: existant.porteeChoisie,
        duree: existant.dureeChoisie,
      };
      const domaines = deriverDomainesDisponibles(
        etat.contexteMagie.competencesAcquises,
        etat.contexteMagie.religionId ?? null,
      );
      const max = domaines.get(cat?.domaine ?? "");
      if (max == null || params.p_niveau_priere > max) {
        return repErr(
          {
            code: "niveau_invalide",
            message: "Niveau de prière supérieur au maximum autorisé pour ce domaine",
          },
          { plancher },
        );
      }
      const diff = nouveauCout - ancienCout;
      if (diff > 0 && etat.xpDispo < diff) {
        return repErr({ code: "xp_insuffisant", message: "XP insuffisant" }, { plancher });
      }
      sauverBrouillon(
        applicModifierPriere(b, priereId, {
          niveauPriere: params.p_niveau_priere,
          zoneChoisie: params.p_zone_choisie,
          porteeChoisie: params.p_portee_choisie,
          dureeChoisie: params.p_duree_choisie,
          // COALESCE(p_nom_personnalise, nom_personnalise) — cf. modifierSort.
          nomPersonnalise: params.p_nom_personnalise ?? existant.nomPersonnalise,
        }),
      );
      return repOk({ xp_diff: diff });
    },

    async acheterRecette(params) {
      return orchestrer(params.p_personnage_id, (b, etat) => {
        const v = peutAcheterRecette(etat.contexteRecette, params.p_recette_id);
        if (!v.peutAcheter) return repErr({ code: v.code, message: v.raison });
        sauverBrouillon(appliquerAchatRecette(b, params.p_recette_id));
        return repOk(null);
      });
    },

    async desacheterRecette(params) {
      const b = chargerBrouillon();
      if (!b) return repBrouillonAbsent();
      const recetteId = decodeId("pr", params.p_personnage_recette_id);
      if (!recetteId) return repErr({ code: "introuvable", message: "Recette introuvable." });
      sauverBrouillon(retirerRecette(b, recetteId));
      return repOk(null);
    },

    async acheterPiege(params) {
      return orchestrer(params.p_personnage_id, (b, etat) => {
        const v = peutAcheterPiege(etat.contextePiege, params.p_piege_id);
        if (!v.peutAcheter) return repErr({ code: v.code, message: v.raison });
        sauverBrouillon(appliquerAchatPiege(b, params.p_piege_id));
        return repOk(null);
      });
    },

    async desacheterPiege(params) {
      const b = chargerBrouillon();
      if (!b) return repBrouillonAbsent();
      const piegeId = decodeId("pt", params.p_personnage_piege_id);
      if (!piegeId) return repErr({ code: "introuvable", message: "Piège introuvable." });
      sauverBrouillon(retirerPiege(b, piegeId));
      return repOk(null);
    },

    async acheterAssemblage(params) {
      return orchestrer(params.p_personnage_id, (b, etat) => {
        const v = peutAcheterAssemblage(etat.contexteAssemblage, params.p_assemblage_id);
        if (!v.peutAcheter) return repErr({ code: v.code, message: v.raison });
        sauverBrouillon(appliquerAchatAssemblage(b, params.p_assemblage_id));
        return repOk(null);
      });
    },

    async desacheterAssemblage(params) {
      const b = chargerBrouillon();
      if (!b) return repBrouillonAbsent();
      const assemblageId = decodeId("pa", params.p_personnage_assemblage_id);
      if (!assemblageId) return repErr({ code: "introuvable", message: "Assemblage introuvable." });
      sauverBrouillon(retirerAssemblage(b, assemblageId));
      return repOk(null);
    },

    // ═══════════════════════════════════════════════════════════════════════
    // C — Cycle de vie (seul portage de validations autorisé, messages VERBATIM)
    // Omissions communes (sans objet hors ligne) : auth / profil / ownership /
    // gel (`gate_edition_personnage`) / verrou / contrainte DB (SQLERRM).
    // ═══════════════════════════════════════════════════════════════════════

    async demarrerCreationPersonnage(_params) {
      // Migration 20260607223650. Business : `brouillon_existant`.
      const existant = chargerBrouillon();
      // TOP 5d — protection du personnage finalisé. Le serveur crée un NOUVEAU
      // personnage et conserve l'ancien ; hors ligne, le slot localStorage est
      // unique et on ne peut pas dupliquer. On REFUSE donc d'écraser un
      // brouillon finalisé (etapeCourante >= 11). Décision maison validée s311 :
      // le vidage explicite reste possible via l'écran de fin de parcours.
      if (existant && existant.meta.etapeCourante >= 11) {
        return repErr({
          code: "FINALISE_EXISTANT",
          message: "Un personnage finalisé existe déjà sur cet appareil.",
        });
      }
      if (existant && existant.meta.etapeCourante < 11) {
        return repErr(
          { code: "brouillon_existant", message: "Vous avez déjà un personnage en cours de création." },
          { personnage_id: PERSONNAGE_LOCAL_ID, etape_creation: existant.meta.etapeCourante },
        );
      }
      const b = creerBrouillonVide();
      sauverBrouillon(b);
      return repOk({ personnage_id: PERSONNAGE_LOCAL_ID, etape_creation: 1 });
    },

    async sauvegarderEtape1(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = chargerBrouillon();
      if (!b) return repBrouillonAbsent();

      const payload = {
        nom: params.p_nom,
        gnCompletes: params.p_gn_completes,
        miniGnCompletes: params.p_mini_gn_completes,
        ouverturesTerrain: params.p_ouvertures_terrain,
        estCroyant: params.p_est_croyant,
        religionId: params.p_religion_id ?? null,
        historique: params.p_historique ?? undefined,
        amePersonnage: params.p_ame_personnage ?? undefined,
      };

      // p_brouillon : sauvegarde partielle SANS validation (migration 20260619030657).
      if (params.p_brouillon) {
        const nb = appliquerEtape1(b, payload);
        sauverBrouillon(nb);
        return repOk({
          personnage_id: PERSONNAGE_LOCAL_ID,
          brouillon: true,
          etape_creation_apres: nb.meta.etapeCourante,
        });
      }

      // valider_etape_1 (baseline) — VERBATIM.
      if (!params.p_nom) {
        return repErr({ code: "nom_manquant", message: "Le nom du personnage est obligatoire", champ: "nom" });
      }
      if (params.p_nom.trim().length < 2) {
        return repErr({ code: "nom_trop_court", message: "Le nom doit contenir au moins 2 caractères", champ: "nom" });
      }
      if (params.p_est_croyant && params.p_religion_id == null) {
        return repErr({ code: "religion_manquante", message: "Un personnage croyant doit avoir une religion", champ: "religion_id" });
      }
      if (!params.p_est_croyant && params.p_religion_id != null) {
        return repErr({ code: "religion_incoherente", message: "Un personnage non-croyant ne doit pas avoir de religion", champ: "religion_id" });
      }
      if (params.p_gn_completes < 0) {
        return repErr({ code: "gn_completes_negatif", message: "Le nombre de GN complétés ne peut pas être négatif", champ: "gn_completes" });
      }

      const nb0 = appliquerEtape1(b, payload);
      const nb = avancerVers(nb0, 1, 2);
      sauverBrouillon(nb);
      return repOk({ personnage_id: PERSONNAGE_LOCAL_ID, etape_creation_apres: nb.meta.etapeCourante });
    },

    async sauvegarderEtape2(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = chargerBrouillon();
      if (!b) return repBrouillonAbsent();

      const payload = {
        raceId: params.p_race_id,
        sousTypeChimeride: params.p_sous_type_chimeride ?? null,
      };
      if (params.p_brouillon) {
        const nb = appliquerEtape2(b, payload);
        sauverBrouillon(nb);
        return repOk({ personnage_id: PERSONNAGE_LOCAL_ID, brouillon: true, etape_creation_apres: nb.meta.etapeCourante });
      }

      // valider_etape_2 (baseline) — VERBATIM.
      if (!params.p_race_id) {
        return repErr({ code: "race_manquante", message: "La race est obligatoire", champ: "race_id" });
      }
      const race = races().find((r) => r.id === params.p_race_id);
      const estChimeride = race?.nom === "Chiméride";
      if (estChimeride && params.p_sous_type_chimeride == null) {
        return repErr({
          code: "sous_type_chimeride_manquant",
          message: "Un Chiméride doit avoir un sous-type (carnivore ou herbivore)",
          champ: "sous_type_chimeride",
        });
      }
      if (!estChimeride && params.p_sous_type_chimeride != null) {
        return repErr({
          code: "sous_type_chimeride_invalide_pour_race",
          message: "Seuls les Chimérides ont un sous-type",
          champ: "sous_type_chimeride",
        });
      }

      const nb = avancerVers(appliquerEtape2(b, payload), 2, 3);
      sauverBrouillon(nb);
      return repOk({ personnage_id: PERSONNAGE_LOCAL_ID, etape_creation_apres: nb.meta.etapeCourante });
    },

    async sauvegarderEtape3(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = chargerBrouillon();
      if (!b) return repBrouillonAbsent();

      const traits = (params.p_traits_raciaux_choisis ?? []) as Array<{
        trait_id?: string;
        est_gratuit?: boolean;
        xp_depense?: number;
        [k: string]: unknown;
      }>;
      const payload = { traitsRaciauxChoisis: traits };

      if (params.p_brouillon) {
        const nb = appliquerEtape3(b, payload);
        sauverBrouillon(nb);
        return repOk({
          personnage_id: PERSONNAGE_LOCAL_ID,
          brouillon: true,
          etape_creation_apres: nb.meta.etapeCourante,
          traits_raciaux_choisis: traits,
        });
      }

      // valider_etape_3 (baseline) — VERBATIM.
      const raceId = b.etape2.raceId || null;
      if (!raceId) {
        return repErr({ code: "race_manquante", message: "Sélectionnez une race avant de choisir des traits", champ: "race_id" });
      }
      const race = races().find((r) => r.id === raceId);
      const quota = race?.nb_traits_raciaux ?? 0;
      const raceTraits = snap().tables.race_traits as Array<{ race_id: string; trait_id: string; sous_type: string | null }>;
      const traitsRaciaux = snap().tables.traits_raciaux as Array<{ id: string; cout_xp: number | null }>;

      const nbGratuits = traits.filter((t) => t.est_gratuit === true).length;
      if (nbGratuits !== quota) {
        return repErr({
          code: "traits_gratuits_quota_incorrect",
          message: `Vous devez choisir exactement ${quota} trait(s) gratuit(s), pas ${nbGratuits}`,
          champ: "traits_raciaux_choisis",
        });
      }
      const vus = new Set<string>();
      for (const t of traits) {
        const tid = t.trait_id ?? "";
        if (vus.has(tid)) {
          return repErr({ code: "traits_doublon", message: "Un même trait apparaît plusieurs fois", champ: "traits_raciaux_choisis" });
        }
        vus.add(tid);
      }
      for (const t of traits) {
        const tid = t.trait_id ?? "";
        const accessible = raceTraits.some((rt) => rt.race_id === raceId && rt.trait_id === tid);
        if (!accessible) {
          return repErr({
            code: "trait_invalide_pour_race",
            message: `Le trait ${tid} n'est pas accessible à cette race`,
            champ: "traits_raciaux_choisis",
          });
        }
      }
      for (const t of traits) {
        const tid = t.trait_id ?? "";
        const xp = t.xp_depense ?? 0;
        if (t.est_gratuit === true && xp !== 0) {
          return repErr({
            code: "trait_gratuit_xp_non_nul",
            message: `Le trait ${tid} est gratuit mais a un xp_depense non nul`,
            champ: "traits_raciaux_choisis",
          });
        }
        if (t.est_gratuit !== true) {
          const cout = traitsRaciaux.find((tr) => tr.id === tid)?.cout_xp ?? 0;
          if (xp !== cout) {
            return repErr({
              code: "trait_payant_xp_incorrect",
              message: `Le trait ${tid} coûte ${cout} XP, pas ${xp}`,
              champ: "traits_raciaux_choisis",
            });
          }
        }
      }

      const nb = avancerVers(appliquerEtape3(b, payload), 3, 4);
      sauverBrouillon(nb);
      return repOk({
        personnage_id: PERSONNAGE_LOCAL_ID,
        etape_creation_apres: nb.meta.etapeCourante,
        traits_raciaux_choisis: traits,
      });
    },

    async sauvegarderEtape4(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = chargerBrouillon();
      if (!b) return repBrouillonAbsent();

      const choix = (params.p_choix_par_competence ?? undefined) as
        | Record<string, string>
        | undefined;
      const payload = { classeId: params.p_classe_id, choixParCompetence: choix };

      if (params.p_brouillon) {
        const nb = appliquerEtape4(b, payload);
        sauverBrouillon(nb);
        return repOk({ personnage_id: PERSONNAGE_LOCAL_ID, brouillon: true, etape_creation_apres: nb.meta.etapeCourante });
      }

      // valider_etape_4 (baseline) — VERBATIM.
      if (!params.p_classe_id) {
        return repErr({ code: "classe_manquante", message: "La classe est obligatoire", champ: "classe_id" });
      }
      const classe = classes().find((c) => c.id === params.p_classe_id);
      if (!classe) {
        return repErr({ code: "classe_introuvable", message: "La classe sélectionnée n'existe pas", champ: "classe_id" });
      }
      const gratuites = (classe.competences_gratuites as Array<{ competence_id: string; niveau: number }> | null) ?? [];
      for (const gr of gratuites) {
        const comp = getCompetenceCat(gr.competence_id);
        if (comp?.type_choix != null) {
          const c = choix?.[gr.competence_id];
          if (c == null || c.trim() === "") {
            return repErr({
              code: "choix_manquant",
              message: `Choix de ${comp.type_choix} manquant pour ${comp.nom}`,
              champ: "choix_par_competence",
            });
          }
        }
      }

      const nb = avancerVers(appliquerEtape4(b, payload), 4, 5);
      sauverBrouillon(nb);
      return repOk({ personnage_id: PERSONNAGE_LOCAL_ID, etape_creation_apres: nb.meta.etapeCourante });
    },

    async avancerEtape(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = chargerBrouillon();
      if (!b) return repBrouillonAbsent();

      const etape = params.p_etape_courante;
      // Migration 20260520213653 — avancer_etape couvre 5..9.
      if (etape < 5 || etape > 9) {
        return repErr({ code: "etape_invalide", message: "avancer_etape ne couvre que les etapes 5 a 9." });
      }
      const val = validerEtape(b, deriver, etape);
      if (!val.valide) {
        return repErr(val.erreurs[0], { personnage_id: PERSONNAGE_LOCAL_ID }, val.avertissements);
      }
      const nb = avancerVers(b, etape, etape + 1);
      sauverBrouillon(nb);
      return repOk(
        { personnage_id: PERSONNAGE_LOCAL_ID, etape_creation_apres: nb.meta.etapeCourante },
        val.avertissements,
      );
    },

    async etatEditionPersonnage(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = chargerBrouillon();
      // Visiteur en création → toujours l'état "brouillon" (wizard).
      return rep({
        etat: b ? "brouillon" : null,
        peut_tout_editer: true,
        peut_ajouter: true,
        rattrapage_editable: true,
        raison: b ? "En création (wizard)." : "Personnage introuvable.",
        evenement_bloquant_id: null,
        evenement_inscrit_id: null,
        evenement_inscrit_titre: null,
        evenement_inscrit_date: null,
        dans_fenetre_gel: false,
        demande_mort_epitaphe: null,
      });
    },

    async validerPersonnageFinal(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = chargerBrouillon();
      if (!b) {
        return rep({
          valide: false,
          est_verrouille: false,
          erreurs: [{ code: "personnage_introuvable", message: "Personnage introuvable" }],
          avertissements: [],
        });
      }
      // Agrégat valider_etape_1..10 (migration 20260530021158).
      const erreurs: ErrItem[] = [];
      const avertissements: ErrItem[] = [];
      for (let e = 1; e <= 10; e++) {
        const v = validerEtape(b, deriver, e);
        erreurs.push(...v.erreurs);
        avertissements.push(...v.avertissements);
      }
      if (erreurs.length > 0) {
        return rep({ valide: false, est_verrouille: false, erreurs, avertissements });
      }
      // Marque le brouillon (aucune écriture serveur — sync = lot a4).
      const marque: BrouillonVisiteur = {
        ...b,
        meta: { ...b.meta, etapeCourante: 11 },
      };
      sauverBrouillon(marque);
      return rep({ valide: true, est_verrouille: true, erreurs: [], avertissements });
    },

    async corrigerXpPersonnage(_params) {
      // §50 — refus poli (action réservée aux comptes).
      return repErr({ code: "INDISPONIBLE_VISITEUR", message: "Cette action nécessite un compte." });
    },

    async changerClassePersonnage(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = chargerBrouillon();
      if (!b) return repBrouillonAbsent();
      const avant = classes().find((c) => c.id === b.etape4.classeId);
      const apres = classes().find((c) => c.id === params.p_classe_id);
      const xpAvant = deriver(b).xpDispo;
      const nb = changerClasse(b, params.p_classe_id);
      const xpApres = deriver(nb).xpDispo;
      // cf. TROUS_A3II §4 — aperçu de changement de classe non porté (tableaux vides).
      const donnees = {
        classe_avant: avant?.nom ?? null,
        classe_apres: apres?.nom ?? null,
        perdues: [] as unknown[],
        dormants: [] as unknown[],
        offertes: [] as unknown[],
        multi_choix: [] as unknown[],
        maitre_en_attente: [] as unknown[],
        xp_rembourse: Math.max(0, xpApres - xpAvant),
      };
      if (params.p_dry_run) return repOk(donnees);
      sauverBrouillon(nb);
      return repOk(donnees);
    },

    async verifierPrerequisCompetences(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = chargerBrouillon();
      if (!b) return rep({ erreur: "Personnage introuvable" });
      return rep(calculerPrerequis(b, deriver));
    },

    async apercuRabaisAcquisitionCompetence(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = chargerBrouillon();
      if (!b) return rep([]);
      return rep(calculerRabais(b, params.p_competence_id));
    },

    // ═══════════════════════════════════════════════════════════════════════
    // B — Lectures : catalogue (snapshot) + état perso (brouillon + dérivés)
    // ═══════════════════════════════════════════════════════════════════════

    // ── État perso ──

    async lirePersonnage(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: null, error: { message: "Personnage introuvable." } };
      const etat = deriver(b);
      // cf. TROUS_A3II §5 — colonnes serveur neutres.
      const row = {
        id: PERSONNAGE_LOCAL_ID,
        nom: b.etape1.nom,
        race_id: b.etape2.raceId || null,
        sous_type_chimeride: b.etape2.sousTypeChimeride ?? null,
        classe_id: b.etape4.classeId || null,
        religion_id: b.etape1.religionId,
        est_croyant: b.etape1.estCroyant,
        traits_raciaux_choisis: b.etape3.traitsRaciauxChoisis,
        historique: b.etape1.historique ?? null,
        ame_personnage: b.etape1.amePersonnage ?? null,
        gn_completes: b.etape1.gnCompletes,
        mini_gn_completes: b.etape1.miniGnCompletes,
        ouvertures_terrain: b.etape1.ouverturesTerrain,
        etape_creation: b.meta.etapeCourante,
        xp_total: etat.xpTotal,
        xp_depense: etat.xpDepense,
        pv_max: etat.pvMax,
        ps_max: etat.psMax,
      };
      return { data: row as unknown as never, error: null };
    },

    async lirePersonnageIdentite(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: null, error: { message: "Personnage introuvable." } };
      return {
        data: {
          nom: b.etape1.nom,
          gn_completes: b.etape1.gnCompletes,
          mini_gn_completes: b.etape1.miniGnCompletes,
          ouvertures_terrain: b.etape1.ouverturesTerrain,
          est_croyant: b.etape1.estCroyant,
          religion_id: b.etape1.religionId,
          historique: b.etape1.historique ?? null,
          ame_personnage: b.etape1.amePersonnage ?? null,
        } as unknown as never,
        error: null,
      };
    },

    async lirePersonnageRace(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: null, error: { message: "Personnage introuvable." } };
      return {
        data: {
          race_id: b.etape2.raceId || null,
          sous_type_chimeride: b.etape2.sousTypeChimeride ?? null,
          traits_raciaux_choisis: b.etape3.traitsRaciauxChoisis,
          xp_total: deriver(b).xpTotal,
        } as unknown as never,
        error: null,
      };
    },

    async lirePersonnageClasse(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: null, error: { message: "Personnage introuvable." } };
      return {
        data: {
          classe_id: b.etape4.classeId || null,
          race_id: b.etape2.raceId || null,
          religion_id: b.etape1.religionId,
          est_croyant: b.etape1.estCroyant,
          nom: b.etape1.nom,
        } as unknown as never,
        error: null,
      };
    },

    async lirePersonnageReligion(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: null, error: { message: "Personnage introuvable." } };
      return {
        data: { id: PERSONNAGE_LOCAL_ID, religion_id: b.etape1.religionId } as unknown as never,
        error: null,
      };
    },

    async lirePersonnageProgression(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: null, error: { message: "Personnage introuvable." } };
      const etat = deriver(b);
      return {
        data: {
          id: PERSONNAGE_LOCAL_ID,
          nom: b.etape1.nom,
          etape_creation: b.meta.etapeCourante,
          xp_total: etat.xpTotal,
          xp_depense: etat.xpDepense,
        } as unknown as never,
        error: null,
      };
    },

    // ── Catalogues (snapshot) ──

    async lireRaces() {
      const rows = races().filter((r) => r.est_actif && r.est_jouable);
      return { data: trierPar(rows, (r) => r.nom) as unknown as never, error: null };
    },

    async lireRace(raceId) {
      const r = races().find((x) => x.id === raceId);
      if (!r) return { data: null, error: { message: "Race introuvable." } };
      return { data: { id: r.id, nom: r.nom, restrictions_classes: r.restrictions_classes } as unknown as never, error: null };
    },

    async lireClasses() {
      const rows = classes().filter((c) => c.est_actif);
      return { data: trierPar(rows, (c) => c.nom) as unknown as never, error: null };
    },

    async lireClasse(classeId) {
      const c = classes().find((x) => x.id === classeId);
      if (!c) return { data: null, error: { message: "Classe introuvable." } };
      return { data: { id: c.id, nom: c.nom } as unknown as never, error: null };
    },

    async lireCompetences() {
      const rows = competences().filter((c) => c.est_actif);
      return { data: trierPar(rows, (c) => c.nom) as unknown as never, error: null };
    },

    async lireCompetencesParIds(ids) {
      const set = new Set(ids);
      const rows = competences()
        .filter((c) => set.has(c.id))
        .map((c) => ({
          id: c.id,
          nom: c.nom,
          type_choix: c.type_choix,
          type_achat: c.type_achat,
          niveaux: c.niveaux,
        }));
      return { data: rows as unknown as never, error: null };
    },

    async lireSorts(cercle, niveauMax) {
      const rows = (snap().tables.sorts as Array<Record<string, unknown>>).filter(
        (s) => s.cercle === cercle && (s.niveau as number) <= niveauMax && s.est_actif === true,
      );
      return { data: trierPar(rows, (s) => s.nom) as unknown as never, error: null };
    },

    async lireSortsCercles() {
      const seen = new Set<string>();
      const rows: Array<{ cercle: string }> = [];
      for (const s of snap().tables.sorts as Array<Record<string, unknown>>) {
        if (s.est_actif === true && s.cercle != null && !seen.has(s.cercle as string)) {
          seen.add(s.cercle as string);
          rows.push({ cercle: s.cercle as string });
        }
      }
      return { data: rows as unknown as never, error: null };
    },

    async lirePrieres(domaine, niveauMax) {
      const rows = (snap().tables.prieres as Array<Record<string, unknown>>).filter(
        (p) => p.domaine === domaine && (p.niveau as number) <= niveauMax && p.est_actif === true,
      );
      return { data: trierPar(rows, (p) => p.nom) as unknown as never, error: null };
    },

    async lirePrieresDomaines() {
      const seen = new Set<string>();
      const rows: Array<{ domaine: string }> = [];
      for (const p of snap().tables.prieres as Array<Record<string, unknown>>) {
        if (p.est_actif === true && p.domaine != null && !seen.has(p.domaine as string)) {
          seen.add(p.domaine as string);
          rows.push({ domaine: p.domaine as string });
        }
      }
      return { data: rows as unknown as never, error: null };
    },

    async lireReligions() {
      const rows = (snap().tables.religions as Array<Record<string, unknown>>).filter((r) => r.est_actif === true);
      return { data: trierPar(rows, (r) => r.nom) as unknown as never, error: null };
    },

    async lireReligionsCatalogue() {
      const rows = (snap().tables.religions as Array<Record<string, unknown>>)
        .filter((r) => r.est_actif === true)
        .map((r) => ({
          id: r.id, nom: r.nom, description: r.description, dirigeant: r.dirigeant,
          fondateur: r.fondateur, symbole_sacre: r.symbole_sacre, pouvoir_symbole: r.pouvoir_symbole,
          domaines_principaux: r.domaines_principaux, domaines_proscrits: r.domaines_proscrits,
          lore_fiche: r.lore_fiche, rituels_fiche: r.rituels_fiche, lore_manuel: r.lore_manuel, rituels_manuel: r.rituels_manuel,
        }));
      return { data: trierPar(rows, (r) => r.nom) as unknown as never, error: null };
    },

    async lireReligionsFiches() {
      const rows = (snap().tables.religions as Array<Record<string, unknown>>)
        .filter((r) => r.est_actif === true)
        .map((r) => ({
          id: r.id, nom: r.nom, dirigeant: r.dirigeant, fondateur: r.fondateur,
          symbole_sacre: r.symbole_sacre, pouvoir_symbole: r.pouvoir_symbole,
          domaines_principaux: r.domaines_principaux, domaines_proscrits: r.domaines_proscrits,
          lore_fiche: r.lore_fiche, rituels_fiche: r.rituels_fiche, lore_manuel: r.lore_manuel, rituels_manuel: r.rituels_manuel,
        }));
      return { data: rows as unknown as never, error: null };
    },

    async lireReligionProscrits(religionId) {
      const r = (snap().tables.religions as Array<Record<string, unknown>>).find((x) => x.id === religionId);
      if (!r) return { data: null, error: { message: "Religion introuvable." } };
      return { data: { domaines_proscrits: r.domaines_proscrits } as unknown as never, error: null };
    },

    async lireLangues() {
      const rows = (snap().tables.langues as Array<Record<string, unknown>>)
        .filter((l) => l.est_actif === true)
        .map((l) => ({ id: l.id, nom: l.nom, est_ancienne: l.est_ancienne, ordre: l.ordre }));
      return { data: trierPar(rows, (l) => l.ordre).map(({ id, nom, est_ancienne }) => ({ id, nom, est_ancienne })) as unknown as never, error: null };
    },

    async lireLanguesAnciennes() {
      const rows = (snap().tables.langues as Array<Record<string, unknown>>)
        .filter((l) => l.est_ancienne === true && l.est_actif === true)
        .map((l) => ({ id: l.id, nom: l.nom, ordre: l.ordre }));
      return { data: trierPar(rows, (l) => l.ordre, (l) => l.nom) as unknown as never, error: null };
    },

    async lireCategoriesCreatures() {
      const rows = (snap().tables.categories_creatures as Array<Record<string, unknown>>)
        .filter((c) => c.est_actif === true)
        .map((c) => ({ id: c.id, nom: c.nom, ordre: c.ordre }));
      return { data: trierPar(rows, (c) => c.ordre) as unknown as never, error: null };
    },

    async lireFamillesCriminelles() {
      const rows = (snap().tables.familles_criminelles as Array<Record<string, unknown>>)
        .filter((f) => f.est_actif === true)
        .map((f) => ({ id: f.id, nom: f.nom }));
      return { data: trierPar(rows, (f) => f.nom) as unknown as never, error: null };
    },

    async lirePieges() {
      const rows = (snap().tables.pieges as Array<Record<string, unknown>>).filter((p) => p.est_actif === true);
      return { data: trierPar(rows, (p) => p.nom, (p) => p.niveau) as unknown as never, error: null };
    },

    async lireRecettesAlchimie(niveauMax) {
      const rows = (snap().tables.recettes_alchimie as Array<Record<string, unknown>>).filter(
        (r) => r.est_actif === true && (r.niveau_requis as number) <= niveauMax,
      );
      return { data: trierPar(rows, (r) => r.niveau_requis, (r) => r.nom) as unknown as never, error: null };
    },

    async lireObjetsForge() {
      const reparations = snap().tables.reparations_forge as Array<Record<string, unknown>> | undefined;
      const rows: Array<Record<string, unknown>> = (snap().tables.objets_forge as Array<Record<string, unknown>>)
        .filter((o) => o.est_actif === true)
        .map((o) => ({
          ...o,
          reparation:
            reparations?.find((r) => r.id === o.reparation_id) != null
              ? (() => {
                  const r = reparations.find((x) => x.id === o.reparation_id)!;
                  return {
                    nom_affichage: r.nom_affichage,
                    temps_minutes: r.temps_minutes,
                    temps_rare_minutes: r.temps_rare_minutes,
                    materiaux: r.materiaux,
                    materiaux_rares: r.materiaux_rares,
                  };
                })()
              : null,
        }));
      return {
        data: trierPar(rows, (o) => o.temps_fabrication_minutes, (o) => o.nom) as unknown as never,
        error: null,
      };
    },

    async lireObjetsJoaillerie() {
      const rows = (snap().tables.objets_joaillerie as Array<Record<string, unknown>>).filter((o) => o.est_actif === true);
      return { data: trierPar(rows, (o) => o.temps_fabrication_minutes, (o) => o.nom) as unknown as never, error: null };
    },

    async lireAssemblagesRunes() {
      const rows = (snap().tables.assemblages_runes as Array<Record<string, unknown>>).filter((a) => a.est_actif === true);
      return { data: trierPar(rows, (a) => a.nom) as unknown as never, error: null };
    },

    async lireParametresJeu() {
      const p = (snap().tables.parametres_jeu as Array<Record<string, unknown>>)[0];
      if (!p) return { data: null, error: null };
      return {
        data: {
          lien_facebook: p.lien_facebook ?? null,
          lien_discord: p.lien_discord ?? null,
          texte_envoi_photos_race: p.texte_envoi_photos_race ?? null,
        } as unknown as never,
        error: null,
      };
    },

    async lireTraitsParRace(raceId, sousType) {
      const raceTraits = snap().tables.race_traits as Array<{ trait_id: string; race_id: string; sous_type: string | null }>;
      const traits = snap().tables.traits_raciaux as Array<Record<string, unknown>>;
      const rows = raceTraits
        .filter(
          (rt) =>
            rt.race_id === raceId &&
            (sousType ? rt.sous_type === sousType || rt.sous_type == null : rt.sous_type == null),
        )
        .map((rt) => {
          const t = traits.find((x) => x.id === rt.trait_id);
          return {
            trait_id: rt.trait_id,
            sous_type: rt.sous_type,
            trait_nom: t?.nom ?? null,
            trait_description: t?.description ?? null,
            trait_texte_manuel: t?.texte_manuel ?? null,
            trait_resume_condense: t?.resume_condense ?? null,
            cout_xp: t?.cout_xp ?? null,
          };
        })
        .filter((r) => {
          const t = traits.find((x) => x.trait_id === r.trait_id);
          return t?.est_actif !== false;
        });
      return { data: trierPar(rows, (r) => r.trait_nom) as unknown as never, error: null };
    },

    // ── Dérivés (vues) ──

    async lireDomainesDisponibles(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: [] as unknown as never, error: null };
      const etat = deriver(b);
      const map = deriverDomainesDisponibles(
        etat.contexteMagie.competencesAcquises,
        etat.contexteMagie.religionId ?? null,
      );
      const rows = [...map.entries()].map(([domaine, niveau_max_prieres]) => ({
        domaine,
        niveau_max_prieres,
        personnage_id: PERSONNAGE_LOCAL_ID,
      }));
      return { data: trierPar(rows, (r) => r.domaine) as unknown as never, error: null };
    },

    async lireCerclesDisponibles(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: [] as unknown as never, error: null };
      const etat = deriver(b);
      const map = deriverCerclesDisponibles(etat.contexteMagie.competencesAcquises);
      const rows = [...map.entries()].map(([cercle, niveau_max_sorts]) => ({
        cercle,
        niveau_max_sorts,
        personnage_id: PERSONNAGE_LOCAL_ID,
      }));
      return { data: trierPar(rows, (r) => r.cercle) as unknown as never, error: null };
    },

    async lireArtisanatQuotas(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: null, error: null };
      const etat = deriver(b);
      const na = etat.niveauxArtisanat;
      // Compteurs « utilisés » = items GRATUITS acquis, ventilés comme la vue
      // serveur `vue_artisanat_quotas` (audit s311 TOP 4) :
      //  - pièges : count(personnage_pieges WHERE niveau_acquis=N AND est_gratuit)
      //  - recettes : count(personnage_recettes JOIN recettes_alchimie
      //               WHERE niveau_requis=palier AND est_gratuit)
      //  - assemblages : count(personnage_assemblages WHERE est_gratuit)
      const recettesCat = snap().tables.recettes_alchimie as Array<{
        id: string;
        niveau_requis: number | null;
      }>;
      const piegesGratuitsNiv = (niveau: number) =>
        etat.contextePiege.piegesAcquis.filter(
          (p) => p.niveauAcquis === niveau && p.estGratuit,
        ).length;
      const recettesGratuitesPalier = (palier: number) =>
        etat.contexteRecette.recettesAcquises.filter(
          (r) =>
            r.estGratuit &&
            (recettesCat.find((x) => x.id === r.recetteId)?.niveau_requis ?? 0) === palier,
        ).length;
      const assemblagesGratuits = etat.contexteAssemblage.assemblagesAcquis.filter(
        (a) => a.estGratuit,
      ).length;
      // cf. TROUS_A3II §1 — forge/joaillerie posés à neutre.
      const row = {
        personnage_id: PERSONNAGE_LOCAL_ID,
        niveau_alchimie: na.niveauAlchimie,
        niveau_runes: na.niveauRunes,
        niveau_pieges: na.niveauPieges,
        niveau_forge: null,
        niveau_joaillerie: null,
        a_forge_legendaire: false,
        a_joaillerie_legendaire: false,
        quota_pieges_niv1_total: etat.quotas.piegesParNiveau[1],
        quota_pieges_amelioration_niv2_total: etat.quotas.piegesParNiveau[2],
        quota_pieges_amelioration_niv3_total: etat.quotas.piegesParNiveau[3],
        quota_alchimie_mineure_total: etat.quotas.recettesParPalier[1],
        quota_alchimie_intermediaire_total: etat.quotas.recettesParPalier[2],
        quota_alchimie_majeure_total: etat.quotas.recettesParPalier[3],
        quota_assemblages_total: etat.quotas.assemblagesTotal,
        quota_recettes_total: null,
        quota_pieges_niv1_utilises: piegesGratuitsNiv(1),
        quota_pieges_amelioration_niv2_utilises: piegesGratuitsNiv(2),
        quota_pieges_amelioration_niv3_utilises: piegesGratuitsNiv(3),
        quota_alchimie_mineure_utilises: recettesGratuitesPalier(1),
        quota_alchimie_intermediaire_utilises: recettesGratuitesPalier(2),
        quota_alchimie_majeure_utilises: recettesGratuitesPalier(3),
        quota_assemblages_utilises: assemblagesGratuits,
      };
      return { data: row as unknown as never, error: null };
    },

    // ── État perso (achats) ──

    async lirePersonnageCompetences(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: [] as unknown as never, error: null };
      const etat = deriver(b);
      const rows = etat.contextePersonnage.competencesAcquises.map((c) => {
        const gratuit = estGratuite(etat, c.competenceId, c.niveauAcquis, c.choixAchat);
        return {
          id: idComp(c.competenceId, c.niveauAcquis, c.choixAchat),
          personnage_id: PERSONNAGE_LOCAL_ID,
          competence_id: c.competenceId,
          niveau_acquis: c.niveauAcquis,
          choix_achat: c.choixAchat,
          // xp_depense EFFECTIF (rabais cercle/domaine inclus) → badge « Gratuit »
          // (xp_depense === 0) fidèle au serveur.
          xp_depense: gratuit
            ? 0
            : coutAchatCompetence(b, c.competenceId, c.niveauAcquis, c.choixAchat),
          appris_via_maitre: false,
          nom_maitre: null,
          statut_maitre: gratuit ? "non_requis" : null,
          date_acquisition: b.meta.creeLe,
          rabais_items: null,
        };
      });
      return { data: rows as unknown as never, error: null };
    },

    async lirePersonnageCompetencesNoms(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: [] as unknown as never, error: null };
      const etat = deriver(b);
      const rows: CompetenceNom[] = etat.contextePersonnage.competencesAcquises.map((c) => ({
        competences: { nom: getCompetenceCat(c.competenceId)?.nom ?? null },
      }));
      return { data: rows as unknown as never, error: null };
    },

    async lireNiveauCompetenceParNom(personnageId, nomCompetence) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: [] as unknown as never, error: null };
      const etat = deriver(b);
      const niveaux = etat.contextePersonnage.competencesAcquises
        .filter((c) => (getCompetenceCat(c.competenceId)?.nom ?? null) === nomCompetence)
        .map((c) => c.niveauAcquis);
      if (niveaux.length === 0) return { data: [] as unknown as never, error: null };
      const row: NiveauCompetence = {
        niveau_acquis: Math.max(...niveaux),
        competences: { nom: nomCompetence },
      };
      return { data: [row] as unknown as never, error: null };
    },

    async lirePersonnageSorts(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: [] as unknown as never, error: null };
      const rows: LigneSortAcquis[] = b.acquisitions.sorts.map((s) => {
        const cat = getSortCat(s.sortId);
        const catFull = (snap().tables.sorts as Array<Record<string, unknown>>).find((x) => x.id === s.sortId);
        return {
          id: idSort(s.sortId),
          personnage_id: PERSONNAGE_LOCAL_ID,
          sort_id: s.sortId,
          niveau_sort: s.niveauSort,
          zone_choisie: s.zoneChoisie,
          portee_choisie: s.porteeChoisie,
          duree_choisie: s.dureeChoisie,
          nom_personnalise: s.nomPersonnalise ?? null,
          statut: "achete",
          // Le serveur stocke `generer_formule_magique(cercle, zone, portee,
          // duree, niveau)` à l'achat/modif ; le port `genererFormuleMagique`
          // est identique (mot manquant → null) → on le rebranche (audit s311).
          formule_magique: genererFormuleMagique(
            cat?.cercle ?? null,
            s.zoneChoisie,
            s.porteeChoisie,
            s.dureeChoisie,
            s.niveauSort,
          ),
          date_acquisition: b.meta.creeLe,
          xp_depense: calculerCoutXP(s.zoneChoisie, s.porteeChoisie, s.dureeChoisie, s.niveauSort, cat?.cout_xp_base ?? 0),
          sorts: catFull
            ? {
                nom: catFull.nom, cercle: catFull.cercle, zone_effet: catFull.zone_effet, portee: catFull.portee,
                duree: catFull.duree, cout_xp_base: catFull.cout_xp_base, bonus_niveau: catFull.bonus_niveau,
                resume_condense: catFull.resume_condense, description: catFull.description, description_tronc: catFull.description_tronc,
                paliers: catFull.paliers, type_sort: catFull.type_sort, effet_instance: catFull.effet_instance,
              }
            : null,
        } as unknown as LigneSortAcquis;
      });
      return { data: rows as unknown as never, error: null };
    },

    async lirePersonnagePrieres(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: [] as unknown as never, error: null };
      const rows: LignePriereAcquise[] = b.acquisitions.prieres.map((p) => {
        const cat = getPriereCat(p.priereId);
        const catFull = (snap().tables.prieres as Array<Record<string, unknown>>).find((x) => x.id === p.priereId);
        return {
          id: idPriere(p.priereId),
          personnage_id: PERSONNAGE_LOCAL_ID,
          priere_id: p.priereId,
          niveau_priere: p.niveauPriere,
          zone_choisie: p.zoneChoisie,
          portee_choisie: p.porteeChoisie,
          duree_choisie: p.dureeChoisie,
          nom_personnalise: p.nomPersonnalise ?? null,
          statut: "achete",
          // Le serveur stocke `calculer_duree_incantation_priere(portee, zone,
          // duree, niveau)` à l'achat/modif ; le port `calculerDureeIncantation`
          // est identique → on le rebranche (audit s311 TOP 5b).
          duree_incantation_calculee: calculerDureeIncantation(
            p.porteeChoisie,
            p.zoneChoisie,
            p.dureeChoisie,
            p.niveauPriere,
          ),
          date_acquisition: b.meta.creeLe,
          xp_depense: calculerCoutXP(p.zoneChoisie, p.porteeChoisie, p.dureeChoisie, p.niveauPriere, cat?.cout_xp_base ?? 0),
          prieres: catFull
            ? {
                nom: catFull.nom, domaine: catFull.domaine, zone_effet: catFull.zone_effet, portee: catFull.portee,
                duree: catFull.duree, cout_xp_base: catFull.cout_xp_base, bonus_niveau: catFull.bonus_niveau,
                resume_condense: catFull.resume_condense, description: catFull.description, description_tronc: catFull.description_tronc,
                paliers: catFull.paliers, type_priere: catFull.type_priere, effet_instance: catFull.effet_instance,
              }
            : null,
        } as unknown as LignePriereAcquise;
      });
      return { data: rows as unknown as never, error: null };
    },

    async lirePersonnagePieges(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: [] as unknown as never, error: null };
      const etat = deriver(b);
      const rows = etat.contextePiege.piegesAcquis.map((p, i) => {
        const item = b.acquisitions.pieges[i];
        const cat = item ? (snap().tables.pieges as Array<Record<string, unknown>>).find((x) => x.id === item.piegeId) : undefined;
        return {
          id: item ? idPiege(item.piegeId) : idPiege(String(i)),
          personnage_id: PERSONNAGE_LOCAL_ID,
          piege_id: item?.piegeId ?? "",
          piege_nom: p.piegeNom,
          niveau_acquis: p.niveauAcquis,
          est_gratuit: p.estGratuit,
          xp_depense: p.estGratuit ? 0 : (cat?.cout_xp as number | null) ?? 0,
          date_acquisition: b.meta.creeLe,
          created_at: b.meta.creeLe,
          updated_at: b.meta.modifieLe,
        };
      });
      return { data: rows as unknown as never, error: null };
    },

    async lirePersonnageRecettes(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: [] as unknown as never, error: null };
      const etat = deriver(b);
      const rows = etat.contexteRecette.recettesAcquises.map((r) => {
        const cat = (snap().tables.recettes_alchimie as Array<Record<string, unknown>>).find((x) => x.id === r.recetteId);
        return {
          id: idRecette(r.recetteId),
          personnage_id: PERSONNAGE_LOCAL_ID,
          recette_id: r.recetteId,
          est_gratuit: r.estGratuit,
          xp_depense: r.estGratuit ? 0 : (cat?.cout_xp as number | null) ?? 0,
          date_acquisition: b.meta.creeLe,
        };
      });
      return { data: rows as unknown as never, error: null };
    },

    async lirePersonnageAssemblages(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = chargerBrouillon();
      if (!b) return { data: [] as unknown as never, error: null };
      const etat = deriver(b);
      const rows = etat.contexteAssemblage.assemblagesAcquis.map((a) => {
        const cat = (snap().tables.assemblages_runes as Array<Record<string, unknown>>).find((x) => x.id === a.assemblageId);
        return {
          id: idAssemblage(a.assemblageId),
          personnage_id: PERSONNAGE_LOCAL_ID,
          assemblage_id: a.assemblageId,
          est_gratuit: a.estGratuit,
          xp_depense: a.estGratuit ? 0 : (cat?.cout_xp as number | null) ?? 0,
          date_acquisition: b.meta.creeLe,
        };
      });
      return { data: rows as unknown as never, error: null };
    },
  };
}

// ============================================================
// Helpers hors fabrique (purs, indépendants de la couture)
// ============================================================

/** Avance `meta.etapeCourante` de `de` vers `vers` seulement si on est à `de`. */
function avancerVers(b: BrouillonVisiteur, de: number, vers: number): BrouillonVisiteur {
  if (b.meta.etapeCourante !== de) return b;
  return { ...b, meta: { ...b.meta, etapeCourante: vers } };
}

interface ResultatValidation {
  valide: boolean;
  erreurs: ErrItem[];
  avertissements: ErrItem[];
}

/**
 * Portage des `valider_etape_N` (messages VERBATIM). Étapes 1-4 : identité déjà
 * validée à la sauvegarde ; ici on couvre 5-10 (magie/artisanat/xp) + rappel 1-4
 * pour la finalisation agrégée. Cf. §B1-B10 du SQL.
 */
function validerEtape(
  b: BrouillonVisiteur,
  deriver: (b: BrouillonVisiteur) => EtatDeriveVisiteur,
  etape: number,
): ResultatValidation {
  const ok: ResultatValidation = { valide: true, erreurs: [], avertissements: [] };
  const snapshot = getSnapshot();

  switch (etape) {
    case 1: {
      const e = b.etape1;
      if (!e.nom) return err("nom_manquant", "Le nom du personnage est obligatoire", "nom");
      if (e.nom.trim().length < 2) return err("nom_trop_court", "Le nom doit contenir au moins 2 caractères", "nom");
      if (e.estCroyant && e.religionId == null) return err("religion_manquante", "Un personnage croyant doit avoir une religion", "religion_id");
      if (!e.estCroyant && e.religionId != null) return err("religion_incoherente", "Un personnage non-croyant ne doit pas avoir de religion", "religion_id");
      if (e.gnCompletes < 0) return err("gn_completes_negatif", "Le nombre de GN complétés ne peut pas être négatif", "gn_completes");
      return ok;
    }
    case 2: {
      if (!b.etape2.raceId) return err("race_manquante", "La race est obligatoire", "race_id");
      return ok;
    }
    case 3:
      return ok; // traits validés à la sauvegarde (étape 3)
    case 4: {
      if (!b.etape4.classeId) return err("classe_manquante", "La classe est obligatoire", "classe_id");
      return ok;
    }
    case 5: {
      const nbPayantes = b.acquisitions.competences.length;
      if (nbPayantes === 0) {
        return {
          valide: true,
          erreurs: [],
          avertissements: [{ code: "info_aucune_competence_payante", message: "Vous n'avez acheté aucune compétence supplémentaire" }],
        };
      }
      return ok;
    }
    case 6: {
      if (b.acquisitions.sorts.length === 0) return ok; // ignoree
      const etat = deriver(b);
      const cercles = deriverCerclesDisponibles(etat.contexteMagie.competencesAcquises);
      for (const s of b.acquisitions.sorts) {
        const cat = (snapshot.tables.sorts as Array<Record<string, unknown>>).find((x) => x.id === s.sortId);
        const cercle = (cat?.cercle as string) ?? "";
        const nom = (cat?.nom as string) ?? "";
        const max = cercles.get(cercle);
        if (max == null) {
          return err("sort_cercle_non_debloque", `Le sort ${nom} appartient au cercle ${cercle}, non débloqué`, "personnage_sorts");
        }
        if (s.niveauSort > max) {
          return err("sort_niveau_trop_eleve", `Le sort ${nom} (niveau ${s.niveauSort}) dépasse le max ${max} du cercle ${cercle}`, "personnage_sorts");
        }
      }
      return ok;
    }
    case 7: {
      if (b.acquisitions.prieres.length === 0) return ok;
      const etat = deriver(b);
      const domaines = deriverDomainesDisponibles(etat.contexteMagie.competencesAcquises, etat.contexteMagie.religionId ?? null);
      for (const p of b.acquisitions.prieres) {
        const cat = (snapshot.tables.prieres as Array<Record<string, unknown>>).find((x) => x.id === p.priereId);
        const domaine = (cat?.domaine as string) ?? "";
        const nom = (cat?.nom as string) ?? "";
        const max = domaines.get(domaine);
        if (max == null) {
          return err("priere_domaine_non_debloque", `La prière ${nom} appartient au domaine ${domaine}, non débloqué`, "personnage_prieres");
        }
        if (p.niveauPriere > max) {
          return err("priere_niveau_trop_eleve", `La prière ${nom} (niveau ${p.niveauPriere}) dépasse le max ${max} du domaine ${domaine}`, "personnage_prieres");
        }
      }
      return ok;
    }
    case 8: {
      const etat = deriver(b);
      if (etat.niveauxArtisanat.niveauRunes < 1) return ok; // pas runiste → ignoree
      const utilises = etat.contexteAssemblage.assemblagesAcquis.filter((a) => a.estGratuit).length;
      if (utilises > etat.quotas.assemblagesTotal) {
        return err("artisanat_quota_depasse", `Quota assemblages gratuits dépassé (${utilises}/${etat.quotas.assemblagesTotal})`, "personnage_assemblages");
      }
      return ok;
    }
    case 9: {
      const etat = deriver(b);
      if (etat.niveauxArtisanat.niveauAlchimie < 1) return ok; // ignoree
      const parPalier = (palier: 1 | 2 | 3) =>
        etat.contexteRecette.recettesAcquises.filter((r) => {
          const cat = (snapshot.tables.recettes_alchimie as Array<Record<string, unknown>>).find((x) => x.id === r.recetteId);
          return (cat?.niveau_requis as number) === palier && r.estGratuit;
        }).length;
      const libelle: Record<1 | 2 | 3, string> = { 1: "mineure", 2: "intermédiaire", 3: "majeure" };
      for (const palier of [1, 2, 3] as const) {
        const util = parPalier(palier);
        const total = etat.quotas.recettesParPalier[palier];
        if (util > total) {
          return err("artisanat_quota_depasse", `Quota recettes alchimie ${libelle[palier]} dépassé (${util}/${total})`, "personnage_recettes");
        }
      }
      return ok;
    }
    case 10: {
      const etat = deriver(b);
      if (etat.xpDepense > etat.xpTotal) {
        return err("xp_insuffisant", `XP dépensée (${etat.xpDepense}) supérieure à XP totale (${etat.xpTotal})`, "xp_depense");
      }
      return ok;
    }
    default:
      return ok;
  }

  function err(code: string, message: string, champ?: string): ResultatValidation {
    return { valide: false, erreurs: [{ code, message, champ }], avertissements: [] };
  }
}

/**
 * `verifier_prerequis_competences` — version pastille-classe (migration
 * 20260706195514). La classe affiche une pastille (vert/rouge) SANS entrer dans
 * `v_manquants` ni réduire `niveau_max_achetable`.
 */
function calculerPrerequis(
  b: BrouillonVisiteur,
  deriver: (b: BrouillonVisiteur) => EtatDeriveVisiteur,
): Record<string, unknown> {
  const etat = deriver(b);
  const acquis = etat.contextePersonnage.competencesAcquises;
  const classeNom = etat.contextePersonnage.classeNom;
  const classeNorm =
    classeNom === "Guerrier" ? "guerrier"
    : classeNom === "Voleur" ? "voleur"
    : classeNom === "Mage" ? "mage"
    : classeNom === "Prêtre" ? "pretre"
    : null;
  const psMax = etat.contextePersonnage.psMax;
  const snapshot = getSnapshot();

  const niveauActuelParNom = (nom: string): number =>
    Math.max(0, ...acquis.filter((a) => a.competenceNom === nom).map((a) => a.niveauAcquis));

  const resultat: Record<string, unknown> = {};

  for (const comp of snapshot.tables.competences) {
    const prereqParNiveau: Record<string, Array<{ label: string; statut: string; competence_id: string | null }>> = {};
    const raisonsParNiveau: Record<string, string> = {};
    let niveauMaxAchetable = 3;

    for (let niveau = 1; niveau <= 3; niveau++) {
      const prereqNiv: Array<{ label: string; statut: string; competence_id: string | null }> = [];
      const manquants: string[] = [];

      // Prérequis de CLASSE : pastille sans impacter les manquants.
      const classesReq = comp.classes_requises;
      if (niveau === 1 && classesReq && classesReq.length > 0) {
        const acquisClasse = classeNorm != null && classesReq.includes(classeNorm);
        prereqNiv.push({
          label: classesReq.join(" ou "),
          statut: acquisClasse ? "acquis" : "manquant",
          competence_id: null,
        });
      }

      // Prérequis compétences (objet indexé par niveau).
      const raw = comp.prerequis_competences as unknown;
      let liste: Array<{ competence_nom: string; niveau_min: number }> = [];
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const forLevel = (raw as Record<string, unknown>)[String(niveau)];
        if (Array.isArray(forLevel)) liste = forLevel as Array<{ competence_nom: string; niveau_min: number }>;
      }
      for (const pr of liste) {
        const actuel = niveauActuelParNom(pr.competence_nom);
        const okPre = actuel >= pr.niveau_min;
        const label = `${pr.competence_nom} niveau ${pr.niveau_min}`;
        prereqNiv.push({ label, statut: okPre ? "acquis" : "manquant", competence_id: null });
        if (!okPre) manquants.push(label);
      }

      if (prereqNiv.length > 0) prereqParNiveau[String(niveau)] = prereqNiv;
      if (manquants.length > 0) {
        raisonsParNiveau[String(niveau)] = `Prérequis manquant(s) : ${manquants.join(", ")}`;
        if (niveau - 1 < niveauMaxAchetable) niveauMaxAchetable = niveau - 1;
      }
    }

    if (niveauMaxAchetable < 3 || Object.keys(prereqParNiveau).length > 0) {
      resultat[comp.id] = {
        niveau_max_achetable: niveauMaxAchetable,
        raisons_par_niveau: raisonsParNiveau,
        prereqs_par_niveau: prereqParNiveau,
      };
    }
  }

  void psMax; // (les prérequis "special" ps sont hors compétences catalogue standard)
  return resultat;
}

/**
 * `apercu_rabais_acquisition_competence` (migration 20260617185134). Rassemble
 * les items du choix (sorts pour un cercle, prières pour un domaine) puis délègue
 * le calcul à `calculerLignesRabais` (moteurCreation/rabais.ts) — LA MÊME fonction
 * que consomme le débit (`deriver.coutAchatCompetence`), garantissant prix affiché
 * == prix débité. `type_choix ∉ (cercle, domaine)` → `[]`.
 */
function calculerRabais(b: BrouillonVisiteur, competenceId: string): unknown[] {
  const comp = getSnapshot().tables.competences.find((c) => c.id === competenceId);
  if (!comp || (comp.type_choix !== "cercle" && comp.type_choix !== "domaine")) return [];

  const niveaux = comp.niveaux as Array<{ niveau: number; cout_xp: number }> | null;
  const baseParNiveau = {
    2: niveaux?.find((n) => n.niveau === 2)?.cout_xp ?? 0,
    3: niveaux?.find((n) => n.niveau === 3)?.cout_xp ?? 0,
  };

  // Regroupe les niveaux des items (sorts/prières) par choix (cercle/domaine).
  const itemsParChoix = new Map<string, number[]>();
  if (comp.type_choix === "cercle") {
    for (const s of b.acquisitions.sorts) {
      const cercle = getSortCat(s.sortId)?.cercle;
      if (cercle == null) continue;
      const arr = itemsParChoix.get(cercle) ?? [];
      arr.push(s.niveauSort);
      itemsParChoix.set(cercle, arr);
    }
  } else {
    for (const p of b.acquisitions.prieres) {
      const domaine = getPriereCat(p.priereId)?.domaine;
      if (domaine == null) continue;
      const arr = itemsParChoix.get(domaine) ?? [];
      arr.push(p.niveauPriere);
      itemsParChoix.set(domaine, arr);
    }
  }

  return calculerLignesRabais(baseParNiveau, itemsParChoix);
}

// ============================================================
// Instance par défaut (prod) — la couture n'est jamais utilisée par l'app.
// ============================================================

export const clientVisiteur: ClientCreation = creerClientVisiteur();
