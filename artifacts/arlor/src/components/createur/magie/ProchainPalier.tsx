import { calculerCoutXP, type PalierSort } from "@/utils/calculsMagie";

// I3 — Prochain palier suggéré (spec s171) : encadré pointillé « Prochain
// palier : Niv. X — texte » + bouton « Passer au niv X · +Y XP » qui ajuste
// le curseur de niveau. Si le palier dépasse le plafond du cercle/domaine :
// grisé non cliquable + mention « montez d'abord le niveau du cercle ».

interface ProchainPalierProps {
  type?: "sort" | "priere";
  paliers?: PalierSort[] | null;
  /** Plafond du cercle (sort) / domaine (prière). */
  niveauMax: number;
  valeurs: { zone: string; portee: string; duree: string; niveau: number };
  coutXpBase: number;
  /** Callback : positionne le curseur de niveau sur le palier suggéré. */
  onNiveau: (niveau: number) => void;
}

const ProchainPalier = ({
  type = "sort",
  paliers,
  niveauMax,
  valeurs,
  coutXpBase,
  onNiveau,
}: ProchainPalierProps) => {
  if (!paliers || paliers.length === 0) return null;
  const prochain = paliers
    .slice()
    .sort((a, b) => a.niveau - b.niveau)
    .find((p) => p.niveau > valeurs.niveau);
  if (!prochain) return null;

  const horsPlafond = prochain.niveau > niveauMax;
  const complet = !!valeurs.zone && !!valeurs.portee && !!valeurs.duree;
  const delta =
    complet && !horsPlafond
      ? calculerCoutXP(
          valeurs.zone,
          valeurs.portee,
          valeurs.duree,
          prochain.niveau,
          coutXpBase,
        ) -
        calculerCoutXP(
          valeurs.zone,
          valeurs.portee,
          valeurs.duree,
          valeurs.niveau,
          coutXpBase,
        )
      : null;

  return (
    <div
      className={`rounded-lg border border-dashed px-2.5 py-2 text-xs ${
        horsPlafond ? "border-border opacity-65" : "border-primary/50"
      }`}
    >
      <span className={horsPlafond ? "text-muted-foreground" : "text-foreground"}>
        <strong className={horsPlafond ? "text-muted-foreground" : "text-primary"}>
          Prochain palier : {prochain.libelle}
        </strong>{" "}
        — {prochain.texte}
      </span>
      {horsPlafond ? (
        <p className="mt-1 text-[11px] italic text-muted-foreground">
          Au-delà du plafond actuel (
          {type === "sort" ? "cercle" : "domaine"} ≤ niv {niveauMax}) — montez
          d'abord le niveau du {type === "sort" ? "cercle" : "domaine"}.
        </p>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNiveau(prochain.niveau);
          }}
          className="mt-1.5 block rounded-md border border-primary/60 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
        >
          Passer au niv {prochain.niveau}
          {delta !== null && ` · ${delta >= 0 ? "+" : "−"}${Math.abs(delta)} XP`}
        </button>
      )}
    </div>
  );
};

export default ProchainPalier;
