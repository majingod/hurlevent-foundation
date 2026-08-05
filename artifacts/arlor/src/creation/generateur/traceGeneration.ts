/**
 * [VIS-8 s376 — décision Fred (option B)] Trace de génération.
 *
 * Quand un tirage (🎲 « Surprends-moi » = 'de' · 🧭 « Guide-moi » =
 * 'boussole') est APPLIQUÉ à un personnage connecté, une ligne part vers la
 * table `journal_generation` via la RPC `enregistrer_generation` — en
 * fire-and-forget : la trace ne bloque JAMAIS le joueur ; un échec se loggue
 * en console et c'est tout. Côté base, UNIQUE(personnage_id) refuse une
 * seconde trace (miroir DB de `refuse_non_vierge`, Gotcha C91).
 *
 * Ce module est PUR : il décide s'il faut tracer et construit les arguments
 * de la RPC. L'appel réseau vit chez l'appelant (`PersonnageNouveauV2`).
 *
 * ON NE TRACE PAS :
 * - en mode visiteur (aucune base derrière) ;
 * - un tirage refusé (`refuse_non_vierge` : rien n'a été écrit) ;
 * - une application dont l'étape 4 n'est pas passée : les achats n'ont pas
 *   commencé et le joueur va RÉESSAYER — tracer trop tôt consommerait la
 *   place unique de la vraie application.
 */

import type { TiragePersonnage } from "@/moteurCreation/generateur/resoudre";
import type {
  ArtisanatTire,
  CompositionOk,
} from "@/moteurCreation/generateur/types";

import type { ResultatApplication } from "./appliquerComposition";

/** 🎲 Surprends-moi = 'de' · 🧭 Guide-moi = 'boussole' (CHECK en base). */
export type ModeGeneration = "de" | "boussole";

/** Arguments EXACTS de la RPC `enregistrer_generation` (mêmes noms p_*). */
export interface ArgsTraceGeneration {
  p_personnage_id: string;
  p_mode: ModeGeneration;
  p_statut: string;
  p_etape_apres: number | null;
  p_nb_echecs: number;
  p_composition: {
    tirage: TiragePersonnage;
    composition: CompositionOk;
    artisanatTire?: ArtisanatTire;
  };
}

/**
 * Décide s'il faut tracer et construit les arguments — `null` = ne pas tracer.
 * Le STATUT et l'étape atteinte voyagent avec : un `partiel` en prod dira OÙ
 * la chaîne s'arrête chez de vrais joueurs (monitoring post-lancement).
 */
export function preparerTraceGeneration(params: {
  modeVisiteur: boolean;
  personnageId: string;
  mode: ModeGeneration;
  resultat: {
    tirage: TiragePersonnage;
    composition: CompositionOk;
    artisanatTire?: ArtisanatTire;
  };
  res: ResultatApplication;
}): ArgsTraceGeneration | null {
  const { modeVisiteur, personnageId, mode, resultat, res } = params;
  if (modeVisiteur) return null;
  if (res.statut === "refuse_non_vierge") return null;
  if (!res.faits.some((f) => f.type === "etape4")) return null;
  return {
    p_personnage_id: personnageId,
    p_mode: mode,
    p_statut: res.statut,
    p_etape_apres: res.etapeApresAvancement,
    p_nb_echecs: res.echecs.length,
    p_composition: resultat,
  };
}
