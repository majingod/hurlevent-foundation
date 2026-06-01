import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Trait } from "./types";

interface TraitsSectionProps {
  traits: Trait[];
}

export const TraitsSection = ({ traits }: TraitsSectionProps) => {
  return traits && traits.length > 0 ? (
    <div className="space-y-3">
      {traits.map((trait) => (
        <Card key={trait.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{trait.nom}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{trait.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  ) : (
    <p className="text-center py-8 text-muted-foreground">Aucun trait racial.</p>
  );
};

export default TraitsSection;
