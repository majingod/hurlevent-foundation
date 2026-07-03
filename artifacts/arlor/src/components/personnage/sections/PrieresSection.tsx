import { useState } from "react";
import { ItemFiche } from "./ItemFiche";
import { Badge } from "@/components/ui/badge";
import { useModeAffichage } from "@/contexts/ModeAffichageContext";
import { PastilleType } from "@/components/shared/PastilleType";
import { calculerBonusNiveau, calculerCoutPS, calculerCoutXP, rendreEffetInstance } from "@/utils/calculsMagie";
import type { PalierSort } from "@/utils/calculsMagie";
import { PaliersDepliable, BlocPaliers } from "@/components/createur/DescriptionDepliable";
import type { Priere } from "./types";

interface PrieresSectionProps {
  prieres: Priere[];
}

export const PrieresSection = ({ prieres }: PrieresSectionProps) => {
  // Patron canon abrégé ⇄ intégral (s299) : priere_resume_condense ⇄ priere_description.
  const { mode } = useModeAffichage();
  // État dépliage des paliers (rendu « effets calculés ») — Set manuel par id.
  const [paliersOuverts, setPaliersOuverts] = useState<Set<string>>(new Set());
  const togglePaliers = (id: string) =>
    setPaliersOuverts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (!prieres || prieres.length === 0) {
    return <p className="text-center py-8 text-muted-foreground">Aucune prière.</p>;
  }

  return (
    <div className="space-y-3">
      {prieres.map((priere) => {
        const paliers = priere.paliers as PalierSort[] | null;
        const segments = rendreEffetInstance(priere.effet_instance, paliers, priere.niveau_priere);
        const prochainPalier = paliers?.find((p) => p.niveau > priere.niveau_priere) ?? null;
        // Bonus de durée gratuit (bonus_niveau variable "duree") → suffixe sur la ligne Durée.
        const bonusDuree =
          priere.bonus_niveau?.formule?.variable === "duree"
            ? calculerBonusNiveau(priere.bonus_niveau, priere.niveau_priere)
            : null;
        const suffixeDuree =
          bonusDuree && bonusDuree.gratuit
            ? ` (+${bonusDuree.n} gratuite${bonusDuree.n > 1 ? "s" : ""})`
            : "";
        // Bonus de rayon/cibles gratuit (variable "rayon" | "cibles") → suffixe sur la ligne Zone (s168, s170).
        const varZone = priere.bonus_niveau?.formule?.variable;
        const bonusZone =
          varZone === "rayon" || varZone === "cibles"
            ? calculerBonusNiveau(priere.bonus_niveau, priere.niveau_priere)
            : null;
        const accordZone = bonusZone?.unite === "cible" ? "e" : "";
        const suffixeZone =
          bonusZone && bonusZone.gratuit
            ? ` (+${bonusZone.n} ${bonusZone.unite}${bonusZone.n > 1 ? "s" : ""} gratuit${accordZone}${bonusZone.n > 1 ? "s" : ""})`
            : "";
        const showIncantationBox = priere.duree_incantation_calculee != null && priere.duree_incantation_calculee > 0;
        // Swap canon : le texte affiché REMPLACE (jamais empilé).
        const textePriere = mode === "abrege" ? priere.priere_resume_condense : priere.priere_description;

        return (
          <ItemFiche
            key={priere.id}
            titre={priere.nom_personnalise}
            sousTitre={<>{priere.domaine} • Niveau {priere.niveau_priere}</>}
            badges={
              <>
                <PastilleType type={priere.type_priere} />
                {priere.cout_xp_base != null && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {calculerCoutPS(calculerCoutXP(priere.zone_choisie ?? "", priere.portee_choisie ?? "", priere.duree_choisie ?? "", priere.niveau_priere, Number(priere.cout_xp_base)))} PS
                  </Badge>
                )}
              </>
            }
          >
              {showIncantationBox && (
                <div className="border border-primary/45 rounded-md bg-primary/10 px-2.5 py-2 text-center">
                  <p className="font-mono italic text-[13.5px] text-primary">
                    ✦ Prier sa Divinité pendant {priere.duree_incantation_calculee} seconde{priere.duree_incantation_calculee! > 1 ? "s" : ""} ✦
                  </p>
                </div>
              )}

              {segments !== null ? (
                <>
                  {((!showIncantationBox && priere.duree_incantation_calculee != null) ||
                    priere.zone_choisie ||
                    priere.portee_choisie ||
                    priere.duree_choisie) && (
                    <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 text-sm">
                      {!showIncantationBox && priere.duree_incantation_calculee != null && (
                        <>
                          <span className="text-muted-foreground">Incantation</span>
                          <span className="text-foreground">{priere.duree_incantation_calculee} s</span>
                        </>
                      )}
                      {priere.zone_choisie && (
                        <>
                          <span className="text-muted-foreground">Zone</span>
                          <span className="text-foreground">
                            {priere.zone_choisie}
                            {suffixeZone && <span className="text-muted-foreground">{suffixeZone}</span>}
                          </span>
                        </>
                      )}
                      {priere.portee_choisie && (
                        <>
                          <span className="text-muted-foreground">Portée</span>
                          <span className="text-foreground">{priere.portee_choisie}</span>
                        </>
                      )}
                      {priere.duree_choisie && (
                        <>
                          <span className="text-muted-foreground">Durée</span>
                          <span className="text-foreground">
                            {priere.duree_choisie}
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
                        onClick={(e) => { e.stopPropagation(); togglePaliers(priere.id); }}
                      >
                        {paliersOuverts.has(priere.id)
                          ? "Masquer les paliers"
                          : `Voir les ${paliers.length} paliers`}
                      </button>
                      {paliersOuverts.has(priere.id) && (
                        <BlocPaliers paliers={paliers} niveauActif={priere.niveau_priere} />
                      )}
                    </div>
                  )}

                  {textePriere && (
                    <p className="border-t border-border/50 pt-2 text-sm text-foreground/90 whitespace-pre-line">
                      {textePriere}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {((!showIncantationBox && priere.duree_incantation_calculee != null) ||
                    priere.zone_choisie ||
                    priere.portee_choisie ||
                    priere.duree_choisie) && (
                    <p className="text-xs text-muted-foreground">
                      {[
                        !showIncantationBox && priere.duree_incantation_calculee != null && `Incantation : ${priere.duree_incantation_calculee} s`,
                        priere.zone_choisie && `Zone : ${priere.zone_choisie}${suffixeZone}`,
                        priere.portee_choisie && `Portée : ${priere.portee_choisie}`,
                        priere.duree_choisie && `Durée : ${priere.duree_choisie}${suffixeDuree}`,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  )}

                  {textePriere && (
                    <p className="border-t border-border/50 pt-2 text-sm text-foreground/90 whitespace-pre-line">
                      {textePriere}
                    </p>
                  )}

                  <PaliersDepliable paliers={paliers} niveau={priere.niveau_priere} />
                </>
              )}
          </ItemFiche>
        );
      })}
    </div>
  );
};

export default PrieresSection;
