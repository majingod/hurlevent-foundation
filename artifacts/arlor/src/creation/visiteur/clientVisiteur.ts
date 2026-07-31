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
import { TABLE_SOURCE_ENCYCLOPEDIE } from "../encyclopedie";
import { rechercherEncyclopedieLocale } from "./rechercheEncyclopedieLocale";
import { calculerCoutXP, calculerDureeIncantation } from "@/utils/calculsMagie";
import { genererFormuleMagique } from "@/moteurCreation/formuleMagique";
import {
  deriverEtat,
  coutAchatCompetence,
  type EtatDeriveVisiteur,
} from "@/moteurCreation/brouillon/deriver";
import { appliquerGratuites } from "@/moteurCreation/gratuites";
import type { EtatCreationVisiteur } from "@/moteurCreation/deriveurs";
import { calculerLignesRabais } from "@/moteurCreation/rabais";
import {
  deriverCerclesDisponibles,
  deriverDomainesDisponibles,
} from "@/moteurCreation/deriveurs";
import { peutAcheterCompetence } from "@/moteurCreation/gatesCompetences";
import { peutAcheterSort, peutAcheterPriere } from "@/moteurCreation/gatesMagie";
import { refusPlafondMagie } from "@/utils/calculsMagie";
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
} from "@/moteurCreation/brouillon/appliquer";
import {
  creerBrouillonVide,
  type BrouillonVisiteur,
  type BrouillonSort,
  type BrouillonPriere,
} from "@/moteurCreation/brouillon/types";
import {
  calculerPrerequis,
  cascadeParPrerequis,
} from "@/moteurCreation/brouillon/prerequis";
import {
  calculerCascadeChangementClasse,
  type ResultatCascade,
} from "@/moteurCreation/brouillon/cascadeClasse";
import {
  chargerBrouillon,
  sauverBrouillon,
} from "./stockageBrouillon";
import * as adaptateurFiche from "@/moteurCreation/brouillon/adaptateurFiche";

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
  /**
   * Lecture du brouillon. Défaut : slot `localStorage` (`chargerBrouillon`).
   * Injecté pour instancier un client EN MÉMOIRE (pré-vol VIS-6 Lot 2) qui ne
   * touche jamais le slot `localStorage`.
   */
  charger?: () => BrouillonVisiteur | null;
  /**
   * Écriture du brouillon. Défaut : slot `localStorage` (`sauverBrouillon`).
   * Un pré-vol injecte une écriture EN MÉMOIRE (aucun effet sur `localStorage`).
   */
  sauver?: (b: BrouillonVisiteur) => void;
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

interface PiegeCat {
  id: string;
  nom: string | null;
  niveau: number | null;
  cout_xp: number | null;
}
function getPiegeCat(id: string): PiegeCat | undefined {
  return (snap().tables.pieges as unknown as PiegeCat[]).find((p) => p.id === id);
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
// Identité d'acquisition exposée en lecture
//
// Chaque ligne acquise porte un `instanceId` (uuid local, posé à l'achat). Les
// lectures exposent `id = instanceId` et les désachats retirent LA ligne portant
// cet id — fini l'encodage synthétique du catalogue qui effaçait toutes les copies
// d'un coup. SEULE exception : les compétences GRATUITES de classe sont DÉRIVÉES
// (hors `acquisitions`, donc sans `instanceId`) ; on leur donne un id synthétique
// préfixé `pc` via `idComp`, et un désachat qui le reçoit tombe sur le refus de
// gratuité (jamais sur une suppression de ligne réelle).
// ============================================================

const SEP = "";
function idGratuite(competenceId: string, niveau: number, choix: string | null): string {
  return ["pc", competenceId, String(niveau), choix ?? ""].join(SEP);
}
function decodeIdGratuite(
  id: string,
): { competenceId: string; niveauAcquis: number; choixAchat: string | null } | null {
  const [p, competenceId, niveau, choix] = id.split(SEP);
  if (p !== "pc") return null;
  return { competenceId, niveauAcquis: Number(niveau), choixAchat: choix === "" ? null : choix };
}

// ============================================================
// Fabrique
// ============================================================

export function creerClientVisiteur(deps: DepsVisiteur = {}): ClientCreation {
  const deriver = deps.deriver ?? deriverEtat;
  // Couture de persistance : par défaut le slot `localStorage`. Un client en
  // mémoire (pré-vol) injecte `charger`/`sauver` no-op → aucune écriture du slot.
  const charger = deps.charger ?? chargerBrouillon;
  const sauver = deps.sauver ?? sauverBrouillon;

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
    const b = charger();
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
        sauver(appliquerAchatCompetence(b, demande));
        return repOk(null);
      });
    },

    async desacheterCompetence(params) {
      // Portage FIDÈLE de `desacheter_competence` (A6, migration 20260610065923) :
      // refus gratuité → cascade niveaux → boucle prérequis → purge sorts/prières
      // → aperçu dry_run reflétant la cascade RÉELLE. Le serveur est la source.
      const b = charger();
      if (!b) return repBrouillonAbsent();

      // ── Cible : `id` reçu = `instanceId` d'une ligne payante OU id synthétique
      //    d'une gratuité de classe (dérivée, sans instance). On résout d'abord
      //    l'instance payante ; à défaut, on décode l'id de gratuité.
      const payantes = b.acquisitions.competences;
      const ciblePayante = payantes.find(
        (c) => c.instanceId === params.p_personnage_competence_id,
      );
      const cible = ciblePayante
        ? {
            competenceId: ciblePayante.competenceId,
            niveauAcquis: ciblePayante.niveauAcquis,
            choixAchat: ciblePayante.choixAchat,
          }
        : decodeIdGratuite(params.p_personnage_competence_id);
      if (!cible) return repErr({ code: "introuvable", message: "Compétence introuvable." });

      const comp = getCompetenceCat(cible.competenceId);
      if (!comp) {
        return repErr({ code: "competence_introuvable", message: "Compétence introuvable" });
      }

      const etat0 = deriver(b);
      const cibleGratuite =
        !ciblePayante &&
        estGratuite(etat0, cible.competenceId, cible.niveauAcquis, cible.choixAchat);
      const presente = ciblePayante != null || cibleGratuite;
      if (!presente) {
        return repErr({ code: "achat_introuvable", message: "Cet achat de compétence n'existe pas" });
      }

      // ── 1. Refus gratuité (sémantique serveur : xp_depense=0 ET NON desachat_force).
      //    xp effectif = 0 pour une gratuité de classe, un achat à 0 XP (« Acquisition
      //    de Sort/Prière ») OU un achat cercle/domaine dont le rabais annule le coût.
      const xpCible = ciblePayante
        ? coutAchatCompetence(b, cible.competenceId, cible.niveauAcquis, cible.choixAchat)
        : 0;
      if (xpCible === 0 && !comp.desachat_force) {
        return repErr({
          code: "competence_gratuite",
          message: "Une compétence acquise gratuitement (de classe) ne peut pas être désachetée",
        });
      }

      // ── 2. Retrait initial (achats du joueur uniquement — les gratuités de classe
      //    sont re-dérivées et ne sont jamais « retirées »).
      //    Cascade (`simple`/`unique_avec_choix`/`multiple_avec_choix_par_niveau`) :
      //    tous les niveaux ≥ cible (même choix). Sinon (`multiple_sans_choix`,
      //    `multiple_choix_distinct`) : UNE seule ligne — celle de l'`instanceId`
      //    ciblé, jamais toutes les copies du catalogue (identité d'instance).
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
      } else if (ciblePayante) {
        restantes = payantes.filter((c) => c.instanceId !== ciblePayante.instanceId);
      }

      // ── 3. Boucle prérequis (SOURCE UNIQUE `cascadeParPrerequis`, partagée avec
      //    le changement de classe) : tant que ça change, on recalcule les
      //    prérequis et on retire les niveaux excédentaires jusqu'à stabilité.
      restantes = cascadeParPrerequis(b, restantes, deriver);

      // Set des compétences RETIRÉES (initial + cascade prérequis).
      const retirees = payantes.filter((c) => !restantes.includes(c));

      // ── 4. Purge sorts/prières (Lot A — fidélité serveur `desacheter_competence`) :
      //    `v_purge_sorts := bool_or(c.nom = 'Acquisition de Sort')` sur le SET retiré
      //    (cascade incluse) → purge TOTALE des sorts SEULEMENT dans ce cas ; idem
      //    prières. AUCUNE purge par cercle/domaine « fermé » : quand une
      //    « Acquisition de Cercle/Domaine » redescend d'un niveau, les sorts/prières
      //    orphelins SURVIVENT au désachat — c'est `validerEtape(6/7)` qui les
      //    attrape ensuite (« Le sort X appartient au cercle Y, non débloqué » / max).
      const purgeSortsTout = retirees.some(
        (c) => getCompetenceCat(c.competenceId)?.nom === "Acquisition de Sort",
      );
      const purgePrieresTout = retirees.some(
        (c) => getCompetenceCat(c.competenceId)?.nom === "Acquisition de Prière",
      );
      const sortsGardes = purgeSortsTout ? [] : b.acquisitions.sorts;
      const prieresGardees = purgePrieresTout ? [] : b.acquisitions.prieres;
      const sortsRetires = purgeSortsTout ? b.acquisitions.sorts : [];
      const prieresRetirees = purgePrieresTout ? b.acquisitions.prieres : [];

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
      sauver(b2);
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
        const item: Omit<BrouillonSort, "instanceId"> = { ...demande, nomPersonnalise: params.p_nom_personnalise };
        sauver(appliquerAchatSort(b, item));
        return repOk(null);
      });
    },

    async desacheterSort(params) {
      const b = charger();
      if (!b) return repBrouillonAbsent();
      // `id` = `instanceId` de la ligne sort → retrait d'UNE copie (identité
      //  d'instance ; deux sorts de même `sortId` sont désormais dissociables).
      const instanceId = params.p_personnage_sort_id;
      const existant = b.acquisitions.sorts.find((s) => s.instanceId === instanceId);
      if (!existant) return repErr({ code: "introuvable", message: "Sort introuvable." });
      const xpAvant = deriver(b).xpDepense;
      const b1 = retirerSort(b, instanceId);
      const xpRembourse = xpAvant - deriver(b1).xpDepense;
      // cf. TROUS_A3II §2 : reprise/rabais non portée → aperçu minimal.
      const donnees = {
        bloque: false,
        xp_rembourse: xpRembourse,
        net: xpRembourse,
        reprise_totale: false,
        reprises: [] as unknown[],
        cercle: getSortCat(existant.sortId)?.cercle ?? null,
        message_action: null,
      };
      if (params.p_dry_run) return repOk(donnees);
      sauver(b1);
      return repOk(donnees);
    },

    async modifierSort(params) {
      const b = charger();
      if (!b) return repBrouillonAbsent();
      const instanceId = params.p_personnage_sort_id;
      const existant = b.acquisitions.sorts.find((s) => s.instanceId === instanceId);
      if (!existant) {
        return repErr({ code: "sort_introuvable", message: "Sort introuvable" });
      }
      const cat = getSortCat(existant.sortId);
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
      // [MAGIE-PLAFOND] Miroir de modifier_sort : ne mord QUE si le cout augmente.
      const refusPlafond = refusPlafondMagie("sort", etat.contexteMagie.niveau, nouveauCout);
      if (diff > 0 && refusPlafond) {
        return repErr({ code: "plafond_depasse", message: refusPlafond }, { plancher });
      }
      if (diff > 0 && etat.xpDispo < diff) {
        return repErr({ code: "xp_insuffisant", message: "XP insuffisant" }, { plancher });
      }
      sauver(
        applicModifierSort(b, instanceId, {
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
        const item: Omit<BrouillonPriere, "instanceId"> = { ...demande, nomPersonnalise: params.p_nom_personnalise };
        sauver(appliquerAchatPriere(b, item));
        return repOk(null);
      });
    },

    async desacheterPriere(params) {
      const b = charger();
      if (!b) return repBrouillonAbsent();
      const instanceId = params.p_personnage_priere_id;
      const existant = b.acquisitions.prieres.find((p) => p.instanceId === instanceId);
      if (!existant) return repErr({ code: "introuvable", message: "Prière introuvable." });
      const xpAvant = deriver(b).xpDepense;
      const b1 = retirerPriere(b, instanceId);
      const xpRembourse = xpAvant - deriver(b1).xpDepense;
      const donnees = {
        bloque: false,
        xp_rembourse: xpRembourse,
        net: xpRembourse,
        reprise_totale: false,
        reprises: [] as unknown[],
        domaine: getPriereCat(existant.priereId)?.domaine ?? null,
        message_action: null,
      };
      if (params.p_dry_run) return repOk(donnees);
      sauver(b1);
      return repOk(donnees);
    },

    async modifierPriere(params) {
      const b = charger();
      if (!b) return repBrouillonAbsent();
      const instanceId = params.p_personnage_priere_id;
      const existant = b.acquisitions.prieres.find((p) => p.instanceId === instanceId);
      if (!existant) {
        return repErr({ code: "priere_introuvable", message: "Prière introuvable" });
      }
      const cat = getPriereCat(existant.priereId);
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
      // [MAGIE-PLAFOND] Miroir de modifier_priere : ne mord QUE si le cout augmente.
      const refusPlafond = refusPlafondMagie("priere", etat.contexteMagie.niveau, nouveauCout);
      if (diff > 0 && refusPlafond) {
        return repErr({ code: "plafond_depasse", message: refusPlafond }, { plancher });
      }
      if (diff > 0 && etat.xpDispo < diff) {
        return repErr({ code: "xp_insuffisant", message: "XP insuffisant" }, { plancher });
      }
      sauver(
        applicModifierPriere(b, instanceId, {
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
        sauver(appliquerAchatRecette(b, params.p_recette_id));
        return repOk(null);
      });
    },

    async desacheterRecette(params) {
      const b = charger();
      if (!b) return repBrouillonAbsent();
      // `id` = `instanceId` → retrait d'UNE ligne recette (par PK côté serveur).
      const instanceId = params.p_personnage_recette_id;
      const existe = b.acquisitions.recettes.some((r) => r.instanceId === instanceId);
      if (!existe) return repErr({ code: "introuvable", message: "Recette introuvable." });
      sauver(retirerRecette(b, instanceId));
      return repOk(null);
    },

    async acheterPiege(params) {
      return orchestrer(params.p_personnage_id, (b, etat) => {
        const v = peutAcheterPiege(etat.contextePiege, params.p_piege_id);
        if (!v.peutAcheter) return repErr({ code: v.code, message: v.raison });
        sauver(appliquerAchatPiege(b, params.p_piege_id));
        return repOk(null);
      });
    },

    async desacheterPiege(params) {
      // Portage FIDÈLE de `desacheter_piege` (migration 20260610065923) : CASCADE
      // ASCENDANTE — le serveur supprime le palier ciblé + TOUS les paliers ≥ N de
      // la MÊME FAMILLE (`piege_nom`), rembourse la somme, et renvoie un `donnees`
      // détaillant les lignes supprimées (mêmes clés que le serveur).
      const b = charger();
      if (!b) return repBrouillonAbsent();
      const instanceId = params.p_personnage_piege_id;
      const cible = b.acquisitions.pieges.find((p) => p.instanceId === instanceId);
      if (!cible) {
        return repErr({ code: "achat_introuvable", message: "Ce piège n'existe pas dans le personnage" });
      }
      const cibleCat = getPiegeCat(cible.piegeId);
      const nomFamille = cibleCat?.nom ?? "";
      const niveauCible = cibleCat?.niveau ?? 0;

      // Info dérivée par ligne (est_gratuit / xp effectif), parallèle à l'ordre du
      // brouillon — même source que `lirePersonnagePieges` (ce que l'écran affiche).
      const etatAvant = deriver(b);
      const infoParInstance = new Map<string, { niveau: number; xp: number }>();
      b.acquisitions.pieges.forEach((p, i) => {
        const derive = etatAvant.contextePiege.piegesAcquis[i];
        const cat = getPiegeCat(p.piegeId);
        infoParInstance.set(p.instanceId, {
          niveau: derive?.niveauAcquis ?? cat?.niveau ?? 0,
          xp: derive?.estGratuit ? 0 : cat?.cout_xp ?? 0,
        });
      });

      // Cascade : palier ciblé + paliers supérieurs de la même famille.
      const aRetirer = b.acquisitions.pieges.filter((p) => {
        const cat = getPiegeCat(p.piegeId);
        return (cat?.nom ?? "") === nomFamille && (cat?.niveau ?? 0) >= niveauCible;
      });
      const idsRetirees = new Set(aRetirer.map((p) => p.instanceId));
      const b1: BrouillonVisiteur = {
        ...b,
        acquisitions: {
          ...b.acquisitions,
          pieges: b.acquisitions.pieges.filter((p) => !idsRetirees.has(p.instanceId)),
        },
        meta: { ...b.meta, modifieLe: new Date().toISOString() },
      };
      const etatApres = deriver(b1);

      // `lignes_supprimees` ORDER BY niveau_acquis DESC (comme le serveur).
      const lignesSupprimees = aRetirer
        .map((p) => {
          const info = infoParInstance.get(p.instanceId)!;
          return {
            personnage_piege_id: p.instanceId,
            niveau_acquis: info.niveau,
            xp_rembourse: info.xp,
          };
        })
        .sort((x, y) => y.niveau_acquis - x.niveau_acquis);
      // Remboursement = delta de dérivation (cohérent avec l'économie XP re-dérivée).
      const xpRembourse = etatAvant.xpDepense - etatApres.xpDepense;
      const donnees = {
        piege_nom: nomFamille,
        lignes_supprimees: lignesSupprimees,
        nb_paliers_supprimes: aRetirer.length,
        xp_rembourse: xpRembourse,
        xp_total: etatApres.xpTotal,
        xp_depense: etatApres.xpDepense,
        xp_restant: etatApres.xpDispo,
      };
      sauver(b1);
      return repOk(donnees);
    },

    async acheterAssemblage(params) {
      return orchestrer(params.p_personnage_id, (b, etat) => {
        const v = peutAcheterAssemblage(etat.contexteAssemblage, params.p_assemblage_id);
        if (!v.peutAcheter) return repErr({ code: v.code, message: v.raison });
        sauver(appliquerAchatAssemblage(b, params.p_assemblage_id));
        return repOk(null);
      });
    },

    async desacheterAssemblage(params) {
      const b = charger();
      if (!b) return repBrouillonAbsent();
      // `id` = `instanceId` → retrait d'UNE ligne assemblage (par PK côté serveur).
      const instanceId = params.p_personnage_assemblage_id;
      const existe = b.acquisitions.assemblages.some((a) => a.instanceId === instanceId);
      if (!existe) return repErr({ code: "introuvable", message: "Assemblage introuvable." });
      sauver(retirerAssemblage(b, instanceId));
      return repOk(null);
    },

    // ═══════════════════════════════════════════════════════════════════════
    // C — Cycle de vie (seul portage de validations autorisé, messages VERBATIM)
    // Omissions communes (sans objet hors ligne) : auth / profil / ownership /
    // gel (`gate_edition_personnage`) / verrou / contrainte DB (SQLERRM).
    // ═══════════════════════════════════════════════════════════════════════

    async demarrerCreationPersonnage(_params) {
      // Migration 20260607223650. Business : `brouillon_existant`.
      const existant = charger();
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
      sauver(b);
      return repOk({ personnage_id: PERSONNAGE_LOCAL_ID, etape_creation: 1 });
    },

    async sauvegarderEtape1(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = charger();
      if (!b) return repBrouillonAbsent();

      const payload = {
        // [s368 #1] Chaque monde son « pas de nom » : le serveur stocke NULL
        // (contrainte `personnages_nom_longueur`), le brouillon visiteur
        // stocke "" (son schéma type `nom: string`). Le pont envoie null ;
        // le miroir coalesce ici — même donnée, deux néants.
        nom: params.p_nom ?? "",
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
        sauver(nb);
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
      sauver(nb);
      return repOk({ personnage_id: PERSONNAGE_LOCAL_ID, etape_creation_apres: nb.meta.etapeCourante });
    },

    async sauvegarderEtape2(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = charger();
      if (!b) return repBrouillonAbsent();

      const payload = {
        raceId: params.p_race_id,
        sousTypeChimeride: params.p_sous_type_chimeride ?? null,
      };
      if (params.p_brouillon) {
        const nb = appliquerEtape2(b, payload);
        sauver(nb);
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
      sauver(nb);
      return repOk({ personnage_id: PERSONNAGE_LOCAL_ID, etape_creation_apres: nb.meta.etapeCourante });
    },

    async sauvegarderEtape3(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = charger();
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
        sauver(nb);
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
      sauver(nb);
      return repOk({
        personnage_id: PERSONNAGE_LOCAL_ID,
        etape_creation_apres: nb.meta.etapeCourante,
        traits_raciaux_choisis: traits,
      });
    },

    async sauvegarderEtape4(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = charger();
      if (!b) return repBrouillonAbsent();

      const choix = (params.p_choix_par_competence ?? undefined) as
        | Record<string, string>
        | undefined;
      const payload = { classeId: params.p_classe_id, choixParCompetence: choix };

      if (params.p_brouillon) {
        const nb = appliquerEtape4(b, payload);
        sauver(nb);
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

      // Délégation serveur (sauvegarder_etape_4, migration 20260617153934) : si une
      // classe DIFFÉRENTE est déjà posée, on ne fait pas un simple swap — on délègue
      // à `changer_classe_personnage(p_dry_run:false)` (cascade complète). UN SEUL
      // chemin : le moteur `calculerCascadeChangementClasse`, comme changerClassePersonnage.
      if (b.etape4.classeId && b.etape4.classeId !== params.p_classe_id) {
        const res = calculerCascadeChangementClasse(getSnapshot(), b, params.p_classe_id, choix ?? {}, deriver);
        if (res.erreurs.length > 0) {
          return repErr(
            res.erreurs[0],
            { personnage_id: PERSONNAGE_LOCAL_ID, etape_creation_apres: b.meta.etapeCourante },
            res.avertissements,
          );
        }
        const casse = appliquerCascadeClasse(b, params.p_classe_id, choix ?? {}, res);

        // FIX s322 (miroir serveur, migrations 163901/163941) : la cascade ne pose
        // ni ne valide le choix des gratuités AJOUTÉES par la nouvelle classe —
        // source unique de « gratuite + choix + religion », comme le serveur qui
        // délègue désormais à `attribuer_competences_gratuites_classe(p_choix)`
        // après la cascade. Portage : `appliquerGratuites` (purge par flag incluse).
        const etatBase: EtatCreationVisiteur = {
          raceId: casse.etape2.raceId || null,
          classeId: casse.etape4.classeId || null,
          religionId: casse.etape1.religionId,
          estCroyant: casse.etape1.estCroyant,
          // C68 (s370) : `EtatCreationVisiteur` porte désormais les traits
          // CHOISIS. Renseigné ici aussi pour qu'aucun état reconstruit ne
          // puisse rendre un verdict d'inaptitude faux par omission.
          traitsChoisis: casse.etape3.traitsRaciauxChoisis.map((t) => ({
            traitId: t.trait_id ?? "",
          })),
          competencesAcquises: [],
        };
        const { erreurs: erreursGratuites } = appliquerGratuites(getSnapshot(), etatBase, choix ?? {});
        if (erreursGratuites.length > 0) {
          return repErr(
            { ...erreursGratuites[0], champ: "choix_par_competence" },
            { personnage_id: PERSONNAGE_LOCAL_ID, etape_creation_apres: b.meta.etapeCourante },
            res.avertissements,
          );
        }

        const nb = avancerVers(casse, 4, 5);
        sauver(nb);
        return repOk(
          { personnage_id: PERSONNAGE_LOCAL_ID, etape_creation_apres: nb.meta.etapeCourante },
          res.avertissements,
        );
      }

      // Sinon (première classe, ou classe identique) : attribution des gratuités
      // par recompute — choix obligatoire des gratuités à `type_choix` non-null.
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
      sauver(nb);
      return repOk({ personnage_id: PERSONNAGE_LOCAL_ID, etape_creation_apres: nb.meta.etapeCourante });
    },

    async avancerEtape(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = charger();
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
      sauver(nb);
      return repOk(
        { personnage_id: PERSONNAGE_LOCAL_ID, etape_creation_apres: nb.meta.etapeCourante },
        val.avertissements,
      );
    },

    async etatEditionPersonnage(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = charger();
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
      const b = charger();
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
      sauver(marque);
      return rep({ valide: true, est_verrouille: true, erreurs: [], avertissements });
    },

    async corrigerXpPersonnage(_params) {
      // §50 — refus poli (action réservée aux comptes).
      return repErr({ code: "INDISPONIBLE_VISITEUR", message: "Cette action nécessite un compte." });
    },

    async changerClassePersonnage(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = charger();
      if (!b) return repBrouillonAbsent();
      const choix = (params.p_choix_par_competence ?? {}) as Record<string, string>;

      // Cascade serveur-fidèle (class-locked / over-cap / cascade / D3 / D6 / D2),
      // portée par le moteur PUR partagé — aperçu ET application le consomment.
      const res = calculerCascadeChangementClasse(getSnapshot(), b, params.p_classe_id, choix, deriver);

      // dry_run : préview COMPLET sans appliquer (brouillon inchangé).
      if (params.p_dry_run) {
        return repOk(res.donnees, res.avertissements);
      }
      // Réel : les erreurs bloquantes (ex. `choix_requis`) empêchent l'application.
      if (res.erreurs.length > 0) {
        return repErr(res.erreurs[0], {}, res.avertissements);
      }

      const nb = appliquerCascadeClasse(b, params.p_classe_id, choix, res);
      sauver(nb);
      const etat = deriver(nb);
      const donnees = {
        ...res.donnees,
        xp_total: etat.xpTotal,
        xp_depense: etat.xpDepense,
        xp_restant: etat.xpDispo,
      };
      return repOk(donnees, res.avertissements);
    },

    async verifierPrerequisCompetences(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = charger();
      if (!b) return rep({ erreur: "Personnage introuvable" });
      return rep(calculerPrerequis(b, deriver));
    },

    async apercuRabaisAcquisitionCompetence(params) {
      const g = guardPerso(params.p_personnage_id);
      if (g) return g;
      const b = charger();
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
      const b = charger();
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
      const b = charger();
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
      const b = charger();
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
      const b = charger();
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
      const b = charger();
      if (!b) return { data: null, error: { message: "Personnage introuvable." } };
      return {
        data: { id: PERSONNAGE_LOCAL_ID, religion_id: b.etape1.religionId } as unknown as never,
        error: null,
      };
    },

    async lirePersonnageProgression(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = charger();
      if (!b) return { data: null, error: { message: "Personnage introuvable." } };
      const etat = deriver(b);
      return {
        data: {
          id: PERSONNAGE_LOCAL_ID,
          nom: b.etape1.nom,
          niveau: etat.contexteMagie.niveau,
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

    async lireFicheSchemaChampsV2(categorie) {
      const rows = (snap().tables.fiches_schemas ?? []) as Array<Record<string, unknown>>;
      const r = rows.find((f) => f.categorie === categorie);
      return { data: r ? ({ champs_v2: r.champs_v2 } as never) : null, error: null };
    },

    async lireFicheListe(categorie) {
      const rows = (snap().tables.fiches_listes ?? []) as Array<Record<string, unknown>>;
      const r = rows.find((f) => f.categorie === categorie);
      return { data: (r ?? null) as never, error: null };
    },

    async lireCatalogueEncyclopedie(categorie) {
      const table = TABLE_SOURCE_ENCYCLOPEDIE[categorie];
      const rows = ((snap().tables[table] ?? []) as Array<Record<string, unknown>>)
        .filter((r) => r.est_actif === true);
      return { data: trierPar(rows, (r) => r.nom) as never, error: null };
    },

    async lireSectionsRegles(categories) {
      const voulu = new Set(categories);
      const rows = ((snap().tables.sections_regles ?? []) as Array<Record<string, unknown>>)
        .filter((s) => s.est_actif === true && voulu.has(String(s.categorie)));
      return {
        data: trierPar(rows, (s) => s.categorie, (s) => s.ordre) as never,
        error: null,
      };
    },

    async rechercherEncyclopedie(terme) {
      return {
        data: rechercherEncyclopedieLocale(
          snap().tables as Record<string, Array<Record<string, unknown>> | undefined>,
          terme,
        ) as never,
        error: null,
      };
    },

    async lireEffetsCombat() {
      // Miroir serveur : PAS de filtre est_actif (la colonne n'existe pas).
      const rows = ((snap().tables.effets_combat ?? []) as Array<Record<string, unknown>>);
      return { data: trierPar(rows, (e) => e.nom) as never, error: null };
    },

    async lireReparationsForge() {
      // Miroir serveur : filtre est_actif, SANS order (Encyclopedie.tsx l.146).
      const rows = ((snap().tables.reparations_forge ?? []) as Array<Record<string, unknown>>)
        .filter((r) => r.est_actif === true);
      return { data: rows as never, error: null };
    },

    async lireRaceTraits() {
      const rows = ((snap().tables.race_traits ?? []) as Array<Record<string, unknown>>)
        .map((rt) => ({ race_id: String(rt.race_id), trait_id: String(rt.trait_id) }));
      return { data: rows as never, error: null };
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
      const b = charger();
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
      const b = charger();
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
      const b = charger();
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
      // TROUS_A3II §1 comblé (HL-RECAP lot 3) : forge/joaillerie dérivés du
      // brouillon (miroir `vue_personnage_etat`), plus de valeur neutre.
      const row = {
        personnage_id: PERSONNAGE_LOCAL_ID,
        niveau_alchimie: na.niveauAlchimie,
        niveau_runes: na.niveauRunes,
        niveau_pieges: na.niveauPieges,
        niveau_forge: na.niveauForge,
        niveau_joaillerie: na.niveauJoaillerie,
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
      const b = charger();
      if (!b) return { data: [] as unknown as never, error: null };
      const etat = deriver(b);
      // Deux sources d'identité, dans l'ordre du serveur (achats du joueur, puis
      // gratuités de classe) :
      //  - PAYANTES : lignes du brouillon → `id = instanceId` (une par copie, donc
      //    deux « Développement Spirituel » sont désormais dissociables).
      //  - GRATUITÉS : dérivées (hors `acquisitions`) → id synthétique `pc…` ; un
      //    désachat qui le reçoit tombe sur le refus de gratuité.
      const payantes = b.acquisitions.competences.map((c) => ({
        id: c.instanceId,
        personnage_id: PERSONNAGE_LOCAL_ID,
        competence_id: c.competenceId,
        niveau_acquis: c.niveauAcquis,
        choix_achat: c.choixAchat,
        // xp_depense EFFECTIF (rabais cercle/domaine inclus) → badge « Gratuit »
        // (xp_depense === 0) fidèle au serveur.
        xp_depense: coutAchatCompetence(b, c.competenceId, c.niveauAcquis, c.choixAchat),
        appris_via_maitre: false,
        nom_maitre: null,
        statut_maitre: null as string | null,
        date_acquisition: b.meta.creeLe,
        rabais_items: null,
      }));
      const gratuites = etat.gratuites.map((c) => ({
        id: idGratuite(c.competenceId, c.niveauAcquis, c.choixAchat),
        personnage_id: PERSONNAGE_LOCAL_ID,
        competence_id: c.competenceId,
        niveau_acquis: c.niveauAcquis,
        choix_achat: c.choixAchat,
        xp_depense: 0,
        appris_via_maitre: false,
        nom_maitre: null,
        statut_maitre: "non_requis" as string | null,
        date_acquisition: b.meta.creeLe,
        rabais_items: null,
      }));
      const rows = [...payantes, ...gratuites];
      return { data: rows as unknown as never, error: null };
    },

    async lirePersonnageCompetencesNoms(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = charger();
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
      const b = charger();
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
      const b = charger();
      if (!b) return { data: [] as unknown as never, error: null };
      const rows: LigneSortAcquis[] = b.acquisitions.sorts.map((s) => {
        const cat = getSortCat(s.sortId);
        const catFull = (snap().tables.sorts as Array<Record<string, unknown>>).find((x) => x.id === s.sortId);
        return {
          id: s.instanceId,
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
      const b = charger();
      if (!b) return { data: [] as unknown as never, error: null };
      const rows: LignePriereAcquise[] = b.acquisitions.prieres.map((p) => {
        const cat = getPriereCat(p.priereId);
        const catFull = (snap().tables.prieres as Array<Record<string, unknown>>).find((x) => x.id === p.priereId);
        return {
          id: p.instanceId,
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
      const b = charger();
      if (!b) return { data: [] as unknown as never, error: null };
      const etat = deriver(b);
      const rows = etat.contextePiege.piegesAcquis.map((p, i) => {
        const item = b.acquisitions.pieges[i];
        const cat = item ? (snap().tables.pieges as Array<Record<string, unknown>>).find((x) => x.id === item.piegeId) : undefined;
        return {
          id: item?.instanceId ?? "",
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
      const b = charger();
      if (!b) return { data: [] as unknown as never, error: null };
      const etat = deriver(b);
      const rows = etat.contexteRecette.recettesAcquises.map((r, i) => {
        const cat = (snap().tables.recettes_alchimie as Array<Record<string, unknown>>).find((x) => x.id === r.recetteId);
        return {
          id: b.acquisitions.recettes[i]?.instanceId ?? "",
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
      const b = charger();
      if (!b) return { data: [] as unknown as never, error: null };
      const etat = deriver(b);
      const rows = etat.contexteAssemblage.assemblagesAcquis.map((a, i) => {
        const cat = (snap().tables.assemblages_runes as Array<Record<string, unknown>>).find((x) => x.id === a.assemblageId);
        return {
          id: b.acquisitions.assemblages[i]?.instanceId ?? "",
          personnage_id: PERSONNAGE_LOCAL_ID,
          assemblage_id: a.assemblageId,
          est_gratuit: a.estGratuit,
          xp_depense: a.estGratuit ? 0 : (cat?.cout_xp as number | null) ?? 0,
          date_acquisition: b.meta.creeLe,
        };
      });
      return { data: rows as unknown as never, error: null };
    },

    // HL-RECAP lot 3 : lectures de la fiche dérivées du brouillon via l'adaptateur
    // PUR (`moteurCreation/brouillon/adaptateurFiche`). Squelette uniforme des
    // lectures existantes : guard + chargerBrouillon + deriver + appel adaptateur.
    // Les catalogues (sans perso) sont des lectures snapshot pures.

    async lireFichePersonnage(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = charger();
      if (!b) return { data: null, error: null };
      const row = adaptateurFiche.fichePersonnage(
        snap(),
        b,
        deriver(b),
        PERSONNAGE_LOCAL_ID,
        PROFIL_VISITEUR_LOCAL,
      );
      return { data: row as unknown as never, error: null };
    },

    async lireFicheCompetences(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = charger();
      if (!b) return { data: [] as unknown as never, error: null };
      const rows = adaptateurFiche.ficheCompetences(
        snap(),
        b,
        deriver(b),
        PERSONNAGE_LOCAL_ID,
        idGratuite,
      );
      return { data: rows as unknown as never, error: null };
    },

    async lireFicheSorts(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = charger();
      if (!b) return { data: [] as unknown as never, error: null };
      const rows = adaptateurFiche.ficheSorts(snap(), b, PERSONNAGE_LOCAL_ID);
      return { data: rows as unknown as never, error: null };
    },

    async lireFichePrieres(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = charger();
      if (!b) return { data: [] as unknown as never, error: null };
      const rows = adaptateurFiche.fichePrieres(snap(), b, PERSONNAGE_LOCAL_ID);
      return { data: rows as unknown as never, error: null };
    },

    async lireFicheAssemblages(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = charger();
      if (!b) return { data: [] as unknown as never, error: null };
      const rows = adaptateurFiche.ficheAssemblages(
        snap(),
        b,
        deriver(b),
        PERSONNAGE_LOCAL_ID,
      );
      return { data: rows as unknown as never, error: null };
    },

    async lireFicheRecettes(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = charger();
      if (!b) return { data: [] as unknown as never, error: null };
      const rows = adaptateurFiche.ficheRecettes(
        snap(),
        b,
        deriver(b),
        PERSONNAGE_LOCAL_ID,
      );
      return { data: rows as unknown as never, error: null };
    },

    async lireFicheArtisanatEtat(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = charger();
      if (!b) return { data: null, error: null };
      const row = adaptateurFiche.ficheArtisanatEtat(deriver(b));
      return { data: row as unknown as never, error: null };
    },

    async lireFichePieges(personnageId) {
      const g = guardPerso(personnageId);
      if (g) return g as unknown as Reponse<never>;
      const b = charger();
      if (!b) return { data: [] as unknown as never, error: null };
      const rows = adaptateurFiche.fichePieges(
        snap(),
        b,
        deriver(b),
        PERSONNAGE_LOCAL_ID,
      );
      return { data: rows as unknown as never, error: null };
    },

    async lireFicheManipulations(niveauMax) {
      const rows = adaptateurFiche.ficheManipulations(snap(), niveauMax);
      return { data: rows as unknown as never, error: null };
    },

    async lireFicheObjetsForge() {
      const rows = adaptateurFiche.ficheObjetsForge(snap());
      return { data: rows as unknown as never, error: null };
    },

    async lireFicheObjetsJoaillerie() {
      const rows = adaptateurFiche.ficheObjetsJoaillerie(snap());
      return { data: rows as unknown as never, error: null };
    },

    async lireFichePiegesCatalogue(niveauMax) {
      const rows = adaptateurFiche.fichePiegesCatalogue(snap(), niveauMax);
      return { data: rows as unknown as never, error: null };
    },

    async lireFicheLangues() {
      const rows = adaptateurFiche.ficheLangues(snap());
      return { data: rows as unknown as never, error: null };
    },

    async lireFicheReligions() {
      const rows = adaptateurFiche.ficheReligions(snap());
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

/**
 * Applique la cascade de changement de classe RÉELLE au brouillon (transformation
 * pure). Retire les achats (phase 1 / cascade + D6), purge sorts/prières (D3),
 * grave les choix D6 dans `etape4.choixParCompetence` puis bascule sur la nouvelle
 * classe — les gratuités se recomposent seules à la re-dérivation. Miroir des
 * phases 6a→6f du serveur, sans grand livre XP (l'XP est re-dérivée).
 */
function appliquerCascadeClasse(
  b: BrouillonVisiteur,
  nouvelleClasseId: string,
  choix: Record<string, string>,
  res: ResultatCascade,
): BrouillonVisiteur {
  const aRetirer = new Set<string>([
    ...res.instanceIdsARetirer,
    ...res.d6.map((d) => d.instanceId),
  ]);
  const competences = b.acquisitions.competences.filter(
    (c) => !aRetirer.has(c.instanceId),
  );
  // Grave les choix D6 : la gratuité dérivée reprend l'instance offerte.
  const choixParCompetence: Record<string, string> = { ...choix };
  for (const d of res.d6) {
    if (d.choixAGraver) choixParCompetence[d.competenceId] = d.choixAGraver;
  }
  return {
    ...b,
    etape4: { classeId: nouvelleClasseId, choixParCompetence },
    acquisitions: {
      ...b.acquisitions,
      competences,
      sorts: res.purgeSorts ? [] : b.acquisitions.sorts,
      prieres: res.purgePrieres ? [] : b.acquisitions.prieres,
    },
    meta: { ...b.meta, modifieLe: new Date().toISOString() },
  };
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
