import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";

interface LoreEntry {
  id: string;
  nom: string;
  sous_titre: string | null;
  embleme: string | null;
  description: string;
  ordre: number | null;
}

const LoreSection = ({ regions, cites }: { regions: LoreEntry[]; cites: LoreEntry[] }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const renderCards = (items: LoreEntry[], showExtras: boolean) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <Card
          key={item.id}
          className="cursor-pointer border-primary/10 transition-shadow duration-200 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
          onClick={() => setExpanded(expanded === item.id ? null : item.id)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-xl">{item.nom}</CardTitle>
            {showExtras && item.sous_titre && <p className="text-sm italic text-muted-foreground">{item.sous_titre}</p>}
            {showExtras && item.embleme && (
              <Badge variant="outline" className="text-xs w-fit border-primary/30">{item.embleme}</Badge>
            )}
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div
              className="overflow-hidden transition-all duration-300 ease-in-out"
              style={{ maxHeight: expanded === item.id ? "1000px" : "0", opacity: expanded === item.id ? 1 : 0 }}
            >
              <p className="border-t border-primary/10 pt-3 mt-1 whitespace-pre-line">{item.description}</p>
            </div>
            <div className="flex justify-end pt-1">
              <ChevronDown className={`h-4 w-4 text-primary/40 transition-transform duration-300 ${expanded === item.id ? "rotate-180" : ""}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">Le Monde de Destéa</h2>

      {regions.length > 0 && (
        <section>
          <h3 className="font-heading text-lg font-semibold text-primary mb-3">Régions</h3>
          {renderCards(regions, false)}
        </section>
      )}

      {cites.length > 0 && (
        <section>
          <h3 className="font-heading text-lg font-semibold text-primary mb-3">Cités</h3>
          {renderCards(cites, true)}
        </section>
      )}
    </div>
  );
};

export default LoreSection;
