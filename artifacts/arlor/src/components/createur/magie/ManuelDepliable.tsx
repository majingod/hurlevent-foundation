import { useState } from "react";

// 📖 — Texte du manuel (spec s171) : lien souligné replié par défaut →
// encadré italique à bordure latérale avec le verbatim. Affiche
// `tronc ?? description` (tronc du Manuel si le sort a des paliers,
// description complète sinon — mapping s161 ; fallback prévu pour É7).

interface ManuelDepliableProps {
  tronc?: string | null;
  description?: string | null;
  /** Ouverture contrôlée par le parent (ex. switch global Abrégé/Intégral). */
  forceOpen?: boolean;
  /** Masque le bouton interne (ouverture pilotée par le parent). */
  hideButton?: boolean;
}

const ManuelDepliable = ({ tronc, description, forceOpen, hideButton }: ManuelDepliableProps) => {
  const [ouvertLocal, setOuvertLocal] = useState(false);
  const texte = tronc ?? description;
  if (!texte) return null;
  const ouvert = hideButton ? !!forceOpen : ouvertLocal;

  return (
    <div>
      {!hideButton && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOuvertLocal((o) => !o);
          }}
          className="flex items-center gap-1.5 text-[11.5px] text-primary underline underline-offset-2"
        >
          📖 {ouvertLocal ? "Masquer le texte du manuel" : "Texte du manuel"}
        </button>
      )}
      {ouvert && (
        <div className="mt-1.5 rounded-r-lg border-l-[3px] border-border bg-muted/30 px-2.5 py-2">
          <p className="whitespace-pre-line text-[12.5px] italic leading-relaxed text-muted-foreground">
            {texte}
          </p>
        </div>
      )}
    </div>
  );
};

export default ManuelDepliable;
