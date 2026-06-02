import { calculerCoutPS, calculerCoutXP } from "@/utils/calculsMagie";
import { parseIngredientsRecette, formaterComposant } from "@/utils/alchimie";
import { STATUT_MAITRE_LABELS } from "@/constants/labels";
import { resoudreChoixAffichage } from "./sections/helpers";
import type {
  FichePersonnage,
  Trait,
  Sort,
  Priere,
  Assemblage,
  Recette,
  ArtisanatEtat,
  ManipulationAlchimique,
  ObjetForge,
  ReparationForge,
  ObjetJoaillerie,
  CompetenceGroupee,
  PiegeRow,
  PersonnagePiegeRow,
} from "./sections/types";

// PDF-PATTERN-4 PR-2 — Vue imprimable React (remplace l'ancien handlePrint en pop-up).
// - Rendue dans le document principal, masquée à l'écran (.fp-root { display:none }),
//   révélée uniquement à l'impression via @media print (le reste de l'appli est masqué).
// - Sections empilées verticalement dans l'ORDRE DU WIZARD ; chaque section répartit
//   ses cartes sur 1→N colonnes selon le nombre d'items, plafonné à 3 (mode Fiche) ou 2 (mode Manuel).
// - Le déclenchement (window.print) vit dans le parent FichePersonnageView.

interface FicheImprimableProps {
  printMode: "fiche" | "manuel";
  fiche: FichePersonnage;
  xpDisponible: number;
  traits: Trait[];
  competencesGroupees: CompetenceGroupee[];
  sorts: Sort[];
  prieres: Priere[];
  assemblages: Assemblage[];
  recettes: Recette[];
  manipulations: ManipulationAlchimique[];
  objetsForge: ObjetForge[];
  reparationsForge: ReparationForge[];
  objetsJoaillerie: ObjetJoaillerie[];
  artisanatEtat: ArtisanatEtat | null;
  piegesCatalogue: PiegeRow[];
  personnagePieges: PersonnagePiegeRow[];
  langues: { id: string; nom: string | null }[] | undefined;
  religions: { id: string; nom: string | null }[] | undefined;
}

const PRINT_CSS = `
.fp-root { display: none; }
@media print {
  body * { visibility: hidden !important; }
  #fiche-imprimable, #fiche-imprimable * { visibility: visible !important; }
  #fiche-imprimable {
    display: block !important;
    position: absolute; left: 0; top: 0; width: 100%;
    padding: 0;
  }
  #fiche-imprimable .fp-card { break-inside: avoid; }
  #fiche-imprimable h2, #fiche-imprimable h3 { break-after: avoid; }
}
/* Impression économe en encre (option A) : aucun aplat de couleur,
   badges/formules en contour fin, filets de titre gris fins, texte noir. */
#fiche-imprimable { font-family: Arial, sans-serif; color: #111; margin: 0; }
#fiche-imprimable h1 { font-family: Georgia, "Times New Roman", serif; font-size: 23px; margin: 0 0 2px; }
#fiche-imprimable .fp-sub { color: #555; font-size: 12px; margin: 0 0 14px; }
#fiche-imprimable h2 { font-family: Georgia, serif; font-size: 16px; margin: 18px 0 7px; border-bottom: 1px solid #999; padding-bottom: 2px; }
#fiche-imprimable h3 { font-size: 11.5px; margin: 10px 0 4px; color: #444; font-weight: bold; }
#fiche-imprimable .fp-grid { display: grid; gap: 8px; }
#fiche-imprimable .fp-kv { display: grid; gap: 3px 14px; margin-bottom: 8px; }
#fiche-imprimable .fp-kv .fp-item { font-size: 12px; }
#fiche-imprimable .fp-label { font-weight: bold; }
#fiche-imprimable .fp-prose { font-size: 11.5px; color: #222; white-space: pre-wrap; margin: 0 0 6px; }
#fiche-imprimable .fp-card { border: 1px solid #bbb; border-radius: 4px; padding: 8px 10px; }
#fiche-imprimable .fp-card-title { font-weight: bold; font-size: 12.5px; }
#fiche-imprimable .fp-card-row { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
#fiche-imprimable .fp-badge { display: inline-block; border: 1px solid #777; border-radius: 3px; padding: 0 5px; font-size: 10px; white-space: nowrap; color: #333; }
#fiche-imprimable .fp-muted { color: #555; font-size: 10.5px; margin-top: 2px; }
#fiche-imprimable .fp-desc { font-size: 11px; color: #222; margin-top: 5px; border-top: 1px solid #ddd; padding-top: 4px; white-space: pre-wrap; }
#fiche-imprimable .fp-formula { font-family: monospace; border: 1px dashed #999; padding: 1px 5px; border-radius: 2px; font-size: 10px; display: inline-block; margin-top: 3px; color: #333; }
`;

export const FicheImprimable = ({
  printMode,
  fiche,
  xpDisponible,
  traits,
  competencesGroupees,
  sorts,
  prieres,
  assemblages,
  recettes,
  manipulations,
  objetsForge,
  reparationsForge,
  objetsJoaillerie,
  artisanatEtat,
  piegesCatalogue,
  personnagePieges,
  langues,
  religions,
}: FicheImprimableProps) => {
  // Plafond colonnes : 3 en Fiche (compact), 2 en Manuel (verbatim long, plus lisible).
  const cap = printMode === "manuel" ? 2 : 3;
  const colsFor = (n: number) => Math.min(Math.max(n, 1), cap);
  const gridStyle = (n: number) => ({ gridTemplateColumns: `repeat(${colsFor(n)}, 1fr)` });

  // Description selon le mode : Fiche = courte (repli verbatim) ; Manuel = verbatim.
  const desc = (court?: string | null, complet?: string | null) => {
    const d = printMode === "fiche" ? court ?? complet : complet;
    return d ? <div className="fp-desc">{d}</div> : null;
  };

  const niveauAlchimie = artisanatEtat?.niveau_alchimie ?? 0;
  const niveauForge = artisanatEtat?.niveau_forge ?? 0;
  const niveauJoaillerie = artisanatEtat?.niveau_joaillerie ?? 0;
  const niveauPieges = artisanatEtat?.niveau_pieges ?? 0;

  // Regroupements (miroir de l'ancien handlePrint).
  const sortsByCercle: Record<string, Sort[]> = {};
  sorts.forEach((s) => {
    (sortsByCercle[s.cercle] ||= []).push(s);
  });

  const prieresByDomaine: Record<string, Priere[]> = {};
  prieres.forEach((p) => {
    (prieresByDomaine[p.domaine] ||= []).push(p);
  });

  const recettesByNiveau: Record<number, Recette[]> = {};
  recettes.forEach((r) => {
    (recettesByNiveau[r.niveau_requis] ||= []).push(r);
  });

  const niveauLabels: Record<number, string> = {
    1: "Recettes mineures (Niv. 1)",
    2: "Recettes intermédiaires (Niv. 2)",
    3: "Recettes majeures (Niv. 3)",
  };

  const piegeCatPrint = new Map<string, PiegeRow>();
  piegesCatalogue.forEach((p) => piegeCatPrint.set(`${p.nom}__${p.niveau}`, p));
  const famillesPieges: [string, number[]][] = (() => {
    const map = new Map<string, number[]>();
    personnagePieges.forEach((pp) => {
      const arr = map.get(pp.piege_nom) ?? [];
      arr.push(pp.niveau_acquis);
      map.set(pp.piege_nom, arr);
    });
    map.forEach((a) => a.sort((x, y) => x - y));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "fr"));
  })();

  // Détail textuel d'une compétence groupée (miroir handlePrint).
  const detailCompetence = (c: CompetenceGroupee): string => {
    if (c.type_achat === "simple") {
      return c.rows.map((r) => `Niv. ${r.niveau_acquis}`).join(", ");
    }
    if (c.type_achat === "multiple_sans_choix") {
      return `× ${c.rows.length} achats`;
    }
    if (c.type_achat === "multiple_choix_distinct") {
      return c.rows
        .map((r) => resoudreChoixAffichage(r.choix_achat, langues, religions) ?? r.choix_achat ?? "?")
        .join(", ");
    }
    return c.rows
      .map((r) => {
        const choix = resoudreChoixAffichage(r.choix_achat, langues, religions);
        return `Niv. ${r.niveau_acquis}${choix ? ` (${choix})` : ""}`;
      })
      .join(", ");
  };

  const verbatimCompetence = (c: CompetenceGroupee) => {
    const parNiveau = new Map<number, string>();
    c.rows.forEach((r) => {
      if (r.description_niveau_acquis && !parNiveau.has(r.niveau_acquis)) {
        parNiveau.set(r.niveau_acquis, r.description_niveau_acquis);
      }
    });
    return [...parNiveau.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([niv, d]) => (
        <div className="fp-desc" key={niv}>
          <strong>Niveau {niv}</strong> — {d}
        </div>
      ));
  };

  const manipulationsVisibles = manipulations.filter((m) => (m.niveau ?? 0) <= niveauAlchimie);

  return (
    <div id="fiche-imprimable" className="fp-root">
      <style>{PRINT_CSS}</style>

      <h1>{fiche.nom}</h1>
      <p className="fp-sub">
        {fiche.race_nom ?? ""}
        {fiche.race_nom_latin ? ` (${fiche.race_nom_latin})` : ""} — {fiche.classe_nom ?? ""} — Niveau {fiche.niveau}
      </p>

      {/* 1. Informations générales + Historique/Âme */}
      <h2>Informations générales</h2>
      <div className="fp-kv" style={gridStyle(8)}>
        <div className="fp-item"><span className="fp-label">PV Max :</span> {fiche.pv_max}</div>
        <div className="fp-item"><span className="fp-label">PS Max :</span> {fiche.ps_max}</div>
        <div className="fp-item"><span className="fp-label">XP Total :</span> {fiche.xp_total}</div>
        <div className="fp-item"><span className="fp-label">XP Dépensé :</span> {fiche.xp_depense}</div>
        <div className="fp-item"><span className="fp-label">XP Disponible :</span> {xpDisponible}</div>
        {fiche.religion_nom && (
          <div className="fp-item"><span className="fp-label">Religion :</span> {fiche.religion_nom}</div>
        )}
        <div className="fp-item"><span className="fp-label">GN complétés :</span> {fiche.gn_completes}</div>
        <div className="fp-item"><span className="fp-label">Mini-GN :</span> {fiche.mini_gn_completes}</div>
        <div className="fp-item"><span className="fp-label">Ouvertures terrain :</span> {fiche.ouvertures_terrain}</div>
      </div>
      {fiche.historique && (
        <>
          <h3>Historique</h3>
          <p className="fp-prose">{fiche.historique}</p>
        </>
      )}
      {fiche.ame_personnage && (
        <>
          <h3>Âme</h3>
          <p className="fp-prose">{fiche.ame_personnage}</p>
        </>
      )}

      {/* 2. Identité & traits */}
      <h2>Identité &amp; traits</h2>
      <div className="fp-grid" style={gridStyle(2 + traits.length)}>
        <div className="fp-card">
          <div className="fp-card-title">
            {fiche.race_emoji ? `${fiche.race_emoji} ` : ""}Race — {fiche.race_nom ?? ""}
            {fiche.race_nom_latin ? <em> ({fiche.race_nom_latin})</em> : ""}
          </div>
          {fiche.race_esperance_vie && (
            <div className="fp-muted"><strong>Espérance de vie :</strong> {fiche.race_esperance_vie}</div>
          )}
          {fiche.race_exigences_costume && (
            <div className="fp-muted"><strong>Exigences de costume :</strong> {fiche.race_exigences_costume}</div>
          )}
          {desc(fiche.race_description_courte, fiche.race_description)}
        </div>
        <div className="fp-card">
          <div className="fp-card-title">
            {fiche.classe_emoji ? `${fiche.classe_emoji} ` : ""}Classe — {fiche.classe_nom ?? ""}
          </div>
          {fiche.classe_role_combat && (
            <div className="fp-muted"><strong>Rôle de combat :</strong> {fiche.classe_role_combat}</div>
          )}
          {desc(fiche.classe_description_courte, fiche.classe_description)}
        </div>
        {traits.map((t) => (
          <div className="fp-card" key={t.id}>
            <div className="fp-card-title">Trait — {t.nom}</div>
            {t.description && <div className="fp-desc">{t.description}</div>}
          </div>
        ))}
      </div>

      {/* 3. Compétences (cartes, mode Fiche ET Manuel) */}
      {competencesGroupees.length > 0 && (
        <>
          <h2>Compétences</h2>
          <div className="fp-grid" style={gridStyle(competencesGroupees.length)}>
            {competencesGroupees.map((c) => {
              const detail = detailCompetence(c);
              const statut =
                c.statut_maitre !== "non_requis"
                  ? ` • ${STATUT_MAITRE_LABELS[c.statut_maitre] || c.statut_maitre}`
                  : "";
              return (
                <div className="fp-card" key={c.competence_id}>
                  <div className="fp-card-row">
                    <div className="fp-card-title">{c.nom}</div>
                    <span className="fp-badge">{c.xp_total === 0 ? "Gratuit" : `${c.xp_total} XP`}</span>
                  </div>
                  <div className="fp-muted">
                    {c.categorie}
                    {detail ? ` • ${detail}` : ""}
                    {statut}
                  </div>
                  {printMode === "manuel" && verbatimCompetence(c)}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 4. Sorts arcaniques (par cercle) */}
      {sorts.length > 0 && (
        <>
          <h2>Sorts arcaniques</h2>
          {Object.entries(sortsByCercle).map(([cercle, sortsDuCercle]) => (
            <div key={cercle}>
              <h3>{cercle}</h3>
              <div className="fp-grid" style={gridStyle(sortsDuCercle.length)}>
                {sortsDuCercle.map((s) => (
                  <div className="fp-card" key={s.id}>
                    <div className="fp-card-row">
                      <div className="fp-card-title">{s.nom_personnalise}</div>
                      <span className="fp-badge">
                        {calculerCoutPS(
                          calculerCoutXP(
                            s.zone_choisie ?? "",
                            s.portee_choisie ?? "",
                            s.duree_choisie ?? "",
                            s.niveau_sort,
                            Number(s.cout_xp_base),
                          ),
                        )}{" "}
                        PS
                      </span>
                    </div>
                    {s.sort_nom_base && s.sort_nom_base !== s.nom_personnalise && (
                      <div className="fp-muted">Basé sur : {s.sort_nom_base}</div>
                    )}
                    {s.formule_magique && <div className="fp-formula">Formule : {s.formule_magique}</div>}
                    <div className="fp-muted">
                      {s.zone_choisie ? `Zone : ${s.zone_choisie}` : ""}
                      {s.portee_choisie ? ` • Portée : ${s.portee_choisie}` : ""}
                      {s.duree_choisie ? ` • Durée : ${s.duree_choisie}` : ""}
                    </div>
                    {desc(s.sort_description_courte, s.sort_description)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* 5. Prières divines (par domaine) */}
      {prieres.length > 0 && (
        <>
          <h2>Prières divines</h2>
          {Object.entries(prieresByDomaine).map(([domaine, prieresDuDomaine]) => (
            <div key={domaine}>
              <h3>{domaine}</h3>
              <div className="fp-grid" style={gridStyle(prieresDuDomaine.length)}>
                {prieresDuDomaine.map((p) => (
                  <div className="fp-card" key={p.id}>
                    <div className="fp-card-row">
                      <div className="fp-card-title">{p.nom_personnalise}</div>
                      {p.cout_xp_base != null && (
                        <span className="fp-badge">
                          {calculerCoutPS(
                            calculerCoutXP(
                              p.zone_choisie ?? "",
                              p.portee_choisie ?? "",
                              p.duree_choisie ?? "",
                              p.niveau_priere,
                              Number(p.cout_xp_base),
                            ),
                          )}{" "}
                          PS
                        </span>
                      )}
                    </div>
                    <div className="fp-muted">
                      {p.duree_incantation ? `Incantation : ${p.duree_incantation}` : ""}
                      {p.zone_choisie ? ` • Zone : ${p.zone_choisie}` : ""}
                      {p.portee_choisie ? ` • Portée : ${p.portee_choisie}` : ""}
                      {p.duree_choisie ? ` • Durée : ${p.duree_choisie}` : ""}
                    </div>
                    {desc(p.priere_description_courte, p.priere_description)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* 6. Assemblages de runes */}
      {assemblages.length > 0 && (
        <>
          <h2>Assemblages de runes</h2>
          <div className="fp-grid" style={gridStyle(assemblages.length)}>
            {assemblages.map((a) => (
              <div className="fp-card" key={a.id}>
                <div className="fp-card-row">
                  <div className="fp-card-title">{a.nom}</div>
                  {a.cout_ps != null && <span className="fp-badge">{a.cout_ps} PS</span>}
                </div>
                {a.cible && <div className="fp-muted">Cible : {a.cible}</div>}
                {a.runes_requises && a.runes_requises.length > 0 && (
                  <div className="fp-muted">Runes : {a.runes_requises.join(", ")}</div>
                )}
                {a.description && <div className="fp-desc">{a.description}</div>}
                {a.effet && (
                  <div className="fp-desc">
                    <strong>Effet :</strong> {a.effet}
                  </div>
                )}
                {printMode === "manuel" && a.texte_manuel && <div className="fp-desc">{a.texte_manuel}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* 7a. Alchimie */}
      {niveauAlchimie >= 1 && (
        <>
          <h2>Alchimie (Niv. {niveauAlchimie})</h2>
          {[1, 2, 3]
            .filter((n) => n <= niveauAlchimie && (recettesByNiveau[n]?.length ?? 0) > 0)
            .map((n) => (
              <div key={n}>
                <h3>{niveauLabels[n]}</h3>
                <div className="fp-grid" style={gridStyle((recettesByNiveau[n] ?? []).length)}>
                  {(recettesByNiveau[n] ?? []).map((r) => {
                    const { composants, manipulations: manips } = parseIngredientsRecette(r.ingredients);
                    return (
                      <div className="fp-card" key={r.id}>
                        <div className="fp-card-title">{r.nom}</div>
                        {r.effet && (
                          <div className="fp-desc">
                            <strong>Effet :</strong> {r.effet}
                          </div>
                        )}
                        {r.formule && (
                          <div className="fp-desc">
                            <strong>Formule :</strong> {r.formule}
                          </div>
                        )}
                        {composants.length > 0 && (
                          <div className="fp-desc">
                            <strong>Ingrédients :</strong> {composants.map(formaterComposant).join(" · ")}
                          </div>
                        )}
                        {manips.length > 0 && (
                          <div className="fp-desc">
                            <strong>Préparation :</strong>{" "}
                            {manips.map((e, i) => `${i + 1}. ${e}`).join("  ")}
                          </div>
                        )}
                        {r.description && <div className="fp-desc">{r.description}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          {manipulationsVisibles.length > 0 && (
            <>
              <h3>Manipulations alchimiques</h3>
              <div className="fp-grid" style={gridStyle(manipulationsVisibles.length)}>
                {manipulationsVisibles.map((m) => (
                  <div className="fp-card" key={m.id}>
                    <div className="fp-card-title">{m.nom ?? ""}</div>
                    {m.manipulations && <div className="fp-desc">{m.manipulations}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* 7b. Pièges */}
      {famillesPieges.length > 0 && (
        <>
          <h2>Pièges (Niv. {niveauPieges})</h2>
          <div className="fp-grid" style={gridStyle(famillesPieges.length)}>
            {famillesPieges.map(([nom, niveaux]) => {
              const nMax = niveaux[niveaux.length - 1];
              const pal = piegeCatPrint.get(`${nom}__${nMax}`);
              const construction = piegeCatPrint.get(`${nom}__1`)?.construction;
              return (
                <div className="fp-card" key={nom}>
                  <div className="fp-card-row">
                    <div className="fp-card-title">{nom}</div>
                    <span className="fp-badge">Niv. {niveaux.join(", ")}</span>
                  </div>
                  {pal?.niveau_effet != null && <div className="fp-muted">Effet de niveau {pal.niveau_effet}</div>}
                  {pal?.cible && <div className="fp-muted">Cible : {pal.cible}</div>}
                  {pal?.duree && <div className="fp-muted">Durée : {pal.duree}</div>}
                  {pal?.effets && <div className="fp-desc">{pal.effets}</div>}
                  {construction && (
                    <div className="fp-muted">
                      <strong>Construction :</strong> {construction}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 7c. Forge */}
      {niveauForge >= 1 && (
        <>
          <h2>Forge (Niv. {niveauForge})</h2>
          {objetsForge.length > 0 && (
            <>
              <h3>Fabrication</h3>
              <div className="fp-grid" style={gridStyle(objetsForge.length)}>
                {objetsForge.map((o) => (
                  <div className="fp-card" key={o.id}>
                    <div className="fp-card-title">{o.nom ?? ""}</div>
                    {o.description && <div className="fp-desc">{o.description}</div>}
                    {o.type && <div className="fp-muted">Type : {o.type}</div>}
                    {o.temps_fabrication_minutes != null && (
                      <div className="fp-muted">
                        <strong>Temps de fabrication :</strong> {o.temps_fabrication_minutes} min
                      </div>
                    )}
                    {o.materiaux_communs && (
                      <div className="fp-muted">
                        <strong>Matériaux communs :</strong> {o.materiaux_communs}
                      </div>
                    )}
                    {niveauForge >= 2 && o.materiaux_rares && (
                      <div className="fp-muted">
                        <strong>Matériaux rares :</strong> {o.materiaux_rares}
                      </div>
                    )}
                    {niveauForge >= 3 && (
                      <div className="fp-muted">
                        <em>Accès aux matériaux légendaires disponible.</em>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {reparationsForge.length > 0 && (
            <>
              <h3>Réparation</h3>
              <div className="fp-grid" style={gridStyle(reparationsForge.length)}>
                {reparationsForge.map((rep) => (
                  <div className="fp-card" key={rep.id}>
                    <div className="fp-card-title">{rep.nom_affichage}</div>
                    <div className="fp-muted">Catégorie : {rep.categorie}</div>
                    <div className="fp-muted">
                      <strong>Temps commun :</strong> {rep.temps_minutes} min
                    </div>
                    {niveauForge >= 2 && (
                      <div className="fp-muted">
                        <strong>Temps rare :</strong> {rep.temps_rare_minutes} min
                      </div>
                    )}
                    <div className="fp-muted">
                      <strong>Matériaux communs :</strong> {rep.materiaux}
                    </div>
                    {niveauForge >= 2 && (
                      <div className="fp-muted">
                        <strong>Matériaux rares :</strong> {rep.materiaux_rares}
                      </div>
                    )}
                    {rep.notes && (
                      <div className="fp-muted" style={{ fontStyle: "italic", marginTop: 4 }}>
                        {rep.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* 7d. Joaillerie */}
      {niveauJoaillerie >= 1 && (
        <>
          <h2>Joaillerie (Niv. {niveauJoaillerie})</h2>
          {objetsJoaillerie.length > 0 && (
            <>
              <h3>Fabrication</h3>
              <div className="fp-grid" style={gridStyle(objetsJoaillerie.length)}>
                {objetsJoaillerie.map((o) => (
                  <div className="fp-card" key={o.id}>
                    <div className="fp-card-title">{o.nom ?? ""}</div>
                    {o.description && <div className="fp-desc">{o.description}</div>}
                    {o.effet && (
                      <div className="fp-desc">
                        <strong>Effet :</strong> {o.effet}
                      </div>
                    )}
                    {o.temps_fabrication_minutes != null && (
                      <div className="fp-muted">
                        <strong>Temps de fabrication :</strong> {o.temps_fabrication_minutes} min
                        {niveauJoaillerie >= 2 && o.temps_rare_minutes != null
                          ? ` (commun) — ${o.temps_rare_minutes} min (rare)`
                          : ""}
                      </div>
                    )}
                    {o.materiaux_communs && (
                      <div className="fp-muted">
                        <strong>Matériaux communs :</strong> {o.materiaux_communs}
                      </div>
                    )}
                    {niveauJoaillerie >= 2 && o.materiaux_rares && (
                      <div className="fp-muted">
                        <strong>Matériaux rares :</strong> {o.materiaux_rares}
                      </div>
                    )}
                    {niveauJoaillerie >= 3 && (
                      <div className="fp-muted">
                        <em>Accès aux matériaux légendaires disponible.</em>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default FicheImprimable;
