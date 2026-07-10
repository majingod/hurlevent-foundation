/**
 * CODE DE REPRISE (lot HL-A3, s321) — emporter/reprendre le brouillon visiteur.
 *
 * Le brouillon visiteur vit en slot unique `localStorage` (cf. `stockageBrouillon.ts`)
 * et peut être perdu (fichier `.html` hors-ligne redéplacé, mémoire du navigateur
 * effacée par l'OS). Ce module donne au visiteur un moyen de l'emporter : un code
 * texte copiable, UNIVERSEL (marche en `file://` et hors-ligne, sur tout appareil).
 *
 * Format `HV2.<base64>` : `base64(deflateRaw(JSON du brouillon))` via `fflate`.
 * PAS `CompressionStream` (indisponible sur iOS < 16.4, or le transfert entre
 * appareils est LE cas d'usage de ce lot).
 *
 * TS pur : aucun import React, aucun accès DOM/`localStorage` — la validation de
 * la forme décodée réutilise `interpreterBrouillonBrut` de `stockageBrouillon.ts`
 * (source unique de la garde de version ; un brouillon v1 encodé dans un code est
 * donc migré à l'import, comme au chargement).
 */

import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";
import type { BrouillonVisiteur } from "@/moteurCreation/brouillon/types";
import { interpreterBrouillonBrut } from "./stockageBrouillon";

/** Préfixe du format de code de reprise (version 2 du schéma brouillon). */
export const PREFIXE_CODE = "HV2.";

/** Sérialise un brouillon en code de reprise portable, copiable en texte. */
export function genererCodeReprise(b: BrouillonVisiteur): string {
  const compresse = deflateSync(strToU8(JSON.stringify(b)));
  // `strFromU8(x, true)` produit une chaîne binaire (latin1) sans spread géant
  // sur les octets — safe pour `btoa` même sur un brouillon volumineux.
  return PREFIXE_CODE + btoa(strFromU8(compresse, true));
}

/** Résultat d'interprétation d'un code/JSON collé ou du contenu d'un fichier .json. */
export type ResultatImport =
  | { ok: true; brouillon: BrouillonVisiteur }
  | { ok: false; erreur: string };

function interpreterJsonBrut(json: string): ResultatImport {
  let parse: unknown;
  try {
    parse = JSON.parse(json);
  } catch {
    return { ok: false, erreur: "Ce texte n'est pas un brouillon Hurlevent lisible (JSON invalide)." };
  }

  const brouillon = interpreterBrouillonBrut(parse);
  if (!brouillon) {
    return {
      ok: false,
      erreur: "Ce brouillon n'est pas reconnu par cette version du créateur de personnage.",
    };
  }
  return { ok: true, brouillon };
}

/**
 * Interprète un texte collé : un code `HV2.…`, OU un JSON brut (le contenu d'un
 * fichier `.json` collé directement, qui commence par `{`).
 *
 * Tolère les espaces/retours à la ligne insérés N'IMPORTE OÙ dans un code `HV2.…`
 * (les messageries en ajoutent au retour à la ligne) : tout caractère d'espacement
 * est retiré AVANT de tester le préfixe et de décoder. Un code tronqué ou corrompu
 * retourne `{ ok:false, erreur }`, jamais de throw.
 */
export function interpreterTexteColle(texte: string): ResultatImport {
  const brut = texte.trim();
  if (brut.startsWith("{")) {
    return interpreterJsonBrut(brut);
  }

  const sansEspaces = texte.replace(/\s+/g, "");
  if (!sansEspaces.startsWith(PREFIXE_CODE)) {
    return {
      ok: false,
      erreur: "Ce texte ne ressemble pas à un code de reprise Hurlevent (préfixe manquant).",
    };
  }

  const b64 = sansEspaces.slice(PREFIXE_CODE.length);
  try {
    const compresse = strToU8(atob(b64), true);
    const json = strFromU8(inflateSync(compresse));
    return interpreterJsonBrut(json);
  } catch {
    return {
      ok: false,
      erreur: "Ce code de reprise est incomplet ou corrompu — vérifie qu'il a été copié en entier.",
    };
  }
}
