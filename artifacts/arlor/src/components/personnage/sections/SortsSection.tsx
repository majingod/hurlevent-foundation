import { useState } from "react";
import { ItemFiche } from "./ItemFiche";
import { Badge } from "@/components/ui/badge";
import { useModeAffichage } from "@/contexts/ModeAffichageContext";
import { PastilleType } from "@/components/shared/PastilleType";
import { calculerBonusNiveau, calculerCoutPS, calculerCoutXP, rendreEffetInstance } from "@/utils/calculsMagie";
import type { PalierSort } from "@/utils/calculsMagie";
import { PaliersDepliable, BlocPaliers } from "@/components/createur/DescriptionDepliable";
import type { Sort } from "./types";

interface SortsSectionProps {
  sorts: Sort[];
}

export const SortsSection = ({ sorts }: SortsSectionProps) => {
  // Patron canon abrégé ⇄ intégral (s299) : sort_resume_condense ⇄ sort_description.
  const { mode } = useModeAffichage();
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

  return (
    <div className="space-y-3">
      {sorts.map((sort) => {
        const paliers = sort.paliers as PalierSort[] | null;
        const segments = rendreEffetInstance(sort.effet_instance, paliers, sort.niveau_sort);
        const prochainPalier = paliers?.find((p) => p.niveau > sort.niveau_sort) ?? null;
        // Bonus de durée gratuit (bonus_niveau variable "duree") → suffixe sur la ligne Durée.
        const bonusDuree =
          sort.bonus_niveau?.formule?.variable === "duree"
            ? calculerBonusNiveau(sort.bonus_niveau, sort.niveau_sort)
            : null;
        const suffixeDuree =
          bonusDuree && bonusDuree.gratuit
            ? ` (+${bonusDuree.n} gratuite${bonusDuree.n > 1 ? "s" : ""})`
            : "";
        // Bonus de rayon gratuit (bonus_niveau variable "rayon") → suffixe sur la ligne Zone (s168).
        const bonusRayon =
          sort.bonus_niveau?.formule?.variable === "rayon"
            ? calculerBonusNiveau(sort.bonus_niveau, sort.niveau_sort)
            : null;
        const suffixeZone =
          bonusRayon && bonusRayon.gratuit
            ? ` (+${bonusRayon.n} ${bonusRayon.unite}${bonusRayon.n > 1 ? "s" : ""} gratuit${bonusRayon.n > 1 ? "s" : ""})`
            : "";
        // Swap canon : le texte affiché REMPLACE (jamais empilé).
        const texteSort = mode === "abrege" ? sort.sort_resume_condense : sort.sort_description;

        return (
          <ItemFiche
            key={sort.id}
            titre={sort.nom_personnalise}
            sousTitre={<>{sort.cercle} • Niveau {sort.niveau_sort}</>}
            badges={
              <>
                <PastilleType type={sort.type_sort} />
                <Badge variant="secondary" className="text-xs shrink-0">
                  {calculerCoutPS(calculerCoutXP(
                    sort.zone_choisie ?? "",
                    sort.portee_choisie ?? "",
                    sort.duree_choisie ?? "",
                    sort.niveau_sort,
                    Number(sort.cout_xp_base),
                  ))} PS
                </Badge>
              </>
            }
          >
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
                          <span className="text-foreground">
                            {sort.zone_choisie}
                            {suffixeZone && <span className="text-muted-foreground">{suffixeZone}</span>}
                          </span>
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
                          <span className="text-foreground">
                            {sort.duree_choisie}
                            {suffixeDuree && <span className="text-muted-foreground">{suffixeDuree}</span>}
                          </span>
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

                  {texteSort && (
                    <p className="border-t border-border/50 pt-2 text-sm text-foreground/90 whitespace-pre-line">
                      {texteSort}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {(sort.zone_choisie || sort.portee_choisie || sort.duree_choisie) && (
                    <p className="text-xs text-muted-foreground">
                      {[
                        sort.zone_choisie && `Zone : ${sort.zone_choisie}${suffixeZone}`,
                        sort.portee_choisie && `Portée : ${sort.portee_choisie}`,
                        sort.duree_choisie && `Durée : ${sort.duree_choisie}${suffixeDuree}`,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  )}

                  {texteSort && (
                    <p className="border-t border-border/50 pt-2 text-sm text-foreground/90 whitespace-pre-line">
                      {texteSort}
                    </p>
                  )}

                  <PaliersDepliable paliers={paliers} niveau={sort.niveau_sort} />
                </>
              )}
          </ItemFiche>
        );
      })}
    </div>
  );
};

export default SortsSection;
