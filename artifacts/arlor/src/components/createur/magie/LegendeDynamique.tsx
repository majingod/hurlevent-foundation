import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { PastilleType } from "@/components/shared/PastilleType";
import { ecrireStockage, lireStockage } from "./stockageLocal";

// L1 — Légende dynamique (spec s171) : carte « ℹ Comprendre les symboles »,
// OUVERTE par défaut, repli mémorisé en localStorage. DYNAMIQUE : chaque
// entrée n'apparaît que si l'élément est réellement visible pour CE joueur
// (plafonds réels de ses cercles, ses ⧉ ×N réels, fond doré seulement s'il a
// des acquis, etc.). PS toujours listé.

const DESCRIPTIONS_TYPES: Record<string, string> = {
  "effet bénéfique": "Avantage ses cibles (protection, soin, bonus).",
  effet: "Altère ou contraint ses cibles sans dégâts.",
  "dégâts": "Inflige des dégâts.",
};

interface LegendeDynamiqueProps {
  type: "sort" | "priere";
  /** Clé localStorage du repli (ex. « hv-e6-legende-repliee »). */
  storageKey: string;
  /** Types de magie réellement présents dans le catalogue/les achats. */
  typesPresents: string[];
  /** Plafonds « ≤ niv X » distincts des cercles/domaines du joueur. */
  plafonds: number[];
  /** Comptes « ⧉ ×N » distincts parmi les possessions du joueur. */
  multiples: number[];
  /** Niveaux minimum « Niv. X+ » distincts (> 1) du catalogue visible. */
  niveauxMin: number[];
  /** Le joueur a au moins un item scellé (fond doré 🔒). */
  aDesAcquis: boolean;
  /** Le joueur possède au moins un item (lignes ↑ / MAX). */
  aDesAchats: boolean;
  modeCampagne: boolean;
}

const Ligne = ({
  symbole,
  texte,
}: {
  symbole: React.ReactNode;
  texte: React.ReactNode;
}) => (
  <div className="flex items-start gap-2">
    <span className="flex min-w-[58px] shrink-0 justify-start">{symbole}</span>
    <span className="text-muted-foreground">{texte}</span>
  </div>
);

const SousTitre = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
    {children}
  </p>
);

const LegendeDynamique = ({
  type,
  storageKey,
  typesPresents,
  plafonds,
  multiples,
  niveauxMin,
  aDesAcquis,
  aDesAchats,
  modeCampagne,
}: LegendeDynamiqueProps) => {
  const [ouvert, setOuvert] = useState(() => lireStockage(storageKey) !== "1");
  const basculer = () => {
    setOuvert((o) => {
      ecrireStockage(storageKey, o ? "1" : "0");
      return !o;
    });
  };

  const mot = type === "sort" ? "sort" : "prière";
  const groupe = type === "sort" ? "cercle" : "domaine";

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
          {typesPresents.length > 0 && (
            <>
              <SousTitre>Types de magie</SousTitre>
              {typesPresents.map((t) => (
                <Ligne
                  key={t}
                  symbole={<PastilleType type={t} />}
                  texte={DESCRIPTIONS_TYPES[t] ?? ""}
                />
              ))}
            </>
          )}

          <SousTitre>Catalogue</SousTitre>
          {plafonds.map((p) => (
            <Ligne
              key={`plafond-${p}`}
              symbole={
                <span className="whitespace-nowrap rounded-full border border-border px-2 py-px text-[11px] font-semibold">
                  ≤ niv {p}
                </span>
              }
              texte={`Plafond du ${groupe} : vos ${mot}s de ce ${groupe} ne peuvent pas dépasser le niveau ${p}.`}
            />
          ))}
          {multiples.map((n) => (
            <Ligne
              key={`multiple-${n}`}
              symbole={
                <span className="whitespace-nowrap rounded-full border border-gold/50 px-2 py-px text-[10px] font-bold text-gold">
                  ⧉ ×{n}
                </span>
              }
              texte={`Vous possédez déjà ${n} version${n > 1 ? "s" : ""} de ce ${mot}.`}
            />
          ))}
          {niveauxMin.map((n) => (
            <Ligne
              key={`niveau-min-${n}`}
              symbole={
                <span className="whitespace-nowrap rounded-full border border-border px-2 py-px text-[11px] font-semibold">
                  Niv. {n}+
                </span>
              }
              texte={`Niveau minimum du ${mot} : son curseur de niveau démarre à ${n}.`}
            />
          ))}

          <SousTitre>{type === "sort" ? "Vos sorts" : "Vos prières"}</SousTitre>
          {aDesAcquis && (
            <Ligne
              symbole={
                <span className="inline-block h-4 w-[50px] rounded border border-gold/50 border-l-4 border-l-gold bg-gold/15" />
              }
              texte={
                <span>
                  <strong className="text-gold">Fond doré 🔒</strong> — {mot}{" "}
                  {type === "sort" ? "acquis, scellé" : "acquise, scellée"} à un
                  GN : améliorable seulement, jamais supprimable ni
                  affaiblissable.
                </span>
              }
            />
          )}
          {modeCampagne && aDesAchats && (
            <Ligne
              symbole={
                <span className="inline-block h-4 w-[50px] rounded border border-emerald-600/35 border-l-[3px] border-l-emerald-600/60 bg-emerald-600/10" />
              }
              texte={
                <span>
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    Fond vert ＋
                  </strong>{" "}
                  — ajout de la fenêtre courante : modifiable et supprimable
                  librement (XP remboursés).
                </span>
              }
            />
          )}
          {aDesAchats && (
            <>
              <Ligne
                symbole={
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    ↑
                  </span>
                }
                texte={`Peut encore monter (niveau, zone, portée ou durée) — touchez-${type === "sort" ? "le" : "la"} pour l'améliorer.`}
              />
              <Ligne
                symbole={
                  <span className="rounded-full border border-border px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-muted-foreground">
                    MAX
                  </span>
                }
                texte="Tout est au plafond : seul le nom peut changer."
              />
            </>
          )}
          <Ligne
            symbole={
              <span className="text-[11px] font-bold text-muted-foreground">
                PS
              </span>
            }
            texte={`Points de spiritualité : dépensés à chaque lancement ${type === "sort" ? "du sort" : "de la prière"} en jeu. Affichés sous le calcul du coût d'achat.`}
          />
        </div>
      )}
    </div>
  );
};

export default LegendeDynamique;
