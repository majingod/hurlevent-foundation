// Helpers de présentation partagés entre FichePersonnageView (parent + handlePrint)
// et les briques sections/*. Extraits du parent en s81 (PR-1 fiche briques, Tranche 2).
// Fonctions PURES uniquement — aucun état, aucune query.

/**
 * Résout l'id stocké dans `choix_achat` vers un libellé affichable.
 * Cherche d'abord dans les langues, puis dans les religions ; sinon renvoie
 * la valeur brute (id) en repli.
 */
export const resoudreChoixAffichage = (
  choixAchat: string | null,
  langues: { id: string; nom: string | null }[] | undefined,
  religions: { id: string; nom: string | null }[] | undefined,
): string | null => {
  if (!choixAchat) return null;
  const enLangue = langues?.find((l) => l.id === choixAchat);
  if (enLangue?.nom) return enLangue.nom;
  const enReligion = religions?.find((r) => r.id === choixAchat);
  if (enReligion?.nom) return enReligion.nom;
  return choixAchat;
};
