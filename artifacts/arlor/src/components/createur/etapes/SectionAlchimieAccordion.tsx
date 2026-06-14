import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { BadgeAcquis } from "@/components/createur/BadgeAcquis";
import { LabelAjoutAnnulable } from "@/components/createur/LabelAjoutAnnulable";
import { PastilleCout } from "@/components/createur/artisanat/PastilleCout";
import { PastilleType } from "@/components/shared/PastilleType";
import FiltreTypeMagie from "@/components/createur/magie/FiltreTypeMagie";
import type { Database } from "@/integrations/supabase/types";
import {
  parseIngredientsRecette,
  formaterComposant,
  parseRecetteVerbatim,
} from "@/utils/alchimie";
import { RecetteSections } from "@/components/shared/RecetteSections";

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
  /**
   * PR-C2 : prédicat de scellement campagne d'une recette (acquise dans la
   * dernière photo de compo → désachat verrouillé). Fourni par le parent qui
   * détient le mode campagne + la photo. Absent → jamais scellé.
   */
  estRecetteScellee?: (recetteId: string) => boolean;
  /**
   * PR-C2.1 : en mode campagne, les ajouts annulables passent au vert pour
   * se distinguer du scellé or (hors campagne, l'acquis garde le fond doré
   * `primary` historique).
   */
  modeCampagne?: boolean;
  /**
   * L2 (Lot B, s183) : ouvre une bulle d'aide au tap sur la PastilleCout.
   * Fourni par la page (useTapBulle.montrer). Absent → pastille non tappable.
   */
  montrerAide?: (aide: { titre: string; texte: string }) => void;
}

const NIVEAU_LABEL: Record<number, string> = {
  1: "Mineures",
  2: "Intermédiaires",
  3: "Majeures",
};

/** Types de recettes d'alchimie pour le filtre partagé FiltreTypeMagie
 * (mêmes couleurs que PastilleType : potion = vert, poison = rouge). */
const TYPES_ALCHIMIE = [
  { type: "potion", libelle: "Potions", couleur: "hsl(142 55% 48%)" },
  { type: "poison", libelle: "Poisons", couleur: "hsl(0 65% 55%)" },
];

/** Bascule une valeur dans un Set (renvoie un nouveau Set). */
function toggleSet<T>(set: Set<T>, val: T): Set<T> {
  const next = new Set(set);
  if (next.has(val)) next.delete(val);
  else next.add(val);
  return next;
}

/** Fiche détaillée d'une recette : Formule / Ingrédients / Manipulations / Effet / Durée. */
function FicheRecette({ recette }: { recette: RecetteRow }) {
  const sections = parseRecetteVerbatim(recette.description_verbatim);
  if (sections) {
    return (
      <div className="border-l-[3px] border-l-primary px-3.5 py-2.5">
        <RecetteSections data={sections} />
      </div>
    );
  }
  // Fallback colonnes : verbatim absent ou non conforme.
  const { composants, manipulations } = parseIngredientsRecette(
    recette.ingredients,
  );
  return (
    <div className="border-l-[3px] border-l-primary px-3.5 py-2.5 text-xs">
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
  estRecetteScellee,
  modeCampagne = false,
  montrerAide,
}: SectionAlchimieAccordionProps) => {
  // Par défaut : tout replié à l'arrivée sur l'étape (niveaux + fiches). Le
  // filtre par type démarre à « Tous » (null) pour chaque niveau.
  const [niveauxOuverts, setNiveauxOuverts] = useState<Set<number>>(
    () => new Set(),
  );
  const [fichesOuvertes, setFichesOuvertes] = useState<Set<string>>(
    () => new Set(),
  );
  const [filtreParNiveau, setFiltreParNiveau] = useState<
    Record<number, string | null>
  >({});

  const niveauxDisponibles = [1, 2, 3].filter((n) => n <= niveauAlchimie);

  return (
    <div className="flex flex-col gap-3">
      {niveauxDisponibles.map((niveau) => {
        const recettesNiveau = recettes.filter(
          (r) => r.niveau_requis === niveau,
        );
        if (recettesNiveau.length === 0) return null;

        const label = NIVEAU_LABEL[niveau] ?? `Niveau ${niveau}`;
        const quota = quotaParNiveau[niveau] ?? { total: 0, utilises: 0 };
        const quotaRestant = Math.max(0, quota.total - quota.utilises);
        const niveauOuvert = niveauxOuverts.has(niveau);
        const filtre = filtreParNiveau[niveau] ?? null;

        const compteParType: Record<string, number> = {
          potion: recettesNiveau.filter((r) => r.type === "potion").length,
          poison: recettesNiveau.filter((r) => r.type === "poison").length,
        };
        const recettesVisibles = filtre
          ? recettesNiveau.filter((r) => r.type === filtre)
          : recettesNiveau;

        return (
          <div
            key={niveau}
            className="overflow-hidden rounded-lg border bg-card"
          >
            <button
              type="button"
              onClick={() => setNiveauxOuverts((s) => toggleSet(s, niveau))}
              className="flex w-full flex-wrap items-center gap-2 px-3.5 py-3 text-left"
            >
              <ChevronRight
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${niveauOuvert ? "rotate-90" : ""}`}
              />
              <span className="flex-1 font-heading text-base font-semibold text-foreground">
                Recettes {label}
              </span>
              <span
                className={`whitespace-nowrap rounded-full border px-2 py-px text-[10.5px] font-bold ${
                  quotaRestant > 0
                    ? "border-primary/50 text-primary"
                    : "border-amber-400/50 text-amber-400"
                }`}
              >
                {quota.utilises}/{quota.total} gratuites
              </span>
            </button>

            {niveauOuvert && (
              <div>
                <FiltreTypeMagie
                  compteParType={compteParType}
                  total={recettesNiveau.length}
                  filtre={filtre}
                  onFiltre={(f) =>
                    setFiltreParNiveau((m) => ({ ...m, [niveau]: f }))
                  }
                  typesConnus={TYPES_ALCHIMIE}
                />

                <div className="pb-1">
                  {recettesVisibles.map((recette) => {
                    const acquise = recettesAcquisesParRecetteId.get(
                      recette.id,
                    );
                    const estAcquise = !!acquise;
                    const estGratuite = acquise?.est_gratuit ?? false;
                    const quotaRestantNiveau = getQuotaRestantPourNiveau(
                      recette.niveau_requis ?? 0,
                    );
                    const seraGratuite = !estAcquise && quotaRestantNiveau > 0;
                    const gratuite = estAcquise ? estGratuite : seraGratuite;
                    const xpInsuffisants =
                      !seraGratuite &&
                      !estAcquise &&
                      coutSupplementaire > xpDisponible;
                    const scellee = estRecetteScellee?.(recette.id) ?? false;
                    const ficheOuverte = fichesOuvertes.has(recette.id);

                    return (
                      <div
                        key={recette.id}
                        className={`border-t border-border transition-colors ${
                          scellee
                            ? "border-l-4 border-l-gold bg-gold/15"
                            : estAcquise
                              ? modeCampagne
                                ? "border-l-[3px] border-l-emerald-600/60 bg-emerald-600/10"
                                : "bg-primary/5"
                              : ""
                        }`}
                      >
                        {/* Ligne de repli (toujours visible) */}
                        <div
                          onClick={() =>
                            setFichesOuvertes((s) => toggleSet(s, recette.id))
                          }
                          className="flex cursor-pointer items-start gap-2 px-3 py-2.5"
                        >
                          <ChevronRight
                            className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${ficheOuverte ? "rotate-90" : ""}`}
                          />
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                            <strong className="font-heading text-sm text-primary">
                              {recette.nom}
                            </strong>
                            <PastilleType type={recette.type} />
                            <PastilleCout
                              gratuit={gratuite}
                              xp={coutSupplementaire}
                              onAide={montrerAide}
                            />
                            {scellee && <BadgeAcquis />}
                            {!scellee && estAcquise && modeCampagne && (
                              <LabelAjoutAnnulable />
                            )}
                          </div>
                          <label
                            onClick={(e) => e.stopPropagation()}
                            className={`flex shrink-0 items-center ${xpInsuffisants ? "opacity-50" : ""}`}
                            title={
                              xpInsuffisants
                                ? `XP insuffisants (manque ${coutSupplementaire - xpDisponible} XP)`
                                : undefined
                            }
                          >
                            <Checkbox
                              checked={estAcquise}
                              disabled={
                                mutationsPending || xpInsuffisants || scellee
                              }
                              onCheckedChange={() => onToggle(recette, acquise)}
                              aria-label={`Sélectionner ${recette.nom ?? "la recette"}`}
                            />
                          </label>
                        </div>

                        {/* Glance (replié) — clic ouvre aussi la fiche */}
                        {!ficheOuverte && recette.description && (
                          <p
                            onClick={() =>
                              setFichesOuvertes((s) =>
                                toggleSet(s, recette.id),
                              )
                            }
                            className="cursor-pointer px-3 pb-2.5 pl-[34px] text-xs leading-snug text-muted-foreground"
                          >
                            {recette.description}
                          </p>
                        )}

                        {ficheOuverte && <FicheRecette recette={recette} />}
                      </div>
                    );
                  })}
                  {recettesVisibles.length === 0 && (
                    <p className="px-3 py-2.5 text-sm text-muted-foreground">
                      Aucune recette de ce type à ce niveau.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SectionAlchimieAccordion;
