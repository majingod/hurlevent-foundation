import type { ReactNode } from "react";

// Brique partagée Lot B — scalaires en lignes « Label : valeur » (langage
// Sections, pas de pastilles). Les facts dont la valeur est null/""/undefined
// sont filtrés. Réutilisé par É8 (assemblages), É9 (alchimie/pièges), fiche perso.

export interface Fact {
  label: string;
  value: ReactNode;
}

interface QuickFactsProps {
  facts: Fact[];
  className?: string;
}

export const QuickFacts = ({ facts, className }: QuickFactsProps) => {
  const items = facts.filter(
    (f) => f.value !== null && f.value !== undefined && f.value !== "",
  );
  if (items.length === 0) return null;
  return (
    <dl className={`space-y-0.5 text-xs ${className ?? ""}`}>
      {items.map((f, i) => (
        <div key={i} className="flex gap-1.5">
          <dt className="shrink-0 font-medium text-foreground">{f.label} :</dt>
          <dd className="text-muted-foreground">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
};

export default QuickFacts;
