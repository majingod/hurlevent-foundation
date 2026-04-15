import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";

interface Creature {
  id: string;
  nom: string;
  categorie: string;
  pv_formule: string | null;
  description: string;
  immunites: string | null;
  capacites_speciales: string | null;
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

const BestiaireSection = ({ creatures }: { creatures: Creature[] }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const grouped = groupBy(creatures, (c) => c.categorie);
  const keys = Object.keys(grouped).sort();

  return (
    <div className="space-y-8">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">Bestiaire</h2>
      {keys.map((cat) => (
        <section key={cat}>
          <h3 className="font-heading text-lg font-semibold text-primary mb-3">{cat}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {grouped[cat].map((c) => (
              <Card
                key={c.id}
                className="cursor-pointer border-primary/10 transition-shadow duration-200 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="font-heading text-xl">{c.nom}</CardTitle>
                  {c.pv_formule && <Badge variant="secondary" className="text-xs w-fit">PV : {c.pv_formule}</Badge>}
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <div
                    className="overflow-hidden transition-all duration-300 ease-in-out"
                    style={{ maxHeight: expanded === c.id ? "1000px" : "0", opacity: expanded === c.id ? 1 : 0 }}
                  >
                    <div className="space-y-2 border-t border-primary/10 pt-3 mt-1">
                      {c.immunites && <p><span className="font-medium text-foreground">Immunités :</span> {c.immunites}</p>}
                      {c.capacites_speciales && <p><span className="font-medium text-foreground">Capacités spéciales :</span> {c.capacites_speciales}</p>}
                      <p>{c.description}</p>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <ChevronDown className={`h-4 w-4 text-primary/40 transition-transform duration-300 ${expanded === c.id ? "rotate-180" : ""}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default BestiaireSection;
