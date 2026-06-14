import { type ReactNode } from "react";

interface SectionCardProps {
  titre: string;
  sousTitre?: string;
  /** Badge optionnel aligné à droite du titre (ex. état campagne « Figé »). */
  badge?: ReactNode;
  children: ReactNode;
}

/**
 * Carte de section du wizard (modèle SECTIONS, Lot A — s185).
 * En-tête neutre : titre Cinzel doré + sous-titre. Pas de barre or-gauche
 * (réservée au « scellé » campagne). Toujours ouverte : les champs requis
 * d'une étape de création restent visibles (pas d'accordéon ici).
 */
const SectionCard = ({ titre, sousTitre, badge, children }: SectionCardProps) => (
  <div className="rounded-lg border border-white/10 bg-white/[0.02]">
    <div className="flex items-start justify-between gap-2 px-4 pt-3">
      <div>
        <h3 className="font-heading text-[15px] font-bold tracking-wide text-gold">
          {titre}
        </h3>
        {sousTitre && (
          <p className="mt-0.5 text-[11.5px] text-white/40">{sousTitre}</p>
        )}
      </div>
      {badge}
    </div>
    <div className="px-4 pb-4 pt-3">{children}</div>
  </div>
);

export default SectionCard;
