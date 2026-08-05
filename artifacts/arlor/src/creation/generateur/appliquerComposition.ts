/**
 * [VIS-8 PR-B s365] « Continuer dans le créateur → » — applique la composition
 * d'un tirage 🎲 au personnage EN COURS, via les vraies portes `ClientCreation`
 * (décision 29 : réutiliser le rejoueur VIS-6, jamais d'écriture directe).
 *
 * POURQUOI « personnage existant » (mesuré s365, déviation du prompt) : quand
 * l'accueil des portes s'affiche, `PersonnageNouveauV2` a DÉJÀ démarré (ou
 * adopté via `brouillon_existant`) le personnage — son id est en main. Un
 * second `demarrer_creation_personnage` répondrait `brouillon_existant`. On
 * appelle donc `executerRejeu` (le cœur extrait), pas `rejouerBrouillon`.
 *
 * SÉQUENCE (plan `planifierRejeu`, ordre topologique du rabais conservé) :
 *   étapes 1-3 en `p_brouillon: true` (identité vierge : le joueur nomme,
 *   choisit son sous-type et ses traits au wizard) → étape 4 COMPLÈTE (pose la
 *   classe + attribue les gratuites, choix de la décision 32 inclus) → achats
 *   compétences (une ligne par niveau, jauges répétées comprises) → sorts /
 *   prières → [s373] enchaînement `avancerEtape` 5→9 (déverrouillage, voir
 *   plus bas). Les achats ne démarrent qu'APRÈS l'étape 4 : un échec d'étape
 *   laisse le personnage sans aucun achat (retry sûr côté page).
 *
 * ÉCHECS : politique VIS-6 inchangée — étape refusée → `partiel` (STOP),
 * achat refusé → journalisé, on continue ; exception réseau → STOP.
 * `ErreurConversionTirage` (snapshot inutilisable) REMONTE en exception :
 * rien n'a été écrit, la page affiche le message en clair.
 */

import type { Alea, TiragePersonnage } from "@/moteurCreation/generateur/resoudre";
import type {
  ArtisanatTire,
  CompositionOk,
} from "@/moteurCreation/generateur/types";
import { convertirTirageEnBrouillon } from "@/moteurCreation/generateur/versBrouillon";
import { getSnapshot } from "@/moteurCreation/snapshot";

import {
  catalogueDepuisSnapshot,
  executerRejeu,
  type CatalogueRejeu,
  type FaitRejeu,
  type ResultatRejeu,
} from "../reprise/rejouerBrouillon";
import type { ClientCreation } from "../types";

export interface OptionsApplication {
  /** Aléa injectable (langue ancienne du mage). Défaut : `Math.random`. */
  alea?: Alea;
  /** Catalogue du plan de rejeu. Défaut : `catalogueDepuisSnapshot()`. */
  catalogue?: CatalogueRejeu;
  onProgres?: (fait: FaitRejeu) => void;
  /**
   * ⭐ [s375-v2 défaut 1] L'état du personnage VISÉ, lu par l'appelant.
   * Absent = pas de garde (contrat v1 : les tests du lot appliquent sur un
   * brouillon frais). Fourni avec `xpDepense > 0` ⇒ refus AVANT toute
   * écriture, cf. `refuse_non_vierge`.
   */
  etatActuel?: { xpDepense: number };
}

/**
 * [s373 WIZARD-ETAPES-VERROUILLEES-APRES-GENERATEUR] Résultat du rejeu,
 * augmenté de l'étape atteinte par l'enchaînement `avancerEtape` 5→9.
 * Champ de DIAGNOSTIC (consommé par les tests) : l'effet joueur, lui, passe
 * par `personnages.etape_creation`, que `etapeMax` (le stepper du wizard)
 * lit pour déverrouiller la navigation.
 */
export interface ResultatApplication extends Omit<ResultatRejeu, "statut"> {
  /**
   * Les statuts du rejeu, PLUS `refuse_non_vierge` (s375-v2) : un tirage
   * refusé d'entrée parce que le personnage porte déjà des achats. La valeur
   * est ajoutée ICI et non dans `ResultatRejeu` — c'est une règle du
   * générateur, le rejoueur VIS-6 ne la connaît pas.
   */
  statut: ResultatRejeu["statut"] | "refuse_non_vierge";
  /** 10 = wizard entièrement déverrouillé · 5..9 = chaîne arrêtée sur un
   * refus (statu quo séquentiel à partir de là) · null = étape 4 refusée,
   * la phase n'a pas couru (ou tirage refusé : rien n'a couru). */
  etapeApresAvancement: number | null;
}

/**
 * Convertit `{ tirage, composition }` en `BrouillonVisiteur` puis le rejoue
 * sur `personnageId`. Marche à l'identique sur `clientServeur` (connecté) et
 * `clientVisiteur` (hors ligne) — même contrat `ClientCreation`.
 *
 * [s373] PHASE DE DÉVERROUILLAGE (demande Fred s372) : une fois l'étape 4
 * complète passée (migration `20260803145513` : elle avance vers 5 depuis
 * toute étape ≤ 4), on enchaîne les VRAIES validations d'étapes 5→9 via
 * `avancerEtape` — exactement ce qu'un joueur fait en cliquant « Continuer »
 * cinq fois, automatisé. Succès → `etape_creation = 10`, toutes les étapes
 * cliquables, le joueur sort du générateur « comme s'il modifiait un perso
 * déjà fait ». Refus ou panne → STOP silencieux : statu quo séquentiel,
 * jamais un personnage cassé (`valider_personnage_final` re-valide de toute
 * façon les 10 étapes — un perso sans nom reste infinalisable). Les échecs
 * d'ACHAT n'empêchent PAS la phase : naviguer librement aide justement à
 * compléter, et chaque étape reste gardée par sa propre validation.
 *
 * ⭐⭐ [s375-v2 défaut 1] UN TIRAGE NE S'APPLIQUE QU'À UN PERSONNAGE VIERGE.
 * Le rejeu n'est PAS un remplacement : il s'EMPILE. Mesuré s375 sur cette
 * branche (sonde, code de la branche) — appliquer ⚗️ puis re-tirer un 🔮
 * runiste sur le MÊME personnage part avec un budget déjà mangé : 12 échecs
 * « XP insuffisant. Requis : 6 | Disponible : 1 », `Assemblage de Runes`
 * refusé (ses propres prérequis refusés), et le joueur atterrit au wizard
 * avec Alchimie + 9 recettes ET ZÉRO RUNE — un hybride cassé. D'où la garde
 * `options.etatActuel` : `xpDepense > 0` ⇒ `refuse_non_vierge` AVANT toute
 * écriture. Pour recommencer : supprimer le personnage.
 */
export async function appliquerComposition(
  client: ClientCreation,
  resultat: {
    tirage: TiragePersonnage;
    composition: CompositionOk;
    /** [C2 s375-v2] Items déjà tirés pour la fiche — consommés tels quels. */
    artisanatTire?: ArtisanatTire;
  },
  personnageId: string,
  options: OptionsApplication = {},
): Promise<ResultatApplication> {
  // ⭐ La garde d'abord : AVANT la conversion, avant la moindre RPC.
  if ((options.etatActuel?.xpDepense ?? 0) > 0) {
    return {
      personnageId,
      statut: "refuse_non_vierge",
      faits: [],
      echecs: [],
      etapeApresAvancement: null,
    };
  }

  const brouillon = convertirTirageEnBrouillon(
    getSnapshot(),
    resultat,
    options.alea ?? Math.random,
  );
  const rejeu = await executerRejeu(
    client,
    options.catalogue ?? catalogueDepuisSnapshot(),
    brouillon,
    personnageId,
    { etapes123EnBrouillon: true },
    options.onProgres,
  );

  let etapeApresAvancement: number | null = null;
  if (rejeu.faits.some((f) => f.type === "etape4")) {
    etapeApresAvancement = 5;
    for (let m = 5; m <= 9; m += 1) {
      try {
        const { data, error } = await client.avancerEtape({
          p_personnage_id: personnageId,
          p_etape_courante: m,
        });
        const payload = (data ?? {}) as { succes?: boolean };
        if (error || payload.succes !== true) break;
        etapeApresAvancement = m + 1;
      } catch {
        break;
      }
    }
  }

  return { ...rejeu, etapeApresAvancement };
}
