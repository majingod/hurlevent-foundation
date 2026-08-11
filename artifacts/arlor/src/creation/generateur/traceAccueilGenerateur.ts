/**
 * [s394] Trace d'accueil du générateur.
 *
 * `journal_generation` (`traceGeneration.ts`) n'enregistre que les SUCCÈS :
 * il ne dit pas si les portes 🧭/🎲 ont été VUES, ni si un joueur a cliqué
 * puis fait demi-tour vers 🛠️ « Je bâtis moi-même ». Ce module trace ces
 * DEUX événements-là (portes vues, porte choisie) via la RPC
 * `enregistrer_accueil_generateur`, en fire-and-forget — comme
 * `traceGeneration.ts` : la trace ne bloque JAMAIS le joueur, un échec se
 * loggue en console et c'est tout.
 *
 * Ce module est PUR : il décide s'il faut tracer et construit les arguments
 * de la RPC. L'appel réseau vit chez l'appelant (`PersonnageNouveauV2`).
 *
 * ON NE TRACE PAS :
 * - en mode visiteur (aucune base derrière) ;
 * - sans `personnageId` (rien à rattacher).
 *
 * ⚠️ Ce n'est PAS un journal de clics : côté base, UNIQUE(personnage_id,
 * evenement) refuse un doublon — revenir aux portes n'est donc pas une
 * erreur, la table constate qu'un événement a eu lieu, une fois.
 */

import type { PorteId } from "@/components/createur/generateur/portes";

export type EvenementAccueil =
  | "portes_vues"
  | "porte_batir"
  | "porte_guide"
  | "porte_tirage";

/** Arguments EXACTS de la RPC `enregistrer_accueil_generateur` (mêmes noms p_*). */
export interface ArgsTraceAccueil {
  p_personnage_id: string;
  p_evenement: EvenementAccueil;
}

export function evenementDePorte(porteId: PorteId): EvenementAccueil {
  switch (porteId) {
    case "batir":
      return "porte_batir";
    case "guide":
      return "porte_guide";
    case "tirage":
      return "porte_tirage";
  }
}

/**
 * Décide s'il faut tracer et construit les arguments — `null` = ne pas tracer.
 */
export function preparerTraceAccueil(e: {
  modeVisiteur: boolean;
  personnageId: string | null;
  evenement: EvenementAccueil;
}): ArgsTraceAccueil | null {
  const { modeVisiteur, personnageId, evenement } = e;
  if (modeVisiteur) return null;
  if (!personnageId) return null;
  return { p_personnage_id: personnageId, p_evenement: evenement };
}
