import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Database } from "@/integrations/supabase/types";
import { parseIngredientsRecette, formaterComposant } from "@/utils/alchimie";

type RecetteRow = Database["public"]["Tables"]["recettes_alchimie"]["Row"];
type PersonnageRecetteRow =
  Database["public"]["Tables"]["personnage_recettes"]["Row"];

export interface QuotaNiveauAlchimie {
  total: number;
  utilises: number;
}

interface SectionAlchimieAccordionProps {
  niveauAlchimie: number;
  recettes: RecetteRow[];
  recettesAcquisesParRecetteId: Map<string, PersonnageRecetteRow>;
  quotaParNiveau: Record<number, QuotaNiveauAlchimie>;
  getQuotaRestantPourNiveau: (niveau: number) => number;
  xpDisponible: number;
  coutSupplementaire: number;
  mutationsPending: boolean;
  onToggle: (
    recette: RecetteRow,
    acquise: PersonnageRecetteRow | undefined,
  ) => void;
}

const NIVEAU_LABEL: Record<number, string> = {
  1: "Mineures",
  2: "Intermédiaires",
  3: "Majeures",
};

/** Bascule une valeur dans un Set (renvoie un nouveau Set). */
function toggleSet<T>(set: Set<T>, val: T): Set<T> {
  const next = new Set(set);
  if (next.has(val)) next.delete(val);
  else next.add(val);
  return next;
}

/** Pastille de coût : verte « Gratuite » ou bordeaux « N XP » (valeurs HSL maquette). */
function PastilleCout({ gratuite, cout }: { gratuite: boolean; cout: number }) {
  const style = gratuite
    ? {
        background: "hsl(150 45% 45% / 0.18)",
        color: "hsl(150 45% 45%)",
        border: "1px solid hsl(150 45% 45% / 0.4)",
      }
    : {
        background: "hsl(348 55% 27%)",
        color: "hsl(36 33% 93%)",
        border: "1px solid hsl(348 55% 27%)",
      };
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-semibold"
      style={style}
    >
      {gratuite ? "Gratuite" : `${cout} XP`}
    </span>
  );
}

/** Fiche détaillée d'une recette : Formule / Ingrédients / Manipulations / Effet / Durée. */
function FicheRecette({ recette }: { recette: RecetteRow }) {
  const { composants, manipulations } = parseIngredientsRecette(
    recette.ingredients,
  );
  return (
    <div className="border-t border-border/60 px-3.5 py-2.5 text-xs">
      {recette.formule && (
        <p className="mb-2">
          <span className="font-semibold text-primary">Formule : </span>
          <em className="text-muted-foreground">{recette.formule}</em>
        </p>
      )}
      {composants.length > 0 && (
        <div className="mb-2">
          <span className="font-semibold text-primary">Ingrédients :</span>
          <ul className="mt-1 list-disc pl-5 text-foreground">
            {composants.map((c, i) => (
              <li key={i} className="mb-0.5">
                {formaterComposant(c)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {manipulations.length > 0 && (
        <div className="mb-2">
          <span className="font-semibold text-primary">Manipulations :</span>
          <ol className="mt-1 list-decimal pl-5 text-foreground">
            {manipulations.map((m, i) => (
              <li key={i} className="mb-0.5">
                {m}
              </li>
            ))}
          </ol>
        </div>
      )}
      {recette.effet && (
        <p className="mb-2">
          <span className="font-semibold text-primary">Effet : </span>
          <span className="text-foreground">{recette.effet}</span>
        </p>
      )}
      {recette.duree && (
        <p className="mb-2">
          <span className="font-semibold text-primary">Durée : </span>
          <span className="text-foreground">{recette.duree}</span>
        </p>
      )}
    </div>
  );
}

export const SectionAlchimieAccordion = ({
  niveauAlchimie,
  recettes,
  recettesAcquisesParRecetteId,
  quotaParNiveau,
  getQuotaRestantPourNiveau,
  xpDisponible,
  coutSupplementaire,
  mutationsPending,
  onToggle,
}: SectionAlchimieAccordionProps) => {
  // Par défaut : tout replié à l'arrivée sur l'étape (niveaux, types et
  // fiches). Le joueur déplie à la demande.
  const [niveauxOuverts, setNiveauxOuverts] = useState<Set<number>>(
    () => new Set(),
  );
  const [groupesOuverts, setGroupesOuverts] = useState<Set<string>>(
    () => new Set(),
  );
  const [fichesOuvertes, setFichesOuvertes] = useState<Set<string>>(
    () => new Set(),
  );

  const niveauxDisponibles = [1, 2, 3].filter((n) => n <= niveauAlchimie);

  return (
    <div className="flex flex-col gap-3">
      {niveauxDisponibles.map((niveau) => {
        const recettesNiveau = recettes.filter(
          (r) => r.niveau_requis === niveau,
        );
        if (recettesNiveau.length === 0) return null;

        const potions = recettesNiveau.filter((r) => r.type === "potion");
        const poisons = recettesNiveau.filter((r) => r.type === "poison");
        const label = NIVEAU_LABEL[niveau] ?? `Niveau ${niveau}`;
        const quota = quotaParNiveau[niveau] ?? { total: 0, utilises: 0 };
        const niveauOuvert = niveauxOuverts.has(niveau);

        const groupes: { cle: string; titre: string; recettes: RecetteRow[] }[] =
          [
            { cle: `${niveau}-potion`, titre: `Potions ${label}`, recettes: potions },
            { cle: `${niveau}-poison`, titre: `Poisons ${label}`, recettes: poisons },
          ].filter((g) => g.recettes.length > 0);

        return (
          <div
            key={niveau}
            className="overflow-hidden rounded-2xl border border-border bg-[hsl(0_0%_5.5%)]"
          >
            <button
              type="button"
              onClick={() => setNiveauxOuverts((s) => toggleSet(s, niveau))}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <span className="text-base text-primary">
                {niveauOuvert ? "▾" : "▸"}
              </span>
              <h3 className="m-0 flex-1 font-heading text-lg uppercase tracking-wide text-foreground">
                Recettes {label}
              </h3>
              <span className="text-sm text-primary">
                {quota.utilises} / {quota.total} gratuites
              </span>
            </button>

            {niveauOuvert && (
              <div className="flex flex-col gap-2.5 px-3.5 pb-4">
                {groupes.map((groupe) => {
                  const groupeOuvert = groupesOuverts.has(groupe.cle);
                  return (
                    <div
                      key={groupe.cle}
                      className="overflow-hidden rounded-xl border border-border bg-card"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setGroupesOuverts((s) => toggleSet(s, groupe.cle))
                        }
                        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
                      >
                        <span className="text-sm text-primary">
                          {groupeOuvert ? "▾" : "▸"}
                        </span>
                        <span className="flex-1 font-heading text-sm tracking-wide text-primary">
                          {groupe.titre}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {groupe.recettes.length}
                        </span>
                      </button>

                      {groupeOuvert && (
                        <div className="flex flex-col gap-2 px-3 pb-3">
                          {groupe.recettes.map((recette) => {
                            const acquise = recettesAcquisesParRecetteId.get(
                              recette.id,
                            );
                            const estAcquise = !!acquise;
                            const estGratuite = acquise?.est_gratuit ?? false;
                            const quotaRestant = getQuotaRestantPourNiveau(
                              recette.niveau_requis ?? 0,
                            );
                            const seraGratuite = !estAcquise && quotaRestant > 0;
                            const gratuite = estAcquise
                              ? estGratuite
                              : seraGratuite;
                            const xpInsuffisants =
                              !seraGratuite &&
                              !estAcquise &&
                              coutSupplementaire > xpDisponible;
                            const ficheOuverte = fichesOuvertes.has(recette.id);

                            return (
                              <div
                                key={recette.id}
                                className={`overflow-hidden rounded-[10px] border transition-colors ${
                                  estAcquise
                                    ? "border-primary/50 bg-primary/5"
                                    : "border-border bg-card"
                                }`}
                              >
                                <div className="flex items-center gap-3 px-3.5 py-3">
                                  <label
                                    className={`flex shrink-0 items-center ${
                                      xpInsuffisants ? "opacity-50" : ""
                                    }`}
                                    title={
                                      xpInsuffisants
                                        ? `XP insuffisants (manque ${
                                            coutSupplementaire - xpDisponible
                                          } XP)`
                                        : undefined
                                    }
                                  >
                                    <Checkbox
                                      checked={estAcquise}
                                      disabled={
                                        mutationsPending || xpInsuffisants
                                      }
                                      onCheckedChange={() =>
                                        onToggle(recette, acquise)
                                      }
                                      aria-label={`Sélectionner ${recette.nom ?? "la recette"}`}
                                    />
                                  </label>

                                  <div className="min-w-0 flex-1">
                                    <strong className="text-[15px] font-bold text-foreground">
                                      {recette.nom}
                                    </strong>
                                    <div className="mt-2">
                                      <PastilleCout
                                        gratuite={gratuite}
                                        cout={coutSupplementaire}
                                      />
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setFichesOuvertes((s) =>
                                        toggleSet(s, recette.id),
                                      )
                                    }
                                    className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground"
                                    aria-expanded={ficheOuverte}
                                  >
                                    <span
                                      className="inline-block transition-transform duration-150"
                                      style={{
                                        transform: ficheOuverte
                                          ? "rotate(90deg)"
                                          : "none",
                                      }}
                                    >
                                      ❯
                                    </span>
                                    Détails
                                  </button>
                                </div>

                                {ficheOuverte && <FicheRecette recette={recette} />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SectionAlchimieAccordion;
