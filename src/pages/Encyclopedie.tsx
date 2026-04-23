import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function Encyclopedie() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Encyclopédie (test direct compétences)</h1>

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
        <Input
          placeholder="Rechercher dans les compétences..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <CompetencesSection searchQuery={searchTerm} />
    </div>
  );
}

function CompetencesSection({ searchQuery }: { searchQuery: string }) {
  const { data: competences, isLoading, error } = useQuery({
    queryKey: ["competences"],
    queryFn: async () => {
      const { data, error } = await supabase.from("competences").select("*").eq("est_actif", true);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  // Toujours appeler les hooks, même si les données ne sont pas encore là
  const categories = useMemo(() => {
    if (!competences) return [];
    const cats = [...new Set(competences.map((c: any) => c.categorie))];
    return cats.sort((a: string, b: string) => a.localeCompare(b));
  }, [competences]);

  const filtered = useMemo(() => {
    if (!competences) return [];
    return competences.filter((comp: any) =>
      comp.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.categorie?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [competences, searchQuery]);

  const grouped = useMemo(() => {
    if (!competences) return {};
    const groups: Record<string, any[]> = {};
    categories.forEach((cat: string) => {
      groups[cat] = filtered.filter((c: any) => c.categorie === cat);
    });
    return groups;
  }, [categories, filtered]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-muted-foreground">Chargement des compétences...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-red-500">Erreur lors du chargement : {error.message}</p>
      </div>
    );
  }

  if (!competences || competences.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-muted-foreground">Aucune compétence trouvée.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {categories.map((cat: string) => {
        const comps = grouped[cat] ?? [];
        if (comps.length === 0) return null;
        return (
          <div key={cat}>
            <h2 className="text-xl font-semibold mb-4 capitalize">{cat}</h2>
            <Accordion type="multiple" className="w-full">
              {comps.map((comp: any) => (
                <AccordionItem key={comp.id} value={comp.id}>
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center gap-2">
                      <span>{comp.nom}</span>
                      {comp.est_general && (
                        <Badge variant="outline" className="text-xs">
                          Général
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {comp.description && (
                      <p className="text-sm text-muted-foreground mb-4">{comp.description}</p>
                    )}
                    {comp.niveaux && Array.isArray(comp.niveaux) && comp.niveaux.length > 0 && (
                      <div className="space-y-3">
                        {comp.niveaux.map((niv: any, i: number) => (
                          <div key={i} className="border rounded-lg p-3 bg-muted/30">
                            <p className="font-medium">
                              Niveau {niv.niveau ?? i + 1}
                              {niv.cout_xp != null && ` — ${niv.cout_xp} XP`}
                            </p>
                            {niv.description && (
                              <p className="text-sm text-muted-foreground mt-1">{niv.description}</p>
                            )}
                            {/* TEST : affichage debug pour le prerequis */}
                            {niv.prerequis !== undefined && niv.prerequis !== null ? (
                              <p className="text-sm mt-2 font-medium">📋 {niv.prerequis}</p>
                            ) : (
                              <p className="text-sm mt-2 font-medium text-red-500">⚠ DEBUG : prerequis absent (type: {typeof niv.prerequis})</p>
                            )}
                            {niv.effet && (
                              <p className="text-sm mt-1 italic">{niv.effet}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        );
      })}
    </div>
  );
                              }
