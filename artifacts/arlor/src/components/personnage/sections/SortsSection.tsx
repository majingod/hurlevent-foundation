import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calculerCoutPS, calculerCoutXP } from "@/utils/calculsMagie";
import type { Sort } from "./types";

interface SortsSectionProps {
  sorts: Sort[];
}

export const SortsSection = ({ sorts }: SortsSectionProps) => {
  return sorts && sorts.length > 0 ? (
    <div className="space-y-3">
      {sorts.map((sort) => (
        <Card key={sort.id}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{sort.nom_personnalise}</p>
                <p className="text-xs text-muted-foreground">{sort.cercle} • Niveau {sort.niveau_sort}</p>
              </div>
              <Badge variant="secondary" className="text-xs shrink-0">
                {calculerCoutPS(calculerCoutXP(
                  sort.zone_choisie ?? "",
                  sort.portee_choisie ?? "",
                  sort.duree_choisie ?? "",
                  sort.niveau_sort,
                  Number(sort.cout_xp_base),
                ))} PS
              </Badge>
            </div>

            {sort.sort_nom_base && sort.sort_nom_base !== sort.nom_personnalise && (
              <p className="text-xs italic text-muted-foreground">Basé sur : {sort.sort_nom_base}</p>
            )}

            {sort.formule_magique && (
              <div className="inline-block rounded bg-muted px-2 py-1 font-mono text-xs">
                Formule : {sort.formule_magique}
              </div>
            )}

            {(sort.zone_choisie || sort.portee_choisie || sort.duree_choisie) && (
              <p className="text-xs text-muted-foreground">
                {[
                  sort.zone_choisie && `Zone : ${sort.zone_choisie}`,
                  sort.portee_choisie && `Portée : ${sort.portee_choisie}`,
                  sort.duree_choisie && `Durée : ${sort.duree_choisie}`,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </p>
            )}

            {sort.sort_description && (
              <p className="border-t border-border/50 pt-2 text-sm text-foreground/90">
                {sort.sort_description}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  ) : (
    <p className="text-center py-8 text-muted-foreground">Aucun sort arcanique.</p>
  );
};

export default SortsSection;
