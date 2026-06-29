import { useState } from "react";

/**
 * ListeMoteur — moteur de LISTE générique, schema-driven (Moteur V2, PR2a).
 *
 * Lit une config `fiches_listes` ({ recherche, navigation, carte, annexes }) + `rows`
 * (données d'une catégorie) et rend : barre de recherche + axes de navigation
 * (`onglets` / `filtre` / `groupe`) + cartes cliquables + annexes éventuelles.
 *
 * Cliquer une carte appelle `onOpen({ item })`. La densité visuelle reprend les
 * tokens v1 (or #c9a84c, encadrés rgba(201,168,76,0.06), titres Cinzel).
 */

type AxeNav = {
  axe: "onglets" | "filtre" | "groupe";
  champ: string;
  valeurs?: string[] | "auto";
  mode?: string;
  libelles?: Record<string, string>;
};

export type ListeConfig = {
  recherche: string[];
  navigation: AxeNav[];
  carte: {
    titre?: string;
    sousTitre?: string;
    badges?: string[];
    emoji?: string;
    mode?: string;
    regroupe_par?: string;
    metaLignes?: Array<{ label: string; source: string; couleur?: string }>;
  };
  annexes?: Array<{ titre?: string; source?: string }>;
};

type Props = {
  config: ListeConfig;
  rows: any[];
  onOpen: (sel: { item: any }) => void;
};

export function ListeMoteur({ config, rows, onOpen }: Props) {
  const [q, setQ] = useState("");
  const navigation = Array.isArray(config.navigation) ? config.navigation : [];
  const recherche = Array.isArray(config.recherche) ? config.recherche : [];
  const carte = config.carte ?? {};
  const annexes = Array.isArray(config.annexes) ? config.annexes : [];

  const onglet = navigation.find((a) => a.axe === "onglets");
  const filtres = navigation.filter((a) => a.axe === "filtre");
  const groupe = navigation.find((a) => a.axe === "groupe");

  const valeursAxe = (a: AxeNav): any[] =>
    a.valeurs && a.valeurs !== "auto"
      ? (a.valeurs as any[])
      : [...new Set(rows.map((r) => r[a.champ]))].filter((v) => v != null).sort();

  const [ongletActif, setOngletActif] = useState<any>(onglet ? valeursAxe(onglet)[0] : null);
  const [filtreVals, setFiltreVals] = useState<Record<string, any>>({});

  const libelle = (a: AxeNav | undefined, v: any) => a?.libelles?.[String(v)] ?? String(v);

  let vis = rows;
  if (q) vis = vis.filter((r) => recherche.some((c) => String(r[c] || "").toLowerCase().includes(q.toLowerCase())));
  if (onglet && ongletActif != null) vis = vis.filter((r) => r[onglet.champ] === ongletActif);
  filtres.forEach((f) => {
    const v = filtreVals[f.champ];
    if (v != null && v !== "") vis = vis.filter((r) => String(r[f.champ]) === String(v));
  });

  type Bloc = { header?: string; cards: { item: any }[] };
  let blocks: Bloc[];
  if (groupe && groupe.mode === "section") {
    const m: Record<string, any[]> = {};
    vis.forEach((r) => {
      (m[r[groupe.champ]] ||= []).push(r);
    });
    blocks = Object.entries(m).map(([k, items]) => ({ header: k, cards: items.map((r) => ({ item: r })) }));
  } else {
    blocks = [{ cards: vis.map((r) => ({ item: r })) }];
  }

  return (
    <div className="space-y-5">
      {/* Recherche */}
      {recherche.length > 0 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher…"
          className="w-full rounded-md border border-gold/30 bg-card px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold"
          style={{ background: "rgba(201,168,76,0.04)" }}
        />
      )}

      {/* Onglets (scroll-x) */}
      {onglet && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {valeursAxe(onglet).map((v) => (
            <button
              key={String(v)}
              onClick={() => setOngletActif(v)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md text-sm font-medium flex-shrink-0 ${
                ongletActif === v
                  ? "bg-amber-700 text-white border border-amber-500"
                  : "bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-600"
              }`}
            >
              {libelle(onglet, v)}
            </button>
          ))}
        </div>
      )}

      {/* Filtres (chips « tous » + valeurs) */}
      {filtres.map((f) => (
        <div key={f.champ} className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltreVals((s) => ({ ...s, [f.champ]: "" }))}
            className={(filtreVals[f.champ] == null || filtreVals[f.champ] === "")
              ? "px-3 py-1 rounded-full text-sm font-medium bg-amber-600 text-white"
              : "px-3 py-1 rounded-full text-sm font-medium bg-stone-700 text-amber-200 hover:bg-stone-600"
            }
          >
            Tous
          </button>
          {valeursAxe(f).map((v) => (
            <button
              key={String(v)}
              onClick={() => setFiltreVals((s) => ({ ...s, [f.champ]: v }))}
              className={String(filtreVals[f.champ]) === String(v)
                ? "px-3 py-1 rounded-full text-sm font-medium bg-amber-600 text-white"
                : "px-3 py-1 rounded-full text-sm font-medium bg-stone-700 text-amber-200 hover:bg-stone-600"
              }
            >
              {libelle(f, v)}
            </button>
          ))}
        </div>
      ))}

      {/* Compteur */}
      <p className="text-xs text-muted-foreground">
        {vis.length} résultat{vis.length > 1 ? "s" : ""}
      </p>

      {/* Blocs → cartes */}
      {vis.length === 0 ? (
        <p className="text-muted-foreground text-center py-6">Aucun résultat.</p>
      ) : (
        <div className="space-y-6">
          {blocks.map((bloc, bi) => (
            <div key={bi}>
              {bloc.header && (
                <h3 className="font-heading text-lg font-semibold text-primary mb-3">{String(bloc.header)}</h3>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {bloc.cards.map(({ item }, ci) => {
                  const emoji = carte.emoji ? item[carte.emoji] : item.emoji;
                  const titre = carte.titre ? item[carte.titre] : item.nom;
                  const sousTitre = carte.sousTitre ? item[carte.sousTitre] : null;
                  const badges = (carte.badges ?? []).map((b) => item[b]).filter((v) => v != null && v !== "");
                  const metaLignes = (carte.metaLignes ?? [])
                    .map((ml) => {
                      const raw = item[ml.source];
                      const vals = Array.isArray(raw)
                        ? raw
                        : raw != null && raw !== ""
                          ? [raw]
                          : [];
                      return { label: ml.label, couleur: ml.couleur, vals };
                    })
                    .filter((m) => m.vals.length > 0);
                  const nbNiveaux = Array.isArray(item.rows) ? item.rows.length : 0;
                  return (
                    <button
                      key={ci}
                      onClick={() => onOpen({ item })}
                      className="text-left w-full rounded-lg border border-gold/40 px-4 py-3 hover:border-gold transition-all"
                      style={{ background: "rgba(201,168,76,0.06)" }}
                    >
                      <div className="flex items-start gap-3">
                        {emoji && <span className="text-2xl flex-shrink-0 leading-none">{String(emoji)}</span>}
                        <div className="min-w-0 flex-grow">
                          <div className="flex items-start justify-between gap-2">
                            <h4
                              className="font-bold leading-tight truncate"
                              style={{ fontFamily: "Cinzel, serif", color: "#c9a84c" }}
                            >
                              {String(titre ?? "")}
                            </h4>
                            {badges.length > 0 && (
                              <div className="flex flex-wrap gap-1 justify-end flex-shrink-0">
                                {badges.map((b, i) => (
                                  <span
                                    key={i}
                                    className="text-[11px] text-gold border border-gold/30 rounded px-1.5 py-px whitespace-nowrap"
                                  >
                                    {String(b)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {nbNiveaux > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">{nbNiveaux} niveaux</p>
                          )}
                          {sousTitre && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{String(sousTitre)}</p>
                          )}
                          {metaLignes.length > 0 && (
                            <div className="mt-2 grid gap-1.5">
                              {metaLignes.map((m, mi) => {
                                const col =
                                  m.couleur === "rouge"
                                    ? "#f87171"
                                    : m.couleur === "vert"
                                      ? "#86efac"
                                      : "#c9a84c";
                                return (
                                  <div key={mi} className="flex items-stretch gap-2">
                                    <div
                                      style={{ width: 3, borderRadius: 2, background: col, flexShrink: 0 }}
                                    />
                                    <div className="min-w-0">
                                      <div
                                        className="text-[10px] font-bold uppercase tracking-wider"
                                        style={{ color: col, opacity: 0.9 }}
                                      >
                                        {m.label}
                                      </div>
                                      <div className="text-[13px] text-foreground/90">
                                        {m.vals.join(", ")}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Annexes (section pointillée — aucune config témoin PR2a n'en porte). */}
      {annexes.length > 0 && (
        <div className="mt-8 space-y-4">
          {annexes.map((annexe, i) => {
            const items = annexe.source ? normaliserAnnexe(rows, annexe.source) : [];
            if (items.length === 0) return null;
            return (
              <div key={i} className="rounded-lg border border-dashed border-gold/30 px-4 py-3" style={{ background: "rgba(201,168,76,0.03)" }}>
                {annexe.titre && (
                  <p className="text-xs font-semibold mb-2 tracking-wider" style={{ color: "#c9a84c", fontVariant: "small-caps" }}>
                    {annexe.titre}
                  </p>
                )}
                <div className="grid gap-1.5 text-[13px] text-foreground/90">
                  {items.map((x, j) => (<div key={j}>{String(x)}</div>))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function normaliserAnnexe(rows: any[], source: string): any[] {
  const [kind, key] = source.split(":");
  if (kind === "col") return rows.map((r) => r[key]).filter((v) => v != null && v !== "");
  return [];
}
