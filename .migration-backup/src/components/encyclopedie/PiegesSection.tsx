import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Info } from "lucide-react";
import { LEGENDE_CONSTRUCTION_PIEGES } from "@/constants/artisanat";

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
  const [expanded, setExpanded] = useState<string | null>(null);
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
            const isOpen = expanded === nom;
            return (
              <Card
                key={nom}
                className="cursor-pointer border-primary/10 transition-shadow duration-200 hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
                onClick={() => setExpanded(isOpen ? null : nom)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="font-heading text-lg">{nom}</CardTitle>
                    <ChevronDown className={`h-4 w-4 text-primary/40 transition-transform duration-300 mt-1 ${isOpen ? "rotate-180" : ""}`} />
                  </div>
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
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <div
                    className="overflow-hidden transition-all duration-300 ease-in-out"
                    style={{ maxHeight: isOpen ? "2000px" : "0", opacity: isOpen ? 1 : 0 }}
                  >
                    <div className="space-y-3 border-t border-primary/10 pt-3 mt-1">
                      {niveaux.map((n) => (
                        <div key={n.id} className="rounded border border-border/60 p-3 space-y-1 text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-[#6b1f2a] hover:bg-[#6b1f2a] text-white border-transparent text-xs">
                              Niveau {n.niveau}
                            </Badge>
                            <span className="text-primary font-medium">{n.cout_xp} XP</span>
                          </div>
                          <p><span className="font-medium text-foreground">Cible :</span> {n.cible}</p>
                          <p><span className="font-medium text-foreground">Durée :</span> {n.duree}</p>
                          <p><span className="font-medium text-foreground">Effets :</span> {n.effets}</p>
                          {n.niveau_effet != null && (
                            <p><span className="font-medium text-foreground">Niveau de résistance requis :</span> {n.niveau_effet}</p>
                          )}
                          {n.construction && (
                            <p className="mt-1 pt-1 border-t border-border/40">
                              <span className="font-medium text-foreground">Construction :</span> {n.construction}
                            </p>
                          )}
                        </div>
                      ))}
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
      )}
    </div>
  );
};

export default PiegesSection;
