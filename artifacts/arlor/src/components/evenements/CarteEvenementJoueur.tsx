import { useLayoutEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  Navigation,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TYPE_EVENEMENT_LABELS } from "@/constants/labels";

export interface EvenementPublie {
  id: string;
  titre: string | null;
  date_evenement: string | null;
  date_fin: string | null;
  lieu: string | null;
  type_evenement: string | null;
  xp_recompense: number | null;
  niveaux_recompense: number | null;
  adresse_physique: string | null;
  max_participants: number | null;
  description: string | null;
  nb_inscrits: number;
}

export type StatutInscription = "aucun" | "inscrit" | "present" | "absent";

interface Props {
  ev: EvenementPublie;
  statut: StatutInscription;
  onInscrire?: (ev: EvenementPublie) => void;
  onDesinscrire?: (ev: EvenementPublie) => void;
}

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("fr-CA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const heure = d.toLocaleTimeString("fr-CA", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date} à ${heure}`;
  } catch {
    return iso;
  }
};

// Couleurs conservées depuis la carte joueur d'origine (décision s192 ①)
const TYPE_BADGE_CLASS: Record<string, string> = {
  mini_gn: "bg-blue-700 text-foreground hover:bg-blue-700",
  gn_regulier: "bg-green-700 text-foreground hover:bg-green-700",
  entretien_terrain: "bg-primary text-primary-foreground hover:bg-primary",
};

/**
 * Carte d'événement côté joueur — composant PARTAGÉ.
 * Présentationnel : émet onInscrire / onDesinscrire, le parent câble les RPC.
 * ⚠️ Présence ≠ inscription : l'admin valide la PRÉSENCE à l'événement
 * (statut present/absent), l'inscription est enregistrée immédiatement.
 */
export const CarteEvenementJoueur = ({
  ev,
  statut,
  onInscrire,
  onDesinscrire,
}: Props) => {
  const [detailsOuvert, setDetailsOuvert] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);
  const [descDeborde, setDescDeborde] = useState(false);

  useLayoutEffect(() => {
    const el = descRef.current;
    if (el) setDescDeborde(el.scrollHeight - el.clientHeight > 4);
  }, [ev.description]);

  const typeKey = ev.type_evenement ?? "gn_regulier";
  const typeLabel = TYPE_EVENEMENT_LABELS[typeKey] ?? ev.type_evenement ?? "—";
  const typeClass =
    TYPE_BADGE_CLASS[typeKey] ?? "bg-muted text-foreground hover:bg-muted";

  const gpsHref = ev.adresse_physique
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        ev.adresse_physique,
      )}`
    : null;

  const complet =
    ev.max_participants != null && ev.nb_inscrits >= ev.max_participants;

  const niveaux = ev.niveaux_recompense ?? 0;

  const dansFenetreGel =
    !!ev.date_evenement &&
    new Date(ev.date_evenement).getTime() - 24 * 3600 * 1000 <= Date.now();

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={typeClass}>{typeLabel}</Badge>
          <Badge variant="secondary">{ev.xp_recompense ?? 0} XP</Badge>
          {niveaux > 0 && (
            <Badge variant="secondary">
              +{niveaux} niveau{niveaux > 1 ? "x" : ""}
            </Badge>
          )}
          {complet && <Badge variant="destructive">Complet</Badge>}
        </div>
        <CardTitle className="font-heading text-xl">{ev.titre}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Encadré description + fondu + « Voir les détails » → modale */}
        {ev.description && (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <div className="relative">
              <p
                ref={descRef}
                className="line-clamp-3 whitespace-pre-line text-sm text-muted-foreground"
              >
                {ev.description}
              </p>
              {descDeborde && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-b from-transparent to-muted/40" />
              )}
            </div>
            {descDeborde && (
              <button
                type="button"
                onClick={() => setDetailsOuvert(true)}
                className="mt-1.5 text-sm font-semibold text-primary hover:underline"
              >
                Voir les détails →
              </button>
            )}
          </div>
        )}

        {/* Métadonnées */}
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary/70" />
            {formatDate(ev.date_evenement)}
          </span>
          {ev.date_fin && (
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-primary/70" />
              Fin : {formatDate(ev.date_fin)}
            </span>
          )}
          {ev.lieu && (
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-primary/70" />
              {ev.lieu}
            </span>
          )}
          {gpsHref && (
            <a
              href={gpsHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <Navigation className="h-4 w-4 shrink-0" />
              Ouvrir le GPS
            </a>
          )}
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-primary/70" />
            {ev.nb_inscrits} / {ev.max_participants ?? "∞"} places
          </span>
        </div>

        {/* Action selon statut */}
        <div className="pt-1">
          {statut === "inscrit" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Inscrit</Badge>
              {dansFenetreGel ? (
                <span className="text-[12px] italic text-muted-foreground">
                  🔒 Verrouillé jusqu'à la confirmation des présences
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDesinscrire?.(ev)}
                >
                  Se désinscrire
                </Button>
              )}
            </div>
          ) : statut === "present" ? (
            <Badge className="bg-green-700 text-foreground hover:bg-green-700">
              Présence confirmée
            </Badge>
          ) : statut === "absent" ? (
            <Badge variant="destructive">Absent</Badge>
          ) : complet ? (
            <Button disabled size="sm" variant="secondary">
              Complet
            </Button>
          ) : (
            <Button size="sm" onClick={() => onInscrire?.(ev)}>
              S'inscrire
            </Button>
          )}
        </div>
      </CardContent>

      {/* Modale détails (texte intégral) */}
      <Dialog open={detailsOuvert} onOpenChange={setDetailsOuvert}>
        <DialogContent className="max-h-[82vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{ev.titre}</DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {ev.description}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CarteEvenementJoueur;
