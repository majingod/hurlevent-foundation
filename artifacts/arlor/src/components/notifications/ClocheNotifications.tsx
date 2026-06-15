import { Bell, CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useNotifications } from "@/hooks/useNotifications";
import { LigneNotif } from "./notifShared";

export default function ClocheNotifications() {
  const { notifs, nbNonLus, lireUne, toutLire } = useNotifications();
  const apercu = notifs.slice(0, 5);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/5"
        >
          <Bell className="h-5 w-5 text-primary" />
          {nbNonLus > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-black">
              {nbNonLus > 9 ? "9+" : nbNonLus}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 border-white/10 bg-[#0a0a0a]">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
          <span className="font-heading text-sm font-bold text-gold">
            Notifications
          </span>
          {nbNonLus > 0 && (
            <button
              type="button"
              onClick={toutLire}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Tout marquer lu
            </button>
          )}
        </div>

        {apercu.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Aucune notification.
          </p>
        ) : (
          <div className="max-h-80 divide-y divide-white/5 overflow-y-auto">
            {apercu.map((n) => (
              <LigneNotif key={n.id} notif={n} onLire={lireUne} compacte />
            ))}
          </div>
        )}

        <Link
          to="/tableau-de-bord"
          className="block border-t border-white/10 py-2.5 text-center text-xs text-gold hover:bg-white/5"
        >
          Voir toutes les notifications
        </Link>
      </PopoverContent>
    </Popover>
  );
}
