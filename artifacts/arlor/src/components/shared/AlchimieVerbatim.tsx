import { BookOpen, ChevronRight } from "lucide-react";

/**
 * Divulgation progressive du verbatim alchimie (Manuel des règles 2026).
 *
 * - La couche courte curée (FicheRecette) reste rendue par le parent.
 * - `AlchimieVerbatim` ajoute un bouton « Texte du manuel » qui déplie le
 *   verbatim EXACT, parsé en rendu ENRICHI (labels en or + listes •/1.).
 * - Le paragraphe « labo » des catalyseurs (« La création nécessite … ») est
 *   ISOLÉ de la dernière manipulation en paragraphe distinct.
 * - Composant CONTRÔLÉ (l'état d'ouverture est porté par le parent : réutilise
 *   `useManuelDisclosure` / `ManuelGlobalSwitch` de `ToggleManuel`).
 *
 * Décisions figées s107 : rendu enrichi + labo isolé. Le mono-bloc est stocké
 * dans `recettes_alchimie.description_verbatim` (hors recherche).
 */

type VerbatimBlock =
  | { kind: "field"; label: string; value: string }
  | { kind: "para"; value: string }
  | { kind: "ul"; title: string; items: string[] }
  | { kind: "ol"; title: string; items: string[] };

// Parser déterministe du mono-bloc. Labels Formule/Effet/Durée/Note ; sections
// Ingrédients (•) / Manipulations (1.) ; les lignes sans puce/numéro sont des
// continuations du dernier item. Validé sur les 40 recettes (0 perte).
export function parseVerbatimAlchimie(
  txt: string,
  isolerLabo = true,
): VerbatimBlock[] {
  const lines = txt.split("\n");
  const blocks: VerbatimBlock[] = [];
  let cur: VerbatimBlock | null = null;

  for (const raw of lines) {
    const l = raw.trim();
    if (!l) {
      cur = null;
      continue;
    }
    const field = l.match(/^(Formule|Effet|Durée|Note)\s*:\s*(.*)$/);
    if (field) {
      blocks.push({ kind: "field", label: field[1], value: field[2] });
      cur = null;
      continue;
    }
    if (l === "Ingrédients :") {
      cur = { kind: "ul", title: "Ingrédients", items: [] };
      blocks.push(cur);
      continue;
    }
    if (l === "Manipulations :") {
      cur = { kind: "ol", title: "Manipulations", items: [] };
      blocks.push(cur);
      continue;
    }
    if (l.startsWith("• ")) {
      if (cur && (cur.kind === "ul" || cur.kind === "ol")) {
        cur.items.push(l.slice(2));
      }
      continue;
    }
    const num = l.match(/^(\d+)\.\s+(.*)$/);
    if (num && cur && cur.kind === "ol") {
      cur.items.push(num[2]);
      continue;
    }
    // Continuation : rattacher au dernier item de la liste courante.
    if (cur && (cur.kind === "ul" || cur.kind === "ol") && cur.items.length) {
      cur.items[cur.items.length - 1] += " " + l;
    }
  }

  // Isoler le paragraphe « labo » (catalyseurs) de la dernière manipulation.
  if (isolerLabo) {
    const ol = blocks.find((b) => b.kind === "ol") as
      | Extract<VerbatimBlock, { kind: "ol" }>
      | undefined;
    if (ol && ol.items.length) {
      const last = ol.items[ol.items.length - 1];
      const idx = last.indexOf("La création nécessite");
      if (idx > 0) {
        ol.items[ol.items.length - 1] = last.slice(0, idx).trim();
        const labo = last.slice(idx).trim();
        const olPos = blocks.indexOf(ol);
        blocks.splice(olPos + 1, 0, { kind: "para", value: labo });
      }
    }
  }

  return blocks;
}

interface AlchimieVerbatimProps {
  verbatim: string | null | undefined;
  isManuelOpen: boolean;
  onToggleManuel: () => void;
}

export function AlchimieVerbatim({
  verbatim,
  isManuelOpen,
  onToggleManuel,
}: AlchimieVerbatimProps) {
  if (!verbatim) return null;
  const blocks = parseVerbatimAlchimie(verbatim, true);

  return (
    <div className="mt-3">
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
      {isManuelOpen && (
        <div className="mt-2 rounded-md border border-l-2 border-border border-l-gold bg-background/30 p-3">
          <p className="mb-2 text-[0.65rem] uppercase tracking-wide text-gold">
            Verbatim — Manuel des règles 2026
          </p>
          <div className="space-y-2 text-sm leading-relaxed text-foreground/80">
            {blocks.map((b, k) => {
              if (b.kind === "field") {
                return (
                  <p key={k}>
                    <span className="font-semibold text-gold">{b.label} : </span>
                    {b.value}
                  </p>
                );
              }
              if (b.kind === "para") {
                return (
                  <p
                    key={k}
                    className="border-l-2 border-border pl-2 italic text-muted-foreground"
                  >
                    {b.value}
                  </p>
                );
              }
              if (b.kind === "ul") {
                return (
                  <div key={k}>
                    <span className="font-semibold text-gold">{b.title} :</span>
                    <ul className="mt-1 list-disc pl-5">
                      {b.items.map((it, j) => (
                        <li key={j} className="mb-0.5">
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }
              return (
                <div key={k}>
                  <span className="font-semibold text-gold">{b.title} :</span>
                  <ol className="mt-1 list-decimal pl-5">
                    {b.items.map((it, j) => (
                      <li key={j} className="mb-0.5">
                        {it}
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default AlchimieVerbatim;
