import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { ecrireStockage, lireStockage } from "./stockageLocal";

// W1 — Introduction d'étape (spec s171) : carte dorée dépliable « Comment
// fonctionne cette étape ? », OUVERTE par défaut, repli mémorisé en
// localStorage (clé paramétrable pour réutilisation É7).

interface IntroEtapeProps {
  /** Clé localStorage du repli (ex. « hv-e6-intro-replie »). */
  storageKey: string;
  titre: string;
  /** Contenu : étapes numérotées (IntroEtapeItem) + notes éventuelles. */
  children: ReactNode;
}

/** Ligne numérotée du contenu de l'intro (pastille n + texte joueur). */
export const IntroEtapeItem = ({
  n,
  children,
}: {
  n: number;
  children: ReactNode;
}) => (
  <div className="flex items-start gap-2.5">
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/15 text-[11px] font-bold text-primary">
      {n}
    </span>
    <p className="text-[12.5px] leading-relaxed text-foreground">{children}</p>
  </div>
);

const IntroEtape = ({ storageKey, titre, children }: IntroEtapeProps) => {
  const [ouvert, setOuvert] = useState(() => lireStockage(storageKey) !== "1");

  const basculer = () => {
    setOuvert((o) => {
      ecrireStockage(storageKey, o ? "1" : "0");
      return !o;
    });
  };

  return (
    <div className="rounded-xl border border-primary/35 bg-primary/5">
      <button
        type="button"
        onClick={basculer}
        className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-[12.5px] font-semibold text-primary"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${ouvert ? "rotate-90" : ""}`}
        />
        {titre}
      </button>
      {ouvert && (
        <div className="flex flex-col gap-2.5 px-3 pb-3">{children}</div>
      )}
    </div>
  );
};

export default IntroEtape;
