/**
 * s404 — [INSCRIPTION-REFUS-MUET] : un refus serveur à l'inscription ou à la
 * désinscription s'affiche dans une fenêtre (arbitrage Fred s404 — jamais un
 * toast), avec le message du serveur MOT POUR MOT et, quand il y a quelque
 * chose à faire, un bouton qui y mène.
 *
 * Les codes viennent du trigger verifier_race_approuvee_avant_inscription
 * (migration 20260815180041_trigger_race_refus_codes_distincts) :
 *   RC001 = aucune demande de race  → mener au créateur
 *   RC002 = demande en attente      → rien à modifier, « Compris »
 *   RC003 = demande refusée         → mener au créateur (changer de race)
 * Tout autre code (dont le gel de désinscription, P0001) : fenêtre
 * informative, « Compris ». Le front ne retape AUCUN message : détecter par
 * le texte casserait en silence, re-tester l'état créerait une deuxième
 * maison pour le même verbe (C146). FAIL-CLOSED : code inconnu, code absent
 * ou personnage cible absent → aucune navigation proposée.
 */

export type VerbeRefus = "inscription" | "desinscription";

export interface RefusServeur {
  verbe: VerbeRefus;
  /** SQLSTATE remonté par PostgREST (error.code), null si absent. */
  code: string | null;
  /** Message du serveur, affiché mot pour mot. */
  message: string;
}

export const TITRE_REFUS: Record<VerbeRefus, string> = {
  inscription: "Inscription impossible",
  desinscription: "Désinscription impossible",
};

export const LIBELLE_COMPRIS = "Compris";
export const LIBELLE_ALLER_CREATEUR = "Aller au créateur";
export const LIBELLE_PLUS_TARD = "Plus tard";

/** Codes du trigger de race dont la réponse du joueur se joue au créateur. */
const CODES_VERS_CREATEUR = new Set(["RC001", "RC003"]);

/**
 * La destination que la fenêtre offre, ou null (bouton « Compris » seul).
 * Même route que le lien « Nommer ce personnage » de s403.
 */
export const destinationRefus = (
  code: string | null | undefined,
  personnageId: string | null | undefined
): string | null =>
  code && personnageId && CODES_VERS_CREATEUR.has(code)
    ? `/personnage/nouveau?id=${personnageId}`
    : null;
