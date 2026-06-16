import { Coins, XCircle, ChevronRight, type LucideIcon } from "lucide-react";
import type { Notif } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { estNavigable, useNaviguerNotif } from "./notifNavigation";

interface MetaType {
  Icon: LucideIcon;
  couleurIcone: string;
  fondIcone: string;
}

const META_DEFAUT: MetaType = {
  Icon: Coins,
  couleurIcone: "text-gold",
  fondIcone: "bg-gold/10",
};

const META_PAR_TYPE: Record<string, MetaType> = {
  info: META_DEFAUT,
  race_refusee: {
    Icon: XCircle,
    couleurIcone: "text-destructive",
    fondIcone: "bg-destructive/10",
  },
};

export function metaPour(type: string): MetaType {
  return META_PAR_TYPE[type] ?? META_DEFAUT;
}

export function dateRelative(iso: string): string {
  const d = new Date(iso);
  const jours = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return "hier";
  if (jours < 7) return `il y a ${jours} j`;
  if (jours < 30) return `il y a ${Math.floor(jours / 7)} sem`;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}

export function LigneNotif({
  notif,
  onLire,
  compacte = false,
  onAvantNavigation,
}: {
  notif: Notif;
  onLire: (id: string) => void;
  compacte?: boolean;
  onAvantNavigation?: () => void;
}) {
  const m = metaPour(notif.type);
  const { Icon } = m;
  const { role } = useAuth();
  const naviguer = useNaviguerNotif();
  const navigable = estNavigable(notif, role);

  const onClick = () => {
    if (!notif.lu) onLire(notif.id);
    if (navigable) {
      onAvantNavigation?.();
      void naviguer(notif);
    }
  };

  const classes = [
    "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors",
    !notif.lu ? "bg-gold/5" : "",
    navigable || !notif.lu ? "hover:bg-gold/10" : "",
    navigable ? "cursor-pointer" : "cursor-default",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" onClick={onClick} className={classes}>
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.fondIcone}`}
      >
        <Icon className={`h-4 w-4 ${m.couleurIcone}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm leading-snug ${compacte ? "line-clamp-2" : ""} ${
            notif.lu ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {notif.message}
        </span>
        <span className="mt-1 block text-[11px] text-muted-foreground">
          {dateRelative(notif.created_at)}
        </span>
      </span>
      <span className="mt-1.5 flex shrink-0 items-center gap-1.5">
        {!notif.lu && (
          <span className="block h-2 w-2 rounded-full bg-gold" aria-label="Non lu" />
        )}
        {navigable && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </span>
    </button>
  );
}
