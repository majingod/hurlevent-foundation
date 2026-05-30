import { useEffect, useState } from "react";
import { CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { LEGENDE_CONSTRUCTION_PIEGES } from "@/constants/artisanat";
import EncyclopedieCard from "@/components/encyclopedie/EncyclopedieCard";

interface Piege {
  id: string;
  nom: string;
  niveau: number;
  cout_xp: number;
  cible: string;
  duree: string;
  effets: string;
  niveau_effet: number | null;
  type_piege: string;
  construction: string | null;
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

const PiegesSection = ({
  pieges,
  searchQuery = "",
}: {
  pieges: Piege[];
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

  useEffect(() => {
    if (!searchQuery) return;
    const qLow = searchQuery.toLowerCase();
    const matchedNoms = new Set(
      pieges
        .filter(p =>
          p.nom.toLowerCase().includes(qLow) ||
          (p.effets ?? "").toLowerCase().includes(qLow) ||
          (p.cible ?? "").toLowerCase().includes(qLow)
        )
        .map(p => p.nom)
    );
    setExpanded(matchedNoms);
  }, [searchQuery, pieges]);

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? pieges.filter(
        (p) =>
          p.nom.toLowerCase().includes(q) ||
          (p.effets ?? "").toLowerCase().includes(q) ||
          (p.cible ?? "").toLowerCase().includes(q),
      )
    : pieges;

  const grouped = groupBy(filtered, (p) => p.nom);
  const keys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold text-primary mb-2">Pièges</h2>

      <div className="rounded-md border border-primary/30 bg-[#111111] p-4 text-sm text-muted-foreground space-y-3">
        <p>
          Les pièges magiques (compétence Piège Magique + Canalisation) permettent d'emprisonner un sort dans un piège.
          Ils ne sont pas listés ici car leur effet dépend du sort choisi lors de la création. Maximum 1 piège par coffre.
        </p>
        <div className="flex items-center gap-2 text-xs border-t border-primary/10 pt-2">
          <Info className="h-3.5 w-3.5 text-primary" />
          <span>{LEGENDE_CONSTRUCTION_PIEGES}</span>
        </div>
      </div>

      {keys.length === 0 ? (
        <p className="text-muted-foreground text-center py-6">Aucun résultat pour cette recherche.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {keys.map((nom) => {
            const niveaux = [...grouped[nom]].sort((a, b) => a.niveau - b.niveau);
            const principal = niveaux[0];
            return (
              <EncyclopedieCard
                key={nom}
                id={nom}
                isOpen={expanded.has(nom)}
                onToggle={() => toggleExpanded(nom)}
                maxHeight={2000}
                header={
                  <>
                    <CardTitle className="font-heading text-lg">{nom}</CardTitle>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {niveaux.map((n) => (
                        <Badge
                          key={n.id}
                          className="text-xs bg-[#6b1f2a] hover:bg-[#6b1f2a] text-white border-transparent"
                        >
                          Niv. {n.niveau}
                        </Badge>
                      ))}
                      {principal?.type_piege && (
                        <Badge variant="outline" className="text-xs">
                          {principal.type_piege}
                        </Badge>
                      )}
                    </div>
                  </>
                }
              >
                <div className="space-y-3 border-t border-primary/10 pt-3 mt-1">
                  {niveaux.map((n) => (
                    <div key={n.id} className="rounded border border-border/60 p-3 space-y-1 text-xs">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge className="bg-[#6b1f2a] hover:bg-[#6b1f2a] text-white border-transparent text-xs">
                          Niveau {n.niveau}
                        </Badge>
                        {n.niveau_effet != null && (
                          <Badge variant="outline" className="text-xs">
                            Effet de niveau {n.niveau_effet}
                          </Badge>
                        )}
                        <span className="text-primary font-medium">{n.cout_xp} XP</span>
                      </div>
                      <p><span className="font-medium text-foreground">Cible :</span> {n.cible}</p>
                      <p><span className="font-medium text-foreground">Durée :</span> {n.duree}</p>
                      <p><span className="font-medium text-foreground">Effets :</span> {n.effets}</p>
                      {n.construction && (
                        <p className="mt-1 pt-1 border-t border-border/40">
                          <span className="font-medium text-foreground">Construction :</span> {n.construction}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </EncyclopedieCard>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PiegesSection;
