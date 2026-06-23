import { useState } from "react";
import { Shield } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useNotificationsStaff } from "@/hooks/useNotifications";
import { useModeStaff } from "@/contexts/ModeStaffContext";
import { LigneNotif } from "./notifShared";

// Cloche d'ORGANISATION : visible uniquement quand le mode animation est actif.
// Compteur = nombre de demandes encore À TRAITER (indépendant du lu/non-lu).
// Clic d'une notif → écran des approbations (géré dans notifNavigation).
export default function ClocheNotificationsStaff() {
  const { staffActif } = useModeStaff();
  const { notifs, nbATraiter } = useNotificationsStaff();
  const [open, setOpen] = useState(false);
  const apercu = notifs.slice(0, 5);

  if (!staffActif) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications d'organisation"
          className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/5"
        >
          <Shield className="h-5 w-5" style={{ color: "#e6b855" }} />
          {nbATraiter > 0 && (
            <span
              className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
              style={{ background: "#e6b855", color: "#1a1206", boxShadow: "0 0 0 2px #0a0a0a" }}
            >
              {nbATraiter > 9 ? "9+" : nbATraiter}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 border-white/10 bg-[#0a0a0a]">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
          <span
            className="flex items-center gap-1.5 font-heading text-sm font-bold"
            style={{ color: "#e6b855" }}
          >
            <Shield className="h-3.5 w-3.5" /> Organisation
          </span>
          {nbATraiter > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {nbATraiter} à traiter
            </span>
          )}
        </div>

        {apercu.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Aucune notification d'organisation.
          </p>
        ) : (
          <div className="max-h-80 divide-y divide-white/5 overflow-y-auto">
            {apercu.map((n) => (
              <LigneNotif
                key={n.id}
                notif={n}
                compacte
                masquerPortee
                traitement={{ aTraiter: n.a_traiter, nom: n.traite_par_nom }}
                onAvantNavigation={() => setOpen(false)}
              />
            ))}
          </div>
        )}

        <Link
          to="/administration/approbations"
          onClick={() => setOpen(false)}
          className="block border-t border-white/10 py-2.5 text-center text-xs hover:bg-white/5"
          style={{ color: "#e6b855" }}
        >
          Voir l'écran des approbations
        </Link>
      </PopoverContent>
    </Popover>
  );
}
