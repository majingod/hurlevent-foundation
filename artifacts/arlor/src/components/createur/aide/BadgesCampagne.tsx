import { Lock, Pencil } from "lucide-react";

/**
 * Badges d'affordance du mode campagne (Lot A — s185).
 * « Figé » = champ verrouillé. « Modifiable » = champ encore éditable.
 * Tons volontairement NEUTRES : ni or (= scellé) ni émeraude (= ajout
 * annulable), pour ne pas entrer en collision avec le langage visuel campagne.
 */
export const BadgeFige = () => (
  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10.5px] font-semibold text-white/50">
    <Lock className="h-2.5 w-2.5" /> Figé
  </span>
);

export const BadgeModifiable = () => (
  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[10.5px] font-semibold text-white/90">
    <Pencil className="h-2.5 w-2.5" /> Modifiable
  </span>
);
