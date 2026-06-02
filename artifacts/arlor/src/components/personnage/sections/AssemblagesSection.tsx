import { Badge } from "@/components/ui/badge";
import { ManuelGlobalSwitch, ToggleManuel } from "@/components/shared/ToggleManuel";
import type { Assemblage } from "./types";

interface AssemblagesSectionProps {
  assemblages: Assemblage[] | undefined;
  isManuelOpen: (id: string) => boolean;
  toggleManuel: (id: string) => void;
  isAllOpen: (ids: string[]) => boolean;
  toggleAll: (ids: string[]) => void;
}

export const AssemblagesSection = ({
  assemblages,
  isManuelOpen,
  toggleManuel,
  isAllOpen,
  toggleAll,
}: AssemblagesSectionProps) => {
  if (!assemblages || assemblages.length === 0) {
    return <p className="text-center py-8 text-muted-foreground">Aucun assemblage de runes.</p>;
  }

  const idsVerbatim = assemblages.filter((a) => a.texte_manuel).map((a) => a.id);

  return (
    <div className="space-y-3">
      {idsVerbatim.length > 0 && (
        <ManuelGlobalSwitch
          allOpen={isAllOpen(idsVerbatim)}
          onToggle={() => toggleAll(idsVerbatim)}
          title="Cet onglet"
          subtitle="Verbatim du manuel pour les assemblages"
        />
      )}
      {assemblages.map((asm) => (
        <div key={asm.id} className="p-3 rounded border border-border/50 text-sm space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{asm.nom}</p>
            {asm.cout_ps != null && <Badge variant="secondary" className="text-xs">{asm.cout_ps} PS</Badge>}
            {asm.cible && <Badge variant="outline" className="text-xs">Cible : {asm.cible}</Badge>}
          </div>
          {asm.runes_requises && asm.runes_requises.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {asm.runes_requises.map((rune, i) => (
                <Badge key={i} variant="outline" className="text-xs border-primary/30 text-primary">{rune}</Badge>
              ))}
            </div>
          )}
          {asm.effet && <p><span className="font-medium text-foreground">Effet :</span> {asm.effet}</p>}
          {asm.description && <p className="text-muted-foreground whitespace-pre-line">{asm.description}</p>}
          <ToggleManuel
            texte={asm.texte_manuel}
            isOpen={isManuelOpen(asm.id)}
            onToggle={() => toggleManuel(asm.id)}
          />
        </div>
      ))}
    </div>
  );
};

export default AssemblagesSection;
