import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FichePersonnage } from "./types";

interface InfosCardProps {
  fiche: FichePersonnage;
  xpDisponible: number;
}

export const InfosCard = ({ fiche, xpDisponible }: InfosCardProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Informations générales</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Race</p>
          <p className="font-medium text-foreground">{fiche.race_nom}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Classe</p>
          <p className="font-medium text-foreground">{fiche.classe_nom}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Niveau</p>
          <p className="font-medium text-foreground">{fiche.niveau}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">XP Total</p>
          <p className="font-medium text-foreground">{fiche.xp_total}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">XP Dépensé</p>
          <p className="font-medium text-foreground">{fiche.xp_depense}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">XP Disponible</p>
          <p className="font-medium text-primary">{xpDisponible}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">PV Max</p>
          <p className="font-medium text-foreground">{fiche.pv_max}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">PS Max</p>
          <p className="font-medium text-foreground">{fiche.ps_max}</p>
        </div>
        {fiche.religion_nom && (
          <div>
            <p className="text-xs text-muted-foreground">Religion</p>
            <p className="font-medium text-foreground">{fiche.religion_nom}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">GN Complétés</p>
          <p className="font-medium text-foreground">{fiche.gn_completes}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default InfosCard;
