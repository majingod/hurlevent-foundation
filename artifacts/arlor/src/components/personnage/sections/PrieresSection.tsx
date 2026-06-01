import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calculerCoutPS, calculerCoutXP } from "@/utils/calculsMagie";
import type { Priere } from "./types";

interface PrieresSectionProps {
  prieres: Priere[];
}

export const PrieresSection = ({ prieres }: PrieresSectionProps) => {
  return prieres && prieres.length > 0 ? (
    <div className="space-y-3">
      {prieres.map((priere) => (
        <Card key={priere.id}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{priere.nom_personnalise}</p>
                <p className="text-xs text-muted-foreground">{priere.domaine} • Niveau {priere.niveau_priere}</p>
              </div>
              {priere.cout_xp_base != null && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {calculerCoutPS(calculerCoutXP(priere.zone_choisie ?? "", priere.portee_choisie ?? "", priere.duree_choisie ?? "", priere.niveau_priere, Number(priere.cout_xp_base)))} PS
                </Badge>
              )}
            </div>

            {(priere.duree_incantation ||
              priere.zone_choisie ||
              priere.portee_choisie ||
              priere.duree_choisie) && (
              <p className="text-xs text-muted-foreground">
                {[
                  priere.duree_incantation && `Incantation : ${priere.duree_incantation}`,
                  priere.zone_choisie && `Zone : ${priere.zone_choisie}`,
                  priere.portee_choisie && `Portée : ${priere.portee_choisie}`,
                  priere.duree_choisie && `Durée : ${priere.duree_choisie}`,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </p>
            )}

            {priere.priere_description && (
              <p className="border-t border-border/50 pt-2 text-sm text-foreground/90">
                {priere.priere_description}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  ) : (
    <p className="text-center py-8 text-muted-foreground">Aucune prière.</p>
  );
};

export default PrieresSection;
