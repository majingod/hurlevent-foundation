import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useModeAffichage } from "@/contexts/ModeAffichageContext";
import type { Trait } from "./types";

interface TraitsSectionProps {
  traits: Trait[];
}

export const TraitsSection = ({ traits }: TraitsSectionProps) => {
  // Patron canon abrégé ⇄ intégral (s299) : resume_condense ⇄ texte_manuel.
  // La colonne description ne s'affiche plus.
  const { mode } = useModeAffichage();

  return traits && traits.length > 0 ? (
    <div className="space-y-3">
      {traits.map((trait) => {
        const texte = mode === "abrege" ? trait.resume_condense : trait.texte_manuel;
        return (
          <Card key={trait.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{trait.nom}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{texte}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  ) : (
    <p className="text-center py-8 text-muted-foreground">Aucun trait racial.</p>
  );
};

export default TraitsSection;
