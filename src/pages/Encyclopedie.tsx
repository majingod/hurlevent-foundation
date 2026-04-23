import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Search } from "lucide-react";

/* ── types ── */

interface Section {
  id: string;
  cle: string;
  label: string;
  ordre: number;
}

interface Competence {
  id: string;
  nom: string;
  description: string | null;
  categorie: string;
  niveaux: any[] | null;
  est_general: boolean;
  est_actif: boolean;
}

/* ── helpers ── */

const getPrerequisText = (niv: any): string | null => {
  let raw = niv.prerequis ?? niv.prerequisites ?? null;
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw === "object") {
    return raw.prerequisites || raw.prerequis || null;
  }
  return null;
};

/* ── composant ── */

const Encyclopedie = () => {
  const [, setSections] = useState<Section[]>([]);
  const [competences, setCompetences] = useState<Competence[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    (async () => {
      const [secRes, compRes] = await Promise.all([
        supabase.from("sections_encyclopedie").select("*").order("ordre"),
        supabase.from("competences").select("*").eq("est_actif", true),
      ]);
      if (secRes.data && secRes.data.length > 0) {
        setSections(secRes.data as Section[]);
        setActiveSection((prev) => prev || secRes.data![0].cle);
      }
      if (compRes.data) setCompetences(compRes.data as Competence[]);
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(() => {
    const cats = [...new Set(competences.map((c) => c.categorie))];
    return cats.sort((a, b) => a.localeCompare(b));
  }, [competences]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return competences;
    const q = searchTerm.toLowerCase();
    return competences.filter(
      (c) =>
        c.nom.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q) ||
        c.categorie.toLowerCase().includes(q)
    );
  }, [competences, searchTerm]);

  const grouped = useMemo(() => {
    const groups: Record<string, Competence[]> = {};
    categories.forEach((cat) => {
      groups[cat] = filtered.filter((c) => c.categorie === cat);
    });
    return groups;
  }, [categories, filtered]);

  return (
    <div className="container py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-2">
          Encyclopédie
        </h1>
        <p className="text-muted-foreground italic">
          Races, classes, compétences et plus — Monde de Destéa
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher dans les compétences…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs value={activeSection} onValueChange={setActiveSection} className="w-full">
        <div className="overflow-x-auto -mx-2 px-2 mb-6">
          <TabsList className="inline-flex h-auto bg-card border border-border p-1 w-max">
            <TabsTrigger
              value="competences"
              className="font-heading text-xs sm:text-sm whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Compétences
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="competences" className="mt-0 space-y-4">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Chargement…</p>
          ) : categories.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune compétence trouvée.
            </p>
          ) : (
            <div className="space-y-8">
              {categories.map((cat) => {
                const comps = grouped[cat] ?? [];
                if (comps.length === 0) return null;
                return (
                  <div key={cat}>
                    <h2 className="font-heading text-xl text-primary mb-4 capitalize">{cat}</h2>
                    <Accordion type="multiple" className="w-full">
                      {comps.map((comp) => (
                        <AccordionItem key={comp.id} value={comp.id}>
                          <AccordionTrigger className="text-left">
                            <div className="flex items-center gap-2">
                              <span className="font-heading">{comp.nom}</span>
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
                                {comp.niveaux.map((niv: any, i: number) => {
                                  const prerequisText = getPrerequisText(niv);
                                  return (
                                    <div key={i} className="border border-border rounded-lg p-3 bg-card/60">
                                      <p className="font-medium">
                                        Niveau {niv.niveau ?? i + 1}
                                        {niv.cout_xp != null && ` — ${niv.cout_xp} XP`}
                                      </p>
                                      {niv.description && (
                                        <p className="text-sm text-muted-foreground mt-1">{niv.description}</p>
                                      )}
                                      {prerequisText && (
                                        <p className="text-sm mt-2 font-medium">📋 {prerequisText}</p>
                                      )}
                                      {niv.effet && (
                                        <p className="text-sm mt-1 italic">{niv.effet}</p>
                                      )}
                                    </div>
                                  );
                                })}
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Encyclopedie;
