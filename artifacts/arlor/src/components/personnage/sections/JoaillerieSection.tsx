import { ItemFiche } from "./ItemFiche";
import { Clock } from "lucide-react";
import { useModeAffichage } from "@/contexts/ModeAffichageContext";
import type { ArtisanatEtat, ObjetJoaillerie } from "./types";

interface JoaillerieSectionProps {
  artisanatEtat: ArtisanatEtat | null | undefined;
  objetsJoaillerie: ObjetJoaillerie[] | undefined;
}

export const JoaillerieSection = ({
  artisanatEtat,
  objetsJoaillerie,
}: JoaillerieSectionProps) => {
  // Patron canon abrégé ⇄ intégral (s299) : resume_condense ⇄ description.
  const { mode } = useModeAffichage();

  return (artisanatEtat?.niveau_joaillerie ?? 0) < 1 ? (
    <p className="text-center py-8 text-muted-foreground">Aucune compétence en joaillerie.</p>
  ) : !objetsJoaillerie || objetsJoaillerie.length === 0 ? (
    <p className="text-sm text-muted-foreground">Aucun objet de joaillerie disponible.</p>
  ) : (
    <div className="grid gap-3 sm:grid-cols-2">
      {objetsJoaillerie.map((obj) => (
        <ItemFiche
          key={obj.id}
          titre={obj.nom}
          sousTitre={
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Temps de fabrication : {obj.temps_fabrication_minutes} min
              {(artisanatEtat?.niveau_joaillerie ?? 0) >= 2 && obj.temps_rare_minutes != null && (
                <>
                  {" (commun) — "}
                  {obj.temps_rare_minutes} min (rare)
                </>
              )}
            </span>
          }
        >
            {(mode === "abrege" ? obj.resume_condense : obj.description) && (
              <p className="text-muted-foreground whitespace-pre-line">
                {mode === "abrege" ? obj.resume_condense : obj.description}
              </p>
            )}
            {obj.effet && <p><span className="font-medium">Effet :</span> {obj.effet}</p>}
            {obj.materiaux_communs && (
              <p className="text-xs"><span className="text-amber-400 font-medium">Matériaux communs :</span> {obj.materiaux_communs}</p>
            )}
            {(artisanatEtat?.niveau_joaillerie ?? 0) >= 2 && obj.materiaux_rares && (
              <p className="text-xs"><span className="text-purple-400 font-medium">Matériaux rares :</span> {obj.materiaux_rares}</p>
            )}
        </ItemFiche>
      ))}
    </div>
  );
};

export default JoaillerieSection;
