import type { Json } from "@/integrations/supabase/types";

export interface IngredientsRecette {
  composants: { label: string; quantite: number }[];
  manipulations: string[];
}

/**
 * Parse le champ `ingredients` (jsonb objet) d'une recette d'alchimie.
 * Forme en base : { "<Nom>": <qté>, ..., "manipulations": ["étape", ...] }
 * - la clé `manipulations` → étapes de préparation (tableau de chaînes) ;
 * - toutes les autres clés → composants (ingrédient / catalyseur → quantité).
 * Robuste : retourne des tableaux vides si la donnée est nulle ou mal formée.
 */
export function parseIngredientsRecette(ingredients: Json | null): IngredientsRecette {
  if (!ingredients || typeof ingredients !== "object" || Array.isArray(ingredients)) {
    return { composants: [], manipulations: [] };
  }
  const obj = ingredients as Record<string, unknown>;
  const manipulations = Array.isArray(obj.manipulations)
    ? (obj.manipulations as unknown[]).map((m) => String(m))
    : [];
  const composants = Object.entries(obj)
    .filter(([cle]) => cle !== "manipulations")
    .map(([cle, valeur]) => ({
      label: cle.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
      quantite: typeof valeur === "number" ? valeur : Number(valeur) || 1,
    }));
  return { composants, manipulations };
}

/** Formate un composant pour l'affichage : "Ganos" ou "Poudre ×2". */
export function formaterComposant(c: { label: string; quantite: number }): string {
  return c.quantite > 1 ? `${c.label} ×${c.quantite}` : c.label;
}

// ─────────────────────────────────────────────────────────────────────────────
// Verbatim alchimie (Manuel des règles 2026) — SOURCE UNIQUE du parser.
// Déplacé depuis shared/AlchimieVerbatim.tsx (Lot B / PR2a). Validé 40/40.
// ─────────────────────────────────────────────────────────────────────────────

export type VerbatimBlock =
  | { kind: "field"; label: string; value: string }
  | { kind: "para"; value: string }
  | { kind: "ul"; title: string; items: string[] }
  | { kind: "ol"; title: string; items: string[] };

/**
 * Parser déterministe du mono-bloc `description_verbatim`.
 * Labels Formule/Effet/Durée/Note ; sections Ingrédients (•) / Manipulations (1.).
 * Les lignes sans puce/numéro sont des continuations du dernier item.
 * `isolerLabo` extrait le paragraphe « La création nécessite … » (catalyseurs)
 * de la dernière manipulation en bloc `para` distinct.
 */
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

export interface RecetteSectionsData {
  formule: string | null;
  effet: string | null;
  duree: string | null;
  note: string | null;
  ingredients: string[];
  manipulations: string[];
  labo: string | null;
}

/**
 * Adaptateur Lot B : projette le verbatim parsé en structure « Sections »
 * (QuickFacts + listes + effet + labo + note). Retourne `null` si le verbatim
 * est absent ou non conforme → les surfaces retombent sur le rendu colonnes.
 */
export function parseRecetteVerbatim(
  verbatim: string | null | undefined,
): RecetteSectionsData | null {
  if (!verbatim || !verbatim.trim()) return null;
  const blocks = parseVerbatimAlchimie(verbatim, true);
  if (blocks.length === 0) return null;

  const field = (label: string): string | null => {
    for (const b of blocks)
      if (b.kind === "field" && b.label === label) return b.value;
    return null;
  };
  const liste = (titre: "Ingrédients" | "Manipulations"): string[] => {
    for (const b of blocks)
      if ((b.kind === "ul" || b.kind === "ol") && b.title === titre)
        return b.items;
    return [];
  };
  const paraBlock = blocks.find((b) => b.kind === "para");

  const data: RecetteSectionsData = {
    formule: field("Formule"),
    effet: field("Effet"),
    duree: field("Durée"),
    note: field("Note"),
    ingredients: liste("Ingrédients"),
    manipulations: liste("Manipulations"),
    labo: paraBlock && paraBlock.kind === "para" ? paraBlock.value : null,
  };

  const vide =
    !data.formule &&
    !data.effet &&
    !data.duree &&
    data.ingredients.length === 0 &&
    data.manipulations.length === 0;
  return vide ? null : data;
}
