import { useState } from "react";
import { CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import EncyclopedieCard from "@/components/encyclopedie/EncyclopedieCard";

const CIBLE_FILTERS: { value: string | null; label: string }[] = [
  { value: null, label: "Tous" },
  { value: "Un individu", label: "Un individu" },
  { value: "Un bouclier", label: "Un bouclier" },
  { value: "Une armure", label: "Une armure" },
  { value: "Une enclume ou un marteau de forge", label: "Une enclume ou un marteau de forge" },
];

interface Assemblage {
  id: string;
  nom: string | null;
  description_longue: string | null;
  effet: string | null;
  cible: string | null;
  runes_requises: string[] | null;
  cout_ps: number | null;
  effet_maitrise: string | null;
  cout_ps_maitrise: number | null;
}

const AssemblagesSection = ({ assemblages, searchQuery = "" }: { assemblages: Assemblage[]; searchQuery?: string }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [cibleFilter, setCibleFilter] = useState<string | null>(null);
  const q = searchQuery.trim().toLowerCase();
  const filtered = assemblages
    .filter((a) => cibleFilter === null || a.cible === cibleFilter)
    .filter(
      (a) =>
        !q ||
        (a.nom ?? "").toLowerCase().includes(q) ||
        (a.description_longue ?? "").toLowerCase().includes(q) ||
        (a.effet ?? "").toLowerCase().includes(q),
    );

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">Assemblages de Runes</h2>
      <div className="flex flex-wrap gap-2">
        {CIBLE_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={cibleFilter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setCibleFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      {filtered.length === 0 && (q || cibleFilter !== null) && (
        <p className="text-muted-foreground text-center py-6">Aucun résultat pour cette recherche.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((a) => (
          <EncyclopedieCard
            key={a.id}
            id={a.id}
            isOpen={expanded.has(a.id)}
            onToggle={() => toggleExpanded(a.id)}
            maxHeight={1000}
            header={
              <>
                <CardTitle className="font-heading text-xl">{a.nom}</CardTitle>
                <div className="flex flex-wrap gap-2 mt-1">
                  {a.cible && <Badge variant="secondary" className="text-xs">Cible : {a.cible}</Badge>}
                  {a.cout_ps != null && <Badge variant="outline" className="text-xs">{a.cout_ps} PS</Badge>}
                </div>
                {a.runes_requises && a.runes_requises.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {a.runes_requises.map((rune, i) => (
                      <Badge key={i} variant="outline" className="text-xs border-primary/30 text-primary">{rune}</Badge>
                    ))}
                  </div>
                )}
              </>
            }
          >
            <div className="border-t border-primary/10 pt-3 mt-2 space-y-2">
              {a.effet && <p><span className="font-medium text-foreground">Effet :</span> {a.effet}</p>}
              {a.description_longue && <p className="whitespace-pre-line">{a.description_longue}</p>}
              {a.effet_maitrise && (
                <p>
                  <span className="font-medium text-foreground">Effet de maîtrise :</span> {a.effet_maitrise}
                  {a.cout_ps_maitrise != null && <span className="text-xs ml-1">({a.cout_ps_maitrise} PS)</span>}
                </p>
              )}
            </div>
          </EncyclopedieCard>
        ))}
      </div>
    </div>
  );
};

export default AssemblagesSection;
