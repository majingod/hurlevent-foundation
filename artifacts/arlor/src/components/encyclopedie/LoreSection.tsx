import { useState } from "react";
import { CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import EncyclopedieCard from "@/components/encyclopedie/EncyclopedieCard";

interface LoreEntry {
  id: string;
  categorie: string;
  nom: string;
  sous_titre: string | null;
  embleme: string | null;
  description: string;
  ordre: number | null;
}

const SOUS_ONGLETS_LORE = [
  { key: "tout", label: "Tout" },
  { key: "region", label: "Régions" },
  { key: "cite", label: "Cités" },
] as const;

const LoreSection = ({ loreEntries, searchQuery }: { loreEntries: LoreEntry[]; searchQuery: string }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [loreOnglet, setLoreOnglet] = useState<"tout" | "region" | "cite">("tout");

  const loreFiltree = loreEntries.filter((entry) => {
    const query = searchQuery.toLowerCase();
    const matchTexte =
      !searchQuery ||
      entry.nom.toLowerCase().includes(query) ||
      entry.sous_titre?.toLowerCase().includes(query) ||
      entry.description?.toLowerCase().includes(query);
    const matchCategorie = loreOnglet === "tout" || entry.categorie === loreOnglet;
    return matchTexte && matchCategorie;
  });

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">Le Monde de Destéa</h2>

      <div className="flex gap-2 mb-4 border-b border-stone-700 pb-3">
        {SOUS_ONGLETS_LORE.map((so) => (
          <button
            key={so.key}
            onClick={() => setLoreOnglet(so.key)}
            className={
              loreOnglet === so.key
                ? "px-4 py-1.5 rounded-md text-sm font-semibold bg-amber-700 text-white border border-amber-500"
                : "px-4 py-1.5 rounded-md text-sm font-medium bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-600"
            }
          >
            {so.label}
          </button>
        ))}
      </div>

      {loreFiltree.length === 0 ? (
        <p className="text-muted-foreground text-center py-6">Aucun résultat pour cette recherche.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {loreFiltree.map((item) => (
            <EncyclopedieCard
              key={item.id}
              id={item.id}
              isOpen={expanded.has(item.id)}
              onToggle={() => toggleExpanded(item.id)}
              maxHeight={1000}
              header={
                <>
                  <CardTitle className="font-heading text-xl">{item.nom}</CardTitle>
                  {item.sous_titre && <p className="text-sm italic text-muted-foreground">{item.sous_titre}</p>}
                  {item.embleme && (
                    <Badge variant="outline" className="text-xs w-fit border-primary/30">{item.embleme}</Badge>
                  )}
                </>
              }
            >
              <p className="border-t border-primary/10 pt-3 mt-1 whitespace-pre-line">{item.description}</p>
            </EncyclopedieCard>
          ))}
        </div>
      )}
    </div>
  );
};

export default LoreSection;
