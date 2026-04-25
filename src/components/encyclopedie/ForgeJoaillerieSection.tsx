import { useState } from "react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, Clock, Info } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { 
  TYPE_OBJET_FORGE_LABELS, 
  STATS_FORGE_LABELS,
  NOTE_FORGE,
  NOTE_JOAILLERIE
} from "@/constants/artisanat";

interface ObjetForge {
  id: string;
  nom: string | null;
  description: string | null;
  type: string | null;
  stats: Json | null;
  difficulte: number | null;
}

interface ObjetJoaillerie {
  id: string;
  nom: string | null;
  description: string | null;
  effet: string | null;
  difficulte: number | null;
}

interface Reparation {
  id: string;
  categorie: string;
  nom_affichage: string;
  temps_minutes: number;
  temps_rare_minutes: number;
  materiaux: string;
  materiaux_rares: string;
  notes: string | null;
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

const labelReparation: Record<string, string> = {
  arme: "Armes",
  armure: "Armures",
  bouclier: "Boucliers",
};

const ForgeJoaillerieSection = ({
  mode,
  forge = [],
  joaillerie = [],
  reparations = [],
  searchQuery = "",
}: {
  mode: "forge" | "joaillerie";
  forge?: ObjetForge[];
  joaillerie?: ObjetJoaillerie[];
  reparations?: Reparation[];
  searchQuery?: string;
}) => {
  const [expandedRep, setExpandedRep] = useState<string | null>(null);
  const q = searchQuery.trim().toLowerCase();

  const filterFn = <T extends { nom: string | null; description?: string | null }>(arr: T[]) =>
    !q
      ? arr
      : arr.filter(
          (o) =>
            (o.nom ?? "").toLowerCase().includes(q) ||
            (o.description ?? "").toLowerCase().includes(q),
        );

  const fForge = filterFn(forge);
  const fJoail = !q
    ? joaillerie
    : joaillerie.filter(
        (o) =>
          (o.nom ?? "").toLowerCase().includes(q) ||
          (o.description ?? "").toLowerCase().includes(q) ||
          (o.effet ?? "").toLowerCase().includes(q),
      );
  const fReps = !q
    ? reparations
    : reparations.filter(
        (r) =>
          r.nom_affichage.toLowerCase().includes(q) ||
          (r.notes ?? "").toLowerCase().includes(q),
      );

  const forgeByDiff = groupBy(fForge, (o) => String(o.difficulte ?? 0));
  const joailByDiff = groupBy(fJoail, (o) => String(o.difficulte ?? 0));
  const forgeKeys = Object.keys(forgeByDiff).sort((a, b) => Number(a) - Number(b));
  const joailKeys = Object.keys(joailByDiff).sort((a, b) => Number(a) - Number(b));

  const repsByCat = groupBy(fReps, (r) => r.categorie);
  const repCatOrder = ["arme", "armure", "bouclier"];
  const repKeys = [
    ...repCatOrder.filter((k) => k in repsByCat),
    ...Object.keys(repsByCat).filter((k) => !repCatOrder.includes(k)),
  ];

  const noResults = mode === "forge" ? (fForge.length === 0 && fReps.length === 0) : (fJoail.length === 0);

  return (
    <div className="space-y-8">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">
        {mode === "forge" ? "Forge" : "Joaillerie"}
      </h2>

      {noResults && q && (
        <p className="text-muted-foreground text-center py-6">Aucun résultat pour cette recherche.</p>
      )}

      {/* Forge */}
      {mode === "forge" && fForge.length > 0 && (
        <section className="space-y-6">
          <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground space-y-2 backdrop-blur-sm">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p><span className="font-medium text-foreground">Niveau 1 :</span> {NOTE_FORGE[1]}</p>
                <p><span className="font-medium text-foreground">Niveau 2+ :</span> {NOTE_FORGE[2]}</p>
              </div>
            </div>
          </div>

          {forgeKeys.map((diff) => (
            <div key={diff} className="mb-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Temps de fabrication : {diff} min
              </h4>
              <Accordion type="multiple" className="w-full">
                {forgeByDiff[diff].map((o) => {
                  const stats = o.stats && typeof o.stats === "object" && !Array.isArray(o.stats) ? o.stats as Record<string, any> : null;
                  const typeLabel = o.type ? (TYPE_OBJET_FORGE_LABELS[o.type] || o.type) : null;
                  return (
                    <AccordionItem key={o.id} value={o.id}>
                      <AccordionTrigger className="font-heading text-base hover:no-underline">
                        <span className="flex items-center gap-2">
                          {o.nom}
                          {typeLabel && <span className="text-xs text-muted-foreground">({typeLabel})</span>}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground space-y-2">
                        {o.description && <p>{o.description}</p>}
                        {stats && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            {Object.entries(stats).map(([k, v]) => (
                              <span key={k}><span className="font-medium text-foreground">{STATS_FORGE_LABELS[k] || k} :</span> {String(v)}</span>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          ))}
        </section>
      )}

      {/* Joaillerie */}
      {mode === "joaillerie" && fJoail.length > 0 && (
        <section className="space-y-6">
          <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground space-y-2 backdrop-blur-sm">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p><span className="font-medium text-foreground">Niveau 1 :</span> {NOTE_JOAILLERIE[1]}</p>
                <p><span className="font-medium text-foreground">Niveau 2+ :</span> {NOTE_JOAILLERIE[2]}</p>
              </div>
            </div>
          </div>

          {joailKeys.map((diff) => (
            <div key={diff} className="mb-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Temps de fabrication : {diff} min
              </h4>
              <Accordion type="multiple" className="w-full">
                {joailByDiff[diff].map((o) => (
                  <AccordionItem key={o.id} value={o.id}>
                    <AccordionTrigger className="font-heading text-base hover:no-underline">
                      {o.nom}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground space-y-2">
                      {o.description && <p>{o.description}</p>}
                      {o.effet && <p><span className="font-medium text-foreground">Effet :</span> {o.effet}</p>}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </section>
      )}

      {/* Réparations */}
      {fReps.length > 0 && (
        <section>
          <h3 className="font-heading text-lg font-semibold text-primary mb-3">Réparations</h3>
          <p className="text-sm text-muted-foreground italic mb-4">
            Les réparations doivent toujours utiliser le même métal que celui d'origine. Il est impossible de réparer un objet avec un métal différent.
          </p>
          {repKeys.map((cat) => (
            <div key={cat} className="mb-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">{labelReparation[cat] ?? cat}</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {repsByCat[cat].map((r) => {
                  const isOpen = expandedRep === r.id;
                  return (
<Card
	                      key={r.id}
	                      className="cursor-pointer border-primary/10 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_25px_rgba(184,146,70,0.1)] group"
	                      onClick={() => setExpandedRep(isOpen ? null : r.id)}
	                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="font-heading text-base">{r.nom_affichage}</CardTitle>
                          <ChevronDown className={`h-4 w-4 text-primary/40 transition-transform duration-300 mt-1 ${isOpen ? "rotate-180" : ""}`} />
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {r.temps_minutes} min
                        </p>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        <div
                          className="overflow-hidden transition-all duration-300 ease-in-out"
                          style={{ maxHeight: isOpen ? "1000px" : "0", opacity: isOpen ? 1 : 0 }}
                        >
                          <div className="border-t border-primary/10 pt-3 mt-1 space-y-1.5 text-xs">
                            <p><span className="font-medium text-foreground">Temps commun :</span> {r.temps_minutes} min</p>
                            <p><span className="font-medium text-foreground">Temps rare :</span> {r.temps_rare_minutes} min</p>
                            <p><span className="font-medium text-foreground">Matériaux communs :</span> {r.materiaux}</p>
                            <p><span className="font-medium text-foreground">Matériaux rares :</span> {r.materiaux_rares}</p>
                            {r.notes && <p className="italic mt-2">{r.notes}</p>}
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <span className="text-xs text-primary">{isOpen ? "Voir moins" : "Voir plus"}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export default ForgeJoaillerieSection;

