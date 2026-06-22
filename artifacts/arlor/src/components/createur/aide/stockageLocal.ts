// Accès localStorage défensif (Safari navigation privée lève sur setItem).
// Partagé par les composants d'aide É6/É7 (IntroEtape, LegendeDynamique, Astuce).

export const lireStockage = (cle: string): string | null => {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
};

export const ecrireStockage = (cle: string, valeur: string): void => {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    // Stockage indisponible : l'état reste en mémoire pour la session.
  }
};
