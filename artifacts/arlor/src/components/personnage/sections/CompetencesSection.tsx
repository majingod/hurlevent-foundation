import { ItemFiche } from "./ItemFiche";
import { Badge } from "@/components/ui/badge";
import { useModeAffichage } from "@/contexts/ModeAffichageContext";
import type { ModeAffichage } from "@/contexts/ModeAffichageContext";
import { STATUT_MAITRE_LABELS } from "@/constants/labels";
import { resoudreChoixAffichage } from "./helpers";
import type { CompetenceGroupee } from "./types";

interface CompetencesSectionProps {
  competencesGroupees: CompetenceGroupee[];
  langues: { id: string; nom: string | null }[] | undefined;
  religions: { id: string; nom: string | null }[] | undefined;
}

// Textes par niveau acquis : 1 entrée par niveau (dédup), triée par niveau.
// Swap canon s299 : description_courte_niveau_acquis (abrégé) ⇄
// description_niveau_acquis (intégral). Couvre les 4 patterns type_achat.
const textesParNiveau = (comp: CompetenceGroupee, mode: ModeAffichage): [number, string][] => {
  const parNiveau = new Map<number, string>();
  for (const r of comp.rows) {
    const texte = mode === "abrege" ? r.description_courte_niveau_acquis : r.description_niveau_acquis;
    if (texte && !parNiveau.has(r.niveau_acquis)) {
      parNiveau.set(r.niveau_acquis, texte);
    }
  }
  return [...parNiveau.entries()].sort(([a], [b]) => a - b);
};

export const CompetencesSection = ({
  competencesGroupees,
  langues,
  religions,
}: CompetencesSectionProps) => {
  // Patron canon abrégé ⇄ intégral (s299) : competence_resume_condense ⇄
  // competence_description sur TOUS les sites (les 4 patterns + fallback).
  const { mode } = useModeAffichage();

  if (competencesGroupees.length === 0) {
    return <p className="text-center py-8 text-muted-foreground">Aucune compétence acquise.</p>;
  }

  return (
    <div className="space-y-3">
      {competencesGroupees.map((comp) => {
        const descriptionAffichee =
          mode === "abrege" ? comp.competence_resume_condense : comp.competence_description;
        const niveaux = textesParNiveau(comp, mode);

        const headerBadges = (
          <div className="flex items-center gap-2 flex-shrink-0">
            {comp.xp_total === 0 ? (
              <Badge variant="outline" className="text-xs">Gratuit</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Coût total : {comp.xp_total} XP</Badge>
            )}
            {comp.statut_maitre !== "non_requis" && (
              <Badge className="text-xs">{STATUT_MAITRE_LABELS[comp.statut_maitre] || comp.statut_maitre}</Badge>
            )}
          </div>
        );

        return (
          <ItemFiche
            key={comp.competence_id}
            titre={comp.nom}
            sousTitre={comp.categorie}
            badges={headerBadges}
          >
              {/* PATTERN 1 — simple : sections par niveau acquis */}
              {comp.type_achat === "simple" && (
                <div className="border-t border-border/50 pt-3 space-y-3 text-sm text-muted-foreground">
                  {descriptionAffichee && (
                    <p className="whitespace-pre-line">{descriptionAffichee}</p>
                  )}
                  {comp.rows.map((r) => (
                    <div key={r.id} className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">Niveau {r.niveau_acquis}</span>
                        <Badge variant="outline" className="text-xs">
                          {r.xp_depense === 0 ? "Gratuit" : `${r.xp_depense} XP`}
                        </Badge>
                        {r.appris_via_maitre && r.nom_maitre && (
                          <Badge className="text-xs">Maître : {r.nom_maitre}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* PATTERN 2 — multiple_sans_choix : compteur + description générale */}
              {comp.type_achat === "multiple_sans_choix" && (
                <div className="border-t border-border/50 pt-3 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">× {comp.rows.length} achats</Badge>
                  </div>
                  {descriptionAffichee && (
                    <p className="whitespace-pre-line">{descriptionAffichee}</p>
                  )}
                </div>
              )}

              {/* PATTERN 3 — multiple_choix_distinct : liste des choix avec XP par item */}
              {comp.type_achat === "multiple_choix_distinct" && (
                <div className="border-t border-border/50 pt-3 space-y-3 text-sm text-muted-foreground">
                  <div>
                    <p className="font-medium text-foreground mb-1">Liste acquise :</p>
                    <ul className="space-y-1">
                      {comp.rows.map((r) => {
                        const choixResolu = resoudreChoixAffichage(r.choix_achat, langues, religions);
                        return (
                          <li key={r.id} className="flex items-center gap-2 flex-wrap">
                            <span>•</span>
                            <span className="text-foreground">{choixResolu ?? r.choix_achat ?? "?"}</span>
                            <Badge variant="outline" className="text-xs">
                              {r.xp_depense === 0 ? "Gratuit" : `${r.xp_depense} XP`}
                            </Badge>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  {descriptionAffichee && (
                    <p className="whitespace-pre-line">{descriptionAffichee}</p>
                  )}
                </div>
              )}

              {/* PATTERN 4 — multiple_avec_choix_par_niveau : groupé par niveau + liste de choix */}
              {comp.type_achat === "multiple_avec_choix_par_niveau" && (
                <div className="border-t border-border/50 pt-3 space-y-3 text-sm text-muted-foreground">
                  {descriptionAffichee && (
                    <p className="whitespace-pre-line">{descriptionAffichee}</p>
                  )}
                  {Object.entries(
                    comp.rows.reduce<Record<number, typeof comp.rows>>((acc, r) => {
                      (acc[r.niveau_acquis] ??= []).push(r);
                      return acc;
                    }, {})
                  )
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([niveau, rowsNiveau]) => {
                      const aDesChoix = rowsNiveau.some((r) => r.choix_achat);
                      return (
                        <div key={niveau} className="space-y-2">
                          <div className="font-medium text-foreground">Niveau {niveau}</div>
                          {aDesChoix && (
                            <ul className="space-y-1 ml-2">
                              {rowsNiveau.map((r) => {
                                const choixResolu = resoudreChoixAffichage(r.choix_achat, langues, religions);
                                return (
                                  <li key={r.id} className="flex items-center gap-2 flex-wrap">
                                    <span>•</span>
                                    <span className="text-foreground">{choixResolu ?? r.choix_achat ?? "?"}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {r.xp_depense === 0 ? "Gratuit" : `${r.xp_depense} XP`}
                                    </Badge>
                                    {r.appris_via_maitre && r.nom_maitre && (
                                      <Badge className="text-xs">Maître : {r.nom_maitre}</Badge>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* FALLBACK — type_achat futur inattendu (gardé par sécurité) */}
              {comp.type_achat !== "simple" &&
                comp.type_achat !== "multiple_sans_choix" &&
                comp.type_achat !== "multiple_choix_distinct" &&
                comp.type_achat !== "multiple_avec_choix_par_niveau" && (
                  <div className="border-t border-border/50 pt-3 space-y-3 text-sm text-muted-foreground">
                    {descriptionAffichee && (
                      <p className="whitespace-pre-line">{descriptionAffichee}</p>
                    )}
                    {comp.rows.map((r) => {
                      const choixResolu = resoudreChoixAffichage(r.choix_achat, langues, religions);
                      return (
                        <div key={r.id} className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground">
                              Niveau {r.niveau_acquis}
                              {choixResolu && <span className="text-muted-foreground"> ({choixResolu})</span>}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {r.xp_depense === 0 ? "Gratuit" : `${r.xp_depense} XP`}
                            </Badge>
                            {r.appris_via_maitre && r.nom_maitre && (
                              <Badge className="text-xs">Maître : {r.nom_maitre}</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              {/* Textes du niveau acquis — swap canon (remplace le dépliage additif s87) */}
              {niveaux.length > 0 && (
                <div className="border-t border-border/50 pt-3 space-y-2 text-sm text-muted-foreground">
                  {niveaux.map(([niveau, texte]) => (
                    <p key={niveau} className="whitespace-pre-line">
                      <span className="font-medium text-foreground">Niveau {niveau}</span> — {texte}
                    </p>
                  ))}
                </div>
              )}
          </ItemFiche>
        );
      })}
    </div>
  );
};

export default CompetencesSection;
