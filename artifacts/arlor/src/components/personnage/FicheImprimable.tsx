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

// PDF-PATTERN-4 — Vue imprimable React, format "recette" unifié (s90).
// - Rendue dans le document principal, masquée à l'écran (.fp-root { display:none }),
//   révélée uniquement à l'impression via @media print (le reste de l'appli est masqué).
// - Cartes "recette" : titre + pastille XP, puis lignes étiquetées séparées par des filets fins.
//   Les sections hors périmètre (identité/traits, compétences, manipulations) gardent
//   l'ancienne carte (.fp-card sans .fp-recette).
// - Encre économe : aucun aplat, contours fins, filets gris, texte noir.
// - Le déclenchement de l'impression vit dans le parent FichePersonnageView.

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
/* Impression économe en encre : aucun aplat, contours fins, filets gris, texte noir. */
#fiche-imprimable { font-family: Arial, sans-serif; color: #111; margin: 0; }
#fiche-imprimable h1 { font-family: Georgia, "Times New Roman", serif; font-size: 23px; margin: 0 0 2px; }
#fiche-imprimable .fp-sub { color: #555; font-size: 12px; margin: 0 0 14px; }
#fiche-imprimable h2 { font-family: Georgia, serif; font-size: 16px; margin: 18px 0 7px; border-bottom: 1px solid #999; padding-bottom: 2px; }
#fiche-imprimable h3 { font-size: 11.5px; margin: 11px 0 5px; color: #444; font-weight: bold; text-transform: uppercase; letter-spacing: .03em; }
#fiche-imprimable .fp-grid { display: grid; gap: 9px; }
#fiche-imprimable .fp-kv { display: grid; gap: 3px 14px; grid-template-columns: repeat(3, 1fr); margin-bottom: 8px; }
#fiche-imprimable .fp-kv .fp-item { font-size: 12px; }
#fiche-imprimable .fp-label { font-weight: bold; }
#fiche-imprimable .fp-prose { font-size: 11.5px; color: #222; white-space: pre-wrap; margin: 0 0 6px; }
/* Historique / Âme : deux cartes côte à côte + respiration sous le bloc. */
#fiche-imprimable .fp-hist { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 0 0 16px; }
/* Carte de base (sections hors périmètre : identité/traits, compétences, manipulations). */
#fiche-imprimable .fp-card { border: 1px solid #bbb; border-radius: 4px; padding: 8px 10px; }
#fiche-imprimable .fp-card-title { font-weight: bold; font-size: 12.5px; }
#fiche-imprimable .fp-card-row { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
#fiche-imprimable .fp-badge { display: inline-block; border: 1px solid #777; border-radius: 3px; padding: 0 6px; font-size: 10px; white-space: nowrap; color: #333; line-height: 16px; }
#fiche-imprimable .fp-muted { color: #555; font-size: 10.5px; margin-top: 2px; }
#fiche-imprimable .fp-desc { font-size: 11px; color: #222; margin-top: 5px; border-top: 1px solid #ddd; padding-top: 4px; white-space: pre-wrap; }
/* Carte "recette" (sorts, prières, assemblages, alchimie, pièges, forge, joaillerie). */
#fiche-imprimable .fp-card.fp-recette { padding: 0; overflow: hidden; }
#fiche-imprimable .fp-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; padding: 8px 10px 7px; }
#fiche-imprimable .fp-row { font-size: 11px; padding: 6px 10px; border-top: 1px solid #e2e2e2; white-space: pre-wrap; }
#fiche-imprimable .fp-row .fp-k { font-weight: bold; }
#fiche-imprimable .fp-row.fp-desc { color: #333; margin-top: 0; padding-top: 6px; border-top: 1px solid #e2e2e2; }
#fiche-imprimable .fp-row.fp-formula { font-family: monospace; color: #333; }
#fiche-imprimable .fp-lvl { border-top: 2px solid #ddd; }
#fiche-imprimable .fp-lvl-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 10px 4px; }
#fiche-imprimable .fp-lvl-title { font-weight: bold; font-size: 11.5px; color: #333; }
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

  // Description "carte" héritée (identité/traits) : Fiche = courte (repli verbatim) ; Manuel = verbatim.
  const desc = (court?: string | null, complet?: string | null) => {
    const d = printMode === "fiche" ? court ?? complet : complet;
    return d ? <div className="fp-desc">{d}</div> : null;
  };

  // Description "recette" : ligne dédiée. Fiche = courte (repli verbatim) ; Manuel = verbatim (repli courte).
  const descRow = (court?: string | null, complet?: string | null) => {
    const d = printMode === "fiche" ? court ?? complet : complet ?? court;
    return d ? <div className="fp-row fp-desc">{d}</div> : null;
  };

  // Pastille XP : 0 ou absent => "Gratuit" (zéro ambiguïté, convention compétences).
  const xpBadge = (v: number | null | undefined) =>
    v == null || Number(v) === 0 ? "Gratuit" : `${v} XP`;

  const niveauAlchimie = artisanatEtat?.niveau_alchimie ?? 0;
  const niveauForge = artisanatEtat?.niveau_forge ?? 0;
  const niveauJoaillerie = artisanatEtat?.niveau_joaillerie ?? 0;
  const niveauPieges = artisanatEtat?.niveau_pieges ?? 0;

  // Regroupements magie.
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

  // Pièges : catalogue par clé "nom__niveau", XP par niveau acquis, familles triées par niveau max DÉCROISSANT.
  const piegeCat = new Map<string, PiegeRow>();
  piegesCatalogue.forEach((p) => piegeCat.set(`${p.nom}__${p.niveau}`, p));
  const piegeXp = new Map<string, number>();
  const famN = new Map<string, number[]>();
  personnagePieges.forEach((pp) => {
    piegeXp.set(`${pp.piege_nom}__${pp.niveau_acquis}`, pp.xp_depense ?? 0);
    const arr = famN.get(pp.piege_nom) ?? [];
    arr.push(pp.niveau_acquis);
    famN.set(pp.piege_nom, arr);
  });
  famN.forEach((a) => a.sort((x, y) => x - y));
  const famillesPieges: [string, number[]][] = Array.from(famN.entries()).sort((a, b) => {
    const mA = a[1][a[1].length - 1];
    const mB = b[1][b[1].length - 1];
    return mB !== mA ? mB - mA : a[0].localeCompare(b[0], "fr");
  });

  // Détail textuel d'une compétence groupée (section hors périmètre, inchangée).
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

  // ── Cartes recette magie (réutilisées en empilé OU en côte à côte) ──
  const renderSortCard = (s: Sort) => {
    const xp = calculerCoutXP(
      s.zone_choisie ?? "",
      s.portee_choisie ?? "",
      s.duree_choisie ?? "",
      s.niveau_sort,
      Number(s.cout_xp_base),
    );
    return (
      <div className="fp-card fp-recette" key={s.id}>
        <div className="fp-card-head">
          <div className="fp-card-title">{s.nom_personnalise}</div>
          <span className="fp-badge">{xp} XP</span>
        </div>
        {s.sort_nom_base && s.sort_nom_base !== s.nom_personnalise && (
          <div className="fp-row"><span className="fp-k">Basé sur :</span> {s.sort_nom_base}</div>
        )}
        <div className="fp-row"><span className="fp-k">Niveau du sort :</span> {s.niveau_sort}</div>
        {s.formule_magique && (
          <div className="fp-row fp-formula"><span className="fp-k">Formule :</span> {s.formule_magique}</div>
        )}
        {s.zone_choisie && <div className="fp-row"><span className="fp-k">Zone :</span> {s.zone_choisie}</div>}
        {s.portee_choisie && <div className="fp-row"><span className="fp-k">Portée :</span> {s.portee_choisie}</div>}
        {s.duree_choisie && <div className="fp-row"><span className="fp-k">Durée :</span> {s.duree_choisie}</div>}
        <div className="fp-row"><span className="fp-k">Coût de lancement :</span> {calculerCoutPS(xp)} PS</div>
        {descRow(s.sort_description_courte, s.sort_description)}
      </div>
    );
  };

  const renderPriereCard = (p: Priere) => {
    const xp = calculerCoutXP(
      p.zone_choisie ?? "",
      p.portee_choisie ?? "",
      p.duree_choisie ?? "",
      p.niveau_priere,
      Number(p.cout_xp_base ?? 0),
    );
    return (
      <div className="fp-card fp-recette" key={p.id}>
        <div className="fp-card-head">
          <div className="fp-card-title">{p.nom_personnalise}</div>
          {p.cout_xp_base != null && <span className="fp-badge">{xp} XP</span>}
        </div>
        <div className="fp-row"><span className="fp-k">Niveau de la prière :</span> {p.niveau_priere}</div>
        {p.duree_incantation_calculee != null && (
          <div className="fp-row"><span className="fp-k">Incantation :</span> {p.duree_incantation_calculee} s</div>
        )}
        {p.zone_choisie && <div className="fp-row"><span className="fp-k">Zone :</span> {p.zone_choisie}</div>}
        {p.portee_choisie && <div className="fp-row"><span className="fp-k">Portée :</span> {p.portee_choisie}</div>}
        {p.duree_choisie && <div className="fp-row"><span className="fp-k">Durée :</span> {p.duree_choisie}</div>}
        {p.cout_xp_base != null && (
          <div className="fp-row"><span className="fp-k">Coût de lancement :</span> {calculerCoutPS(xp)} PS</div>
        )}
        {descRow(p.priere_description_courte, p.priere_description)}
      </div>
    );
  };

  const sortsSection = (
    <>
      <h2 style={{ marginTop: 0 }}>Sorts arcaniques</h2>
      {Object.entries(sortsByCercle).map(([cercle, sortsDuCercle]) => (
        <div key={cercle}>
          <h3>{cercle}</h3>
          <div className="fp-grid" style={gridStyle(sortsDuCercle.length)}>
            {sortsDuCercle.map(renderSortCard)}
          </div>
        </div>
      ))}
    </>
  );

  const prieresSection = (
    <>
      <h2 style={{ marginTop: 0 }}>Prières divines</h2>
      {Object.entries(prieresByDomaine).map(([domaine, prieresDuDomaine]) => (
        <div key={domaine}>
          <h3>{domaine}</h3>
          <div className="fp-grid" style={gridStyle(prieresDuDomaine.length)}>
            {prieresDuDomaine.map(renderPriereCard)}
          </div>
        </div>
      ))}
    </>
  );

  // Sorts | Prières côte à côte uniquement si peu de magie (en pratique 1 sort + 1 prière).
  const coteACote = sorts.length > 0 && prieres.length > 0 && sorts.length + prieres.length < 3;

  return (
    <div id="fiche-imprimable" className="fp-root">
      <style>{PRINT_CSS}</style>

      <h1>{fiche.nom}</h1>
      <p className="fp-sub">
        {fiche.race_nom ?? ""}
        {fiche.race_nom_latin ? ` (${fiche.race_nom_latin})` : ""} — {fiche.classe_nom ?? ""} — Niveau {fiche.niveau}
      </p>

      {/* 1. Informations générales + Historique/Âme (2 cartes) */}
      <h2>Informations générales</h2>
      <div className="fp-kv">
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
      {(fiche.historique || fiche.ame_personnage) && (
        <div className="fp-hist">
          {fiche.historique && (
            <div className="fp-card">
              <div className="fp-card-title">Historique</div>
              <p className="fp-prose">{fiche.historique}</p>
            </div>
          )}
          {fiche.ame_personnage && (
            <div className="fp-card">
              <div className="fp-card-title">Âme</div>
              <p className="fp-prose">{fiche.ame_personnage}</p>
            </div>
          )}
        </div>
      )}

      {/* 2. Identité & traits (hors périmètre recette) */}
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

      {/* 3. Compétences (hors périmètre recette, inchangé) */}
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

      {/* 4-5. Magie : côte à côte si peu d'items, sinon empilé */}
      {coteACote ? (
        <div className="fp-grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
          <div>{sortsSection}</div>
          <div>{prieresSection}</div>
        </div>
      ) : (
        <>
          {sorts.length > 0 && <>{sortsSection}</>}
          {prieres.length > 0 && <>{prieresSection}</>}
        </>
      )}

      {/* 6. Assemblages de runes */}
      {assemblages.length > 0 && (
        <>
          <h2>Assemblages de runes</h2>
          <div className="fp-grid" style={gridStyle(assemblages.length)}>
            {assemblages.map((a) => (
              <div className="fp-card fp-recette" key={a.id}>
                <div className="fp-card-head">
                  <div className="fp-card-title">{a.nom}</div>
                  <span className="fp-badge">{xpBadge(a.xp_depense)}</span>
                </div>
                {a.cible && <div className="fp-row"><span className="fp-k">Cible :</span> {a.cible}</div>}
                {a.cout_ps != null && <div className="fp-row"><span className="fp-k">Coût :</span> {a.cout_ps} PS</div>}
                {a.runes_requises && a.runes_requises.length > 0 && (
                  <div className="fp-row"><span className="fp-k">Runes :</span> {a.runes_requises.join(" · ")}</div>
                )}
                {a.effet && <div className="fp-row"><span className="fp-k">Effet :</span> {a.effet}</div>}
                {descRow(a.description, a.texte_manuel)}
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
                      <div className="fp-card fp-recette" key={r.id}>
                        <div className="fp-card-head">
                          <div className="fp-card-title">{r.nom}</div>
                          <span className="fp-badge">{xpBadge(r.xp_depense)}</span>
                        </div>
                        {r.effet && <div className="fp-row"><span className="fp-k">Effet :</span> {r.effet}</div>}
                        {r.formule && (
                          <div className="fp-row fp-formula"><span className="fp-k">Formule :</span> {r.formule}</div>
                        )}
                        {composants.length > 0 && (
                          <div className="fp-row">
                            <span className="fp-k">Ingrédients :</span> {composants.map(formaterComposant).join(" · ")}
                          </div>
                        )}
                        {manips.length > 0 && (
                          <div className="fp-row">
                            <span className="fp-k">Préparation :</span>{" "}
                            {manips.map((e, i) => `${i + 1}. ${e}`).join("  ")}
                          </div>
                        )}
                        {r.description && <div className="fp-row fp-desc">{r.description}</div>}
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

      {/* 7b. Pièges (une carte par famille, sous-blocs par niveau, familles triées niveau max ↓) */}
      {famillesPieges.length > 0 && (
        <>
          <h2>Pièges (Niv. {niveauPieges})</h2>
          <div className="fp-grid" style={gridStyle(famillesPieges.length)}>
            {famillesPieges.map(([nom, niveaux]) => {
              const constrRaw = piegeCat.get(`${nom}__1`)?.construction;
              const constr = constrRaw ? constrRaw.replace(/^\s*Construction\s*:\s*/i, "") : null;
              return (
                <div className="fp-card fp-recette" key={nom}>
                  <div className="fp-card-head">
                    <div className="fp-card-title">{nom}</div>
                  </div>
                  {niveaux.map((niv) => {
                    const cat = piegeCat.get(`${nom}__${niv}`);
                    const xp = piegeXp.get(`${nom}__${niv}`) ?? 0;
                    return (
                      <div className="fp-lvl" key={niv}>
                        <div className="fp-lvl-head">
                          <span className="fp-lvl-title">Niveau {niv}</span>
                          <span>
                            {cat?.niveau_effet != null && (
                              <span className="fp-badge">Effet {cat.niveau_effet}</span>
                            )}{" "}
                            <span className="fp-badge">{xpBadge(xp)}</span>
                          </span>
                        </div>
                        {cat?.cible && <div className="fp-row"><span className="fp-k">Cible :</span> {cat.cible}</div>}
                        {cat?.duree && <div className="fp-row"><span className="fp-k">Durée :</span> {cat.duree}</div>}
                        {cat?.effets && (
                          <div className="fp-row fp-desc"><span className="fp-k">Effet :</span> {cat.effets}</div>
                        )}
                      </div>
                    );
                  })}
                  {constr && (
                    <div className="fp-row"><span className="fp-k">Construction :</span> {constr}</div>
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
                  <div className="fp-card fp-recette" key={o.id}>
                    <div className="fp-card-head">
                      <div className="fp-card-title">{o.nom ?? ""}</div>
                      <span className="fp-badge">{xpBadge(o.cout_xp)}</span>
                    </div>
                    {o.type && <div className="fp-row"><span className="fp-k">Type :</span> {o.type}</div>}
                    {o.temps_fabrication_minutes != null && (
                      <div className="fp-row"><span className="fp-k">Temps de fabrication :</span> {o.temps_fabrication_minutes} min</div>
                    )}
                    {o.materiaux_communs && (
                      <div className="fp-row"><span className="fp-k">Matériaux communs :</span> {o.materiaux_communs}</div>
                    )}
                    {niveauForge >= 2 && o.materiaux_rares && (
                      <div className="fp-row"><span className="fp-k">Matériaux rares :</span> {o.materiaux_rares}</div>
                    )}
                    {niveauForge >= 3 && (
                      <div className="fp-row fp-desc"><em>Accès aux matériaux légendaires disponible.</em></div>
                    )}
                    {o.description && <div className="fp-row fp-desc">{o.description}</div>}
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
                  <div className="fp-card fp-recette" key={rep.id}>
                    <div className="fp-card-head">
                      <div className="fp-card-title">{rep.nom_affichage}</div>
                    </div>
                    <div className="fp-row"><span className="fp-k">Catégorie :</span> {rep.categorie}</div>
                    <div className="fp-row"><span className="fp-k">Temps commun :</span> {rep.temps_minutes} min</div>
                    {niveauForge >= 2 && (
                      <div className="fp-row"><span className="fp-k">Temps rare :</span> {rep.temps_rare_minutes} min</div>
                    )}
                    <div className="fp-row"><span className="fp-k">Matériaux communs :</span> {rep.materiaux}</div>
                    {niveauForge >= 2 && (
                      <div className="fp-row"><span className="fp-k">Matériaux rares :</span> {rep.materiaux_rares}</div>
                    )}
                    {rep.notes && <div className="fp-row fp-desc">{rep.notes}</div>}
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
                  <div className="fp-card fp-recette" key={o.id}>
                    <div className="fp-card-head">
                      <div className="fp-card-title">{o.nom ?? ""}</div>
                      <span className="fp-badge">{xpBadge(o.cout_xp)}</span>
                    </div>
                    {o.effet && <div className="fp-row"><span className="fp-k">Effet :</span> {o.effet}</div>}
                    {o.temps_fabrication_minutes != null && (
                      <div className="fp-row">
                        <span className="fp-k">Temps de fabrication :</span> {o.temps_fabrication_minutes} min
                        {niveauJoaillerie >= 2 && o.temps_rare_minutes != null
                          ? ` (commun) — ${o.temps_rare_minutes} min (rare)`
                          : ""}
                      </div>
                    )}
                    {o.materiaux_communs && (
                      <div className="fp-row"><span className="fp-k">Matériaux communs :</span> {o.materiaux_communs}</div>
                    )}
                    {niveauJoaillerie >= 2 && o.materiaux_rares && (
                      <div className="fp-row"><span className="fp-k">Matériaux rares :</span> {o.materiaux_rares}</div>
                    )}
                    {niveauJoaillerie >= 3 && (
                      <div className="fp-row fp-desc"><em>Accès aux matériaux légendaires disponible.</em></div>
                    )}
                    {o.description && <div className="fp-row fp-desc">{o.description}</div>}
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
