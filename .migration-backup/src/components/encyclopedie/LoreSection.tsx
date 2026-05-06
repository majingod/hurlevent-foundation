import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";

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
  const [expanded, setExpanded] = useState<string | null>(null);
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
            <Card
              key={item.id}
              className="cursor-pointer border-primary/10 transition-shadow duration-200 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
              onClick={() => setExpanded(expanded === item.id ? null : item.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-xl">{item.nom}</CardTitle>
                {item.sous_titre && <p className="text-sm italic text-muted-foreground">{item.sous_titre}</p>}
                {item.embleme && (
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
      )}
    </div>
  );
};

export default LoreSection;
