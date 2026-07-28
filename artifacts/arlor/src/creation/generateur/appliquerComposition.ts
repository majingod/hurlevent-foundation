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
 *   prières. Les achats ne démarrent qu'APRÈS l'étape 4 : un échec d'étape
 *   laisse le personnage sans aucun achat (retry sûr côté page).
 *
 * ÉCHECS : politique VIS-6 inchangée — étape refusée → `partiel` (STOP),
 * achat refusé → journalisé, on continue ; exception réseau → STOP.
 * `ErreurConversionTirage` (snapshot inutilisable) REMONTE en exception :
 * rien n'a été écrit, la page affiche le message en clair.
 */

import type { Alea, TiragePersonnage } from "@/moteurCreation/generateur/resoudre";
import type { CompositionOk } from "@/moteurCreation/generateur/types";
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
}

/**
 * Convertit `{ tirage, composition }` en `BrouillonVisiteur` puis le rejoue
 * sur `personnageId`. Marche à l'identique sur `clientServeur` (connecté) et
 * `clientVisiteur` (hors ligne) — même contrat `ClientCreation`.
 */
export async function appliquerComposition(
  client: ClientCreation,
  resultat: { tirage: TiragePersonnage; composition: CompositionOk },
  personnageId: string,
  options: OptionsApplication = {},
): Promise<ResultatRejeu> {
  const brouillon = convertirTirageEnBrouillon(
    getSnapshot(),
    resultat,
    options.alea ?? Math.random,
  );
  return executerRejeu(
    client,
    options.catalogue ?? catalogueDepuisSnapshot(),
    brouillon,
    personnageId,
    { etapes123EnBrouillon: true },
    options.onProgres,
  );
}
