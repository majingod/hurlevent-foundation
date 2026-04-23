import { useState, useMemo } from "react";
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

  if (isLoading) {
    return <div className="flex justify-center py-12">Chargement...</div>;
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
          {sections?.map((section) => (
            <TabsTrigger
              key={section.id}
              value={section.cle}
              className="whitespace-nowrap"
            >
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {sections?.map((section) => (
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
    case "classes":
      return <ClassesSection searchQuery={searchQuery} />;
    case "competences":
      return <CompetencesSection searchQuery={searchQuery} />;
    case "sorts":
      return <SortsSection searchQuery={searchQuery} />;
    case "prieres":
      return <PrièresSection searchQuery={searchQuery} />;
    case "traits_raciaux":
      return <TraitsRaciauxSection searchQuery={searchQuery} />;
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
  const { data: competences } = useQuery({
    queryKey: ["competences"],
    queryFn: async () => {
      const { data } = await supabase.from("competences").select("*").eq("est_actif", true);
      return data ?? [];
    },
  });

  const categories = useMemo(() => {
    const cats = [...new Set(competences?.map((c) => c.categorie))];
    return cats.sort((a, b) => a.localeCompare(b));
  }, [competences]);

  const filtered = useMemo(
    () =>
      competences?.filter(
        (comp) =>
          comp.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
          comp.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          comp.categorie?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [competences, searchQuery]
  );

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    categories.forEach((cat) => {
      groups[cat] = filtered?.filter((c) => c.categorie === cat) ?? [];
    });
    return groups;
  }, [categories, filtered]);

  return (
    <div className="space-y-8">
      {categories.map((cat) => {
        const comps = grouped[cat] ?? [];
        if (comps.length === 0) return null;
        return (
          <div key={cat}>
            <h2 className="text-xl font-semibold mb-4 capitalize">{cat}</h2>
            <Accordion type="multiple" className="w-full">
              {comps.map((comp) => (
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
                            {niv.prerequis && (
                              <p className="text-sm mt-2 font-medium">📋 {niv.prerequis}</p>
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

function TraitsRaciauxSection({ searchQuery }: { searchQuery: string }) {
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
