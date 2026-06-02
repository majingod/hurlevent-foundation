import { useState } from "react";
import { BookOpen, ChevronRight } from "lucide-react";

/**
 * Divulgation progressive « Fiche / Texte du manuel ».
 *
 * - La « Fiche » curée est rendue par le parent (toujours visible).
 * - `ToggleManuel` ajoute, sous chaque carte, un bouton qui déplie le verbatim
 *   exact du Manuel des règles 2026.
 * - `ManuelGlobalSwitch` est un interrupteur global optionnel qui ouvre/ferme
 *   le verbatim sur toutes les cartes d'un coup.
 * - `useManuelDisclosure` centralise l'état (réutilisable par type d'item :
 *   assemblages aujourd'hui, sorts/prières/etc. demain).
 */

// Hook d'état partagé. Sans argument : les ids sont passés au point d'usage
// (toggleAll / isAllOpen), ce qui le rend insensible à l'ordre de rendu.
export function useManuelDisclosure() {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const isManuelOpen = (id: string) => openIds.has(id);

  const toggleManuel = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const isAllOpen = (ids: string[]) => ids.length > 0 && ids.every((id) => openIds.has(id));

  const toggleAll = (ids: string[]) =>
    setOpenIds((prev) => {
      const allOpen = ids.length > 0 && ids.every((id) => prev.has(id));
      return allOpen ? new Set() : new Set(ids);
    });

  return { isManuelOpen, toggleManuel, isAllOpen, toggleAll };
}

// Interrupteur global « Textes du manuel ».
// title/subtitle sont optionnels (défaut = libellé historique des assemblages),
// ce qui permet de l'utiliser en tête de fiche (« Tous les onglets ») et par
// onglet (« Cet onglet ») sans dupliquer le composant.
export function ManuelGlobalSwitch({
  allOpen,
  onToggle,
  title = "Textes du manuel",
  subtitle = "Affiche le verbatim sur toutes les cartes",
}: {
  allOpen: boolean;
  onToggle: () => void;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <BookOpen size={16} className="flex-shrink-0 text-gold" />
        <div className="min-w-0">
          <p className="text-sm text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={allOpen}
        aria-label="Afficher les textes du manuel"
        onClick={onToggle}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
          allOpen ? "bg-[#6b1f2a]" : "bg-muted"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
            allOpen ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

// Divulgation du verbatim manuel pour une carte donnée.
export function ToggleManuel({
  texte,
  isOpen,
  onToggle,
}: {
  texte: string | null | undefined;
  isOpen: boolean;
  onToggle: () => void;
}) {
  if (!texte) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-sm text-gold transition-colors hover:bg-background/70"
      >
        <BookOpen size={15} className="flex-shrink-0" />
        <span>Texte du manuel</span>
        <ChevronRight size={15} className={`ml-auto transition-transform ${isOpen ? "rotate-90" : ""}`} />
      </button>
      {isOpen && (
        <div className="mt-2 rounded-md border border-l-2 border-border border-l-gold bg-background/30 p-3">
          <p className="mb-1.5 text-[0.65rem] uppercase tracking-wide text-gold">Verbatim — Manuel des règles 2026</p>
          <p className="whitespace-pre-line text-sm text-foreground/80">{texte}</p>
        </div>
      )}
    </div>
  );
}
