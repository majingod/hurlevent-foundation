import { useState } from "react";

interface DescriptionDepliableProps {
  courte?: string | null;
  complete?: string | null;
}

/**
 * Description courte + verbatim Manuel dépliable. État local par instance —
 * PAS de Radix Accordion (AccordionTrigger rend un <button>, interdit avec
 * enfants interactifs imbriqués). Les cartes parentes étant cliquables pour
 * la sélection, le clic du lien fait stopPropagation.
 */
const DescriptionDepliable = ({ courte, complete }: DescriptionDepliableProps) => {
  const [deplie, setDeplie] = useState(false);

  const texteCourt = courte ?? complete;
  const aVerbatim = !!complete && complete !== courte;

  if (!texteCourt) return null;

  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{texteCourt}</p>
      {deplie && aVerbatim && (
        <p className="whitespace-pre-line text-sm text-muted-foreground">
          {complete}
        </p>
      )}
      {aVerbatim && (
        <button
          type="button"
          className="text-xs text-primary underline-offset-2 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setDeplie((d) => !d);
          }}
        >
          {deplie ? "Réduire" : "Voir la description complète"}
        </button>
      )}
    </div>
  );
};

export default DescriptionDepliable;
