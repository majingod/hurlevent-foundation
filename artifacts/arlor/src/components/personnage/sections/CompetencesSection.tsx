import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ManuelGlobalSwitch, ToggleManuel } from "@/components/shared/ToggleManuel";
import { STATUT_MAITRE_LABELS } from "@/constants/labels";
import { resoudreChoixAffichage } from "./helpers";
import type { CompetenceGroupee } from "./types";

interface CompetencesSectionProps {
  competencesGroupees: CompetenceGroupee[];
  langues: { id: string; nom: string | null }[] | undefined;
  religions: { id: string; nom: string | null }[] | undefined;
  isManuelOpen: (id: string) => boolean;
  toggleManuel: (id: string) => void;
  isAllOpen: (ids: string[]) => boolean;
  toggleAll: (ids: string[]) => void;
}

// Verbatim concaténé par compétence : 1 entrée par niveau acquis (dédup),
// triée par niveau. Couvre les 4 patterns type_achat (validé s87 ②).
const construireVerbatim = (comp: CompetenceGroupee): string => {
  const parNiveau = new Map<number, string>();
  for (const r of comp.rows) {
    if (r.description_niveau_acquis && !parNiveau.has(r.niveau_acquis)) {
      parNiveau.set(r.niveau_acquis, r.description_niveau_acquis);
    }
  }
  return [...parNiveau.entries()]
    .sort(([a], [b]) => a - b)
    .map(([niveau, desc]) => `Niveau ${niveau} — ${desc}`)
    .join("\n\n");
};

export const CompetencesSection = ({
  competencesGroupees,
  langues,
  religions,
  isManuelOpen,
  toggleManuel,
  isAllOpen,
  toggleAll,
}: CompetencesSectionProps) => {
  if (competencesGroupees.length === 0) {
    return <p className="text-center py-8 text-muted-foreground">Aucune compétence acquise.</p>;
  }

  const verbatimParComp = new Map<string, string>(
    competencesGroupees.map((c) => [c.competence_id, construireVerbatim(c)]),
  );
  const idsVerbatim = competencesGroupees
    .filter((c) => (verbatimParComp.get(c.competence_id) ?? "").length > 0)
    .map((c) => c.competence_id);

  return (
    <div className="space-y-3">
      {idsVerbatim.length > 0 && (
        <ManuelGlobalSwitch
          allOpen={isAllOpen(idsVerbatim)}
          onToggle={() => toggleAll(idsVerbatim)}
          title="Cet onglet"
          subtitle="Verbatim du manuel pour les compétences"
        />
      )}
      {competencesGroupees.map((comp) => {
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
          <Card key={comp.competence_id}>
            <CardContent className="pt-4 space-y-3">
              {/* Header commun */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{comp.nom}</p>
                  <p className="text-xs text-muted-foreground">{comp.categorie}</p>
                </div>
                {headerBadges}
              </div>

              {/* PATTERN 1 — simple : sections par niveau acquis */}
              {comp.type_achat === "simple" && (
                <div className="border-t border-border/50 pt-3 space-y-3 text-sm text-muted-foreground">
                  {comp.competence_description && (
                    <p className="whitespace-pre-line">{comp.competence_description}</p>
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
                  {comp.competence_description && (
                    <p className="whitespace-pre-line">{comp.competence_description}</p>
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
                  {comp.competence_description && (
                    <p className="whitespace-pre-line">{comp.competence_description}</p>
                  )}
                </div>
              )}

              {/* PATTERN 4 — multiple_avec_choix_par_niveau : groupé par niveau + liste de choix */}
              {comp.type_achat === "multiple_avec_choix_par_niveau" && (
                <div className="border-t border-border/50 pt-3 space-y-3 text-sm text-muted-foreground">
                  {comp.competence_description && (
                    <p className="whitespace-pre-line">{comp.competence_description}</p>
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
                    {comp.competence_description && (
                      <p className="whitespace-pre-line">{comp.competence_description}</p>
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

              {/* Toggle « Texte du manuel » — verbatim par niveau replié (s87 ①) */}
              <ToggleManuel
                texte={verbatimParComp.get(comp.competence_id)}
                isOpen={isManuelOpen(comp.competence_id)}
                onToggle={() => toggleManuel(comp.competence_id)}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default CompetencesSection;
