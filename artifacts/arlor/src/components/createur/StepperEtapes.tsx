import { Check, Lock, type LucideIcon } from "lucide-react";

/* Stepper cliquable du wizard. Étapes atteintes (<= max) cliquables,
   courante mise en avant, futures verrouillées. Saut = navigation pure. */

export interface EtapeDef {
  n: number;
  t: string;
  Icon: LucideIcon;
}

interface Props {
  etapes: EtapeDef[];
  courant: number;
  /** étape la plus avancée atteinte (incluse) — au-delà = verrouillé */
  max: number;
  onJump: (n: number) => void;
  /** M3a PR-C1 : étapes figées en campagne (race/stats/classe) — visibles mais non cliquables */
  verrouillees?: number[];
}

export default function StepperEtapes({ etapes, courant, max, onJump, verrouillees = [] }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto px-1 pb-2">
      {etapes.map((e) => {
        const figee = verrouillees.includes(e.n);
        const statut =
          e.n === courant ? "current" : e.n <= max ? "done" : "locked";
        const locked = statut === "locked" || figee;
        const Ic = statut === "done" ? Check : e.Icon;
        const cercle =
          statut === "current"
            ? "bg-gold text-black border-gold ring-2 ring-gold/30"
            : statut === "done"
              ? "bg-gold/15 text-gold border-gold/50"
              : "bg-white/5 text-white/40 border-white/10";
        return (
          <button
            key={e.n}
            type="button"
            disabled={locked}
            onClick={() => !locked && onJump(e.n)}
            title={figee ? "Figé en campagne" : `${e.t}`}
            className={`flex w-16 shrink-0 flex-col items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50 ${
              figee ? "opacity-45 cursor-not-allowed" : ""
            }`}
          >
            <span
              className={`relative flex h-10 w-10 items-center justify-center rounded-full border ${cercle}`}
            >
              {figee ? (
                <Lock className="h-3 w-3" />
              ) : locked ? (
                <Lock className="h-4 w-4" />
              ) : (
                <Ic className="h-[18px] w-[18px]" />
              )}

            </span>
            <span
              className={`text-center text-[9.5px] leading-tight ${
                statut === "current" ? "font-bold text-gold" : "text-white/50"
              }`}
            >
              {e.t}
            </span>
          </button>
        );
      })}
    </div>
  );
}
