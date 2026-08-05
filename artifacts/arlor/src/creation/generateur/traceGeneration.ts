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
 *
 * ⚠️ FRONTIÈRE `Json` (corrigé s376, rapport CC) : la colonne est `jsonb`, donc
 * `types.ts` — fichier GÉNÉRÉ par Supabase — déclare `p_composition: Json`, un
 * type récursif à signature d'index. `TiragePersonnage` / `CompositionOk` sont
 * des interfaces sans signature d'index : structurellement INCOMPATIBLES, `tsc`
 * refuse l'appel (TS2345). Élargir le type dans `types.ts` aurait « marché » et
 * aurait été EFFACÉ SANS BRUIT à la prochaine régénération des types — la
 * frontière appartient donc à CE module, seul à connaître la forme du payload.
 * Le passage se fait par un aller-retour JSON, pas par un cast sec : le cast
 * AFFIRME que la valeur est du Json, l'aller-retour la REND telle (et
 * `traceGeneration.test.ts` l'atteste sur un payload réaliste).
 */

import type { Json } from "@/integrations/supabase/types";
import type { TiragePersonnage } from "@/moteurCreation/generateur/resoudre";
import type {
  ArtisanatTire,
  CompositionOk,
} from "@/moteurCreation/generateur/types";

import type { ResultatApplication } from "./appliquerComposition";

/** 🎲 Surprends-moi = 'de' · 🧭 Guide-moi = 'boussole' (CHECK en base). */
export type ModeGeneration = "de" | "boussole";

/** Ce que le générateur a produit — la forme AVANT passage en `jsonb`. */
export interface CompositionTracee {
  tirage: TiragePersonnage;
  composition: CompositionOk;
  artisanatTire?: ArtisanatTire;
}

/** Arguments EXACTS de la RPC `enregistrer_generation` (mêmes noms p_*). */
export interface ArgsTraceGeneration {
  p_personnage_id: string;
  p_mode: ModeGeneration;
  p_statut: string;
  p_etape_apres: number | null;
  p_nb_echecs: number;
  /** `jsonb` côté base — voir la note FRONTIÈRE en tête de fichier. */
  p_composition: Json;
}

/**
 * Rend la composition réellement sérialisable (et pas seulement déclarée
 * telle). Tout le contenu est plat — chaînes, nombres, booléens, tableaux
 * d'objets : aucun `Set`, `Map`, `Date` ni fonction. L'aller-retour retire
 * aussi les clés `undefined` (`artisanatTire` absent), ce que `jsonb` aurait
 * fait de toute façon.
 */
export function versJson(composition: CompositionTracee): Json {
  return JSON.parse(JSON.stringify(composition)) as Json;
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
  resultat: CompositionTracee;
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
    p_composition: versJson(resultat),
  };
}
