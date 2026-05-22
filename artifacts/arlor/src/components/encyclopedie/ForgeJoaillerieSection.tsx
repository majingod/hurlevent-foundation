import { useEffect, useState } from "react";
import { CardTitle } from "@/components/ui/card";
import { Clock, Info } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import {
  TYPE_OBJET_FORGE_LABELS,
  STATS_FORGE_LABELS,
  NOTE_FORGE,
  NOTE_JOAILLERIE,
} from "@/constants/artisanat";
import EncyclopedieCard from "@/components/encyclopedie/EncyclopedieCard";

interface ObjetForge {
  id: string;
  nom: string | null;
  description: string | null;
  type: string | null;
  stats: Json | null;
  difficulte: number | null;
  materiaux_communs: string | null;
  materiaux_rares: string | null;
}

interface ObjetJoaillerie {
  id: string;
  nom: string | null;
  description: string | null;
  effet: string | null;
  difficulte: number | null;
  materiaux_communs: string | null;
  materiaux_rares: string | null;
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

const labelTypeForge: Record<string, string> = {
  arme: "Armes",
  armure: "Armures",
  accessoire: "Accessoires d'armure",
  bouclier: "Boucliers",
};

const typeForgeOrder = ["arme", "armure", "accessoire", "bouclier"];

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [forgeOnglet, setForgeOnglet] = useState<'fabrication' | 'reparation'>('fabrication');

  useEffect(() => {
    if (!searchQuery) return;
    const qLow = searchQuery.toLowerCase();
    const matches: string[] = [];
    if (mode === "forge") {
      forge.forEach(o => {
        if (
          (o.nom ?? "").toLowerCase().includes(qLow) ||
          (o.description ?? "").toLowerCase().includes(qLow)
        ) {
          matches.push(o.id);
        }
      });
      reparations.forEach(r => {
        if (
          r.nom_affichage.toLowerCase().includes(qLow) ||
          (r.notes ?? "").toLowerCase().includes(qLow)
        ) {
          matches.push(r.id);
        }
      });
    } else {
      joaillerie.forEach(o => {
        if (
          (o.nom ?? "").toLowerCase().includes(qLow) ||
          (o.description ?? "").toLowerCase().includes(qLow) ||
          (o.effet ?? "").toLowerCase().includes(qLow)
        ) {
          matches.push(o.id);
        }
      });
    }
    setExpanded(new Set(matches));
  }, [searchQuery, mode, forge, reparations, joaillerie]);
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

  const repsByCat = groupBy(fReps, (r) => r.categorie);
  const repCatOrder = ["arme", "armure", "bouclier"];
  const repKeys = [
    ...repCatOrder.filter((k) => k in repsByCat),
    ...Object.keys(repsByCat).filter((k) => !repCatOrder.includes(k)),
  ];

  const noResults = mode === "forge"
    ? (forgeOnglet === 'fabrication' ? fForge.length === 0 : fReps.length === 0)
    : fJoail.length === 0;

  return (
    <div className="space-y-8">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">
        {mode === "forge" ? "Forge" : "Joaillerie"}
      </h2>

      {noResults && q && (
        <p className="text-muted-foreground text-center py-6">Aucun résultat pour cette recherche.</p>
      )}

      {/* Forge — sous-onglets */}
      {mode === "forge" && (
        <div className="flex gap-2 mb-4 border-b border-stone-700 pb-3">
          {(['fabrication', 'reparation'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setForgeOnglet(tab)}
              className={forgeOnglet === tab
                ? "px-4 py-1.5 rounded-md text-sm font-semibold bg-amber-700 text-white border border-amber-500"
                : "px-4 py-1.5 rounded-md text-sm font-medium bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-600"
              }
            >
              {tab === 'fabrication' ? 'Fabrication' : 'Réparation'}
            </button>
          ))}
        </div>
      )}

      {/* Forge — Fabrication */}
      {mode === "forge" && forgeOnglet === 'fabrication' && fForge.length > 0 && (
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

          {(() => {
            const forgeByType = groupBy(fForge, (o) => o.type ?? "autre");
            const forgeTypeKeys = [
              ...typeForgeOrder.filter(k => k in forgeByType),
              ...Object.keys(forgeByType).filter(k => !typeForgeOrder.includes(k)),
            ];
            return forgeTypeKeys.map(type => (
              <div key={type} className="space-y-3">
                <h3 className="font-heading text-base font-semibold text-primary">
                  {labelTypeForge[type] ?? type}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {forgeByType[type].map((o) => {
                    const stats = o.stats && typeof o.stats === "object" && !Array.isArray(o.stats) ? o.stats as Record<string, any> : null;
                    return (
                      <EncyclopedieCard
                        key={o.id}
                        id={o.id}
                        isOpen={expanded.has(o.id)}
                        onToggle={() => toggleExpanded(o.id)}
                        maxHeight={1000}
                        header={
                          <>
                            <CardTitle className="font-heading text-base">{o.nom}</CardTitle>
                            {o.type && (
                              <p className="text-xs text-muted-foreground">{TYPE_OBJET_FORGE_LABELS[o.type] ?? o.type}</p>
                            )}
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Temps de fabrication : {o.difficulte} min
                            </p>
                          </>
                        }
                      >
                        <div className="border-t border-primary/10 pt-3 mt-1 space-y-1.5 text-xs">
                          {o.description && <p>{o.description}</p>}
                          {stats && Object.entries(stats).map(([k, v]) => (
                            <p key={k}><span className="font-medium text-foreground">{STATS_FORGE_LABELS[k] || k} :</span> {String(v)}</p>
                          ))}
                          {o.materiaux_communs && (
                            <p><span className="font-medium text-amber-400">Matériaux communs :</span> {o.materiaux_communs}</p>
                          )}
                          {o.materiaux_rares && (
                            <p><span className="font-medium text-purple-400">Matériaux rares :</span> {o.materiaux_rares}</p>
                          )}
                        </div>
                      </EncyclopedieCard>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
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

          <div className="grid gap-3 sm:grid-cols-2">
            {fJoail.map((o) => (
              <EncyclopedieCard
                key={o.id}
                id={o.id}
                isOpen={expanded.has(o.id)}
                onToggle={() => toggleExpanded(o.id)}
                maxHeight={1000}
                header={
                  <>
                    <CardTitle className="font-heading text-base">{o.nom}</CardTitle>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Temps de fabrication : {o.difficulte} min
                    </p>
                    {o.effet && (
                      <p className="text-xs text-stone-400 truncate">{o.effet}</p>
                    )}
                  </>
                }
              >
                <div className="border-t border-primary/10 pt-3 mt-1 space-y-1.5 text-xs">
                  {o.description && <p>{o.description}</p>}
                  {o.effet && <p><span className="font-medium text-foreground">Effet :</span> {o.effet}</p>}
                  {o.materiaux_communs && (
                    <p><span className="font-medium text-amber-400">Matériaux communs :</span> {o.materiaux_communs}</p>
                  )}
                  {o.materiaux_rares && (
                    <p><span className="font-medium text-purple-400">Matériaux rares :</span> {o.materiaux_rares}</p>
                  )}
                </div>
              </EncyclopedieCard>
            ))}
          </div>
        </section>
      )}

      {/* Forge — Réparations (sous-onglet) */}
      {mode === "forge" && forgeOnglet === 'reparation' && fReps.length > 0 && (
        <section>
          <h3 className="font-heading text-lg font-semibold text-primary mb-3">Réparations</h3>
          <p className="text-sm text-muted-foreground italic mb-4">
            Les réparations doivent toujours utiliser le même métal que celui d'origine. Il est impossible de réparer un objet avec un métal différent.
          </p>
          {repKeys.map((cat) => (
            <div key={cat} className="mb-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">{labelReparation[cat] ?? cat}</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {repsByCat[cat].map((r) => (
                  <EncyclopedieCard
                    key={r.id}
                    id={r.id}
                    isOpen={expanded.has(r.id)}
                    onToggle={() => toggleExpanded(r.id)}
                    maxHeight={1000}
                    header={
                      <>
                        <CardTitle className="font-heading text-base">{r.nom_affichage}</CardTitle>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {r.temps_minutes} min
                        </p>
                      </>
                    }
                  >
                    <div className="border-t border-primary/10 pt-3 mt-1 space-y-1.5 text-xs">
                      <p><span className="font-medium text-foreground">Temps commun :</span> {r.temps_minutes} min</p>
                      <p><span className="font-medium text-foreground">Temps rare :</span> {r.temps_rare_minutes} min</p>
                      <p><span className="font-medium text-foreground">Matériaux communs :</span> {r.materiaux}</p>
                      <p><span className="font-medium text-foreground">Matériaux rares :</span> {r.materiaux_rares}</p>
                      {r.notes && <p className="italic mt-2">{r.notes}</p>}
                    </div>
                  </EncyclopedieCard>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export default ForgeJoaillerieSection;
