/**
 * [VIS-6] Sync-brouillon — Lot 2 : PRÉ-VOL du brouillon visiteur.
 *
 * Avant tout appel serveur, on « pré-vole » le brouillon : on rejoue l'ENSEMBLE
 * des choix contre les règles à jour, mais sur un client VISITEUR EN MÉMOIRE —
 * jamais le serveur, jamais le slot `localStorage`. Le rapport produit alimente
 * l'écran de reprise (VIS-6 Lot 2 UI) : ce qui ne passe plus, et de combien le
 * total XP réellement débité divergera de l'aperçu hors-ligne.
 *
 * DEUX SOURCES, ZÉRO DUPLICATION :
 *  - la VALIDATION réutilise l'orchestrateur Lot 1 (`rejouerBrouillon`) sur un
 *    client en mémoire : son journal `echecs` EST le rapport d'échecs (message
 *    serveur verbatim) ;
 *  - le DELTA de rabais réutilise `planifierRejeu` (source unique de l'ordre) +
 *    les helpers de `moteurCreation/rabais.ts` (aucune formule recopiée).
 *
 * POURQUOI UN DELTA ? Le moteur hors-ligne débite le rabais « Acquisition de
 * Cercle/Domaine » sur l'état FINAL (assiette maximale : tous les items du
 * choix). Le serveur, lui, le recalcule au MOMENT de chaque achat, sur les seuls
 * items déjà possédés à ce point de l'ordre de rejeu. Le rabais réel est donc ≤
 * au rabais hors-ligne → le total DÉBITÉ est ≥ à l'aperçu. On l'annonce avant
 * toute confirmation : `xpTotalAttendu = xpTotalOffline + Σ (coûtRéel − coûtFinal)`.
 */

import type { ClientCreation } from "../types";
import {
  rejouerBrouillon,
  planifierRejeu,
  catalogueDepuisSnapshot,
  type CatalogueRejeu,
  type EchecRejeu,
} from "./rejouerBrouillon";
import { creerClientVisiteur, PROFIL_VISITEUR_LOCAL } from "../visiteur/clientVisiteur";
import { estPerime } from "../visiteur/stockageBrouillon";
import {
  deriverEtat,
  coutAchatCompetence,
  type EtatDeriveVisiteur,
} from "@/moteurCreation/brouillon/deriver";
import { coutApresRabais, SEUIL_RABAIS_PAR_NIVEAU } from "@/moteurCreation/rabais";
import type { BrouillonVisiteur } from "@/moteurCreation/brouillon/types";

// ============================================================
// API publique
// ============================================================

export interface RapportPreVol {
  /** Aucun échec (tout le brouillon passe encore les règles à jour). */
  valide: boolean;
  /** Items qui ne passent plus — code/message serveur VERBATIM (journal Lot 1). */
  echecs: EchecRejeu[];
  /** Total XP dépensé, vu par le moteur hors-ligne (état final = aperçu visiteur). */
  xpTotalOffline: number;
  /** Total XP réellement débité, corrigé de l'ordre d'achat serveur (≥ offline). */
  xpTotalAttendu: number;
  /** XP encore disponible sur l'état final reconstruit. */
  xpDisponible: number;
  /** Le brouillon date-t-il d'une version antérieure des règles ? (`estPerime`). */
  peremption: boolean;
}

/** Couture d'injection (test-only). Défauts = comportement prod. */
export interface DepsPreVol {
  /** Fabrique le client en mémoire. Défaut : `creerClientVisiteur` (stockage injecté). */
  creerClient?: (
    charger: () => BrouillonVisiteur | null,
    sauver: (b: BrouillonVisiteur) => void,
  ) => ClientCreation;
  /** Catalogue pour le plan + le rabais. Défaut : `catalogueDepuisSnapshot()`. */
  catalogue?: CatalogueRejeu;
  /** Dérivation de l'état final. Défaut : `deriverEtat`. */
  deriver?: (b: BrouillonVisiteur) => EtatDeriveVisiteur;
  /** Test de péremption. Défaut : `estPerime`. */
  estPerime?: (b: BrouillonVisiteur) => boolean;
}

/**
 * Pré-vole `brouillon` : rejeu complet EN MÉMOIRE (aucune écriture serveur ni
 * `localStorage`), puis calcul du delta de rabais dû à l'ordre d'achat réel.
 */
export async function preVolerBrouillon(
  brouillon: BrouillonVisiteur,
  deps: DepsPreVol = {},
): Promise<RapportPreVol> {
  const catalogue = deps.catalogue ?? catalogueDepuisSnapshot();
  const deriver = deps.deriver ?? deriverEtat;
  const peremption = (deps.estPerime ?? estPerime)(brouillon);
  const fabrique =
    deps.creerClient ??
    ((charger, sauver) => creerClientVisiteur({ charger, sauver }));

  // Client EN MÉMOIRE : part d'un état vierge, n'écrit RIEN dans `localStorage`.
  let memoire: BrouillonVisiteur | null = null;
  const client = fabrique(
    () => memoire,
    (b) => {
      memoire = b;
    },
  );

  // Validation : le journal `echecs` du rejeu EST le rapport (profil factice —
  // ignoré par le client visiteur).
  const resultat = await rejouerBrouillon(
    client,
    catalogue,
    brouillon,
    PROFIL_VISITEUR_LOCAL,
  );

  // État final = dérivation du brouillon RECONSTRUIT en mémoire (getters existants,
  // aucun calcul XP maison). `memoire` est non-nul dès que le démarrage a réussi.
  const source = memoire ?? brouillon;
  const etat = deriver(source);

  return {
    valide: resultat.echecs.length === 0,
    echecs: resultat.echecs,
    xpTotalOffline: etat.xpDepense,
    xpTotalAttendu: etat.xpDepense + deltaOrdreAchat(source, catalogue),
    xpDisponible: etat.xpDispo,
    peremption,
  };
}

// ============================================================
// Delta de rabais dû à l'ordre d'achat serveur
// ============================================================

/**
 * Somme, sur chaque palier d'« Acquisition de Cercle/Domaine » niv 2/3 du plan,
 * du surcoût `coûtRéel − coûtFinal` (≥ 0) :
 *  - `coûtFinal` = rabais appliqué hors-ligne (assiette = TOUS les items du choix
 *    présents dans le brouillon reconstruit) — exactement ce que débite
 *    `deriver.xpDepense` (fonction exportée `coutAchatCompetence`) ;
 *  - `coûtRéel`  = rabais au moment de l'achat serveur (assiette = seuls les items
 *    du même choix DÉJÀ rejoués AVANT ce palier dans le plan) — via le helper
 *    `coutApresRabais` (source unique du calcul, `moteurCreation/rabais.ts`).
 */
function deltaOrdreAchat(b: BrouillonVisiteur, catalogue: CatalogueRejeu): number {
  const compById = new Map(b.acquisitions.competences.map((c) => [c.instanceId, c]));
  const sortById = new Map(b.acquisitions.sorts.map((s) => [s.instanceId, s]));
  const priereById = new Map(b.acquisitions.prieres.map((p) => [p.instanceId, p]));

  // Niveaux des items (sorts/prières) déjà rejoués à ce point du plan, par choix.
  const niveauxRejoues = new Map<string, number[]>();
  const ajouter = (cle: string, niveau: number): void => {
    const arr = niveauxRejoues.get(cle) ?? [];
    arr.push(niveau);
    niveauxRejoues.set(cle, arr);
  };

  let delta = 0;
  for (const action of planifierRejeu(b, catalogue)) {
    if (action.type === "sort") {
      const s = sortById.get(action.instanceId);
      const cercle = s ? catalogue.cercleDuSort(s.sortId) : null;
      if (s && cercle != null) ajouter(`cercle:${cercle}`, s.niveauSort);
    } else if (action.type === "priere") {
      const p = priereById.get(action.instanceId);
      const domaine = p ? catalogue.domaineDeLaPriere(p.priereId) : null;
      if (p && domaine != null) ajouter(`domaine:${domaine}`, p.niveauPriere);
    } else if (action.type === "competence") {
      const c = compById.get(action.instanceId);
      if (!c) continue;
      const typeChoix = catalogue.typeChoixCompetence(c.competenceId);
      const k = c.niveauAcquis;
      if (
        c.choixAchat != null &&
        (k === 2 || k === 3) &&
        (typeChoix === "cercle" || typeChoix === "domaine")
      ) {
        const seuil = SEUIL_RABAIS_PAR_NIVEAU[k];
        const base = coutAchatCompetence(b, c.competenceId, k, null); // coût catalogue
        const coutFinal = coutAchatCompetence(b, c.competenceId, k, c.choixAchat); // rabais final
        const niveauxReels = niveauxRejoues.get(`${typeChoix}:${c.choixAchat}`) ?? [];
        const coutReel = coutApresRabais(base, niveauxReels, seuil);
        delta += coutReel - coutFinal;
      }
    }
  }
  return delta;
}
