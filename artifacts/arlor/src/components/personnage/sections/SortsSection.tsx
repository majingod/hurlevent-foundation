import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ManuelGlobalSwitch, ToggleManuel } from "@/components/shared/ToggleManuel";
import { PastilleType } from "@/components/shared/PastilleType";
import { calculerCoutPS, calculerCoutXP, rendreEffetInstance } from "@/utils/calculsMagie";
import type { PalierSort } from "@/utils/calculsMagie";
import { PaliersDepliable, BlocPaliers } from "@/components/createur/DescriptionDepliable";
import type { Sort } from "./types";

interface SortsSectionProps {
  sorts: Sort[];
  isManuelOpen: (id: string) => boolean;
  toggleManuel: (id: string) => void;
  isAllOpen: (ids: string[]) => boolean;
  toggleAll: (ids: string[]) => void;
}

export const SortsSection = ({
  sorts,
  isManuelOpen,
  toggleManuel,
  isAllOpen,
  toggleAll,
}: SortsSectionProps) => {
  // État dépliage des paliers (rendu « effets calculés ») — Set manuel par id.
  const [paliersOuverts, setPaliersOuverts] = useState<Set<string>>(new Set());
  const togglePaliers = (id: string) =>
    setPaliersOuverts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (!sorts || sorts.length === 0) {
    return <p className="text-center py-8 text-muted-foreground">Aucun sort arcanique.</p>;
  }

  const idsVerbatim = sorts.filter((s) => s.sort_description).map((s) => s.id);

  return (
    <div className="space-y-3">
      {idsVerbatim.length > 0 && (
        <ManuelGlobalSwitch
          allOpen={isAllOpen(idsVerbatim)}
          onToggle={() => toggleAll(idsVerbatim)}
          title="Cet onglet"
          subtitle="Verbatim du manuel pour les sorts"
        />
      )}
      {sorts.map((sort) => {
        const paliers = sort.paliers as PalierSort[] | null;
        const segments = rendreEffetInstance(sort.effet_instance, paliers, sort.niveau_sort);
        const prochainPalier = paliers?.find((p) => p.niveau > sort.niveau_sort) ?? null;

        return (
          <Card key={sort.id}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{sort.nom_personnalise}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-muted-foreground">{sort.cercle} • Niveau {sort.niveau_sort}</p>
                    <PastilleType type={sort.type_sort} />
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {calculerCoutPS(calculerCoutXP(
                    sort.zone_choisie ?? "",
                    sort.portee_choisie ?? "",
                    sort.duree_choisie ?? "",
                    sort.niveau_sort,
                    Number(sort.cout_xp_base),
                  ))} PS
                </Badge>
              </div>

              {sort.sort_nom_base && sort.sort_nom_base !== sort.nom_personnalise && (
                <p className="text-xs italic text-muted-foreground">Basé sur : {sort.sort_nom_base}</p>
              )}

              {sort.formule_magique && (
                <div className="border border-primary/45 rounded-md bg-primary/10 px-2.5 py-2 text-center">
                  <p className="font-mono italic text-[13.5px] text-primary">✦ {sort.formule_magique} ✦</p>
                </div>
              )}

              {segments !== null ? (
                <>
                  {(sort.zone_choisie || sort.portee_choisie || sort.duree_choisie) && (
                    <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 text-sm">
                      {sort.zone_choisie && (
                        <>
                          <span className="text-muted-foreground">Zone</span>
                          <span className="text-foreground">{sort.zone_choisie}</span>
                        </>
                      )}
                      {sort.portee_choisie && (
                        <>
                          <span className="text-muted-foreground">Portée</span>
                          <span className="text-foreground">{sort.portee_choisie}</span>
                        </>
                      )}
                      {sort.duree_choisie && (
                        <>
                          <span className="text-muted-foreground">Durée</span>
                          <span className="text-foreground">{sort.duree_choisie}</span>
                        </>
                      )}
                    </div>
                  )}

                  <div className="border-t border-border/50 pt-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-primary">Effets</p>
                    <p className="text-sm leading-snug text-foreground">
                      {segments.map((seg, i) =>
                        seg.fort ? (
                          <strong key={i} className="font-semibold text-primary">{seg.texte}</strong>
                        ) : (
                          <span key={i}>{seg.texte}</span>
                        ),
                      )}
                    </p>
                    {prochainPalier && (
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Prochain palier : {prochainPalier.libelle}
                      </p>
                    )}
                  </div>

                  {paliers && paliers.length > 0 && (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        className="text-xs text-primary underline-offset-2 hover:underline"
                        onClick={(e) => { e.stopPropagation(); togglePaliers(sort.id); }}
                      >
                        {paliersOuverts.has(sort.id)
                          ? "Masquer les paliers"
                          : `Voir les ${paliers.length} paliers`}
                      </button>
                      {paliersOuverts.has(sort.id) && (
                        <BlocPaliers paliers={paliers} niveauActif={sort.niveau_sort} />
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {(sort.zone_choisie || sort.portee_choisie || sort.duree_choisie) && (
                    <p className="text-xs text-muted-foreground">
                      {[
                        sort.zone_choisie && `Zone : ${sort.zone_choisie}`,
                        sort.portee_choisie && `Portée : ${sort.portee_choisie}`,
                        sort.duree_choisie && `Durée : ${sort.duree_choisie}`,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  )}

                  {(sort.sort_description_courte ?? sort.sort_description) && (
                    <p className="border-t border-border/50 pt-2 text-sm text-foreground/90 whitespace-pre-line">
                      {sort.sort_description_courte ?? sort.sort_description}
                    </p>
                  )}

                  <PaliersDepliable paliers={paliers} niveau={sort.niveau_sort} />
                </>
              )}

              <ToggleManuel
                texte={sort.sort_description}
                isOpen={isManuelOpen(sort.id)}
                onToggle={() => toggleManuel(sort.id)}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default SortsSection;
