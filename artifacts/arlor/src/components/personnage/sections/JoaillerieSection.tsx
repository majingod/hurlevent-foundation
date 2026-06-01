import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import type { ArtisanatEtat, ObjetJoaillerie } from "./types";

interface JoaillerieSectionProps {
  artisanatEtat: ArtisanatEtat | null | undefined;
  objetsJoaillerie: ObjetJoaillerie[] | undefined;
}

export const JoaillerieSection = ({
  artisanatEtat,
  objetsJoaillerie,
}: JoaillerieSectionProps) => {
  return (artisanatEtat?.niveau_joaillerie ?? 0) < 1 ? (
    <p className="text-center py-8 text-muted-foreground">Aucune compétence en joaillerie.</p>
  ) : !objetsJoaillerie || objetsJoaillerie.length === 0 ? (
    <p className="text-sm text-muted-foreground">Aucun objet de joaillerie disponible.</p>
  ) : (
    <div className="grid gap-3 sm:grid-cols-2">
      {objetsJoaillerie.map((obj) => (
        <Card key={obj.id} className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{obj.nom}</CardTitle>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Temps de fabrication : {obj.temps_fabrication_minutes} min
              {(artisanatEtat?.niveau_joaillerie ?? 0) >= 2 && obj.temps_rare_minutes != null && (
                <>
                  {" (commun) — "}
                  {obj.temps_rare_minutes} min (rare)
                </>
              )}
            </p>
          </CardHeader>
          <CardContent className="space-y-1 text-xs pt-0">
            {obj.description && <p className="text-muted-foreground">{obj.description}</p>}
            {obj.effet && <p><span className="font-medium">Effet :</span> {obj.effet}</p>}
            {obj.materiaux_communs && (
              <p><span className="text-amber-400 font-medium">Matériaux communs :</span> {obj.materiaux_communs}</p>
            )}
            {(artisanatEtat?.niveau_joaillerie ?? 0) >= 2 && obj.materiaux_rares && (
              <p><span className="text-purple-400 font-medium">Matériaux rares :</span> {obj.materiaux_rares}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default JoaillerieSection;
