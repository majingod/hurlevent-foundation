// I4 — Jauge XP live (spec s171) : bandeau sticky en tête d'étape, toujours
// visible au défilement. Affiche le solde XP et, si une configuration est en
// cours (achat ou modification), le delta et le solde résultant (rouge si
// négatif). z-index AU-DESSUS du bandeau « Calcul du coût d'achat » (z-[15]).

export interface CoutEnCours {
  /** Delta XP signé : > 0 achat/surcoût, < 0 remboursement. */
  delta: number;
  /** « achat en cours » / « modification en cours » / « remboursement ». */
  libelle: string;
}

interface JaugeXPProps {
  xpDisponible: number;
  coutEnCours?: CoutEnCours | null;
}

const JaugeXP = ({ xpDisponible, coutEnCours }: JaugeXPProps) => {
  const reste = coutEnCours ? xpDisponible - coutEnCours.delta : xpDisponible;
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 rounded-lg border border-primary/45 bg-background px-3 py-2 shadow-lg">
      <span className="text-sm" aria-hidden>
        ⚡
      </span>
      <span className="text-sm font-bold text-primary">{xpDisponible} XP</span>
      {coutEnCours ? (
        <span className="flex-1 text-xs text-muted-foreground">
          {coutEnCours.delta > 0
            ? `− ${coutEnCours.delta}`
            : `+ ${-coutEnCours.delta}`}{" "}
          ({coutEnCours.libelle}) →{" "}
          <strong className={reste < 0 ? "text-destructive" : "text-foreground"}>
            {reste} XP
          </strong>
        </span>
      ) : (
        <span className="flex-1 text-xs text-muted-foreground">disponibles</span>
      )}
    </div>
  );
};

export default JaugeXP;
