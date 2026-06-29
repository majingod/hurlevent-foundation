import { BookOpen, ChevronRight, Crown, Sparkles, User, X } from "lucide-react";

/**
 * Détails d'une religion, architecture double couche.
 * - Couche FICHE (curée) : symbole, dirigeant/fondateur, lore_fiche, rituels_fiche — toujours visible.
 * - Couche MANUEL (verbatim) : lore_manuel + rituels_manuel — dépliée par le bouton « Texte du manuel ».
 * Composant CONTRÔLÉ : l'état d'ouverture du manuel est porté par le parent
 * (réutilise useManuelDisclosure / ManuelGlobalSwitch, ou un simple useState booléen).
 */
export interface ReligionDetailsReligion {
  id: string;
  nom?: string | null;
  dirigeant?: string | null;
  fondateur?: string | null;
  symbole_sacre?: string | null;
  pouvoir_symbole?: string | null;
  domaines_principaux?: string[] | null;
  domaines_proscrits?: string[] | null;
  lore_fiche?: string | null;
  rituels_fiche?: string[] | null;
  lore_manuel?: string | null;
  rituels_manuel?: string[] | null;
}

interface ReligionDetailsProps {
  religion: ReligionDetailsReligion;
  isManuelOpen: boolean;
  onToggleManuel: () => void;
  /** Masque les domaines (déjà affichés dans l'en-tête de la surface, ex. encyclopédie) */
  hideDomaines?: boolean;
  /** Masque le bouton interne « Texte du manuel » (l'ouverture est pilotée par le parent, ex. toggle global encyclo) */
  hideManuelButton?: boolean;
}

export function ReligionDetails({
  religion,
  isManuelOpen,
  onToggleManuel,
  hideDomaines = false,
  hideManuelButton = false,
}: ReligionDetailsProps) {
  const rituelsFiche = religion.rituels_fiche ?? [];
  const rituelsManuel = religion.rituels_manuel ?? [];
  const domPrincipaux = religion.domaines_principaux ?? [];
  const domProscrits = religion.domaines_proscrits ?? [];
  const aManuel = !!religion.lore_manuel || rituelsManuel.length > 0;

  return (
    <div className="space-y-4">
      {/* Domaines */}
      {!hideDomaines && (domPrincipaux.length > 0 || domProscrits.length > 0) && (
        <div className="space-y-2">
          {domPrincipaux.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {domPrincipaux.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center rounded-full border border-green-700 bg-green-900/50 px-2 py-1 text-xs font-medium text-green-300"
                >
                  {d}
                </span>
              ))}
            </div>
          )}
          {domProscrits.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {domProscrits.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center rounded-full border border-red-700 bg-red-900/40 px-2 py-1 text-xs font-medium text-red-400"
                >
                  <X size={11} className="mr-1" /> {d}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Symbole sacré */}
      {(religion.symbole_sacre || religion.pouvoir_symbole) && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-gold">
            <Sparkles size={16} />
            <h4 className="text-sm font-bold uppercase">Symbole sacré</h4>
          </div>
          <div className="rounded-md border border-border bg-background/40 p-3">
            {religion.symbole_sacre && (
              <p className="text-sm font-semibold text-foreground">{religion.symbole_sacre}</p>
            )}
            {religion.pouvoir_symbole && (
              <p className="mt-1 text-xs text-muted-foreground">{religion.pouvoir_symbole}</p>
            )}
          </div>
        </div>
      )}

      {/* Dirigeant / Fondateur */}
      {(religion.dirigeant || religion.fondateur) && (
        <div className="grid grid-cols-2 gap-4">
          {religion.dirigeant && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-gold">
                <Crown size={14} />
                <h4 className="text-[10px] font-bold uppercase">Dirigeant</h4>
              </div>
              <p className="text-xs text-foreground/80">{religion.dirigeant}</p>
            </div>
          )}
          {religion.fondateur && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-gold">
                <User size={14} />
                <h4 className="text-[10px] font-bold uppercase">Fondateur</h4>
              </div>
              <p className="text-xs text-foreground/80">{religion.fondateur}</p>
            </div>
          )}
        </div>
      )}

      {/* Couche FICHE — lore */}
      {religion.lore_fiche && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gold">
            <BookOpen size={16} />
            <h4 className="text-sm font-bold uppercase">Description</h4>
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">
            {religion.lore_fiche}
          </p>
        </div>
      )}

      {/* Couche FICHE — rituels */}
      {rituelsFiche.length > 0 && (
        <div className="space-y-2 rounded-lg border border-gold/10 bg-gold/5 p-4">
          <h4 className="text-center text-xs font-bold uppercase tracking-tight text-gold">
            Rituels &amp; habitudes
          </h4>
          <ul className="list-disc space-y-1 pl-5">
            {rituelsFiche.map((r, i) => (
              <li key={i} className="text-sm leading-relaxed text-foreground/80">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bouton + couche MANUEL (verbatim) */}
      {aManuel && (
        <div>
          {!hideManuelButton && (
          <button
            type="button"
            onClick={onToggleManuel}
            aria-expanded={isManuelOpen}
            className="flex w-full items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-sm text-gold transition-colors hover:bg-background/70"
          >
            <BookOpen size={15} className="flex-shrink-0" />
            <span>Texte du manuel</span>
            <ChevronRight
              size={15}
              className={`ml-auto transition-transform ${isManuelOpen ? "rotate-90" : ""}`}
            />
          </button>
          )}
          {isManuelOpen && (
            <div className="mt-2 space-y-3 rounded-md border border-l-2 border-border border-l-gold bg-background/30 p-3">
              <p className="text-[0.65rem] uppercase tracking-wide text-gold">
                Verbatim — Manuel des règles 2026
              </p>
              {religion.lore_manuel && (
                <p className="whitespace-pre-line text-sm text-foreground/80">{religion.lore_manuel}</p>
              )}
              {rituelsManuel.length > 0 && (
                <ul className="list-disc space-y-1 pl-5">
                  {rituelsManuel.map((r, i) => (
                    <li key={i} className="whitespace-pre-line text-sm text-foreground/80">
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReligionDetails;
