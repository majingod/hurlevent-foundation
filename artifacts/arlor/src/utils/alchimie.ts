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
