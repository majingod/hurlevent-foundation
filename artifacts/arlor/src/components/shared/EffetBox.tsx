import type { ReactNode } from "react";

// Brique partagée Lot B — encadré or « effet complet » en paragraphe. Réutilise
// le style de createur/magie/ApercuEffet (bordure/fond or). Texte simple ici
// (pas de calcul de palier) : on rend le contenu tel quel (whitespace-pre-line).

interface EffetBoxProps {
  children: ReactNode;
  titre?: string;
}

export const EffetBox = ({ children, titre = "✦ Effet" }: EffetBoxProps) => {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="rounded-lg border border-gold/45 bg-gold/10 px-2.5 py-2">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gold">
        {titre}
      </p>
      <p className="whitespace-pre-line text-[13px] leading-snug text-foreground">
        {children}
      </p>
    </div>
  );
};

export default EffetBox;
