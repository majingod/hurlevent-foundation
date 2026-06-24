import { useState } from "react";
import { X } from "lucide-react";
import { ecrireStockage, lireStockage } from "./stockageLocal";

// W3 — Astuce progressive (spec s171) : bulle 👉 pointillée affichée à la
// première découverte d'une zone ; le ✕ la masque définitivement
// (localStorage, clé paramétrable pour réutilisation É7).

interface AstuceProps {
  /** Clé localStorage « vue » (ex. « hv-e6-astuce-catalogue-vue »). */
  storageKey: string;
  texte: string;
}

const Astuce = ({ storageKey, texte }: AstuceProps) => {
  const [vue, setVue] = useState(() => lireStockage(storageKey) === "1");
  if (vue) return null;

  return (
    <div className="mx-3 mt-2 flex items-start gap-2 rounded-lg border border-dashed border-primary/45 bg-primary/5 px-2.5 py-2">
      <span className="text-xs" aria-hidden>
        👉
      </span>
      <p className="flex-1 text-[11.5px] leading-relaxed text-foreground">
        {texte}
      </p>
      <button
        type="button"
        aria-label="Ne plus afficher cette astuce"
        onClick={() => {
          ecrireStockage(storageKey, "1");
          setVue(true);
        }}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default Astuce;
