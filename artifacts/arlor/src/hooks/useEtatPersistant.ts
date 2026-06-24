import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { lireStockage, ecrireStockage } from "@/components/createur/aide/stockageLocal";

// useState miroir-localStorage générique (calqué sur useModeManuel).
// Persiste l'état d'une surface (onglet, filtres, accordéons de l'encyclopédie…)
// pour qu'il SURVIVE à la sortie/ré-entrée de page : le state local pur est perdu
// au démontage SPA, et l'URL est nettoyée quand on revient par le menu.
// Préfixe "hv-etat:<cle>". Accès défensif via stockageLocal (Safari navigation privée).
// Codec par défaut = JSON. Pour un Set<string> (accordéons custom), passer `codecEnsembleTexte`.

const PREFIXE = "hv-etat:";

export interface Codec<T> {
  serialise: (v: T) => string;
  parse: (s: string) => T;
}

// Codec dédié Set<string> : sérialisé comme tableau JSON (Set n'est pas JSON-sérialisable).
export const codecEnsembleTexte: Codec<Set<string>> = {
  serialise: (v) => JSON.stringify([...v]),
  parse: (s) => new Set<string>(JSON.parse(s) as string[]),
};

export function useEtatPersistant<T>(
  cle: string,
  defaut: T,
  codec?: Codec<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const serialise = codec?.serialise ?? ((v: T) => JSON.stringify(v));
  const parse = codec?.parse ?? ((s: string) => JSON.parse(s) as T);

  const [valeur, setValeur] = useState<T>(() => {
    const stocke = lireStockage(PREFIXE + cle);
    if (stocke === null) return defaut;
    try {
      return parse(stocke);
    } catch {
      return defaut;
    }
  });

  useEffect(() => {
    try {
      ecrireStockage(PREFIXE + cle, serialise(valeur));
    } catch {
      // Sérialisation impossible : l'état reste en mémoire pour la session.
    }
    // serialise/parse sont stables pour une clé donnée ; on ne dépend que de cle + valeur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, valeur]);

  return [valeur, setValeur];
}
