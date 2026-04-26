import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import type { Json } from "@/integrations/supabase/types";
import { NIVEAU_ALCHIMIE_LABELS, TYPE_RECETTE_LABELS } from "@/constants/labels";

interface Recette {
  id: string;
  nom: string | null;
  description: string | null;
  formule: string | null;
  effet: string | null;
  ingredients: Json | null;
  niveau_requis: number | null;
  type: string | null;
}

interface Ingredient {
  id: string;
  nom: string | null;
  manipulations: string | null;
  niveau: number | null;
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

const FILTRES_TYPE = [
  { key: null, label: "Tous Types" },
  { key: "potion", label: "Potions" },
  { key: "poison", label: "Poisons" },
  { key: "autre", label: "Catalyseurs" },
  { key: "ingredients", label: "Ingrédients Alchimiques" },
];

const FILTRES_NIVEAU_ING = [
  { key: null, label: "Tous les niveaux" },
  { key: 1, label: "Mineurs" },
  { key: 2, label: "Intermédiaires" },
  { key: 3, label: "Majeurs" },
];

const AlchimieSection = ({
  recettes,
  ingredients,
  searchQuery = "",
}: {
  recettes: Recette[];
  ingredients: Ingredient[];
  searchQuery?: string;
}) => {
  const [typeFiltre, setTypeFiltre] = useState<string | null>(null);
  const [niveauIngFiltre, setNiveauIngFiltre] = useState<number | null>(null);

  const showIngredients = typeFiltre === "ingredients";

  const handleTypeFiltre = (key: string | null) => {
    setTypeFiltre(key);
  };

  const recettesFiltrees = showIngredients
    ? []
    : recettes.filter((rec) => {
        const query = searchQuery.toLowerCase();
        const matchTexte =
          !query ||
          (rec.nom ?? "").toLowerCase().includes(query) ||
          (rec.description ?? "").toLowerCase().includes(query) ||
          (rec.formule ?? "").toLowerCase().includes(query) ||
          (rec.effet ?? "").toLowerCase().includes(query);
        const matchType = !typeFiltre || rec.type === typeFiltre;
        const matchNiveau = !niveauIngFiltre || rec.niveau_requis === niveauIngFiltre;
        return matchTexte && matchType && matchNiveau;
      });

  const ingredientsFiltres = showIngredients
    ? ingredients.filter((ing) => {
        const query = searchQuery.toLowerCase();
        const matchTexte =
          !query ||
          (ing.nom ?? "").toLowerCase().includes(query) ||
          (ing.manipulations ?? "").toLowerCase().includes(query);
        const matchNiveau = !niveauIngFiltre || ing.niveau === niveauIngFiltre;
        return matchTexte && matchNiveau;
      })
    : [];

  const groupedByType = groupBy(recettesFiltrees, (r) => r.type ?? "autre");
  const typeOrder = ["potion", "poison", "autre"];
  const typeKeys = [
    ...typeOrder.filter((k) => k in groupedByType),
    ...Object.keys(groupedByType).filter((k) => !typeOrder.includes(k)),
  ];

  const groupedIngredients = groupBy(ingredientsFiltres, (i) => String(i.niveau ?? 1));
  const niveauKeys = Object.keys(groupedIngredients).sort();

  return (
    <div className="space-y-8">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">Alchimie</h2>

      {/* Filtres */}
      <div className="space-y-2 mb-2">
        <div className="flex flex-wrap gap-2">
          {FILTRES_TYPE.map((f) => (
            <button
              key={String(f.key)}
              onClick={() => handleTypeFiltre(f.key)}
              className={
                typeFiltre === f.key
                  ? "px-3 py-1 rounded-md text-xs font-semibold bg-amber-700 text-white border border-amber-500"
                  : "px-3 py-1 rounded-md text-xs font-medium bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-600"
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTRES_NIVEAU_ING.map((f) => (
            <button
              key={String(f.key)}
              onClick={() => setNiveauIngFiltre(f.key)}
              className={
                niveauIngFiltre === f.key
                  ? "px-3 py-1 rounded-md text-xs font-semibold bg-amber-700 text-white border border-amber-500"
                  : "px-3 py-1 rounded-md text-xs font-medium bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-600"
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {!showIngredients && recettesFiltrees.length === 0 && (searchQuery || typeFiltre) && (
        <p className="text-muted-foreground text-center py-6">Aucun résultat pour cette recherche.</p>
      )}
      {showIngredients && ingredientsFiltres.length === 0 && (searchQuery || niveauIngFiltre) && (
        <p className="text-muted-foreground text-center py-6">Aucun résultat pour cette recherche.</p>
      )}

      {/* Recettes */}
      {!showIngredients && typeKeys.map((type) => {
        const byNiveau = groupBy(groupedByType[type], (r) => String(r.niveau_requis ?? 1));
        const niveaux = Object.keys(byNiveau).sort();
        return (
          <section key={type}>
            <h3 className="font-heading text-lg font-semibold text-primary mb-3">
              {TYPE_RECETTE_LABELS[type] ?? type}
            </h3>
            {niveaux.map((niv) => (
              <div key={niv} className="mb-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {NIVEAU_ALCHIMIE_LABELS[Number(niv)] ?? `Niveau ${niv}`}
                </h4>
                <Accordion type="multiple" className="w-full">
                  {byNiveau[niv].map((r) => {
                    const ings = Array.isArray(r.ingredients) ? r.ingredients : [];
                    return (
                      <AccordionItem key={r.id} value={r.id}>
                        <AccordionTrigger className="font-heading text-base hover:no-underline">
                          <span className="flex items-center">{r.nom}</span>
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground space-y-2">
                          {r.effet && <p><span className="font-medium text-foreground">Effet :</span> {r.effet}</p>}
                          {r.formule && <p><span className="font-medium text-foreground">Formule :</span> {r.formule}</p>}
                          {ings.length > 0 && (
                            <div>
                              <span className="font-medium text-foreground">Ingrédients :</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ings.map((ing: any, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {String(typeof ing === "object" ? ing.nom ?? ing : ing)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {r.description && <p className="mt-2">{r.description}</p>}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            ))}
          </section>
        );
      })}

      {/* Ingrédients Alchimiques */}
      {showIngredients && (
        <section>
          <h3 className="font-heading text-lg font-semibold text-primary mb-3">Ingrédients Alchimiques</h3>
          {niveauKeys.map((niv) => (
            <div key={niv} className="mb-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {NIVEAU_ALCHIMIE_LABELS[Number(niv)] ?? `Niveau ${niv}`}
              </h4>
              <div className="space-y-1">
                {groupedIngredients[niv].map((ing) => (
                  <div
                    key={ing.id}
                    className="rounded-lg border border-primary/10 bg-card/30 p-3 flex items-center justify-between text-sm hover:border-primary/30 transition-colors"
                  >
                    <span className="font-medium text-foreground">{ing.nom}</span>
                    {ing.manipulations && (
                      <span className="text-muted-foreground text-xs">{ing.manipulations}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export default AlchimieSection;
