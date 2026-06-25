import { useEffect, useState } from "react";
import { CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import EncyclopedieCard from "@/components/encyclopedie/EncyclopedieCard";
import { ManuelGlobalSwitch } from "@/components/shared/ToggleManuel";
import { FicheMoteur, type ChampSchema } from "@/components/shared/FicheMoteur";
import { useModeManuel } from "@/hooks/useModeManuel";

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
  duree: string | null;
  effet: string | null;
  cible: string | null;
  runes_requises: string[] | null;
  cout_ps: number | null;
  effet_maitrise: string | null;
  cout_ps_maitrise: number | null;
  texte_manuel: string | null;
  resume_condense: string | null;
}

const AssemblagesSection = ({
  assemblages,
  searchQuery = "",
  schema,
}: {
  assemblages: Assemblage[];
  searchQuery?: string;
  schema: ChampSchema[];
}) => {
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
  const [mode, setMode] = useModeManuel("encyclopedie", "integral");

  useEffect(() => {
    if (!searchQuery) return;
    const qLow = searchQuery.toLowerCase();
    const matches = assemblages.filter(a =>
      (a.nom ?? "").toLowerCase().includes(qLow) ||
      (a.description_longue ?? "").toLowerCase().includes(qLow) ||
      (a.effet ?? "").toLowerCase().includes(qLow)
    );
    setExpanded(new Set(matches.map(a => a.id)));
  }, [searchQuery, assemblages]);
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
      <ManuelGlobalSwitch
        allOpen={mode === "integral"}
        onToggle={() => setMode((m) => (m === "integral" ? "abrege" : "integral"))}
        title="Texte du manuel"
        subtitle="Intégral (verbatim du manuel) ou abrégé"
      />
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
            header={<CardTitle className="font-heading text-xl">{a.nom}</CardTitle>}
          >
            <div className="border-t border-primary/10 pt-3 mt-2">
              <FicheMoteur
                schema={schema}
                entite={a as unknown as Record<string, any>}
                densite="encyclo"
                mode={mode}
              />
            </div>
          </EncyclopedieCard>
        ))}
      </div>
    </div>
  );
};

export default AssemblagesSection;
