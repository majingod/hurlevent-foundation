import { Lock } from "lucide-react";

/** Badge « Acquis » (or + cadenas) marquant un item scellé par la photo de
 *  compo en mode campagne. Cosmétique — le backend (INV-3) reste l'autorité. */
export const BadgeAcquis = () => (
  <span className="inline-flex items-center gap-1 rounded border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[10px] font-semibold text-gold-accent">
    <Lock className="h-2.5 w-2.5" /> Acquis
  </span>
);
