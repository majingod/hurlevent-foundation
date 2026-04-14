import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Search, Clock, AlertTriangle } from "lucide-react";

/* ── types ── */

interface SectionRegle {
  id: string;
  titre: string;
  contenu: string;
  categorie: string;
  ordre: number;
}

interface EffetCombat {
  id: string;
  nom: string | null;
  description: string | null;
  duree: string | null;
  conditions: string | null;
  type: string | null;
  source: string | null;
}

const typesEffet = ["debuff", "controle", "degats", "utilitaire", "mort"] as const;
const sourcesEffet = ["magie", "competence", "les_deux"] as const;

const labelType: Record<string, string> = {
  debuff: "Débuff",
  controle: "Contrôle",
  degats: "Dégâts",
  utilitaire: "Utilitaire",
  mort: "Mort",
};
const labelSource: Record<string, string> = {
  magie: "Magie",
  competence: "Compétence",
  les_deux: "Les deux",
};

/* ── component ── */

const Regles = () => {
  const [effets, setEffets] = useState<EffetCombat[]>([]);
  const [sectionsGenerales, setSectionsGenerales] = useState<SectionRegle[]>([]);
  const [sectionsCombat, setSectionsCombat] = useState<SectionRegle[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtreType, setFiltreType] = useState<string | null>(null);
  const [filtreSource, setFiltreSource] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      const [effetsRes, generalesRes, combatRes] = await Promise.all([
        supabase.from("effets_combat").select("*").order("nom", { ascending: true }),
        supabase.from("sections_regles").select("*").in("categorie", ["generaux", "objets_enjeu"]).eq("est_actif", true).order("categorie").order("ordre"),
        supabase.from("sections_regles").select("*").in("categorie", ["combat", "magie"]).eq("est_actif", true).order("categorie").order("ordre"),
      ]);
      if (effetsRes.data) setEffets(effetsRes.data);
      if (generalesRes.data) setSectionsGenerales(generalesRes.data as SectionRegle[]);
      if (combatRes.data) setSectionsCombat(combatRes.data as SectionRegle[]);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const effetsFiltres = useMemo(() => {
    return effets.filter((e) => {
      const matchNom = !recherche || (e.nom ?? "").toLowerCase().includes(recherche.toLowerCase());
      const matchType = !filtreType || e.type === filtreType;
      const matchSource = !filtreSource || e.source === filtreSource;
      return matchNom && matchType && matchSource;
    });
  }, [effets, recherche, filtreType, filtreSource]);

  const renderSections = (sections: SectionRegle[]) => {
    if (loading) return <p className="text-muted-foreground text-center py-8">Chargement…</p>;
    if (sections.length === 0) return <p className="text-muted-foreground text-center py-8">Aucune règle trouvée.</p>;
    return (
      <Accordion type="multiple" className="w-full">
        {sections.map((s) => (
          <AccordionItem key={s.id} value={s.id}>
            <AccordionTrigger className="font-heading text-lg text-primary hover:no-underline">
              {s.titre}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {s.contenu}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  return (
    <div className="container py-12 max-w-5xl">
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-8">
        Règles & Lexique
      </h1>

      <Tabs defaultValue="generales" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-card border border-border">
          <TabsTrigger value="generales" className="font-heading text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Règles générales
          </TabsTrigger>
          <TabsTrigger value="combat" className="font-heading text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Règles de combat
          </TabsTrigger>
          <TabsTrigger value="lexique" className="font-heading text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Lexique des effets
          </TabsTrigger>
        </TabsList>

        {/* ── Onglet 1 ── */}
        <TabsContent value="generales" className="mt-6 space-y-6">
          {renderSections(sectionsGenerales)}
        </TabsContent>

        {/* ── Onglet 2 ── */}
        <TabsContent value="combat" className="mt-6 space-y-6">
          {renderSections(sectionsCombat)}
        </TabsContent>

        {/* ── Onglet 2 ── */}
        <TabsContent value="combat" className="mt-6 space-y-8">
          <section>
            <h2 className="font-heading text-xl font-semibold text-primary mb-4">
              Règles générales de combat
            </h2>
            <ul className="space-y-3">
              {reglesCombatTexte.map((r, i) => (
                <li key={i} className="flex gap-3 text-muted-foreground leading-relaxed">
                  <span className="text-primary mt-1">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-primary mb-4">Tableau des armes</h2>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-card">
                    <TableHead className="text-primary font-heading">Type d'arme</TableHead>
                    <TableHead className="text-primary font-heading">Taille</TableHead>
                    <TableHead className="text-primary font-heading text-center">Dégât membres</TableHead>
                    <TableHead className="text-primary font-heading text-center">Dégât torse</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableauArmes.map((a) => (
                    <TableRow key={a.type}>
                      <TableCell className="font-medium">{a.type}</TableCell>
                      <TableCell className="text-muted-foreground">{a.taille}</TableCell>
                      <TableCell className="text-center">{a.membres}</TableCell>
                      <TableCell className="text-center">{a.torse}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section>
            <h2 className="font-heading text-xl font-semibold text-primary mb-4">Armures</h2>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-card">
                    <TableHead className="text-primary font-heading">Type</TableHead>
                    <TableHead className="text-primary font-heading text-center">Points d'armure</TableHead>
                    <TableHead className="text-primary font-heading text-center">Durée</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableauArmures.map((a) => (
                    <TableRow key={a.type}>
                      <TableCell className="font-medium">{a.type}</TableCell>
                      <TableCell className="text-center">{a.points}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{a.duree}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </TabsContent>

        {/* ── Onglet 3 ── */}
        <TabsContent value="lexique" className="mt-6 space-y-6">
          {/* Recherche & filtres */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un effet…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-1 self-center">Type :</span>
              {typesEffet.map((t) => (
                <Badge
                  key={t}
                  variant={filtreType === t ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFiltreType(filtreType === t ? null : t)}
                >
                  {labelType[t]}
                </Badge>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-1 self-center">Source :</span>
              {sourcesEffet.map((s) => (
                <Badge
                  key={s}
                  variant={filtreSource === s ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFiltreSource(filtreSource === s ? null : s)}
                >
                  {labelSource[s]}
                </Badge>
              ))}
            </div>
          </div>

          {/* Résultats */}
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Chargement…</p>
          ) : effetsFiltres.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucun effet trouvé pour cette recherche.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {effetsFiltres.map((e) => (
                <Card key={e.id} className="border-border hover:border-primary/40 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="font-heading text-lg">{e.nom}</CardTitle>
                      <div className="flex gap-1 flex-shrink-0">
                        {e.type && (
                          <Badge variant="secondary" className="text-xs">
                            {labelType[e.type] ?? e.type}
                          </Badge>
                        )}
                        {e.source && (
                          <Badge variant="outline" className="text-xs">
                            {labelSource[e.source] ?? e.source}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-muted-foreground">{e.description}</p>
                    {e.duree && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Durée : {e.duree}</span>
                      </div>
                    )}
                    {e.conditions && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Conditions : {e.conditions}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Regles;
