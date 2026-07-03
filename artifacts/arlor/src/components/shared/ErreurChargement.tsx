interface Props {
  message?: string;
  onRetry: () => void;
  className?: string;
}

/**
 * État d'échec de chargement partagé (encyclopédie + wizard). Affiche un
 * message + un bouton « Réessayer ». Composant présentationnel pur : la
 * relance (refetch / reload) vit chez l'appelant.
 */
export default function ErreurChargement({ message, onRetry, className }: Props) {
  return (
    <div className={`text-center py-12 ${className ?? ""}`}>
      <p className="text-sm mb-4" style={{ color: "#e6b3b3" }}>
        {message ?? "Impossible de charger les données. Vérifie ta connexion et réessaie."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 px-4 py-2 text-sm text-gold transition-all hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{ background: "rgba(201,168,76,0.06)" }}
      >
        Réessayer
      </button>
    </div>
  );
}
