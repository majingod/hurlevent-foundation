import { Construction } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EtapeProps {
  personnageId: string;
  onSuccess: () => void;
  onPrevious?: () => void;
}

const Etape6_Sorts_V2 = ({ onPrevious }: EtapeProps) => {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <Construction className="h-12 w-12 text-gold/60" aria-hidden />
      <div className="space-y-2">
        <h2 className="font-heading text-2xl text-gold">
          Étape 6 — Sorts arcaniques
        </h2>
        <p className="max-w-md text-sm text-white/60">
          Cette étape sera disponible avec le déploiement de la Phase 2 du
          créateur de personnage. Elle sera automatiquement ignorée pour les
          personnages qui n'ont accès à aucun cercle.
        </p>
      </div>
      {onPrevious && (
        <Button variant="outline" onClick={onPrevious}>
          ← Étape précédente
        </Button>
      )}
    </div>
  );
};

export default Etape6_Sorts_V2;
