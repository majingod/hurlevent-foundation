import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface ItemFicheProps {
  titre: ReactNode;
  sousTitre?: ReactNode;
  badges?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Coquille commune des items de la fiche personnage (HARMONISATION s305).
 * Unifie conteneur (Card), en-tête (titre sobre + sous-titre + badges à droite)
 * et taille du corps (text-sm). Le CORPS reste custom par section (slot children).
 */
export const ItemFiche = ({ titre, sousTitre, badges, children, className }: ItemFicheProps) => (
  <Card className={className}>
    <CardContent className="pt-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-tight text-foreground">{titre}</p>
          {sousTitre && <p className="text-xs text-muted-foreground">{sousTitre}</p>}
        </div>
        {badges && (
          <div className="flex flex-wrap items-center justify-end gap-1.5 flex-shrink-0">
            {badges}
          </div>
        )}
      </div>
      {children && <div className="text-sm space-y-2">{children}</div>}
    </CardContent>
  </Card>
);
