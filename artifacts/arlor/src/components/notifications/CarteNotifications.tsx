import { Bell, CheckCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useNotifications } from "@/hooks/useNotifications";
import { LigneNotif } from "./notifShared";

export default function CarteNotifications() {
  const { notifs, nbNonLus, isLoading, lireUne, toutLire } = useNotifications();
  const liste = notifs.slice(0, 15);

  if (isLoading) return null;

  return (
    <Card className="overflow-hidden border-white/10 bg-white/5">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-gold" />
          <h2 className="font-heading text-base font-bold text-gold">Notifications</h2>
          {nbNonLus > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold/20 px-1.5 text-[11px] font-bold text-gold">
              {nbNonLus}
            </span>
          )}
        </div>
        {nbNonLus > 0 && (
          <button
            type="button"
            onClick={toutLire}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Tout marquer lu
          </button>
        )}
      </div>

      {liste.length === 0 ? (
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Bell className="mb-3 h-10 w-10 text-white/15" />
          <p className="text-sm text-muted-foreground">
            Aucune notification pour le moment.
          </p>
        </CardContent>
      ) : (
        <div className="divide-y divide-white/5">
          {liste.map((n) => (
            <LigneNotif key={n.id} notif={n} onLire={lireUne} />
          ))}
        </div>
      )}
    </Card>
  );
}
