import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { PiegeRow, PersonnagePiegeRow } from "./types";

interface PiegesSectionProps {
  piegesCatalogue: PiegeRow[] | undefined;
  personnagePieges: PersonnagePiegeRow[] | undefined;
}

export const PiegesSection = ({
  piegesCatalogue,
  personnagePieges,
}: PiegesSectionProps) => {
  // PR-4 — toggle densité par famille de piège (lecture seule), encapsulé ici.
  const [piegesDepliees, setPiegesDepliees] = useState<Set<string>>(new Set());
  const togglePiegeDepliee = (nom: string) =>
    setPiegesDepliees((prev) => {
      const next = new Set(prev);
      if (next.has(nom)) next.delete(nom);
      else next.add(nom);
      return next;
    });

  // Catalogue indexé par (nom, niveau).
  const piegeCatalogueParNomNiveau = new Map<string, PiegeRow>();
  (piegesCatalogue ?? []).forEach((p) => {
    piegeCatalogueParNomNiveau.set(`${p.nom}__${p.niveau}`, p);
  });
  const famillesPiegesPossedees: [string, number[]][] = (() => {
    const map = new Map<string, number[]>();
    (personnagePieges ?? []).forEach((pp) => {
      const arr = map.get(pp.piege_nom) ?? [];
      arr.push(pp.niveau_acquis);
      map.set(pp.piege_nom, arr);
    });
    map.forEach((arr) => arr.sort((a, b) => a - b));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "fr"));
  })();

  return famillesPiegesPossedees.length === 0 ? (
    <p className="text-center py-8 text-muted-foreground">Aucun piège acquis.</p>
  ) : (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground border-b border-border/50 pb-2">
        Total : {famillesPiegesPossedees.length} piège{famillesPiegesPossedees.length > 1 ? "s" : ""} maîtrisé{famillesPiegesPossedees.length > 1 ? "s" : ""}
      </div>
      {famillesPiegesPossedees.map(([nom, niveaux]) => {
        const niveauMax = niveaux[niveaux.length - 1];
        const palierHaut = piegeCatalogueParNomNiveau.get(`${nom}__${niveauMax}`);
        // Construction = info de famille (rangée sur le niv 1), miroir wizard
        const constructionFamille = piegeCatalogueParNomNiveau.get(`${nom}__1`)?.construction ?? null;
        const depliee = piegesDepliees.has(nom);
        return (
          <Card key={nom}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="font-heading text-base">{nom}</CardTitle>
                {niveaux.map((n) => (
                  <Badge key={n} className="bg-[#6b1f2a] hover:bg-[#6b1f2a] text-white border-transparent text-xs">
                    Niv. {n}
                  </Badge>
                ))}
                {palierHaut?.niveau_effet != null && (
                  <Badge variant="outline" className="text-xs">Effet de niveau {palierHaut.niveau_effet}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {palierHaut && (
                <div className="space-y-1 rounded border border-border/60 bg-background/40 p-2">
                  {palierHaut.cible && (
                    <p><span className="font-medium text-foreground">Cible :</span> {palierHaut.cible}</p>
                  )}
                  {palierHaut.duree && (
                    <p><span className="font-medium text-foreground">Durée :</span> {palierHaut.duree}</p>
                  )}
                  {palierHaut.effets && (
                    <p><span className="font-medium text-foreground">Effets :</span> {palierHaut.effets}</p>
                  )}
                  {constructionFamille && (
                    <p className="pt-1 border-t border-border/40"><span className="font-medium text-amber-400">Construction :</span> {constructionFamille}</p>
                  )}
                </div>
              )}
              {niveaux.length > 1 && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-1 py-1 text-xs text-muted-foreground"
                    onClick={() => togglePiegeDepliee(nom)}
                  >
                    {depliee ? <ChevronDown className="mr-1 h-3 w-3" /> : <ChevronRight className="mr-1 h-3 w-3" />}
                    {depliee ? "Masquer le détail par niveau" : "Voir le détail par niveau"}
                  </Button>
                  {depliee && (
                    <div className="space-y-2 border-l-2 border-border pl-3">
                      {niveaux.map((n) => {
                        const palier = piegeCatalogueParNomNiveau.get(`${nom}__${n}`);
                        if (!palier) return null;
                        return (
                          <div key={n} className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <strong>Niveau {n}</strong>
                              {palier.niveau_effet != null && (
                                <Badge variant="outline" className="text-xs">Effet de niveau {palier.niveau_effet}</Badge>
                              )}
                            </div>
                            {palier.cible && (
                              <p><span className="font-medium text-foreground">Cible :</span> {palier.cible}</p>
                            )}
                            {palier.duree && (
                              <p><span className="font-medium text-foreground">Durée :</span> {palier.duree}</p>
                            )}
                            {palier.effets && (
                              <p><span className="font-medium text-foreground">Effets :</span> {palier.effets}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default PiegesSection;
