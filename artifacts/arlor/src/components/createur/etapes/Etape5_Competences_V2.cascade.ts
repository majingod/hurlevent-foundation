/**
 * Logique pure extraite de `Etape5_Competences_V2` (import direct du composant
 * impossible en test unitaire : `clientActif` → `clientServeur` → le client
 * Supabase touche `localStorage` au chargement du module). Suit la convention
 * `Etape2_V2.calc.ts`.
 */

/**
 * Détermine si l'aperçu de désachat justifie l'ouverture de la modale de
 * confirmation plutôt qu'une suppression directe. Vrai dès qu'il y a plus
 * d'un niveau de compétence touché, ou tout sort/prière/recette/piège/
 * assemblage entraîné en cascade.
 */
export function doitOuvrirModaleCascade(
  donnees: Record<string, unknown>,
): boolean {
  const nbLignes = (donnees.count_competences as number) ?? 0;
  const aDesSortsOuPrieres =
    ((donnees.count_sorts as number) ?? 0) > 0 ||
    ((donnees.count_prieres as number) ?? 0) > 0;
  const aDesArtisanat =
    ((donnees.count_recettes as number) ?? 0) > 0 ||
    ((donnees.count_assemblages as number) ?? 0) > 0 ||
    ((donnees.count_pieges as number) ?? 0) > 0;
  return nbLignes > 1 || aDesSortsOuPrieres || aDesArtisanat;
}
