import { Coins, XCircle, ChevronRight, type LucideIcon } from "lucide-react";
import type { Notif } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { useProfil } from "@/contexts/ProfilContext";
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

// Badge de portée (Option B) : « Compte » pour une annonce compte-wide
// (profil_id NULL), sinon le nom du profil actif (la notif lui appartient,
// garanti par le filtre de useNotifications).
function BadgePortee({ notif, nomProfil }: { notif: Notif; nomProfil?: string }) {
  if (notif.profil_id === null) {
    return (
      <span className="rounded-full border border-gold/30 bg-gold/10 px-1.5 py-px text-[10px] font-semibold text-gold">
        Compte
      </span>
    );
  }
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
      {nomProfil ?? "Profil"}
    </span>
  );
}

// Badge d'état de traitement (cloche staff) : « À traiter » tant que la demande
// est en attente, sinon « Traité par <nom> » (approuvée ou refusée).
function BadgeTraitement({
  traitement,
}: {
  traitement: { aTraiter: boolean; nom: string | null };
}) {
  if (traitement.aTraiter) {
    return (
      <span
        className="rounded-full border px-1.5 py-px text-[10px] font-semibold"
        style={{
          borderColor: "rgba(230,184,85,.35)",
          background: "rgba(230,184,85,.1)",
          color: "#e6b855",
        }}
      >
        ⏳ À traiter
      </span>
    );
  }
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
      ✓ Traité{traitement.nom ? ` par ${traitement.nom}` : ""}
    </span>
  );
}

export function LigneNotif({
  notif,
  onLire,
  compacte = false,
  onAvantNavigation,
  masquerPortee = false,
  traitement,
}: {
  notif: Notif;
  onLire?: (id: string) => void;
  compacte?: boolean;
  onAvantNavigation?: () => void;
  masquerPortee?: boolean;
  traitement?: { aTraiter: boolean; nom: string | null } | null;
}) {
  const m = metaPour(notif.type);
  const { Icon } = m;
  const { role } = useAuth();
  const { profilActif } = useProfil();
  const naviguer = useNaviguerNotif();
  const navigable = estNavigable(notif, role);

  const onClick = () => {
    if (!notif.lu) onLire?.(notif.id);
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
        <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {traitement ? (
            <BadgeTraitement traitement={traitement} />
          ) : (
            !masquerPortee && (
              <BadgePortee notif={notif} nomProfil={profilActif?.nom} />
            )
          )}
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
