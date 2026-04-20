import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Clock, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

const CATEGORIES: { key: string; label: string }[] = [
  { key: "generaux", label: "Règles générales" },
  { key: "objets_enjeu", label: "Règles en jeu" },
  { key: "combat", label: "Combat & Équipement" },
  { key: "magie", label: "Règles de magie" },
  { key: "creation_sorts", label: "Construction des sorts" },
  { key: "artisanat", label: "Artisanat & Créations" },
  { key: "lexique", label: "Lexique des effets de combat" },
];

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

/* ── markdown renderers ── */

const mdComponents = {
  table: (props: any) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  thead: (props: any) => <thead className="bg-[#1a1a1a]" {...props} />,
  th: (props: any) => (
    <th className="border border-primary/30 px-3 py-2 text-left font-heading text-primary" {...props} />
  ),
  tr: (props: any) => <tr className="odd:bg-[#0f0f0f] even:bg-[#161616]" {...props} />,
  td: (props: any) => <td className="border border-border/40 px-3 py-2 align-top" {...props} />,
  ul: (props: any) => <ul className="my-2 space-y-1 pl-5 [&>li]:relative [&>li]:before:absolute [&>li]:before:-left-4 [&>li]:before:text-primary [&>li]:before:content-['•']" {...props} />,
  ol: (props: any) => <ol className="my-2 list-decimal space-y-1 pl-6 marker:text-primary" {...props} />,
  li: (props: any) => <li className="leading-relaxed" {...props} />,
  strong: (props: any) => <strong className="font-semibold text-primary" {...props} />,
  p: (props: any) => <p className="leading-relaxed mb-2 last:mb-0" {...props} />,
  h1: (props: any) => <h3 className="font-heading text-xl text-primary mt-4 mb-2" {...props} />,
  h2: (props: any) => <h3 className="font-heading text-lg text-primary mt-4 mb-2" {...props} />,
  h3: (props: any) => <h4 className="font-heading text-base text-primary mt-3 mb-2" {...props} />,
  code: (props: any) => <code className="rounded bg-[#1a1a1a] px-1.5 py-0.5 text-primary text-xs" {...props} />,
  blockquote: (props: any) => <blockquote className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground my-2" {...props} />,
};

/* ── component ── */

const Regles = () => {
  const [sections, setSections] = useState<SectionRegle[]>([]);
  const [effets, setEffets] = useState<EffetCombat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string>("generaux");
  const [recherche, setRecherche] = useState("");

  const [rechercheLex, setRechercheLex] = useState("");
  const [filtreType, setFiltreType] = useState<string | null>(null);
  const [filtreSource, setFiltreSource] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [secRes, effetsRes] = await Promise.all([
        supabase
          .from("sections_regles")
          .select("*")
          .in("categorie", CATEGORIES.map((c) => c.key))
          .eq("est_actif", true)
          .order("categorie")
          .order("ordre"),
        supabase.from("effets_combat").select("*").order("nom", { ascending: true }),
      ]);
      if (secRes.data) setSections(secRes.data as SectionRegle[]);
      if (effetsRes.data) setEffets(effetsRes.data as EffetCombat[]);
      setLoading(false);
    })();
  }, []);

  const sectionsFiltrees = useMemo(() => {
    const cat = sections.filter((s) => s.categorie === activeCat);
    if (!recherche.trim()) return cat;
    const q = recherche.toLowerCase();
    return cat.filter(
      (s) =>
        s.titre.toLowerCase().includes(q) ||
        (s.contenu ?? "").toLowerCase().includes(q),
    );
  }, [sections, activeCat, recherche]);

  const effetsFiltres = useMemo(() => {
    return effets.filter((e) => {
      const matchNom = !rechercheLex || (e.nom ?? "").toLowerCase().includes(rechercheLex.toLowerCase());
      const matchType = !filtreType || e.type === filtreType;
      const matchSource = !filtreSource || e.source === filtreSource;
      return matchNom && matchType && matchSource;
    });
  }, [effets, rechercheLex, filtreType, filtreSource]);

  const hasTypes = effets.some((e) => e.type);
  const hasSources = effets.some((e) => e.source);

  return (
    <div className="container py-8 max-w-5xl">
      {/* En-tête */}
      <div className="mb-6">
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-2">
          Règles et Lexique
        </h1>
        <p className="text-muted-foreground italic">
          Manuel officiel du GN Hurlevent — Monde de Destéa
        </p>
      </div>

      {/* Recherche globale */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher dans cette section…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs value={activeCat} onValueChange={setActiveCat} className="w-full">
        <div className="overflow-x-auto -mx-2 px-2 mb-6">
          <TabsList className="inline-flex h-auto bg-card border border-border p-1 w-max">
            {CATEGORIES.map((c) => (
              <TabsTrigger
                key={c.key}
                value={c.key}
                className="font-heading text-xs sm:text-sm whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {c.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {CATEGORIES.map((c) => (
          <TabsContent key={c.key} value={c.key} className="mt-0 space-y-4">
            {c.key === "lexique" ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un effet…"
                      value={rechercheLex}
                      onChange={(e) => setRechercheLex(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {hasTypes && (
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
                  )}

                  {hasSources && (
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
                  )}
                </div>

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
                          {e.description && <p className="text-muted-foreground">{e.description}</p>}
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
              </div>
            ) : (
              <>
                {loading ? (
                  <p className="text-muted-foreground text-center py-8">Chargement…</p>
                ) : sectionsFiltrees.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    {recherche ? "Aucune règle trouvée pour cette recherche." : "Aucune règle disponible."}
                  </p>
                ) : (
                  sectionsFiltrees.map((s) => (
                    <article
                      key={s.id}
                      className="rounded-md bg-[#111111] border-l-[3px] border-primary p-5 shadow-sm"
                    >
                      <h2 className="font-heading text-xl text-primary mb-3">{s.titre}</h2>
                      <div className="text-[#f5f0e8] text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                          {s.contenu ?? ""}
                        </ReactMarkdown>
                      </div>
                    </article>
                  ))
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default Regles;
