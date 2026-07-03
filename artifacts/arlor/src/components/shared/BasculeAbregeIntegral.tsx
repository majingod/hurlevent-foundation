type Mode = "abrege" | "integral";

interface Props {
  mode: Mode;
  onToggle: () => void;
  className?: string;
}

/**
 * Bascule Abrégé ⇄ Intégral — switch unique partagé par l'encyclopédie et le
 * wizard (et la future fiche perso). Composant présentationnel pur : l'état
 * `mode` et sa persistance vivent chez l'appelant.
 */
export default function BasculeAbregeIntegral({ mode, onToggle, className }: Props) {
  const integral = mode === "integral";
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <span className={`text-sm ${integral ? "text-muted-foreground" : "text-foreground font-semibold"}`}>
        Abrégé
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={integral}
        aria-label="Basculer entre texte abrégé et texte intégral"
        onClick={onToggle}
        className="relative rounded-full border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{ width: 46, height: 26, background: integral ? "#c9a84c" : "hsl(0 0% 14%)" }}
      >
        <span
          className="absolute rounded-full transition-all"
          style={{ top: 2, left: integral ? 22 : 2, width: 20, height: 20, background: integral ? "hsl(0 0% 4%)" : "hsl(36 33% 93%)" }}
        />
      </button>
      <span className={`text-sm ${integral ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
        Intégral
      </span>
    </div>
  );
}
