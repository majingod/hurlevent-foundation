import { useState } from "react";
import type { PalierSort } from "@/utils/calculsMagie";

/**
 * Bloc « Effets par palier » — règle d'état générique pilotée par niveauActif :
 *   - dernier palier atteint (max niveau ≤ niveauActif) = surligné or + pastille ACTIF
 *   - paliers atteints inférieurs = rendu normal (PAS grisés)
 *   - paliers futurs (niveau > niveauActif) = grisés visibles + mention « à venir »
 *   - niveauActif null (encyclopédie / carte non sélectionnée) = tous neutres
 * `libelle` est verbatim Manuel, affiché tel quel sans reformatage.
 */
export const BlocPaliers = ({
  paliers,
  niveauActif,
}: {
  paliers?: PalierSort[] | null;
  niveauActif?: number | null;
}) => {
  if (!paliers || paliers.length === 0) return null;

  // Dernier palier atteint = plus haut niveau parmi ceux ≤ niveauActif.
  const niveauDernierAtteint =
    niveauActif == null
      ? null
      : paliers.reduce<number | null>(
          (acc, p) =>
            p.niveau <= niveauActif ? Math.max(acc ?? p.niveau, p.niveau) : acc,
          null,
        );

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Effets par palier
      </p>
      {paliers.map((p, i) => {
        const futur = niveauActif != null && p.niveau > niveauActif;
        const actif = niveauActif != null && p.niveau === niveauDernierAtteint;
        return (
          <div
            key={i}
            className={`rounded-md border p-2.5 text-sm ${
              actif
                ? "border-primary bg-primary/10"
                : futur
                  ? "border-border opacity-45"
                  : "border-border"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{p.libelle}</span>
              {actif && (
                <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                  Actif
                </span>
              )}
              {futur && (
                <span className="shrink-0 text-xs italic text-muted-foreground">
                  à venir
                </span>
              )}
            </div>
            <p className="mt-0.5 whitespace-pre-line text-muted-foreground">
              {p.texte}
            </p>
          </div>
        );
      })}
    </div>
  );
};

/** Variante C (s161) : palier actif + dépliable vers la liste complète.
 *  Affiché sous le slider niveau du ConstructeurMagie. */
export const PaliersDepliable = ({
  paliers,
  niveau,
}: {
  paliers?: PalierSort[] | null;
  niveau: number;
}) => {
  const [tout, setTout] = useState(false);
  if (!paliers || paliers.length === 0) return null;

  const atteints = paliers.filter((p) => p.niveau <= niveau);
  const actif = atteints.length ? atteints[atteints.length - 1] : null;
  const prochain = paliers.find((p) => p.niveau > niveau);
  const autres = paliers.length - (actif ? 1 : 0);

  if (tout) {
    return (
      <div className="space-y-1.5">
        <BlocPaliers paliers={paliers} niveauActif={niveau} />
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={(e) => { e.stopPropagation(); setTout(false); }}
        >
          Réduire au palier actif
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {actif ? (
        <div className="rounded-md border border-primary bg-primary/10 p-2.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">{actif.libelle}</span>
            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
              Actif
            </span>
          </div>
          <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{actif.texte}</p>
          {prochain && (
            <p className="mt-1 text-xs text-muted-foreground">
              Prochain palier : {prochain.libelle}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-md border p-2.5 text-sm text-muted-foreground">
          Aucun palier atteint au niveau {niveau} (premier palier : {paliers[0].libelle}).
        </div>
      )}
      {autres > 0 && (
        <button
          type="button"
          className="text-xs text-primary underline-offset-2 hover:underline"
          onClick={(e) => { e.stopPropagation(); setTout(true); }}
        >
          Voir les {autres} autres paliers
        </button>
      )}
    </div>
  );
};

