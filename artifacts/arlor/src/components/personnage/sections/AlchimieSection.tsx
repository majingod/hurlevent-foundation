import { parseIngredientsRecette, formaterComposant } from "@/utils/alchimie";
import {
  useManuelDisclosure,
  ManuelGlobalSwitch,
} from "@/components/shared/ToggleManuel";
import { AlchimieVerbatim } from "@/components/shared/AlchimieVerbatim";
import type { ArtisanatEtat, Recette, ManipulationAlchimique } from "./types";

interface AlchimieSectionProps {
  artisanatEtat: ArtisanatEtat | null | undefined;
  recettes: Recette[] | undefined;
  manipulations: ManipulationAlchimique[] | undefined;
}

export const AlchimieSection = ({
  artisanatEtat,
  recettes,
  manipulations,
}: AlchimieSectionProps) => {
  // DETTE-MANIPULATIONS-ALCHIMIQUES-ECRAN — filtre par niveau acquis
  const niveauAlchimieEcran = artisanatEtat?.niveau_alchimie ?? 0;
  const manipulationsFiltrees = (manipulations ?? []).filter(
    (m) => (m.niveau ?? 0) <= niveauAlchimieEcran
  );

  // Divulgation progressive du verbatim manuel (Option A + Option B globale).
  const { isManuelOpen, toggleManuel, isAllOpen, toggleAll } =
    useManuelDisclosure();
  const recetteIds = (recettes ?? [])
    .filter((r) => r.description_verbatim)
    .map((r) => r.id);

  return niveauAlchimieEcran < 1 ? (
    <p className="text-center py-8 text-muted-foreground">Aucune compétence en alchimie.</p>
  ) : (!recettes || recettes.length === 0) && manipulationsFiltrees.length === 0 ? (
    <p className="text-center py-8 text-muted-foreground">Aucune recette ni manipulation acquise.</p>
  ) : (
    <div className="space-y-4">
      {recettes && recettes.length > 0 && (
        <>
          <div className="text-xs text-muted-foreground border-b border-border/50 pb-2">
            Total : {recettes.length} recette{recettes.length > 1 ? "s" : ""}
            {[1, 2, 3].map((n) => {
              const count = recettes.filter((r) => r.niveau_requis === n).length;
              const label = n === 1 ? "mineures" : n === 2 ? "intermédiaires" : "majeures";
              return count > 0 ? ` • ${count} ${label}` : "";
            }).join("")}
          </div>
          {recetteIds.length > 0 && (
            <ManuelGlobalSwitch
              allOpen={isAllOpen(recetteIds)}
              onToggle={() => toggleAll(recetteIds)}
              subtitle="Affiche le verbatim sur toutes les recettes"
            />
          )}
          {[1, 2, 3].map((n) => {
            const recettesNiveau = recettes.filter((r) => r.niveau_requis === n);
            if (recettesNiveau.length === 0) return null;
            const label = n === 1 ? "Mineures" : n === 2 ? "Intermédiaires" : "Majeures";
            return (
              <div key={n} className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {label} (Niv. {n}) — {recettesNiveau.length}
                </h3>
                <div className="space-y-2">
                  {recettesNiveau.map((recette) => {
                    const { composants, manipulations } = parseIngredientsRecette(recette.ingredients);
                    return (
                    <div key={recette.id} className="p-2 rounded border border-border/50 text-sm space-y-1">
                      <p className="font-medium text-foreground">{recette.nom}</p>
                      <p className="text-xs text-muted-foreground">{recette.type}</p>
                      {recette.effet && <p className="text-xs text-muted-foreground"><strong>Effet :</strong> {recette.effet}</p>}
                      {recette.formule && <p className="text-xs text-muted-foreground"><strong>Formule :</strong> {recette.formule}</p>}
                      {composants.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          <strong>Ingrédients :</strong> {composants.map(formaterComposant).join(" · ")}
                        </p>
                      )}
                      {manipulations.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <strong>Préparation :</strong>
                          <ol className="list-decimal list-inside mt-0.5 space-y-0.5">
                            {manipulations.map((etape, i) => (
                              <li key={i}>{etape}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {recette.description && <p className="text-xs text-muted-foreground italic">{recette.description}</p>}
                      <AlchimieVerbatim
                        verbatim={recette.description_verbatim}
                        isManuelOpen={isManuelOpen(recette.id)}
                        onToggleManuel={() => toggleManuel(recette.id)}
                      />
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
      {manipulationsFiltrees.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            Manipulations alchimiques — {manipulationsFiltrees.length}
          </h3>
          <div className="space-y-2">
            {manipulationsFiltrees.map((m) => (
              <div key={m.id} className="p-2 rounded border border-border/50 text-sm">
                <p className="font-medium text-foreground">{m.nom}</p>
                {m.manipulations && (
                  <p className="text-xs text-muted-foreground mt-1">{m.manipulations}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AlchimieSection;
