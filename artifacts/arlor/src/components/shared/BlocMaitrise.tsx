// Brique partagée Lot B — bloc Maîtrise ⭐ TOUJOURS visible. Encadré or si
// débloqué (niveauRunes >= 3) ; grisé + 🔒 sinon (décision verrouillée s161 :
// futurs paliers jamais masqués). Réutilisé par É8 (assemblages) et fiche perso.

interface BlocMaitriseProps {
  effetMaitrise: string | null;
  coutPsMaitrise: number | null;
  debloque: boolean;
}

export const BlocMaitrise = ({
  effetMaitrise,
  coutPsMaitrise,
  debloque,
}: BlocMaitriseProps) => {
  if (!effetMaitrise) return null;
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 ${
        debloque
          ? "border-gold/45 bg-gold/10"
          : "border-border bg-muted/30 opacity-60"
      }`}
    >
      <p
        className={`mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${
          debloque ? "text-gold" : "text-muted-foreground"
        }`}
      >
        <span aria-hidden>⭐</span> Maîtrise
        {coutPsMaitrise != null && (
          <span className="font-normal normal-case">({coutPsMaitrise} PS)</span>
        )}
        {!debloque && (
          <span aria-hidden title="Nécessite Assemblage de Runes niveau 3">
            🔒
          </span>
        )}
      </p>
      <p className="whitespace-pre-line text-[12.5px] leading-snug text-foreground">
        {effetMaitrise}
      </p>
    </div>
  );
};

export default BlocMaitrise;
