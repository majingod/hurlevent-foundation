import { ItemFiche } from "./ItemFiche";
import { Badge } from "@/components/ui/badge";
import { EffetBox } from "@/components/shared/EffetBox";
import { useModeAffichage } from "@/contexts/ModeAffichageContext";
import type { Assemblage } from "./types";

interface AssemblagesSectionProps {
  assemblages: Assemblage[] | undefined;
}

export const AssemblagesSection = ({ assemblages }: AssemblagesSectionProps) => {
  // Patron canon abrégé ⇄ intégral (s299) : resume_condense ⇄ texte_manuel.
  // La colonne description ne s'affiche plus (précédent Étape 8 s298).
  const { mode } = useModeAffichage();

  if (!assemblages || assemblages.length === 0) {
    return <p className="text-center py-8 text-muted-foreground">Aucun assemblage de runes.</p>;
  }

  return (
    <div className="space-y-3">
      {assemblages.map((asm) => {
        const texte = mode === "abrege" ? asm.resume_condense : asm.texte_manuel;
        return (
          <ItemFiche
            key={asm.id}
            titre={asm.nom}
            badges={
              <>
                {asm.cout_ps != null && <Badge variant="secondary" className="text-xs">{asm.cout_ps} PS</Badge>}
                {asm.cible && <Badge variant="outline" className="text-xs">Cible : {asm.cible}</Badge>}
                {asm.duree && <Badge variant="outline" className="text-xs">Durée : {asm.duree}</Badge>}
              </>
            }
          >
            {asm.runes_requises && asm.runes_requises.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {asm.runes_requises.map((rune, i) => (
                  <Badge key={i} variant="outline" className="text-xs border-primary/30 text-primary">{rune}</Badge>
                ))}
              </div>
            )}
            {asm.effet && <p><span className="font-medium text-foreground">Effet :</span> {asm.effet}</p>}
            {asm.effet_maitrise && (
              <EffetBox titre="⭐ Maîtrise">
                {asm.cout_ps_maitrise != null
                  ? `${asm.effet_maitrise} (${asm.cout_ps_maitrise} PS)`
                  : asm.effet_maitrise}
              </EffetBox>
            )}
            {texte && <p className="text-muted-foreground whitespace-pre-line">{texte}</p>}
          </ItemFiche>
        );
      })}
    </div>
  );
};

export default AssemblagesSection;
