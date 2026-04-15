import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { ChevronDown, Shield, Swords, BookOpen, Sparkles, Church, Users, FlaskConical, Gem, Hammer, Skull, Globe } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import AlchimieSection from "@/components/encyclopedie/AlchimieSection";
import AssemblagesSection from "@/components/encyclopedie/AssemblagesSection";
import ForgeJoaillerieSection from "@/components/encyclopedie/ForgeJoaillerieSection";
import BestiaireSection from "@/components/encyclopedie/BestiaireSection";
import LoreSection from "@/components/encyclopedie/LoreSection";

/* ── types ── */

interface Race {
  id: string;
  nom: string | null;
  nom_latin: string | null;
  description: string | null;
  xp_depart: number;
  esperance_vie: string | null;
  exigences_costume: string | null;
}

interface Classe {
  id: string;
  nom: string | null;
  description: string | null;
  role_combat: string | null;
  pv_depart: number | null;
  ps_depart: number | null;
  competences_gratuites: Json | null;
}

interface Competence {
  id: string;
  nom: string | null;
  description: string | null;
  categorie: string | null;
  niveaux: Json | null;
  est_general: boolean | null;
}

interface Sort {
  id: string;
  cercle: string;
  nom: string;
  niveau: number;
  description: string | null;
  type_sort: string | null;
  zone_effet: string | null;
  portee: string | null;
  duree: string | null;
}

interface Priere {
  id: string;
  domaine: string;
  nom: string;
  niveau: number;
  description: string | null;
  type_priere: string | null;
  zone_effet: string | null;
  portee: string | null;
  duree: string | null;
  duree_incantation: string | null;
}

interface Religion {
  id: string;
  nom: string | null;
  description: string | null;
  description_longue: string | null;
  domaines_principaux: string[] | null;
  domaines_proscrits: string[] | null;
  symbole_sacre: string | null;
  pouvoir_symbole: string | null;
  dirigeant: string | null;
  fondateur: string | null;
}

type SectionKey = "races" | "classes" | "competences" | "magie" | "prieres" | "religions" | "alchimie" | "assemblages" | "forge" | "bestiaire" | "lore";

const sections: { key: SectionKey; label: string; icon: React.ElementType }[] = [
  { key: "races", label: "Les Races", icon: Users },
  { key: "classes", label: "Les Classes", icon: Shield },
  { key: "competences", label: "Compétences", icon: Swords },
  { key: "magie", label: "Magie", icon: Sparkles },
  { key: "prieres", label: "Prières", icon: Church },
  { key: "religions", label: "Religions", icon: BookOpen },
  { key: "alchimie", label: "Alchimie", icon: FlaskConical },
  { key: "assemblages", label: "Runes", icon: Gem },
  { key: "forge", label: "Forge & Joaillerie", icon: Hammer },
  { key: "bestiaire", label: "Bestiaire", icon: Skull },
  { key: "lore", label: "Monde de Destéa", icon: Globe },
];

/* ── helpers ── */

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

const labelCategorie: Record<string, string> = {
  general: "Générales",
  guerrier: "Guerrier",
  voleur: "Voleur",
  mage: "Mage",
  pretre: "Prêtre",
};

/* ── component ── */

const Encyclopedie = () => {
  const [active, setActive] = useState<SectionKey>("races");
  const [races, setRaces] = useState<Race[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [competences, setCompetences] = useState<Competence[]>([]);
  const [sorts, setSorts] = useState<Sort[]>([]);
  const [prieres, setPrieres] = useState<Priere[]>([]);
  const [religions, setReligions] = useState<Religion[]>([]);
  const [recettes, setRecettes] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [assemblages, setAssemblages] = useState<any[]>([]);
  const [forge, setForge] = useState<any[]>([]);
  const [joaillerie, setJoaillerie] = useState<any[]>([]);
  const [creatures, setCreatures] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [cites, setCites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const [racesRes, classesRes, compRes, sortsRes, prieresRes, relRes, recettesRes, ingsRes, assRes, forgeRes, joailRes, bestRes, regionsRes, citesRes] = await Promise.all([
        supabase.from("races").select("*").eq("est_actif", true).eq("est_jouable", true).order("nom"),
        supabase.from("classes").select("*").eq("est_actif", true).order("nom"),
        supabase.from("competences").select("*").eq("est_actif", true).order("categorie").order("nom"),
        supabase.from("sorts").select("*").eq("est_actif", true).order("cercle").order("niveau").order("nom"),
        supabase.from("prieres").select("*").eq("est_actif", true).order("domaine").order("niveau").order("nom"),
        supabase.from("religions").select("*").eq("est_actif", true).order("nom"),
        supabase.from("recettes_alchimie").select("*").eq("est_actif", true).order("niveau_requis").order("type").order("nom"),
        supabase.from("ingredients_alchimiques").select("*").order("niveau").order("nom"),
        supabase.from("assemblages_runes").select("*").eq("est_actif", true).order("nom"),
        supabase.from("objets_forge").select("*").eq("est_actif", true).order("difficulte").order("nom"),
        supabase.from("objets_joaillerie").select("*").eq("est_actif", true).order("difficulte").order("nom"),
        supabase.from("bestiaire").select("*").eq("est_actif", true).order("categorie").order("nom"),
        supabase.from("lore").select("*").eq("categorie", "region").eq("est_actif", true).order("ordre"),
        supabase.from("lore").select("*").eq("categorie", "cite").eq("est_actif", true).order("ordre"),
      ]);
      setRaces((racesRes.data ?? []) as Race[]);
      setClasses((classesRes.data ?? []) as Classe[]);
      setCompetences((compRes.data ?? []) as Competence[]);
      setSorts((sortsRes.data ?? []) as Sort[]);
      setPrieres((prieresRes.data ?? []) as Priere[]);
      setReligions((relRes.data ?? []) as Religion[]);
      setRecettes(recettesRes.data ?? []);
      setIngredients(ingsRes.data ?? []);
      setAssemblages(assRes.data ?? []);
      setForge(forgeRes.data ?? []);
      setJoaillerie(joailRes.data ?? []);
      setCreatures(bestRes.data ?? []);
      setRegions(regionsRes.data ?? []);
      setCites(citesRes.data ?? []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="container py-12 text-center">
        <p className="text-muted-foreground">Chargement de l'encyclopédie…</p>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl">
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-8">
        Encyclopédie de Destéa
      </h1>

      <div className="flex flex-col md:flex-row gap-8">
        {/* ── Sidebar nav ── */}
        <nav className="md:w-56 flex-shrink-0">
          <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible md:sticky md:top-24">
            {sections.map((s) => {
              const Icon = s.icon;
              const isActive = active === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setActive(s.key)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content ── */}
        <main className="flex-1 min-w-0">
          {active === "races" && <RacesSection races={races} />}
          {active === "classes" && <ClassesSection classes={classes} />}
          {active === "competences" && <CompetencesSection competences={competences} />}
          {active === "magie" && <MagieSection sorts={sorts} />}
          {active === "prieres" && <PrieresSection prieres={prieres} />}
          {active === "religions" && <ReligionsSection religions={religions} />}
          {active === "alchimie" && <AlchimieSection recettes={recettes} ingredients={ingredients} />}
          {active === "assemblages" && <AssemblagesSection assemblages={assemblages} />}
          {active === "forge" && <ForgeJoaillerieSection forge={forge} joaillerie={joaillerie} />}
          {active === "bestiaire" && <BestiaireSection creatures={creatures} />}
          {active === "lore" && <LoreSection regions={regions} cites={cites} />}
        </main>
      </div>
    </div>
  );
};

/* ── Section components (existing) ── */

const RacesSection = ({ races }: { races: Race[] }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">Les Races de Destéa</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {races.map((r) => (
          <Card
            key={r.id}
            className="cursor-pointer border-primary/10 transition-shadow duration-200 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
            onClick={() => setExpanded(expanded === r.id ? null : r.id)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-xl">{r.nom}</CardTitle>
              {r.nom_latin && <p className="text-sm italic text-muted-foreground">{r.nom_latin}</p>}
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>XP de départ : {r.xp_depart}</p>
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: expanded === r.id ? "500px" : "0", opacity: expanded === r.id ? 1 : 0 }}
              >
                {r.esperance_vie && <p className="mt-2">Espérance de vie : {r.esperance_vie}</p>}
                {r.exigences_costume && (
                  <Badge variant="outline" className="mt-2 border-orange-500/50 text-orange-400">
                    Costume : {r.exigences_costume}
                  </Badge>
                )}
                {r.description && <p className="mt-3 border-t border-primary/10 pt-3">{r.description}</p>}
              </div>
              <div className="flex justify-end pt-1">
                <ChevronDown className={`h-4 w-4 text-primary/40 transition-transform duration-300 ${expanded === r.id ? "rotate-180" : ""}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

const ClassesSection = ({ classes }: { classes: Classe[] }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">Les Classes de Destéa</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {classes.map((c) => {
          const gratuites = Array.isArray(c.competences_gratuites) ? c.competences_gratuites : [];
          return (
            <Card
              key={c.id}
              className="cursor-pointer border-primary/10 transition-shadow duration-200 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
              onClick={() => setExpanded(expanded === c.id ? null : c.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-xl">{c.nom}</CardTitle>
                {c.role_combat && <Badge variant="secondary" className="text-xs w-fit">{c.role_combat}</Badge>}
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-primary/60" /> PV : {c.pv_depart ?? "—"}</span>
                  <span className="flex items-center gap-1"><Swords className="h-3.5 w-3.5 text-primary/60" /> PS : {c.ps_depart ?? "—"}</span>
                </div>
                <div
                  className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{ maxHeight: expanded === c.id ? "500px" : "0", opacity: expanded === c.id ? 1 : 0 }}
                >
                  {c.description && <p className="mt-3 border-t border-primary/10 pt-3">{c.description}</p>}
                  {gratuites.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium text-foreground text-xs mb-1">Compétences gratuites :</p>
                      <div className="flex flex-wrap gap-1">
                        {gratuites.map((g, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{String(g)}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end pt-1">
                  <ChevronDown className={`h-4 w-4 text-primary/40 transition-transform duration-300 ${expanded === c.id ? "rotate-180" : ""}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

const CompetencesSection = ({ competences }: { competences: Competence[] }) => {
  const grouped = groupBy(competences, (c) => c.categorie ?? "autre");
  const orderedKeys = ["general", "guerrier", "voleur", "mage", "pretre"];
  const keys = [...orderedKeys.filter((k) => k in grouped), ...Object.keys(grouped).filter((k) => !orderedKeys.includes(k))];

  return (
    <div className="space-y-8">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">Compétences</h2>
      {keys.map((cat) => (
        <section key={cat}>
          <h3 className="font-heading text-lg font-semibold text-primary mb-3">{labelCategorie[cat] ?? cat}</h3>
          <Accordion type="multiple" className="w-full">
            {grouped[cat].map((c) => {
              const niveaux = Array.isArray(c.niveaux) ? c.niveaux : [];
              return (
                <AccordionItem key={c.id} value={c.id}>
                  <AccordionTrigger className="font-heading text-base hover:no-underline">
                    <span className="flex items-center gap-2">
                      {c.nom}
                      {c.est_general && <Badge variant="secondary" className="text-xs">Générale</Badge>}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 text-sm text-muted-foreground">
                    {c.description && <p>{c.description}</p>}
                    {niveaux.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {niveaux.map((niv: any, i: number) => (
                          <div key={i} className="rounded-lg border border-border p-3">
                            <p className="font-medium text-foreground text-xs mb-1">
                              Niveau {niv.niveau ?? i + 1}{niv.cout_xp != null && ` — ${niv.cout_xp} XP`}
                            </p>
                            {niv.description && <p className="text-muted-foreground text-xs">{niv.description}</p>}
                            {niv.effet && <p className="text-muted-foreground text-xs">{niv.effet}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </section>
      ))}
    </div>
  );
};

const MagieSection = ({ sorts }: { sorts: Sort[] }) => {
  const grouped = groupBy(sorts, (s) => s.cercle);
  const keys = Object.keys(grouped).sort();
  return (
    <div className="space-y-8">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">Magie — Cercles et Sorts</h2>
      {keys.map((cercle) => (
        <section key={cercle}>
          <h3 className="font-heading text-lg font-semibold text-primary mb-3">{cercle}</h3>
          <Accordion type="multiple" className="w-full">
            {grouped[cercle].map((s) => (
              <AccordionItem key={s.id} value={s.id}>
                <AccordionTrigger className="font-heading text-base hover:no-underline">
                  <span className="flex items-center gap-2">
                    {s.nom}
                    <Badge variant="secondary" className="text-xs">Niv. {s.niveau}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs">
                    {s.type_sort && <span>Type : {s.type_sort}</span>}
                    {s.portee && <span>Portée : {s.portee}</span>}
                    {s.zone_effet && <span>Zone : {s.zone_effet}</span>}
                    {s.duree && <span>Durée : {s.duree}</span>}
                  </div>
                  {s.description && <p>{s.description}</p>}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
    </div>
  );
};

const PrieresSection = ({ prieres }: { prieres: Priere[] }) => {
  const grouped = groupBy(prieres, (p) => p.domaine);
  const keys = Object.keys(grouped).sort();
  return (
    <div className="space-y-8">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">Prières — Domaines</h2>
      {keys.map((domaine) => (
        <section key={domaine}>
          <h3 className="font-heading text-lg font-semibold text-primary mb-3">{domaine}</h3>
          <Accordion type="multiple" className="w-full">
            {grouped[domaine].map((p) => (
              <AccordionItem key={p.id} value={p.id}>
                <AccordionTrigger className="font-heading text-base hover:no-underline">
                  <span className="flex items-center gap-2">
                    {p.nom}
                    <Badge variant="secondary" className="text-xs">Niv. {p.niveau}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs">
                    {p.type_priere && <span>Type : {p.type_priere}</span>}
                    {p.portee && <span>Portée : {p.portee}</span>}
                    {p.zone_effet && <span>Zone : {p.zone_effet}</span>}
                    {p.duree && <span>Durée : {p.duree}</span>}
                    {p.duree_incantation && <span>Incantation : {p.duree_incantation}</span>}
                  </div>
                  {p.description && <p>{p.description}</p>}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
    </div>
  );
};

const ReligionsSection = ({ religions }: { religions: Religion[] }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">Religions et Ordres</h2>
      <div className="space-y-4">
        {religions.map((r) => (
          <Card
            key={r.id}
            className="cursor-pointer border-primary/10 transition-shadow duration-200 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
            onClick={() => setExpanded(expanded === r.id ? null : r.id)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-xl">{r.nom}</CardTitle>
              {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <div className="flex flex-wrap gap-2 mb-2">
                {r.domaines_principaux?.map((d) => (
                  <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                ))}
                {r.domaines_proscrits?.map((d) => (
                  <Badge key={d} variant="destructive" className="text-xs">Proscrit : {d}</Badge>
                ))}
              </div>
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: expanded === r.id ? "1000px" : "0", opacity: expanded === r.id ? 1 : 0 }}
              >
                <div className="border-t border-primary/10 pt-3 mt-2 space-y-2">
                  {r.symbole_sacre && <p><span className="font-medium text-foreground">Symbole sacré :</span> {r.symbole_sacre}</p>}
                  {r.pouvoir_symbole && <p><span className="font-medium text-foreground">Pouvoir du symbole :</span> {r.pouvoir_symbole}</p>}
                  {r.dirigeant && <p><span className="font-medium text-foreground">Dirigeant :</span> {r.dirigeant}</p>}
                  {r.fondateur && <p><span className="font-medium text-foreground">Fondateur :</span> {r.fondateur}</p>}
                  {r.description_longue && <p className="mt-2 whitespace-pre-line">{r.description_longue}</p>}
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <ChevronDown className={`h-4 w-4 text-primary/40 transition-transform duration-300 ${expanded === r.id ? "rotate-180" : ""}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Encyclopedie;
