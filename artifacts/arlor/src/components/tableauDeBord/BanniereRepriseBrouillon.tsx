/**
 * [VIS-6] Lot 2 — bannière de reprise du brouillon visiteur, en tête du tableau
 * de bord. Un joueur qui a bâti un personnage en essai libre (mode visiteur, hors
 * ligne) se voit proposer, à sa première connexion, de le transformer en vrai
 * personnage.
 *
 * Visible SSI : un brouillon existe (`chargerBrouillon()`) ET la reprise n'a pas
 * été ignorée définitivement (`estRepriseIgnoree()`). Trois issues :
 *  - « Le transformer en vrai personnage » → page de reprise (`/reprise-essai`) ;
 *  - « Plus tard » → masque pour la session (état mémoire, revient au reload) ;
 *  - « Ignorer définitivement » → drapeau `localStorage`, ne revient plus.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { chargerBrouillon } from "@/creation/visiteur/stockageBrouillon";
import {
  repriseDisponible,
  ignorerRepriseDefinitivement,
} from "@/creation/reprise/repriseFlags";
import { getSnapshot } from "@/moteurCreation/snapshot";

function nomRace(raceId: string): string {
  return getSnapshot().tables.races.find((r) => r.id === raceId)?.nom ?? "";
}
function nomClasse(classeId: string): string {
  return getSnapshot().tables.classes.find((c) => c.id === classeId)?.nom ?? "";
}
function dateFr(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}

export default function BanniereRepriseBrouillon() {
  // Le brouillon (et le drapeau) sont lus au montage : la page se recharge après
  // reprise/ignore, pas besoin de réactivité fine.
  const brouillon = useMemo(() => (repriseDisponible() ? chargerBrouillon() : null), []);
  const [masquee, setMasquee] = useState(false);

  if (!brouillon || masquee) return null;

  const nom = brouillon.etape1.nom?.trim() || "Personnage sans nom";
  const race = nomRace(brouillon.etape2.raceId);
  const classe = nomClasse(brouillon.etape4.classeId);
  const etape = brouillon.meta.etapeCourante;
  const date = dateFr(brouillon.meta.creeLe);
  const descriptif = [race, classe].filter(Boolean).join(" ");

  return (
    <Card className="border-gold/40 bg-gold/[0.06]">
      <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
          <div className="space-y-1">
            <h2 className="font-heading text-lg text-gold">Un personnage d'essai vous attend</h2>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-white">{nom}</span>
              {descriptif ? ` — ${descriptif}` : ""}, avancé à l'étape {etape}
              {date ? `, créé le ${date}` : ""} en essai libre.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button asChild className="w-full bg-gold font-bold text-black hover:bg-gold/80 sm:w-auto">
            <Link to="/reprise-essai">Le transformer en vrai personnage</Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={() => setMasquee(true)}
          >
            Plus tard
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground hover:text-white sm:ml-auto sm:w-auto"
            onClick={() => {
              ignorerRepriseDefinitivement();
              setMasquee(true);
            }}
          >
            Ignorer définitivement
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
