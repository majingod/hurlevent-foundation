/**
 * Logique pure de la fenêtre « accès magiques dormants » (s379, D51). Extraite
 * du composant pour rester testable sans monter de composant, sur le modèle
 * de `Etape5_Competences_V2.cascade.ts`.
 */

export interface AvertissementAccesDormant {
  code?: string;
  message?: string;
  xp?: number;
}

/** D51-c : la fenêtre s'ouvre dès qu'il existe au moins un avertissement. */
export function doitOuvrirFenetreAccesDormants(
  avertissements: AvertissementAccesDormant[] | undefined,
): boolean {
  return (avertissements ?? []).length > 0;
}

/** Somme des `xp` fournis par le serveur ; un avertissement sans `xp` compte 0. */
export function totalXpDormant(
  avertissements: AvertissementAccesDormant[] | undefined,
): number {
  return (avertissements ?? []).reduce((total, a) => total + (a.xp ?? 0), 0);
}

export type DecisionApresDryRun =
  | { action: "erreur" }
  | { action: "ouvrir_fenetre"; avertissements: AvertissementAccesDormant[] }
  | { action: "finaliser" };

/**
 * Décision prise après le dry-run de `validerPersonnageFinal` (§4.1.2/3) :
 * une validation bloquante (`valide === false`) emprunte le chemin d'erreur
 * existant et n'ouvre JAMAIS la fenêtre, même s'il y a des avertissements.
 */
export function decisionApresDryRun(result: {
  valide?: boolean;
  avertissements?: AvertissementAccesDormant[];
}): DecisionApresDryRun {
  if (result.valide === false) {
    return { action: "erreur" };
  }
  const avertissements = result.avertissements ?? [];
  if (doitOuvrirFenetreAccesDormants(avertissements)) {
    return { action: "ouvrir_fenetre", avertissements };
  }
  return { action: "finaliser" };
}
