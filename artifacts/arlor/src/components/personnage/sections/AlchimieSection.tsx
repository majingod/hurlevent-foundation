import {
  parseIngredientsRecette,
  formaterComposant,
  parseRecetteVerbatim,
} from "@/utils/alchimie";
import { RecetteSections } from "@/components/shared/RecetteSections";
import { useModeAffichage } from "@/contexts/ModeAffichageContext";
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
  // Patron canon abrégé ⇄ intégral (s299) : en abrégé, resume_condense en
  // paragraphe simple ; en intégral, rendu verbatim actuel. Le teaser
  // recette.description n'est plus affiché.
  const { mode } = useModeAffichage();
  // DETTE-MANIPULATIONS-ALCHIMIQUES-ECRAN — filtre par niveau acquis
  const niveauAlchimieEcran = artisanatEtat?.niveau_alchimie ?? 0;
  const manipulationsFiltrees = (manipulations ?? []).filter(
    (m) => (m.niveau ?? 0) <= niveauAlchimieEcran
  );

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
                    const sections = parseRecetteVerbatim(recette.description_verbatim);
                    return (
                    <div key={recette.id} className="p-2 rounded border border-border/50 text-sm space-y-1">
                      <p className="font-medium text-foreground">{recette.nom}</p>
                      <p className="text-xs text-muted-foreground">{recette.type}</p>
                      {mode === "abrege" ? (
                        <p className="text-xs text-muted-foreground whitespace-pre-line">{recette.resume_condense}</p>
                      ) : sections ? (
                        <RecetteSections data={sections} />
                      ) : (
                        <>
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
                        </>
                      )}
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
