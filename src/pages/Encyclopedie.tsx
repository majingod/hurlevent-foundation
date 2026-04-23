import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useSectionsEncyclopedie } from "@/hooks/useSectionsEncyclopedie";

export default function Encyclopedie() {
  const { data: sections, isLoading } = useSectionsEncyclopedie();
  const [activeSection, setActiveSection] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (sections && sections.length > 0 && !activeSection) {
      setActiveSection(sections[0].cle);
    }
  }, [sections, activeSection]);

  if (isLoading) {
    return <div className="flex justify-center py-12">Chargement...</div>;
  }

  if (!sections || sections.length === 0) {
    return (
      <div className="p-8 text-center">
        <p>Aucune section trouvée dans l'encyclopédie.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Encyclopédie</h1>

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
        <Input
          placeholder="Rechercher dans l'encyclopédie..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs value={activeSection} onValueChange={setActiveSection} className="w-full">
        <TabsList className="w-full overflow-x-auto flex flex-nowrap gap-1 pb-2 mb-6">
          {sections.map((section) => (
            <TabsTrigger
              key={section.id}
              value={section.cle}
              className="whitespace-nowrap"
            >
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {sections.map((section) => (
          <TabsContent key={section.id} value={section.cle}>
            <SectionContent active={section.cle} searchQuery={searchTerm} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function SectionContent({ active, searchQuery }: { active: string; searchQuery: string }) {
  switch (active) {
    case "races":
      return <RacesSection searchQuery={searchQuery} />;
    case "traits":
      return <TraitsSection searchQuery={searchQuery} />;
    case "classes":
      return <ClassesSection searchQuery={searchQuery} />;
    case "competences":
      return <CompetencesSection searchQuery={searchQuery} />;
    case "magie":
      return <SortsSection searchQuery={searchQuery} />;
    case "prieres":
      return <PrièresSection searchQuery={searchQuery} />;
    case "religions":
      return <ReligionsSection searchQuery={searchQuery} />;
    case "assemblages":
      return <AssemblagesSection searchQuery={searchQuery} />;
    case "alchimie":
      return <AlchimieSection searchQuery={searchQuery} />;
    case "pieges":
      return <PiegesSection searchQuery={searchQuery} />;
    case "forge":
      return <ForgeSection searchQuery={searchQuery} />;
    case "joaillerie":
      return <JoaillerieSection searchQuery={searchQuery} />;
    case "bestiaire":
      return <BestiaireSection searchQuery={searchQuery} />;
    case "lore":
      return <LoreSection searchQuery={searchQuery} />;
    default:
      return <p className="text-muted-foreground">Cette section n'existe pas encore.</p>;
  }
}

function RacesSection({ searchQuery }: { searchQuery: string }) {
  const { data: races } = useQuery({
    queryKey: ["races"],
    queryFn: async () => {
      const { data } = await supabase.from("races").select("*").eq("est_actif", true);
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () =>
      races?.filter(
        (r) =>
          r.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.description?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [races, searchQuery]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered?.map((race) => (
        <Card key={race.id}>
          <CardHeader>
            <CardTitle>{race.nom}</CardTitle>
            {race.nom_latin && <CardDescription>{race.nom_latin}</CardDescription>}
          </CardHeader>
          <CardContent>
            <p className="text-sm">{race.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TraitsSection({ searchQuery }: { searchQuery: string }) {
  const { data: traits } = useQuery({
    queryKey: ["traits_raciaux"],
    queryFn: async () => {
      const { data } = await supabase.from("traits_raciaux").select("*").eq("est_actif", true);
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () =>
      traits?.filter(
        (t) =>
          t.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [traits, searchQuery]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered?.map((trait) => (
        <Card key={trait.id}>
          <CardHeader>
            <CardTitle>{trait.nom}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{trait.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ClassesSection({ searchQuery }: { searchQuery: string }) {
  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("*").eq("est_actif", true);
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () =>
      classes?.filter(
        (c) =>
          c.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.description?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [classes, searchQuery]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filtered?.map((classe) => (
        <Card key={classe.id}>
          <CardHeader>
            <CardTitle>{classe.nom}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{classe.description}</p>
          </CardContent>
        </Card>
      ))}
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

  if (isLoading) return <p>Chargement compétences...</p>;
  if (error) return <p className="text-red-500">Erreur compétences : {error.message}</p>;
  if (!competences || competences.length === 0) return <p>Aucune compétence trouvée.</p>;

  // Extrait proprement le prérequis, qu'il soit string ou objet
  const getPrerequisText = (niv: any): string | null => {
    let raw = niv.prerequis ?? niv.prerequisites ?? null;
    if (!raw) return null;
    if (typeof raw === "string") return raw;
    // Si c'est un objet, cherche les clés habituelles
    if (typeof raw === "object") {
      return raw.prerequisites || raw.prerequis || null;
    }
    return null;
  };

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
                        <Badge variant="outline" className="text-xs">Général</Badge>
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
                            <div key={i} className="border rounded-lg p-3 bg-muted/30">
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
  );
}

function SortsSection({ searchQuery }: { searchQuery: string }) {
  const { data: sorts } = useQuery({
    queryKey: ["sorts"],
    queryFn: async () => {
      const { data } = await supabase.from("sorts").select("*").eq("est_actif", true).order("niveau", { ascending: true });
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () =>
      sorts?.filter(
        (s) =>
          s.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.cercle?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [sorts, searchQuery]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered?.map((sort) => (
        <Card key={sort.id}>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>{sort.nom}</span>
              <Badge variant="secondary">{sort.cercle}</Badge>
            </CardTitle>
            <CardDescription>Niveau {sort.niveau}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{sort.description}</p>
            {sort.type_sort && <Badge className="mt-2">{sort.type_sort}</Badge>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PrièresSection({ searchQuery }: { searchQuery: string }) {
  const { data: prieres } = useQuery({
    queryKey: ["prieres"],
    queryFn: async () => {
      const { data } = await supabase.from("prieres").select("*").eq("est_actif", true).order("niveau", { ascending: true });
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () =>
      prieres?.filter(
        (p) =>
          p.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.domaine?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [prieres, searchQuery]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered?.map((priere) => (
        <Card key={priere.id}>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>{priere.nom}</span>
              <Badge variant="secondary">{priere.domaine}</Badge>
            </CardTitle>
            <CardDescription>Niveau {priere.niveau}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{priere.description}</p>
            {priere.type_priere && <Badge className="mt-2">{priere.type_priere}</Badge>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Les sections supplémentaires (pour que le switch ne plante pas)
function ReligionsSection({ searchQuery }: { searchQuery: string }) {
  return <p>Section religions en construction.</p>;
}
function AssemblagesSection({ searchQuery }: { searchQuery: string }) {
  return <p>Section assemblages en construction.</p>;
}
function AlchimieSection({ searchQuery }: { searchQuery: string }) {
  return <p>Section alchimie en construction.</p>;
}
function PiegesSection({ searchQuery }: { searchQuery: string }) {
  return <p>Section pièges en construction.</p>;
}
function ForgeSection({ searchQuery }: { searchQuery: string }) {
  return <p>Section forge en construction.</p>;
}
function JoaillerieSection({ searchQuery }: { searchQuery: string }) {
  return <p>Section joaillerie en construction.</p>;
}
function BestiaireSection({ searchQuery }: { searchQuery: string }) {
  return <p>Section bestiaire en construction.</p>;
}
function LoreSection({ searchQuery }: { searchQuery: string }) {
  return <p>Section lore en construction.</p>;
}
