import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { ecrireStockage, lireStockage } from "../aide/stockageLocal";

// L1 — Légende repliable « ℹ Comprendre les symboles » de l'artisanat (Lot B,
// s183), partagée É8 (assemblages) / É9 (alchimie + pièges). OUVERTE par
// défaut, repli mémorisé en localStorage (clé paramétrable). DIRIGÉE PAR LES
// DONNÉES : la page construit le tableau `entrees` (sous-titres + lignes) selon
// ce qui est réellement visible pour CE joueur. Reprend `LegendeDepliable` de
// la maquette v8 (sym « or »/« vert » → échantillon de fond doré/vert).

export interface EntreeLegende {
  /** Sous-titre de section (ex. « Coût », « Symboles »). */
  section?: string;
  /** Symbole : nœud React, ou « or » / « vert » pour un échantillon de fond. */
  sym?: ReactNode | "or" | "vert";
  texte?: ReactNode;
}

interface LegendeArtisanatProps {
  /** Clé localStorage du repli (ex. « hv-e8-legende-replie »). */
  storageKey: string;
  entrees: EntreeLegende[];
}

/** Échantillon de fond doré (bord gauche 4px) ou vert (bord gauche 3px). */
const FondDemo = ({ couleur }: { couleur: "or" | "vert" }) =>
  couleur === "or" ? (
    <span className="inline-block h-4 w-[52px] rounded border border-gold/45 border-l-4 border-l-gold bg-gold/10" />
  ) : (
    <span className="inline-block h-4 w-[52px] rounded border border-emerald-600/45 border-l-[3px] border-l-emerald-500 bg-emerald-600/10" />
  );

const Ligne = ({ sym, texte }: { sym?: EntreeLegende["sym"]; texte?: ReactNode }) => (
  <div className="flex items-start gap-2">
    <span className="flex min-w-[64px] shrink-0 justify-start">
      {sym === "or" ? (
        <FondDemo couleur="or" />
      ) : sym === "vert" ? (
        <FondDemo couleur="vert" />
      ) : (
        sym
      )}
    </span>
    <span className="text-muted-foreground">{texte}</span>
  </div>
);

const LegendeArtisanat = ({ storageKey, entrees }: LegendeArtisanatProps) => {
  const [ouvert, setOuvert] = useState(() => lireStockage(storageKey) !== "1");

  const basculer = () => {
    setOuvert((o) => {
      ecrireStockage(storageKey, o ? "1" : "0");
      return !o;
    });
  };

  return (
    <div className="rounded-lg border bg-card/50 text-xs">
      <button
        type="button"
        onClick={basculer}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs text-muted-foreground"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${ouvert ? "rotate-90" : ""}`}
        />
        ℹ Comprendre les symboles
      </button>
      {ouvert && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          {entrees.map((e, i) =>
            e.section ? (
              <p
                key={i}
                className={`text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground ${i ? "mt-1" : ""}`}
              >
                {e.section}
              </p>
            ) : (
              <Ligne key={i} sym={e.sym} texte={e.texte} />
            ),
          )}
        </div>
      )}
    </div>
  );
};

export default LegendeArtisanat;
