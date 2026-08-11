import { useMemo, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Download, Printer, Plus, X, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AdminLayout from "@/components/admin/AdminLayout";
import { libelleCompetenceAvecChoix } from "@/lib/libelleCompetenceAvecChoix";

/* ===========================================================================
 * FILTRE ADMIN PERSONNAGES — PR2 (s116)
 * UX B (maquette s115) : constructeur de critères à puces + logique ET / OU.
 * Lit la vue enrichie `vue_personnages_admin_complet` (1 fetch, filtrage CLIENT
 * — volume faible). Export CSV (Blob client) + vue imprimable (@media print +
 * window.print, pattern FicheImprimable, sans lib).
 * Décisions figées : archi C, UX B, CSV, PDF imprimable. 10 types de critères.
 * ======================================================================== */

interface NomNiveau {
  nom: string;
  niveau?: number;
}
interface NomSeul {
  nom: string;
}

interface ChoixCompetenceRow {
  personnage_id: string;
  competence_nom: string;
  choix: string[] | null;
}

interface PersoComplet {
  id: string;
  nom: string;
  joueur_nom: string | null;
  race_nom: string | null;
  classe_nom: string | null;
  classe_secondaire_nom: string | null;
  religion_nom: string | null;
  famille_nom: string | null;
  niveau: number | null;
  xp_total: number | null;
  xp_depense: number | null;
  est_actif: boolean | null;
  est_mort: boolean | null;
  est_finalise: boolean | null;
  est_verrouille: boolean | null;
  etape_creation: number | null;
  created_at: string | null;
  traits_raciaux: NomSeul[] | null;
  competences: NomNiveau[] | null;
  sorts: NomNiveau[] | null;
  prieres: NomNiveau[] | null;
  assemblages: NomSeul[] | null;
  recettes: NomSeul[] | null;
  pieges: NomNiveau[] | null;
}

type CritType =
  | "race"
  | "classe"
  | "niveau"
  | "trait"
  | "comp"
  | "sort"
  | "priere"
  | "assemblage"
  | "recette"
  | "piege";

interface Critere {
  type: CritType;
  val?: string;
  niv?: number;
}

type Logic = "AND" | "OR";

const TYPE_LABELS: Record<CritType, string> = {
  race: "Race",
  classe: "Classe",
  niveau: "Niveau ≥",
  trait: "Trait racial",
  comp: "Compétence",
  sort: "Sort",
  priere: "Prière",
  assemblage: "Assemblage",
  recette: "Recette",
  piege: "Piège",
};

// Types acceptant un seuil de niveau optionnel.
const TYPES_AVEC_NIVEAU: CritType[] = ["comp", "sort", "priere", "piege"];

const asArrNiv = (v: unknown): NomNiveau[] =>
  Array.isArray(v) ? (v as NomNiveau[]) : [];
const asArrNom = (v: unknown): NomSeul[] =>
  Array.isArray(v) ? (v as NomSeul[]) : [];
const uniqSort = (arr: string[]): string[] =>
  [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));

const AdminPersonnages = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [logic, setLogic] = useState<Logic>("AND");
  const [chips, setChips] = useState<Critere[]>([]);
  // barre d'ajout
  const [addType, setAddType] = useState<CritType>("race");
  const [addVal, setAddVal] = useState("");
  const [addNiv, setAddNiv] = useState("");
  // impression
  const [printNonce, setPrintNonce] = useState(0);

  const { data: personnages, isLoading } = useQuery({
    queryKey: ["admin-personnages-complet"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_personnages_admin_complet")
        .select("*")
        .order("niveau", { ascending: false });
      return (data ?? []) as unknown as PersoComplet[];
    },
  });

  const { data: choixCompetences } = useQuery({
    queryKey: ["admin-choix-competences"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_personnages_choix_competences")
        .select("*");
      return (data ?? []) as unknown as ChoixCompetenceRow[];
    },
  });

  const persos = personnages ?? [];

  // Map "personnage_id|competence_nom" -> choix résolus (langue/religion/texte).
  const choixMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const row of choixCompetences ?? []) {
      m.set(`${row.personnage_id}|${row.competence_nom}`, row.choix ?? []);
    }
    return m;
  }, [choixCompetences]);

  // ---- listes de valeurs dérivées du jeu de données chargé ----
  const valeurs = useMemo(() => {
    return {
      race: uniqSort(persos.map((p) => p.race_nom ?? "")),
      classe: uniqSort(persos.map((p) => p.classe_nom ?? "")),
      trait: uniqSort(persos.flatMap((p) => asArrNom(p.traits_raciaux).map((t) => t.nom))),
      comp: uniqSort(persos.flatMap((p) => asArrNiv(p.competences).map((c) => c.nom))),
      sort: uniqSort(persos.flatMap((p) => asArrNiv(p.sorts).map((s) => s.nom))),
      priere: uniqSort(persos.flatMap((p) => asArrNiv(p.prieres).map((x) => x.nom))),
      assemblage: uniqSort(persos.flatMap((p) => asArrNom(p.assemblages).map((a) => a.nom))),
      recette: uniqSort(persos.flatMap((p) => asArrNom(p.recettes).map((r) => r.nom))),
      piege: uniqSort(persos.flatMap((p) => asArrNiv(p.pieges).map((x) => x.nom))),
    } as Record<Exclude<CritType, "niveau">, string[]>;
  }, [persos]);

  // Quand le type d'ajout change, présélectionne la 1re valeur dispo.
  useEffect(() => {
    if (addType === "niveau") {
      setAddVal("");
      return;
    }
    const liste = valeurs[addType as Exclude<CritType, "niveau">] ?? [];
    setAddVal(liste[0] ?? "");
    setAddNiv("");
  }, [addType, valeurs]);

  // ---- matching ----
  const matchCrit = (p: PersoComplet, c: Critere): boolean => {
    switch (c.type) {
      case "race":
        return (p.race_nom ?? "") === c.val;
      case "classe":
        return (p.classe_nom ?? "") === c.val;
      case "niveau":
        return (p.niveau ?? 1) >= (c.niv ?? 1);
      case "trait":
        return asArrNom(p.traits_raciaux).some((t) => t.nom === c.val);
      case "comp":
        return asArrNiv(p.competences).some(
          (x) => x.nom === c.val && (!c.niv || (x.niveau ?? 0) >= c.niv),
        );
      case "sort":
        return asArrNiv(p.sorts).some(
          (x) => x.nom === c.val && (!c.niv || (x.niveau ?? 0) >= c.niv),
        );
      case "priere":
        return asArrNiv(p.prieres).some(
          (x) => x.nom === c.val && (!c.niv || (x.niveau ?? 0) >= c.niv),
        );
      case "assemblage":
        return asArrNom(p.assemblages).some((a) => a.nom === c.val);
      case "recette":
        return asArrNom(p.recettes).some((r) => r.nom === c.val);
      case "piege":
        return asArrNiv(p.pieges).some(
          (x) => x.nom === c.val && (!c.niv || (x.niveau ?? 0) >= c.niv),
        );
      default:
        return true;
    }
  };

  const matchTexte = (p: PersoComplet): boolean => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.nom ?? "").toLowerCase().includes(q) ||
      (p.joueur_nom ?? "").toLowerCase().includes(q)
    );
  };

  const resultats = useMemo(() => {
    const base = persos.filter(matchTexte);
    if (!chips.length) return base;
    if (logic === "OR") {
      return base.filter((p) => chips.some((c) => matchCrit(p, c)));
    }
    return base.filter((p) => chips.every((c) => matchCrit(p, c)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persos, chips, logic, searchTerm]);

  // surlignage des tags correspondant à un critère actif
  const isMatchTag = (type: CritType, nom: string): boolean =>
    chips.some((c) => c.type === type && c.val === nom);

  // ---- gestion des puces ----
  const ajouterChip = () => {
    if (addType === "niveau") {
      const n = parseInt(addNiv, 10);
      setChips((cur) => [...cur, { type: "niveau", niv: Number.isNaN(n) ? 1 : n }]);
      setAddNiv("");
      return;
    }
    if (!addVal) return;
    const c: Critere = { type: addType, val: addVal };
    if (TYPES_AVEC_NIVEAU.includes(addType) && addNiv) {
      const n = parseInt(addNiv, 10);
      if (!Number.isNaN(n)) c.niv = n;
    }
    setChips((cur) => [...cur, c]);
    setAddNiv("");
  };

  const retirerChip = (i: number) =>
    setChips((cur) => cur.filter((_, idx) => idx !== i));

  const chipLabel = (c: Critere): string => {
    const lab = TYPE_LABELS[c.type];
    if (c.type === "niveau") return `${lab} ${c.niv}`;
    if (c.niv) return `${lab} : ${c.val} ≥ ${c.niv}`;
    return `${lab} : ${c.val}`;
  };

  // ---- export CSV ----
  const exporterCSV = () => {
    const head = [
      "Nom",
      "Joueur",
      "Race",
      "Classe",
      "Niveau",
      "Traits",
      "Compétences",
      "Sorts",
      "Prières",
      "Assemblages",
      "Recettes",
      "Pièges",
    ];
    const rows = resultats.map((p) => [
      p.nom ?? "",
      p.joueur_nom ?? "",
      p.race_nom ?? "",
      p.classe_nom ?? "",
      String(p.niveau ?? 1),
      asArrNom(p.traits_raciaux).map((t) => t.nom).join(" | "),
      asArrNiv(p.competences)
        .map((c) => libelleCompetenceAvecChoix(c.nom, c.niveau ?? null, choixMap.get(`${p.id}|${c.nom}`)))
        .join(" | "),
      asArrNiv(p.sorts).map((s) => `${s.nom} ${s.niveau ?? ""}`.trim()).join(" | "),
      asArrNiv(p.prieres).map((x) => `${x.nom} ${x.niveau ?? ""}`.trim()).join(" | "),
      asArrNom(p.assemblages).map((a) => a.nom).join(" | "),
      asArrNom(p.recettes).map((r) => r.nom).join(" | "),
      asArrNiv(p.pieges).map((x) => `${x.nom} ${x.niveau ?? ""}`.trim()).join(" | "),
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "personnages_filtres.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- impression ----
  const lancerImpression = () => setPrintNonce((n) => n + 1);
  useEffect(() => {
    if (printNonce > 0) window.print();
  }, [printNonce]);

  // ---- rendu d'une carte résultat ----
  const renderTags = (p: PersoComplet) => {
    const tg = (key: string, label: string, match: boolean) => (
      <span
        key={key}
        className={
          "text-[10px] px-1.5 py-0.5 rounded border " +
          (match
            ? "bg-primary/20 border-primary/55 text-primary font-semibold"
            : "bg-secondary/20 border-secondary/40 text-foreground/90")
        }
      >
        {label}
      </span>
    );
    const traits = asArrNom(p.traits_raciaux).map((t) =>
      tg(`t-${t.nom}`, `⬨ ${t.nom}`, isMatchTag("trait", t.nom)),
    );
    const comps = asArrNiv(p.competences).map((c) => {
      const gold = isMatchTag("comp", c.nom);
      // D-Ⓑ : seul le badge de la compétence FILTRÉE (doré) porte ses choix.
      const label = gold
        ? libelleCompetenceAvecChoix(c.nom, c.niveau ?? null, choixMap.get(`${p.id}|${c.nom}`))
        : `${c.nom} ${c.niveau ?? ""}`.trim();
      return tg(`c-${c.nom}`, label, gold);
    });
    const sorts = asArrNiv(p.sorts).map((s) =>
      tg(`s-${s.nom}`, `✦ ${s.nom} ${s.niveau ?? ""}`.trim(), isMatchTag("sort", s.nom)),
    );
    const prieres = asArrNiv(p.prieres).map((x) =>
      tg(`p-${x.nom}`, `✝ ${x.nom} ${x.niveau ?? ""}`.trim(), isMatchTag("priere", x.nom)),
    );
    const pieges = asArrNiv(p.pieges).map((x) =>
      tg(`pg-${x.nom}`, `◊ ${x.nom} ${x.niveau ?? ""}`.trim(), isMatchTag("piege", x.nom)),
    );
    // collections volumineuses (assemblages / recettes) : compteur compact,
    // surligné si un critère du type est actif.
    const nbAss = asArrNom(p.assemblages).length;
    const nbRec = asArrNom(p.recettes).length;
    const assMatch = chips.some((c) => c.type === "assemblage");
    const recMatch = chips.some((c) => c.type === "recette");
    const compteurs: ReactNode[] = [];
    if (nbAss > 0)
      compteurs.push(tg("ass-count", `◈ ${nbAss} assemblage${nbAss > 1 ? "s" : ""}`, assMatch));
    if (nbRec > 0)
      compteurs.push(tg("rec-count", `⚗ ${nbRec} recette${nbRec > 1 ? "s" : ""}`, recMatch));
    return [...traits, ...comps, ...sorts, ...prieres, ...pieges, ...compteurs];
  };

  // ---- valeurs dispo pour la barre d'ajout selon le type ----
  const valeursAjout =
    addType === "niveau" ? [] : valeurs[addType as Exclude<CritType, "niveau">] ?? [];
  const ajoutAvecNiveau = TYPES_AVEC_NIVEAU.includes(addType);

  if (isLoading) {
    return (
      <AdminLayout
        title="Filtre des personnages"
        searchPlaceholder="Filtre rapide (nom, joueur)…"
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
      >
        <p className="text-center py-12 text-muted-foreground">Chargement…</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Filtre des personnages"
      searchPlaceholder="Filtre rapide (nom, joueur)…"
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
    >
      {/* ====================== CONSTRUCTEUR DE CRITÈRES ====================== */}
      <Card className="border-primary/10 bg-card/50 backdrop-blur-sm mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-heading uppercase tracking-wide text-primary">
            Critères actifs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* logique ET / OU */}
          <div className="inline-flex rounded-md border border-border overflow-hidden mb-3">
            <button
              type="button"
              onClick={() => setLogic("AND")}
              className={
                "px-3.5 py-1.5 text-xs font-heading font-semibold transition-colors " +
                (logic === "AND"
                  ? "bg-secondary text-white"
                  : "bg-muted text-muted-foreground")
              }
            >
              Tous (ET)
            </button>
            <button
              type="button"
              onClick={() => setLogic("OR")}
              className={
                "px-3.5 py-1.5 text-xs font-heading font-semibold transition-colors " +
                (logic === "OR"
                  ? "bg-secondary text-white"
                  : "bg-muted text-muted-foreground")
              }
            >
              Au moins un (OU)
            </button>
          </div>

          {/* puces */}
          <div className="flex flex-wrap gap-2 mb-3 min-h-[20px]">
            {chips.length === 0 ? (
              <span className="text-xs italic text-muted-foreground">
                Aucun critère — ajoutes-en un ci-dessous.
              </span>
            ) : (
              chips.map((c, i) => (
                <span
                  key={`${c.type}-${c.val ?? c.niv}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 text-primary text-xs font-medium pl-3 pr-1.5 py-1"
                >
                  {chipLabel(c)}
                  <button
                    type="button"
                    onClick={() => retirerChip(i)}
                    className="w-4 h-4 grid place-items-center rounded-full bg-primary/20 hover:bg-secondary hover:text-white transition-colors"
                    aria-label="Retirer le critère"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))
            )}
          </div>

          {/* barre d'ajout */}
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[130px]">
              <label className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                Type de critère
              </label>
              <select
                value={addType}
                onChange={(e) => setAddType(e.target.value as CritType)}
                className="w-full bg-muted text-foreground border border-border rounded-md px-2.5 py-2 text-sm focus:outline-none focus:border-primary"
              >
                {(Object.keys(TYPE_LABELS) as CritType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {addType !== "niveau" && (
              <div className="flex-1 min-w-[130px]">
                <label className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                  Valeur
                </label>
                <select
                  value={addVal}
                  onChange={(e) => setAddVal(e.target.value)}
                  className="w-full bg-muted text-foreground border border-border rounded-md px-2.5 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  {valeursAjout.length === 0 ? (
                    <option value="">—</option>
                  ) : (
                    valeursAjout.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {(addType === "niveau" || ajoutAvecNiveau) && (
              <div className="w-[110px]">
                <label className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                  Niveau ≥
                </label>
                <input
                  type="number"
                  min={1}
                  value={addNiv}
                  onChange={(e) => setAddNiv(e.target.value)}
                  placeholder={addType === "niveau" ? "1" : "indif."}
                  className="w-full bg-muted text-foreground border border-border rounded-md px-2.5 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            )}

            <Button onClick={ajouterChip} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ====================== BARRE RÉSULTATS + EXPORTS ====================== */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="font-heading text-base text-primary">
          {resultats.length} personnage{resultats.length > 1 ? "s" : ""}{" "}
          <span className="text-muted-foreground font-normal text-xs">
            / {persos.length}
          </span>
        </div>
        <div className="flex gap-2">
          <Button onClick={exporterCSV} variant="outline" size="sm" className="gap-1.5">
            <Download className="w-4 h-4" />
            CSV
          </Button>
          <Button onClick={lancerImpression} size="sm" className="gap-1.5">
            <Printer className="w-4 h-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* ====================== LISTE RÉSULTATS ====================== */}
      <div className="flex flex-col gap-2.5">
        {resultats.length === 0 ? (
          <div className="text-center py-9 text-muted-foreground italic">
            Aucun personnage ne correspond à ces critères.
          </div>
        ) : (
          resultats.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-3.5 py-3 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-md grid place-items-center bg-muted border border-border">
                <span className="font-heading text-base text-primary leading-none">
                  {p.niveau ?? 1}
                </span>
                <span className="text-[8px] uppercase text-muted-foreground tracking-wide">
                  niv
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-heading font-semibold text-sm text-foreground">
                  {p.nom}
                  {p.est_mort ? (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      ✝ mort
                    </Badge>
                  ) : p.est_finalise ? (
                    <Badge className="ml-2 bg-green-500/20 text-green-700 text-[10px]">
                      finalisé
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      brouillon
                    </Badge>
                  )}
                </div>
                <div className="text-[11.5px] text-muted-foreground mt-0.5">
                  {p.race_nom ?? "—"} · {p.classe_nom ?? "—"} · @{p.joueur_nom ?? "—"}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">{renderTags(p)}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 flex-shrink-0"
                onClick={() => navigate(`/personnage/${p.id}`)}
              >
                <Eye className="w-3.5 h-3.5" />
                Voir
              </Button>
            </div>
          ))
        )}
      </div>

      {/* ====================== VUE IMPRIMABLE ====================== */}
      <style>{`
        #admin-personnages-print { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          #admin-personnages-print, #admin-personnages-print * { visibility: visible !important; }
          #admin-personnages-print {
            display: block !important;
            position: absolute; left: 0; top: 0; width: 100%;
            padding: 0; color: #000;
          }
          #admin-personnages-print table { width: 100%; border-collapse: collapse; font-size: 10px; }
          #admin-personnages-print th, #admin-personnages-print td {
            border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top;
          }
          #admin-personnages-print th { background: #eee; font-weight: 700; }
          #admin-personnages-print h2 { font-size: 14px; margin-bottom: 8px; }
          #admin-personnages-print .meta { font-size: 10px; margin-bottom: 10px; color: #444; }
        }
      `}</style>
      <div id="admin-personnages-print">
        <h2>Personnages filtrés — Hurlevent</h2>
        <p className="meta">
          {resultats.length} résultat{resultats.length > 1 ? "s" : ""} sur {persos.length}
          {chips.length > 0
            ? ` · critères (${logic === "AND" ? "ET" : "OU"}) : ${chips
                .map((c) => chipLabel(c))
                .join(" ; ")}`
            : ""}
          {searchTerm.trim() ? ` · texte « ${searchTerm.trim()} »` : ""}
        </p>
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Joueur</th>
              <th>Race</th>
              <th>Classe</th>
              <th>Niv</th>
              <th>Traits</th>
              <th>Compétences</th>
              <th>Sorts</th>
              <th>Prières</th>
              <th>Pièges</th>
            </tr>
          </thead>
          <tbody>
            {resultats.map((p) => (
              <tr key={`pr-${p.id}`}>
                <td>{p.nom}</td>
                <td>{p.joueur_nom ?? ""}</td>
                <td>{p.race_nom ?? ""}</td>
                <td>{p.classe_nom ?? ""}</td>
                <td>{p.niveau ?? 1}</td>
                <td>{asArrNom(p.traits_raciaux).map((t) => t.nom).join(", ")}</td>
                <td>
                  {asArrNiv(p.competences)
                    .map((c) => libelleCompetenceAvecChoix(c.nom, c.niveau ?? null, choixMap.get(`${p.id}|${c.nom}`)))
                    .join(", ")}
                </td>
                <td>
                  {asArrNiv(p.sorts)
                    .map((s) => `${s.nom} ${s.niveau ?? ""}`.trim())
                    .join(", ")}
                </td>
                <td>
                  {asArrNiv(p.prieres)
                    .map((x) => `${x.nom} ${x.niveau ?? ""}`.trim())
                    .join(", ")}
                </td>
                <td>
                  {asArrNiv(p.pieges)
                    .map((x) => `${x.nom} ${x.niveau ?? ""}`.trim())
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
};

export default AdminPersonnages;
