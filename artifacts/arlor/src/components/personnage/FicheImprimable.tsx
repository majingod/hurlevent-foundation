import { Fragment } from "react";
import { calculerCoutPS, calculerCoutXP, rendreEffetInstance } from "@/utils/calculsMagie";
import type { PalierSort, EffetInstance } from "@/utils/calculsMagie";
import { parseIngredientsRecette, formaterComposant } from "@/utils/alchimie";
import { STATUT_MAITRE_LABELS } from "@/constants/labels";
import { resoudreChoixAffichage } from "./sections/helpers";
import { RappelFouillePrint, FOUILLE_ABREGE } from "./RappelFouille";
import type { Json } from "@/integrations/supabase/types";
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
  ObjetJoaillerie,
  CompetenceGroupee,
  PiegeRow,
  PersonnagePiegeRow,
} from "./sections/types";

// PDF-PATTERN-4 — Vue imprimable React, deux variantes (s299 v2) :
// - ABRÉGÉ ("fiche") : layout « journal » (racine .fp-compact) — corps 19px (s363 :
//   lisibilité terrain > tenir en 2 pages ; arbitrage Fred, GN en faible lumière),
//   colonnes doubles, catalogues d'artisanat en tableaux filtrés au niveau.
// - INTÉGRAL ("manuel") : layout carte historique inchangé (verbatims, historique/âme,
//   catalogues complets), à une exception : la réparation est fusionnée dans la carte
//   de chaque objet forgé (jointure objets_forge → reparations_forge).
// - Rendue dans le document principal, masquée à l'écran (.fp-root { display:none }),
//   révélée uniquement à l'impression via @media print (le reste de l'appli est masqué).
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
  objetsJoaillerie: ObjetJoaillerie[];
  artisanatEtat: ArtisanatEtat | null;
  piegesCatalogue: PiegeRow[];
  personnagePieges: PersonnagePiegeRow[];
  langues: { id: string; nom: string | null }[] | undefined;
  religions:
    | {
        id: string;
        nom: string | null;
        lore_fiche?: string | null;
        rituels_fiche?: string[] | null;
        lore_manuel?: string | null;
        rituels_manuel?: string[] | null;
      }[]
    | undefined;
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
/* ── Variante ABRÉGÉ « terrain » (s363) — layout « journal », racine .fp-compact ──
   Arbitrage Fred s363 : lisibilité en forêt/faible lumière > tenir en 2 pages.
   Corps 19px (×2 de s299) · méta/tableaux 17px · formules 20px mono ·
   bandeau de stats 21px gras · gris assombris pour la lampe frontale. */
#fiche-imprimable.fp-compact { font-size: 19px; line-height: 1.32; }
#fiche-imprimable.fp-compact h1 { font-size: 26px; display: inline; margin: 0; }
#fiche-imprimable.fp-compact .fp-sub { display: inline; margin-left: 8px; font-size: 18px; color: #222; }
#fiche-imprimable.fp-compact .fp-statband { display: flex; flex-wrap: wrap; gap: 4px 18px; border-top: 1.5px solid #111; border-bottom: 1.5px solid #111; padding: 5px 0; font-size: 21px; font-weight: bold; margin: 8px 0 10px; }
#fiche-imprimable.fp-compact .fp-fouille { border: 1px solid #555; padding: 6px 9px; font-size: 18px; margin: 0 0 10px; }
#fiche-imprimable.fp-compact h2 { font-size: 20px; margin: 12px 0 5px; padding-bottom: 2px; }
#fiche-imprimable.fp-compact .fp-cols2 { column-count: 2; column-gap: 22px; }
#fiche-imprimable.fp-compact .fp-it { break-inside: avoid; margin: 0 0 7px; }
#fiche-imprimable.fp-compact .fp-it b { font-size: 20px; }
#fiche-imprimable.fp-compact .fp-meta { color: #333; font-size: 17px; }
#fiche-imprimable.fp-compact .fp-bloc { break-inside: avoid; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px dotted #999; }
#fiche-imprimable.fp-compact .fp-params { color: #222; font-size: 17px; }
#fiche-imprimable.fp-compact .fp-formula { font-family: "Courier New", monospace; font-size: 20px; }
#fiche-imprimable.fp-compact table { width: 100%; border-collapse: collapse; font-size: 17px; margin: 3px 0 12px; }
#fiche-imprimable.fp-compact th { text-align: left; border-bottom: 1px solid #555; padding: 2px 6px 2px 0; font-size: 16px; text-transform: uppercase; letter-spacing: .02em; color: #111; }
#fiche-imprimable.fp-compact td { border-bottom: 1px solid #ccc; padding: 3px 6px 3px 0; vertical-align: top; }
#fiche-imprimable.fp-compact td b { font-size: 18px; }
#fiche-imprimable.fp-compact tr.fp-grptype td { border-bottom: 1px solid #777; font-weight: bold; font-size: 16px; text-transform: uppercase; color: #111; padding-top: 6px; }
#fiche-imprimable.fp-compact table, #fiche-imprimable.fp-compact .fp-it, #fiche-imprimable.fp-compact .fp-bloc { break-inside: avoid; }
`;

// Nom court d'assemblage : préfixe « Assemblage de / d' » retiré, majuscule rétablie.
const nomCourtAssemblage = (nom: string): string => {
  const court = nom.replace(/^assemblage\s+d(?:e\s+|['’]\s*)/i, "").trim();
  return court ? court.charAt(0).toLocaleUpperCase("fr") + court.slice(1) : nom;
};

// Ingrédients compacts d'une recette : clés de l'objet `ingredients` sauf
// `manipulations`, underscores → espaces, quantité > 1 → « ×N ».
const ingredientsCompact = (ingredients: Json | null): string => {
  if (!ingredients || typeof ingredients !== "object" || Array.isArray(ingredients)) return "";
  return Object.entries(ingredients as Record<string, unknown>)
    .filter(([cle]) => cle !== "manipulations")
    .map(([cle, valeur]) => {
      const quantite = Number(valeur);
      return `${cle.replace(/_/g, " ")}${Number.isFinite(quantite) && quantite > 1 ? ` ×${quantite}` : ""}`;
    })
    .join(", ");
};

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

  const palierActifRow = (paliers: PalierSort[] | null | undefined, niveau: number) => {
    if (!paliers || paliers.length === 0) return null;
    const atteints = paliers.filter((p) => p.niveau <= niveau);
    if (atteints.length === 0) return null;
    const actif = atteints[atteints.length - 1];
    return (
      <div className="fp-row">
        <strong>Effet ({actif.libelle}) :</strong> {actif.texte}
      </div>
    );
  };

  // Effets calculés (s162) : si l'instance a un effet_instance rendu, ligne
  // statique « Effets : … » (rendu print sobre, sans pastille ni encadré) ;
  // sinon repli sur palierActifRow (comportement actuel).
  const effetRow = (
    effet: EffetInstance | null | undefined,
    paliers: PalierSort[] | null | undefined,
    niveau: number,
  ) => {
    const segments = rendreEffetInstance(effet, paliers, niveau);
    if (!segments) return null;
    return (
      <div className="fp-row">
        <strong>Effets :</strong>{" "}
        {segments.map((seg, i) =>
          seg.fort ? <strong key={i}>{seg.texte}</strong> : <span key={i}>{seg.texte}</span>,
        )}
      </div>
    );
  };

  // Effets calculés / palier actif, rendu compact (variante abrégé) : div nue 19px (héritée).
  const effetCompact = (
    effet: EffetInstance | null | undefined,
    paliers: PalierSort[] | null | undefined,
    niveau: number,
  ) => {
    const segments = rendreEffetInstance(effet, paliers, niveau);
    if (segments) {
      return (
        <div>
          <b>Effets :</b>{" "}
          {segments.map((seg, i) =>
            seg.fort ? <b key={i}>{seg.texte}</b> : <span key={i}>{seg.texte}</span>,
          )}
        </div>
      );
    }
    if (!paliers || paliers.length === 0) return null;
    const atteints = paliers.filter((p) => p.niveau <= niveau);
    if (atteints.length === 0) return null;
    const actif = atteints[atteints.length - 1];
    return (
      <div>
        <b>Effet ({actif.libelle}) :</b> {actif.texte}
      </div>
    );
  };

  // Pastille XP : 0 ou absent => "Gratuit" (zéro ambiguïté, convention compétences).
  const xpBadge = (v: number | null | undefined) =>
    v == null || Number(v) === 0 ? "Gratuit" : `${v} XP`;

  const niveauAlchimie = artisanatEtat?.niveau_alchimie ?? 0;
  const niveauForge = artisanatEtat?.niveau_forge ?? 0;
  const niveauJoaillerie = artisanatEtat?.niveau_joaillerie ?? 0;
  const niveauPieges = artisanatEtat?.niveau_pieges ?? 0;
  const niveauRunes = artisanatEtat?.niveau_runes ?? 0;

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

  // Textes du niveau acquis — canon s299 : Intégral = description_niveau_acquis.
  // (Le détail par niveau est réservé à la variante manuel depuis s299 v2.)
  const verbatimCompetence = (c: CompetenceGroupee) => {
    const parNiveau = new Map<number, string>();
    c.rows.forEach((r) => {
      const texte = r.description_niveau_acquis;
      if (texte && !parNiveau.has(r.niveau_acquis)) {
        parNiveau.set(r.niveau_acquis, texte);
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

  // Ligne réparation fusionnée (s299 v2) : jointure objets_forge → reparations_forge.
  const reparationTexte = (o: ObjetForge): string | null =>
    o.non_reparable || !o.reparation ? null : `${o.reparation.temps_minutes} min · ${o.reparation.materiaux}`;

  // ════════════════════════════════════════════════════════════════════
  // VARIANTE ABRÉGÉ — layout dense « journal » (s299 v2, maquette validée)
  // ════════════════════════════════════════════════════════════════════
  if (printMode === "fiche") {
    // Ligne Artisanat du bandeau : uniquement les niveaux ≥ 1.
    const artisanats = (
      [
        ["Alchimie", niveauAlchimie],
        ["Forge", niveauForge],
        ["Joaillerie", niveauJoaillerie],
        ["Pièges", niveauPieges],
        ["Runes", niveauRunes],
      ] as [string, number][]
    ).filter(([, n]) => n >= 1);

    // Sorts — groupement ×N : clé = base + niveau + zone + portée + durée + formule + nom perso.
    type BlocSort = { cle: string; sort: Sort; n: number };
    const blocsSorts: BlocSort[] = [];
    {
      const parCle = new Map<string, BlocSort>();
      [...sorts]
        .sort((a, b) => {
          const bA = a.sort_nom_base ?? a.nom_personnalise;
          const bB = b.sort_nom_base ?? b.nom_personnalise;
          return bA.localeCompare(bB, "fr") || a.niveau_sort - b.niveau_sort;
        })
        .forEach((s) => {
          const cle = [
            s.sort_nom_base ?? "",
            s.niveau_sort,
            s.zone_choisie ?? "",
            s.portee_choisie ?? "",
            s.duree_choisie ?? "",
            s.formule_magique ?? "",
            s.nom_personnalise ?? "",
          ].join("§");
          const existant = parCle.get(cle);
          if (existant) existant.n += 1;
          else {
            const bloc = { cle, sort: s, n: 1 };
            parCle.set(cle, bloc);
            blocsSorts.push(bloc);
          }
        });
    }
    // Dédoublonnage du résumé : au sein d'un même sort_nom_base, le resume_condense
    // n'est imprimé que sur le PREMIER bloc ; les suivants renvoient « même effet que niv. X ».
    const premierBlocParBase = new Map<string, BlocSort>();
    blocsSorts.forEach((b) => {
      const base = b.sort.sort_nom_base ?? b.sort.nom_personnalise;
      if (!premierBlocParBase.has(base) && b.sort.sort_resume_condense) {
        premierBlocParBase.set(base, b);
      }
    });

    // Pièges possédés groupés par nom (niveaux triés) — résumé du niveau max acquis.
    const piegesPossedes = [...famN.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));

    // Pièges catalogue : dédoublonnage strict nom + resume_condense entre niveaux.
    const catalogueMerge = new Map<string, { nom: string; resume: string | null; niveaux: number[] }>();
    piegesCatalogue.forEach((p) => {
      const cle = `${p.nom}§${p.resume_condense ?? ""}`;
      const existant = catalogueMerge.get(cle);
      if (existant) existant.niveaux.push(p.niveau);
      else catalogueMerge.set(cle, { nom: p.nom, resume: p.resume_condense, niveaux: [p.niveau] });
    });
    const cataloguePieges = [...catalogueMerge.values()]
      .map((e) => ({ ...e, niveaux: [...e.niveaux].sort((x, y) => x - y) }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr") || a.niveaux[0] - b.niveaux[0]);
    // Couvre tous les niveaux réalisables (1..N) → le titre de section suffit, pas de méta.
    const couvreTousNiveaux = (niveaux: number[]) =>
      niveaux.length === niveauPieges && niveaux[0] === 1;

    // Forge : lignes de regroupement par type (Accessoires / Armes / Armures / Boucliers).
    const forgeParType = new Map<string, ObjetForge[]>();
    objetsForge.forEach((o) => {
      const type = o.type ?? "Autres";
      (forgeParType.get(type) ?? forgeParType.set(type, []).get(type)!).push(o);
    });
    const typesForge = [...forgeParType.keys()].sort((a, b) => a.localeCompare(b, "fr"));
    const nbColsForge = niveauForge >= 2 ? 6 : 5;

    return (
      <div id="fiche-imprimable" className="fp-root fp-compact">
        <style>{PRINT_CSS}</style>

        {/* 1. En-tête inline — AUCUNE description de race/classe en abrégé */}
        <div>
          <h1>{fiche.nom}</h1>
          <span className="fp-sub">
            {fiche.race_nom ?? ""}
            {fiche.race_nom_latin ? ` (${fiche.race_nom_latin})` : ""} — {fiche.classe_nom ?? ""} —{" "}
            Niveau {fiche.niveau}
          </span>
        </div>

        {/* 2. Bandeau stats (religion : nom seul, pas de détails en abrégé) */}
        <div className="fp-statband">
          <span><b>PV</b> {fiche.pv_max}</span>
          <span><b>PS</b> {fiche.ps_max}</span>
          <span>
            <b>XP</b> {fiche.xp_total} total · {fiche.xp_depense} dépensé · {xpDisponible} dispo
          </span>
          <span>
            <b>GN</b> {fiche.gn_completes} · <b>Mini-GN</b> {fiche.mini_gn_completes} ·{" "}
            <b>Ouvertures</b> {fiche.ouvertures_terrain}
          </span>
          {fiche.religion_nom && (
            <span><b>Religion</b> {fiche.religion_nom}</span>
          )}
          {artisanats.length > 0 && (
            <span>
              <b>Artisanat</b> {artisanats.map(([nom, n]) => `${nom} ${n}`).join(" · ")}
            </span>
          )}
        </div>

        {/* 3. Fouille — rappel #604, texte abrégé, style compact */}
        <div className="fp-fouille">
          <b>🔍 Fouille.</b> {FOUILLE_ABREGE}
        </div>

        {/* 4. Traits raciaux (historique/âme : réservés à la variante intégral) */}
        {traits.length > 0 && (
          <>
            <h2>Traits raciaux</h2>
            <div className="fp-cols2">
              {traits.map((t) => (
                <div className="fp-it" key={t.id}>
                  <b>{t.nom}.</b> {t.resume_condense ?? t.texte_manuel ?? t.description}
                </div>
              ))}
            </div>
          </>
        )}

        {/* 5. Compétences (détail par niveau : réservé à la variante intégral) */}
        {competencesGroupees.length > 0 && (
          <>
            <h2>Compétences</h2>
            <div className="fp-cols2">
              {competencesGroupees.map((c) => {
                const meta = [
                  detailCompetence(c),
                  c.xp_total === 0 ? "Gratuit" : `${c.xp_total} XP`,
                  c.statut_maitre !== "non_requis"
                    ? STATUT_MAITRE_LABELS[c.statut_maitre] || c.statut_maitre
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div className="fp-it" key={c.competence_id}>
                    <b>{c.nom}</b> <span className="fp-meta">{meta}</span>
                    {c.competence_resume_condense ? <> — {c.competence_resume_condense}</> : null}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 6. Sorts — blocs groupés ×N, résumé dédoublonné par sort de base */}
        {blocsSorts.length > 0 && (
          <>
            <h2>Sorts arcaniques</h2>
            <div className="fp-cols2">
              {blocsSorts.map((bloc) => {
                const s = bloc.sort;
                const base = s.sort_nom_base ?? s.nom_personnalise;
                const premier = premierBlocParBase.get(base);
                const xp = calculerCoutXP(
                  s.zone_choisie ?? "",
                  s.portee_choisie ?? "",
                  s.duree_choisie ?? "",
                  s.niveau_sort,
                  Number(s.cout_xp_base),
                );
                const params = [
                  s.zone_choisie ? `Zone ${s.zone_choisie}` : null,
                  s.portee_choisie ? `Portée ${s.portee_choisie}` : null,
                  s.duree_choisie ? `Durée ${s.duree_choisie}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const meta = [
                  `niv. ${s.niveau_sort}`,
                  s.cercle,
                  s.sort_nom_base && s.sort_nom_base !== s.nom_personnalise ? s.sort_nom_base : null,
                  `${calculerCoutPS(xp)} PS`,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div className="fp-bloc" key={bloc.cle}>
                    <b>
                      {s.nom_personnalise}
                      {bloc.n > 1 ? ` ×${bloc.n}` : ""}
                    </b>{" "}
                    <span className="fp-meta">{meta}</span>
                    {params && <div className="fp-params">{params}</div>}
                    {s.formule_magique && <div className="fp-formula">« {s.formule_magique} »</div>}
                    {premier === bloc
                      ? s.sort_resume_condense && <div>{s.sort_resume_condense}</div>
                      : premier && (
                          <div className="fp-meta">même effet que niv. {premier.sort.niveau_sort}</div>
                        )}
                    {effetCompact(s.effet_instance, s.paliers, s.niveau_sort)}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 7. Prières */}
        {prieres.length > 0 && (
          <>
            <h2>Prières divines</h2>
            <div className="fp-cols2">
              {prieres.map((p) => {
                const xp = calculerCoutXP(
                  p.zone_choisie ?? "",
                  p.portee_choisie ?? "",
                  p.duree_choisie ?? "",
                  p.niveau_priere,
                  Number(p.cout_xp_base ?? 0),
                );
                const params = [
                  p.zone_choisie ? `Zone ${p.zone_choisie}` : null,
                  p.portee_choisie ? `Portée ${p.portee_choisie}` : null,
                  p.duree_choisie ? `Durée ${p.duree_choisie}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const meta = [
                  `niv. ${p.niveau_priere}`,
                  p.domaine,
                  p.duree_incantation_calculee != null
                    ? `incantation ${p.duree_incantation_calculee} s`
                    : null,
                  p.cout_xp_base != null ? `${calculerCoutPS(xp)} PS` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div className="fp-bloc" key={p.id}>
                    <b>{p.nom_personnalise}</b> <span className="fp-meta">{meta}</span>
                    {params && <div className="fp-params">{params}</div>}
                    {p.priere_resume_condense && <div>{p.priere_resume_condense}</div>}
                    {effetCompact(p.effet_instance, p.paliers, p.niveau_priere)}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 8. Assemblages de runes — nom court, méta PS · cible */}
        {assemblages.length > 0 && (
          <>
            <h2>Assemblages de runes</h2>
            <div className="fp-cols2">
              {assemblages.map((a) => {
                const meta = [a.cout_ps != null ? `${a.cout_ps} PS` : null, a.cible]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div className="fp-it" key={a.id}>
                    <b>{nomCourtAssemblage(a.nom)}</b>{" "}
                    {meta && <span className="fp-meta">{meta}</span>}
                    {a.resume_condense ? <> — {a.resume_condense}</> : null}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 9. Pièges possédés — groupés par nom, niveaux triés */}
        {piegesPossedes.length > 0 && (
          <>
            <h2>Pièges possédés</h2>
            <div className="fp-cols2">
              {piegesPossedes.map(([nom, niveaux]) => {
                const nivMax = niveaux[niveaux.length - 1];
                const resume = piegeCat.get(`${nom}__${nivMax}`)?.resume_condense;
                return (
                  <div className="fp-it" key={nom}>
                    <b>{nom}</b> <span className="fp-meta">niv. {niveaux.join(", ")}</span>
                    {resume ? <> — {resume}</> : null}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 10. Forge — tableau pleine largeur, groupé par type, réparation fusionnée */}
        {niveauForge >= 1 && objetsForge.length > 0 && (
          <>
            <h2>Forge — Niv. {niveauForge} · fabrication &amp; réparation</h2>
            <table>
              <thead>
                <tr>
                  <th>Objet</th>
                  <th>Fab.</th>
                  <th>Matériaux</th>
                  {niveauForge >= 2 && <th>Rares</th>}
                  <th>Effet</th>
                  <th>Réparation</th>
                </tr>
              </thead>
              <tbody>
                {typesForge.map((type) => (
                  <Fragment key={type}>
                    <tr className="fp-grptype">
                      <td colSpan={nbColsForge}>{type}</td>
                    </tr>
                    {forgeParType.get(type)!.map((o) => (
                      <tr key={o.id}>
                        <td><b>{o.nom ?? ""}</b></td>
                        <td>
                          {o.temps_fabrication_minutes != null
                            ? `${o.temps_fabrication_minutes} min`
                            : "—"}
                        </td>
                        <td>{o.materiaux_communs ?? "—"}</td>
                        {niveauForge >= 2 && <td>{o.materiaux_rares ?? "—"}</td>}
                        <td>{o.resume_condense ?? ""}</td>
                        <td>{reparationTexte(o) ?? "—"}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* 11. Joaillerie — effet identique partout : dans le titre, pas en colonne */}
        {niveauJoaillerie >= 1 && objetsJoaillerie.length > 0 && (
          <>
            <h2>Joaillerie — Niv. {niveauJoaillerie} (tous support d'enchantement)</h2>
            <table>
              <thead>
                <tr>
                  <th>Bijou</th>
                  <th>{niveauJoaillerie >= 2 ? "Fab. (rare)" : "Fab."}</th>
                  <th>Matériaux</th>
                  {niveauJoaillerie >= 2 && <th>Rares</th>}
                </tr>
              </thead>
              <tbody>
                {objetsJoaillerie.map((o) => (
                  <tr key={o.id}>
                    <td><b>{o.nom ?? ""}</b></td>
                    <td>
                      {o.temps_fabrication_minutes != null
                        ? `${o.temps_fabrication_minutes}${
                            niveauJoaillerie >= 2 && o.temps_rare_minutes != null
                              ? ` (${o.temps_rare_minutes})`
                              : ""
                          } min`
                        : "—"}
                    </td>
                    <td>{o.materiaux_communs ?? "—"}</td>
                    {niveauJoaillerie >= 2 && <td>{o.materiaux_rares ?? "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* 12. Alchimie — recettes en tableau */}
        {niveauAlchimie >= 1 && recettes.length > 0 && (
          <>
            <h2>Alchimie — Niv. {niveauAlchimie} · recettes</h2>
            <table>
              <thead>
                <tr>
                  <th>Recette</th>
                  <th>Niv</th>
                  <th>Effet</th>
                  <th>Ingrédients</th>
                </tr>
              </thead>
              <tbody>
                {recettes.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.nom}</b></td>
                    <td>{r.niveau_requis}</td>
                    <td>{r.resume_condense ?? ""}</td>
                    <td>{ingredientsCompact(r.ingredients)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* 13. Ingrédients & manipulations — texte complet, 17px */}
        {niveauAlchimie >= 1 && manipulationsVisibles.length > 0 && (
          <>
            <h2>Ingrédients &amp; manipulations — Niv. ≤ {niveauAlchimie}</h2>
            <div className="fp-cols2" style={{ fontSize: "17px" }}>
              {manipulationsVisibles.map((m) => (
                <div className="fp-it" key={m.id}>
                  <b>{m.nom ?? ""}</b>{" "}
                  {m.niveau != null && <span className="fp-meta">niv. {m.niveau}</span>}
                  {m.manipulations ? <> — {m.manipulations}</> : null}
                </div>
              ))}
            </div>
          </>
        )}

        {/* 14. Pièges — catalogue dédoublonné (nom + résumé strictement identiques) */}
        {niveauPieges >= 1 && cataloguePieges.length > 0 && (
          <>
            <h2>
              Pièges — Niv. {niveauPieges} · catalogue (réalisables aux niv. 1-{niveauPieges})
            </h2>
            <div className="fp-cols2" style={{ fontSize: "17px" }}>
              {cataloguePieges.map((p) => (
                <div className="fp-it" key={`${p.nom}§${p.niveaux.join(",")}`}>
                  <b>{p.nom}</b>{" "}
                  {!couvreTousNiveaux(p.niveaux) && (
                    <span className="fp-meta">niv. {p.niveaux.join(", ")}</span>
                  )}
                  {p.resume ? <> — {p.resume}</> : null}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // VARIANTE INTÉGRAL — layout carte historique (fusion forge exceptée)
  // ════════════════════════════════════════════════════════════════════

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
        {descRow(s.sort_resume_condense, s.sort_description)}
        {effetRow(s.effet_instance, s.paliers, s.niveau_sort) ?? palierActifRow(s.paliers, s.niveau_sort)}
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
        {descRow(p.priere_resume_condense, p.priere_description)}
        {effetRow(p.effet_instance, p.paliers, p.niveau_priere) ?? palierActifRow(p.paliers, p.niveau_priere)}
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

      {/* 0. Règles de fouille (s299) — en haut de la variante intégral */}
      <RappelFouillePrint variante="integral" />

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

      {(() => {
        const rel = fiche.religion_id ? religions?.find((r) => r.id === fiche.religion_id) : null;
        if (!rel) return null;
        const lore = rel.lore_manuel;
        const rituels = rel.rituels_manuel ?? [];
        if (!lore && rituels.length === 0) return null;
        return (
          <>
            <h2>Religion — {rel.nom}</h2>
            <div className="fp-card">
              {lore && (
                <p className="fp-prose" style={{ whiteSpace: "pre-line" }}>
                  {lore}
                </p>
              )}
              {rituels.length > 0 && (
                <ul style={{ margin: "6px 0 0", paddingLeft: "18px" }}>
                  {rituels.map((r, i) => (
                    <li key={i} style={{ whiteSpace: "pre-line", marginBottom: "2px" }}>
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        );
      })()}

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
          {desc(fiche.race_resume_condense, fiche.race_description)}
        </div>
        <div className="fp-card">
          <div className="fp-card-title">
            {fiche.classe_emoji ? `${fiche.classe_emoji} ` : ""}Classe — {fiche.classe_nom ?? ""}
          </div>
          {fiche.classe_role_combat && (
            <div className="fp-muted"><strong>Rôle de combat :</strong> {fiche.classe_role_combat}</div>
          )}
          {desc(fiche.classe_resume_condense, fiche.classe_description)}
        </div>
        {traits.map((t) => (
          <div className="fp-card" key={t.id}>
            <div className="fp-card-title">Trait — {t.nom}</div>
            {desc(t.resume_condense, t.texte_manuel)}
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
                  {desc(c.competence_resume_condense, c.competence_description)}
                  {verbatimCompetence(c)}
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
                {a.duree && <div className="fp-row"><span className="fp-k">Durée :</span> {a.duree}</div>}
                {a.runes_requises && a.runes_requises.length > 0 && (
                  <div className="fp-row"><span className="fp-k">Runes :</span> {a.runes_requises.join(" · ")}</div>
                )}
                {a.effet && <div className="fp-row"><span className="fp-k">Effet :</span> {a.effet}</div>}
                {a.effet_maitrise && (
                  <div className="fp-row"><span className="fp-k">⭐ Maîtrise :</span> {a.cout_ps_maitrise != null ? `${a.effet_maitrise} (${a.cout_ps_maitrise} PS)` : a.effet_maitrise}</div>
                )}
                {descRow(a.resume_condense, a.texte_manuel)}
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
                        {/* Canon s299 : Intégral = détail actuel (le teaser r.description
                            n'est plus imprimé). */}
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

      {/* 7c. Forge — fusion fabrication & réparation (s299 v2) : chaque objet
          affiche sa réparation en ligne dédiée, plus de sous-section séparée. */}
      {niveauForge >= 1 && objetsForge.length > 0 && (
        <>
          <h2>Forge (Niv. {niveauForge})</h2>
          <h3>Fabrication &amp; réparation</h3>
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
                {reparationTexte(o) && (
                  <div className="fp-row"><span className="fp-k">Réparation :</span> {reparationTexte(o)}</div>
                )}
                {niveauForge >= 3 && (
                  <div className="fp-row fp-desc"><em>Accès aux matériaux légendaires disponible.</em></div>
                )}
                {descRow(o.resume_condense, o.description)}
              </div>
            ))}
          </div>
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
                    {descRow(o.resume_condense, o.description)}
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
