// Brique partagée Lot B — liste titrée (ingrédients ; manipulations ordonnées).
// `ordonnee` → <ol> numéroté ; `note` → mention italique sous la liste
// (ex. « à suivre à la lettre »). Réutilisé surtout par É9 (alchimie) en PR2.

interface SectionListeProps {
  titre: string;
  items: string[];
  ordonnee?: boolean;
  note?: string;
}

export const SectionListe = ({
  titre,
  items,
  ordonnee = false,
  note,
}: SectionListeProps) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="text-xs">
      <p className="font-medium text-foreground">{titre} :</p>
      {ordonnee ? (
        <ol className="mt-0.5 list-decimal space-y-0.5 pl-4 text-muted-foreground">
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ol>
      ) : (
        <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-muted-foreground">
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}
      {note && (
        <p className="mt-0.5 text-[11px] italic text-muted-foreground">{note}</p>
      )}
    </div>
  );
};

export default SectionListe;
