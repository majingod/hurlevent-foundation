import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfil } from "@/contexts/ProfilContext";
import { setModeStaff as setModeStaffHeader } from "@/integrations/supabase/client";

const ROLES_STAFF = ["admin", "animateur"];

interface ModeStaffContextType {
  /** Compte staff ET profil actif = principal -> l'interrupteur peut s'afficher. */
  peutBasculer: boolean;
  /** Interrupteur utilisateur (persisté par compte, défaut OFF). */
  interrupteurOn: boolean;
  /** Effectif = peutBasculer ∧ interrupteurOn. Pilote l'UI staff + le canal admin. */
  staffActif: boolean;
  setInterrupteur: (on: boolean) => void;
}

const ModeStaffContext = createContext<ModeStaffContextType>({
  peutBasculer: false,
  interrupteurOn: false,
  staffActif: false,
  setInterrupteur: () => {},
});

export const useModeStaff = () => useContext(ModeStaffContext);

// Persistance par compte (comme le profil actif) : un reload garde l'état ;
// une nouvelle session repart OFF.
const cleStorage = (compteId: string) => `hv_mode_staff:${compteId}`;

export const ModeStaffProvider = ({ children }: { children: ReactNode }) => {
  const { user, role } = useAuth();
  const { profilActif } = useProfil();
  const [interrupteurOn, setInterrupteurOn] = useState(false);

  const estStaff = role != null && ROLES_STAFF.includes(role);
  const peutBasculer = estStaff && !!profilActif?.est_principal;
  const staffActif = peutBasculer && interrupteurOn;

  // Restaure l'interrupteur (par compte) au login / changement de compte.
  useEffect(() => {
    if (!user) {
      setInterrupteurOn(false);
      return;
    }
    const stocke = sessionStorage.getItem(cleStorage(user.id));
    setInterrupteurOn(stocke === "1");
  }, [user]);

  const setInterrupteur = useCallback(
    (on: boolean) => {
      if (user) {
        if (on) sessionStorage.setItem(cleStorage(user.id), "1");
        else sessionStorage.removeItem(cleStorage(user.id));
      }
      setInterrupteurOn(on);
    },
    [user],
  );

  // Le canal admin (header x-hv-canal) suit l'état staff effectif.
  useEffect(() => {
    setModeStaffHeader(staffActif);
  }, [staffActif]);

  return (
    <ModeStaffContext.Provider
      value={{ peutBasculer, interrupteurOn, staffActif, setInterrupteur }}
    >
      {children}
    </ModeStaffContext.Provider>
  );
};
