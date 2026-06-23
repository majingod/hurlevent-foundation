import type { MouseEvent } from "react";

// Brique partagée Lot B (couche aide, s183) — pastille de coût « Gratuit »
// (vert émeraude) / « N XP » (bordeaux). Tappable quand `onAide` est fourni :
// ouvre une bulle d'aide L2 (TapBulle) expliquant le quota gratuit / surcoût XP.
// Sans `onAide`, la pastille est purement décorative (légende L1).

interface PastilleCoutProps {
  gratuit: boolean;
  xp: number;
  /** Optionnel : callback d'aide L2. Si absent → non tappable. */
  onAide?: (aide: { titre: string; texte: string }) => void;
}

export const PastilleCout = ({ gratuit, xp, onAide }: PastilleCoutProps) => {
  const handle = onAide
    ? (e: MouseEvent) => {
        e.stopPropagation();
        onAide(
          gratuit
            ? {
                titre: "Gratuit",
                texte:
                  "Compris dans votre quota gratuit. Si vous le retirez, la place se libère.",
              }
            : {
                titre: `${xp} XP`,
                texte: `Quota épuisé : cet ajout coûte ${xp} XP, remboursés si retiré.`,
              },
        );
      }
    : undefined;

  const base = gratuit
    ? "shrink-0 rounded-full border border-emerald-600/40 bg-emerald-600/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400"
    : "shrink-0 rounded-full border border-bordeaux bg-bordeaux px-2.5 py-0.5 text-[11px] font-bold text-foreground";

  return (
    <span onClick={handle} className={onAide ? `${base} cursor-pointer` : base}>
      {gratuit ? "Gratuit" : `${xp} XP`}
    </span>
  );
};

export default PastilleCout;
