import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

interface EncyclopedieCardProps {
  /** Identifiant unique (utilisé par le state d'ouverture multi du parent) */
  id: string;
  /** Carte ouverte ou fermée */
  isOpen: boolean;
  /** Handler de toggle (appelé au clic sur la carte) */
  onToggle: () => void;
  /** Contenu du header (titre, badges, sous-titre, ...) */
  header: ReactNode;
  /** Contenu déployé */
  children: ReactNode;
  /** Hauteur max du contenu déployé (px). Default 1500. */
  maxHeight?: number;
  /** Classes additionnelles optionnelles sur la Card racine */
  className?: string;
}

/**
 * Carte expandable réutilisable pour les sections de l'Encyclopédie.
 *
 * Pattern uniformisé pour : Religions, Traits, Lore, Bestiaire,
 * Pièges, Assemblages, Forge, Joaillerie. Le state d'ouverture
 * (mono ou multi) est porté par le parent.
 *
 * Le parent doit gérer le state avec un Set<string> pour le mode
 * multi-open (recommandé pour permettre la pré-ouverture après
 * navigation depuis recherche).
 */
const EncyclopedieCard = ({
  id,
  isOpen,
  onToggle,
  header,
  children,
  maxHeight = 1500,
  className = "",
}: EncyclopedieCardProps) => (
  <Card
    className={`cursor-pointer border-primary/10 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_25px_rgba(184,146,70,0.1)] group ${className}`}
    onClick={onToggle}
    data-encyclopedie-card-id={id}
  >
    <CardHeader className="pb-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">{header}</div>
        <ChevronDown
          className={`h-4 w-4 text-primary/40 transition-transform duration-300 mt-1 flex-shrink-0 group-hover:text-primary ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </div>
    </CardHeader>
    <CardContent className="text-sm text-muted-foreground">
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isOpen ? `${maxHeight}px` : "0",
          opacity: isOpen ? 1 : 0,
        }}
      >
        {children}
      </div>
      <div className="flex justify-end pt-1">
        <span className="text-xs text-primary">
          {isOpen ? "Voir moins" : "Voir plus"}
        </span>
      </div>
    </CardContent>
  </Card>
);

export default EncyclopedieCard;
