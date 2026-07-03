import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type ModeAffichage = "abrege" | "integral";

interface ModeAffichageContextType {
  /** Préférence d'affichage du texte descriptif, partagée encyclo + wizard + fiche perso. */
  mode: ModeAffichage;
  /** Fixe explicitement le mode (persiste). */
  setMode: (m: ModeAffichage) => void;
  /** Bascule abrégé ⇄ intégral (persiste). */
  toggleMode: () => void;
}

// Préférence GLOBALE de l'appareil (PAS par compte) : l'encyclopédie est une
// page PUBLIQUE accessible déconnecté, donc aucune dépendance à l'auth.
const CLE_STORAGE = "hv_mode_affichage";
const MODE_DEFAUT: ModeAffichage = "abrege";

const ModeAffichageContext = createContext<ModeAffichageContextType>({
  mode: MODE_DEFAUT,
  setMode: () => {},
  toggleMode: () => {},
});

export const useModeAffichage = () => useContext(ModeAffichageContext);

const lireStorage = (): ModeAffichage => {
  try {
    const v = localStorage.getItem(CLE_STORAGE);
    return v === "integral" || v === "abrege" ? v : MODE_DEFAUT;
  } catch {
    return MODE_DEFAUT;
  }
};

const ecrireStorage = (m: ModeAffichage) => {
  try {
    localStorage.setItem(CLE_STORAGE, m);
  } catch {
    /* localStorage indisponible (navigation privée) : on garde l'état mémoire. */
  }
};

export const ModeAffichageProvider = ({ children }: { children: ReactNode }) => {
  // Init paresseuse depuis localStorage (évite un flash de mode au montage).
  const [mode, setModeState] = useState<ModeAffichage>(lireStorage);

  const setMode = useCallback((m: ModeAffichage) => {
    setModeState(m);
    ecrireStorage(m);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((m) => {
      const suivant: ModeAffichage = m === "integral" ? "abrege" : "integral";
      ecrireStorage(suivant);
      return suivant;
    });
  }, []);

  return (
    <ModeAffichageContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ModeAffichageContext.Provider>
  );
};
