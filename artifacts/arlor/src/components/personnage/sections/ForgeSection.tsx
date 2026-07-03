import { ItemFiche } from "./ItemFiche";
import { Clock } from "lucide-react";
import { useModeAffichage } from "@/contexts/ModeAffichageContext";
import type { ArtisanatEtat, ObjetForge } from "./types";

interface ForgeSectionProps {
  artisanatEtat: ArtisanatEtat | null | undefined;
  objetsForge: ObjetForge[] | undefined;
}

export const ForgeSection = ({ artisanatEtat, objetsForge }: ForgeSectionProps) => {
  // Patron canon abrégé ⇄ intégral (s299) : resume_condense ⇄ description.
  const { mode } = useModeAffichage();

  return (artisanatEtat?.niveau_forge ?? 0) < 1 ? (
    <p className="text-center py-8 text-muted-foreground">Aucune compétence en forge.</p>
  ) : (
    <div className="space-y-3">
      {/* Fusion s299 v2 (parité encyclopédie) : chaque objet porte sa réparation
          en ligne dédiée — plus de section « Réparation » séparée. */}
      <h3 className="text-sm font-semibold text-primary">Fabrication &amp; réparation</h3>
      {!objetsForge || objetsForge.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun objet de forge disponible.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {objetsForge.map((obj) => (
            <ItemFiche
              key={obj.id}
              titre={obj.nom}
              sousTitre={
                <>
                  {obj.type && <span className="block">{obj.type}</span>}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Temps de fabrication : {obj.temps_fabrication_minutes} min
                  </span>
                </>
              }
            >
                {(mode === "abrege" ? obj.resume_condense : obj.description) && (
                  <p className="text-muted-foreground whitespace-pre-line">
                    {mode === "abrege" ? obj.resume_condense : obj.description}
                  </p>
                )}
                {obj.materiaux_communs && (
                  <p className="text-xs"><span className="text-amber-400 font-medium">Matériaux communs :</span> {obj.materiaux_communs}</p>
                )}
                {(artisanatEtat?.niveau_forge ?? 0) >= 2 && obj.materiaux_rares && (
                  <p className="text-xs"><span className="text-purple-400 font-medium">Matériaux rares :</span> {obj.materiaux_rares}</p>
                )}
                {!obj.non_reparable && obj.reparation && (
                  <p className="text-xs">
                    <span className="text-emerald-400 font-medium">Réparation :</span>{" "}
                    {obj.reparation.temps_minutes} min · {obj.reparation.materiaux}
                  </p>
                )}
            </ItemFiche>
          ))}
        </div>
      )}
    </div>
  );
};

export default ForgeSection;
