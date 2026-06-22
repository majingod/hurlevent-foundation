import { useCallback, useState } from "react";
import { X } from "lucide-react";

// L2 — Bulle d'aide au tap (spec s171) : tout symbole tappable (pastille de
// type, ⧉ ×N, ↑/MAX, 🔒/＋…) appelle `montrer({ titre, texte })` — avec
// stopPropagation côté appelant — et la bulle sticky bottom affiche
// l'explication jusqu'au ✕ ou au tap d'un autre symbole.

export interface AideTapBulle {
  titre: string;
  texte: string;
}

/** État de la bulle d'aide : à instancier une fois par étape. */
export const useTapBulle = () => {
  const [aide, setAide] = useState<AideTapBulle | null>(null);
  const fermer = useCallback(() => setAide(null), []);
  return { aide, montrer: setAide, fermer };
};

export const TapBulle = ({
  aide,
  onClose,
}: {
  aide: AideTapBulle | null;
  onClose: () => void;
}) => {
  if (!aide) return null;
  return (
    <div className="sticky bottom-2 z-40">
      <div className="flex items-start gap-2.5 rounded-xl border border-primary/55 bg-background px-3 py-2.5 shadow-xl">
        <div className="flex-1">
          <p className="text-[12.5px] font-bold text-primary">{aide.titre}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-foreground">
            {aide.texte}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l'aide"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
