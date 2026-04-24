import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import type { Json } from "@/integrations/supabase/types";

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

const labelType: Record<string, string> = {
  potion: "Potions",
  poison: "Poisons",
  autre: "Autres",
};

const AlchimieSection = ({ recettes, ingredients }: { recettes: Recette[]; ingredients: Ingredient[] }) => {
  const groupedByType = groupBy(recettes, (r) => r.type ?? "autre");
  const typeOrder = ["potion", "poison", "autre"];
  const typeKeys = [...typeOrder.filter((k) => k in groupedByType), ...Object.keys(groupedByType).filter((k) => !typeOrder.includes(k))];

  const groupedIngredients = groupBy(ingredients, (i) => String(i.niveau ?? 1));
  const niveauKeys = Object.keys(groupedIngredients).sort();

  return (
    <div className="space-y-8">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">Alchimie</h2>

      {/* Recettes */}
      {typeKeys.map((type) => {
        const byNiveau = groupBy(groupedByType[type], (r) => String(r.niveau_requis ?? 1));
        const niveaux = Object.keys(byNiveau).sort();
        return (
          <section key={type}>
            <h3 className="font-heading text-lg font-semibold text-primary mb-3">{labelType[type] ?? type}</h3>
            {niveaux.map((niv) => (
              <div key={niv} className="mb-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Niveau {niv}</h4>
                <Accordion type="multiple" className="w-full">
                  {byNiveau[niv].map((r) => {
                    const ings = Array.isArray(r.ingredients) ? r.ingredients : [];
                    return (
                      <AccordionItem key={r.id} value={r.id}>
                        <AccordionTrigger className="font-heading text-base hover:no-underline">
                          {r.nom}
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground space-y-2">
                          {r.effet && <p><span className="font-medium text-foreground">Effet :</span> {r.effet}</p>}
                          {r.formule && <p><span className="font-medium text-foreground">Formule :</span> {r.formule}</p>}
                          {ings.length > 0 && (
                            <div>
                              <span className="font-medium text-foreground">Ingrédients :</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ings.map((ing: any, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs">{String(typeof ing === "object" ? ing.nom ?? ing : ing)}</Badge>
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

      {/* Ingrédients */}
      <section>
        <h3 className="font-heading text-lg font-semibold text-primary mb-3">Ingrédients Alchimiques</h3>
        {niveauKeys.map((niv) => (
          <div key={niv} className="mb-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Niveau {niv}</h4>
            <div className="space-y-1">
              {groupedIngredients[niv].map((ing) => (
                <div key={ing.id} className="rounded-lg border border-primary/10 bg-card/30 p-3 flex items-center justify-between text-sm hover:border-primary/30 transition-colors">
                  <span className="font-medium text-foreground">{ing.nom}</span>
                  {ing.manipulations && <span className="text-muted-foreground text-xs">{ing.manipulations}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};

export default AlchimieSection;

