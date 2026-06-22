import {
  rendreEffetInstance,
  type EffetInstance,
  type PalierSort,
  type SegmentEffet,
} from "@/utils/calculsMagie";

// Effet calculé live (spec s171) : encadré or « ✦ Effet au niveau N » à
// l'achat, variante AvantApres en modification (AVANT grisé au niveau actuel
// → ↓ → APRÈS or au niveau du curseur ; encadré simple si niveau inchangé).
// S'appuie sur rendreEffetInstance (effet_instance + paliers, s162).

const Segments = ({ segments }: { segments: SegmentEffet[] }) => (
  <>
    {segments.map((s, i) =>
      s.fort ? (
        <strong key={i} className="text-gold">
          {s.texte}
        </strong>
      ) : (
        <span key={i}>{s.texte}</span>
      ),
    )}
  </>
);

interface ApercuEffetProps {
  effet: EffetInstance | null | undefined;
  paliers?: PalierSort[] | null;
  niveau: number;
}

export const ApercuEffet = ({ effet, paliers, niveau }: ApercuEffetProps) => {
  const segments = rendreEffetInstance(effet, paliers, niveau);
  if (!segments) return null;
  return (
    <div className="rounded-lg border border-gold/45 bg-gold/10 px-2.5 py-2">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gold">
        ✦ Effet au niveau {niveau}
      </p>
      <p className="text-[13px] leading-snug text-foreground">
        <Segments segments={segments} />
      </p>
    </div>
  );
};

interface AvantApresProps {
  effet: EffetInstance | null | undefined;
  paliers?: PalierSort[] | null;
  niveauAvant: number;
  niveauApres: number;
}

export const AvantApres = ({
  effet,
  paliers,
  niveauAvant,
  niveauApres,
}: AvantApresProps) => {
  const avant = rendreEffetInstance(effet, paliers, niveauAvant);
  const apres = rendreEffetInstance(effet, paliers, niveauApres);
  if (!avant && !apres) return null;
  if (niveauAvant === niveauApres) {
    return <ApercuEffet effet={effet} paliers={paliers} niveau={niveauApres} />;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="rounded-lg border border-border px-2.5 py-2 opacity-70">
        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Effet actuel — niveau {niveauAvant}
        </p>
        <p className="text-xs leading-snug text-muted-foreground">
          {avant ? (
            <Segments segments={avant.map((s) => ({ ...s, fort: false }))} />
          ) : (
            "—"
          )}
        </p>
      </div>
      <div className="text-center text-xs leading-none text-gold" aria-hidden>
        ↓
      </div>
      <div className="rounded-lg border border-gold/50 bg-gold/10 px-2.5 py-2">
        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
          ✦ Effet après — niveau {niveauApres}
        </p>
        <p className="text-[13px] leading-snug text-foreground">
          {apres ? <Segments segments={apres} /> : "—"}
        </p>
      </div>
    </div>
  );
};
