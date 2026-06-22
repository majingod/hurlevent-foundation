import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { lireStockage, ecrireStockage } from "@/components/createur/aide/stockageLocal";
import type { ModeManuel } from "@/components/shared/FicheMoteur";

// Persistance localStorage du MODE manuel (abrégé / intégral) par SURFACE.
// Réutilise l'accès défensif `stockageLocal` (try/catch Safari navigation privée).
// Clés distinctes par surface : useModeManuel("encyclopedie", "integral"),
// useModeManuel("wizard", "abrege")… → préfixe "hv-mode-manuel:<cle>".

const PREFIXE = "hv-mode-manuel:";

const estModeValide = (v: string | null): v is ModeManuel =>
  v === "abrege" || v === "integral";

export function useModeManuel(
  cle: string,
  defaut: ModeManuel,
): [ModeManuel, Dispatch<SetStateAction<ModeManuel>>] {
  const [mode, setMode] = useState<ModeManuel>(() => {
    const stocke = lireStockage(PREFIXE + cle);
    return estModeValide(stocke) ? stocke : defaut;
  });

  useEffect(() => {
    ecrireStockage(PREFIXE + cle, mode);
  }, [cle, mode]);

  return [mode, setMode];
}
