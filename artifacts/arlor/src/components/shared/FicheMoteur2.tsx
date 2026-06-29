import React from "react";
import RecetteSections from "@/components/shared/RecetteSections";
import { ReligionDetails } from "@/components/shared/ReligionDetails";

/**
 * FicheMoteur2 — moteur de rendu schema-driven (Moteur V2, PR2a).
 *
 * Copie additive de FicheMoteur (v1) : lit `champs_v2` (jamais `champs`/v1 en live)
 * via FicheMoteur2/EncyclopedieV2. Les 9 schémas v1 rendent à l'identique ; ce
 * moteur ajoute les primitives `liste`, `section`, `relation`, `si_flag`, `tableau`
 * et un toggle 3-valeurs (`swap` = v1, `peek`, `aucun`).
 *
 * Deux axes INDÉPENDANTS :
 *  - densité (imposée par la surface) : "carte" (compact) | "encyclo" (complet).
 *  - mode (choisi par le joueur, bascule) : "abrege" | "integral".
 *    → n'affecte QUE les champs texte (choix de la source c/v) et l'ouverture des
 *      blocs peek. Jamais les chiffres.
 */

export type Densite = "carte" | "encyclo";
export type ModeManuel = "abrege" | "integral";

type SousSource = { source?: string; densite?: string };

export type Palier = {
  tier: string;
  verrou?: string;
  icone?: string;
  temps?: string;
  recette?: string;
};

export type ChampSchema = {
  cle: string;
  type: "texte" | "mecanique";
  label?: string;
  titre?: string;
  icone?: string;
  render?: string;
  source?: string;
  densite?: string;
  suffixe?: string;
  format?: string;
  paliers?: Palier[];
  source_cout?: string;
  badge?: string;
  suffixe_cout?: string;
  c?: SousSource;
  v?: SousSource;
  // --- Extensions Moteur V2 (PR2a) — optionnelles, lues par les nouvelles branches. ---
  toggle?: "swap" | "peek" | "aucun";
  item?: any;
  lignes?: Array<{ label: string; source: string }>;
  relation?: any;
  texte?: string;
  colonnes?: any[];
  meta?: any[];
  effet?: any;
  regroupe_par?: string;
  construction?: string;
  encadre?: boolean;
  abrege?: { source?: string };
};

type Props = {
  schema: ChampSchema[];
  entite: Record<string, any>;
  densite: Densite;
  mode: ModeManuel;
  competencesParId?: Record<string, string>;
  lookups?: Record<string, any[]>; // ex. { reparations: Reparation[] } pour les render "relation" en FK
};

// Formate la valeur d'un champ mécanique selon son `format`.
//  - "coefficient" : multiplicateur de création → "×1.5" (zéros superflus retirés : 1.00→×1, 0.50→×0.5).
//  - sinon : valeur brute + suffixe éventuel (ex. " XP").
function formaterValeur(val: any, champ: ChampSchema): string {
  if (champ.format === "coefficient") {
    const n = Number(val);
    return Number.isFinite(n) ? `×${n}` : String(val);
  }
  return `${String(val)}${champ.suffixe ? ` ${champ.suffixe}` : ""}`;
}

// "col:xxx" -> entite.xxx (seule source supportée au Lot 1)
function lireSource(source: string | undefined, entite: Record<string, any>) {
  if (!source) return undefined;
  const [kind, key] = source.split(":");
  if (kind === "col") return entite[key];
  return undefined;
}

function aValeur(v: any): boolean {
  return v !== null && v !== undefined && v !== "";
}

function normaliserListe(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

// --- Tokens visuels partagés (mêmes idiomes que v1). ---
const LabelOr = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold mb-2 tracking-wider" style={{ color: "#c9a84c", fontVariant: "small-caps" }}>{children}</p>
);
const Encadre = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-md border border-gold/30 px-4 py-3" style={{ background: "rgba(201,168,76,0.06)" }}>{children}</div>
);

function ItemPeek({ titre, xp, suffixeXp, verbatim, apercu, forceOpen }: { titre: string; xp?: any; suffixeXp?: string; verbatim?: string | null; apercu?: string | null; forceOpen?: boolean; }) {
  const [open, setOpen] = React.useState(false);
  const isOpen = forceOpen || open;
  return (
    <div>
      <div className="flex items-baseline gap-2.5">
        <b style={{ color: "#c9a84c" }}>{titre}</b>
        {aValeur(xp) && <span className="text-xs text-muted-foreground">{String(xp)}{suffixeXp ? ` ${suffixeXp}` : ""}</span>}
        {!forceOpen && verbatim && (
          <button onClick={() => setOpen(o => !o)} className="ml-auto text-xs" style={{ color: "#c9a84c" }}>
            {open ? "Masquer le manuel ▴" : "Texte du manuel ▸"}
          </button>
        )}
      </div>
      {!isOpen && apercu && <p className="text-[13px] leading-relaxed text-foreground/75 italic mt-1.5">{apercu}</p>}
      {isOpen && verbatim && <p className="text-[13px] leading-relaxed text-foreground/90 mt-2 whitespace-pre-wrap">{verbatim}</p>}
    </div>
  );
}

// Religions : porte l'état d'ouverture du « Texte du manuel » (ReligionDetails est contrôlé).
// Mirroir du patron ItemPeek (état local via useState, hook hors de tout .map).
function ReligionFiche({ entite }: { entite: any }) {
  const [manuelOpen, setManuelOpen] = React.useState(false);
  return (
    <ReligionDetails
      religion={entite}
      isManuelOpen={manuelOpen}
      onToggleManuel={() => setManuelOpen((o) => !o)}
      hideDomaines={false}
    />
  );
}

export function FicheMoteur2({ schema, entite, densite, mode, competencesParId, lookups }: Props) {
  const encyclo = densite === "encyclo";
  const champs = Array.isArray(schema) ? schema : [];

  // --- DENSITÉ CARTE (header compact) ---
  if (!encyclo) {
    const meca = champs.filter((c) => c.type === "mecanique" && !c.render);
    const listes = champs.filter((c) => c.type === "mecanique" && c.render === "liste_competences");
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-foreground/80">
          {meca.map((champ) => {
            const val = lireSource(champ.source, entite);
            if (!aValeur(val)) return null;
            return (
              <span key={champ.cle}>
                {champ.icone ? `${champ.icone} ` : ""}
                {formaterValeur(val, champ)}
              </span>
            );
          })}
        </div>
        {listes.map((champ) => {
          const arr = normaliserListe(lireSource(champ.source, entite));
          if (arr.length === 0) return null;
          const noms = arr.map((o) => competencesParId?.[o?.competence_id] ?? o?.competence_id ?? String(o));
          return (
            <div key={champ.cle} className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-foreground/80">
              {noms.map((nom, i) => (
                <span key={i}>⭐ {nom}</span>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // --- DENSITÉ ENCYCLO (corps déplié, complet) ---
  return (
    <div className="flex flex-col gap-4">
      {champs.map((champ) => {
        // Champ texte (lore) : source pilotée par le MODE + toggle 3-valeurs.
        if (champ.type === "texte") {
          // toggle: "swap" (défaut, = v1) | "peek" (géré par render:"liste") | "aucun" (toujours intégral)
          let src: string | undefined;
          if (champ.toggle === "aucun") src = champ.v?.source;
          else src = mode === "integral" ? champ.v?.source : champ.c?.source;
          const txt = lireSource(src, entite);
          if (!txt) return null;
          if (champ.titre) {
            return (
              <div key={champ.cle}>
                <p
                  className="text-xs font-semibold mb-2 tracking-wider"
                  style={{ color: "#c9a84c", fontVariant: "small-caps" }}
                >
                  {champ.titre}
                </p>
                <div
                  className="rounded-md border border-gold/30 px-4 py-3"
                  style={{ background: "rgba(201,168,76,0.06)" }}
                >
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {String(txt)}
                  </p>
                </div>
              </div>
            );
          }
          return (
            <p key={champ.cle} className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {String(txt)}
            </p>
          );
        }

        // render liste_competences : résout competence_id -> nom.
        if (champ.render === "liste_competences") {
          const arr = normaliserListe(lireSource(champ.source, entite));
          if (arr.length === 0) return null;
          const noms = arr.map((o) => competencesParId?.[o?.competence_id] ?? o?.competence_id ?? String(o));
          return (
            <div key={champ.cle}>
              <p
                className="text-xs font-semibold mb-2 tracking-wider"
                style={{ color: "#c9a84c", fontVariant: "small-caps" }}
              >
                ⭐ {champ.label}
              </p>
              <div className="space-y-2">
                {noms.map((nom, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-md border border-gold/30 px-4 py-3"
                    style={{ background: "rgba(201,168,76,0.06)" }}
                  >
                    <span className="flex-shrink-0">⭐</span>
                    <span className="text-sm text-foreground/90">{nom}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // render liste_traits : liste de noms (col:traits_permis injecté côté front).
        if (champ.render === "liste_traits") {
          const arr = normaliserListe(lireSource(champ.source, entite));
          if (arr.length === 0) return null;
          return (
            <div key={champ.cle}>
              <p
                className="text-xs font-semibold mb-2 tracking-wider"
                style={{ color: "#c9a84c", fontVariant: "small-caps" }}
              >
                {champ.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {arr.map((nom, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-gold/30 px-3 py-1 text-xs text-foreground/90"
                    style={{ background: "rgba(201,168,76,0.06)" }}
                  >
                    {String(nom)}
                  </span>
                ))}
              </div>
            </div>
          );
        }

        // render chips : pastilles génériques depuis un array de strings (ex. runes_requises).
        if (champ.render === "chips") {
          const arr = normaliserListe(lireSource(champ.source, entite));
          if (arr.length === 0) return null;
          return (
            <div key={champ.cle}>
              <p
                className="text-xs font-semibold mb-2 tracking-wider"
                style={{ color: "#c9a84c", fontVariant: "small-caps" }}
              >
                {champ.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {arr.map((x, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-gold/30 px-3 py-1 text-xs text-foreground/90"
                    style={{ background: "rgba(201,168,76,0.06)" }}
                  >
                    {String(x)}
                  </span>
                ))}
              </div>
            </div>
          );
        }

        // render paliers : 1 carte par matériau (commun/rare) — tier + verrou + icône + temps + recette.
        if (champ.render === "paliers") {
          const defs = Array.isArray(champ.paliers) ? champ.paliers : [];
          const cartes = defs
            .map((p) => ({
              ...p,
              temps: lireSource(p.temps, entite),
              recette: lireSource(p.recette, entite),
            }))
            .filter((p) => aValeur(p.recette));
          if (cartes.length === 0) return null;
          return (
            <div key={champ.cle}>
              <p
                className="text-xs font-semibold mb-2 tracking-wider"
                style={{ color: "#c9a84c", fontVariant: "small-caps" }}
              >
                {champ.label}
              </p>
              <div className="grid gap-2">
                {cartes.map((p, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-gold/30 px-3.5 py-2.5"
                    style={{ background: "rgba(201,168,76,0.06)" }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-foreground">{p.tier}</span>
                      {p.verrou && (
                        <span className="text-[11px] text-gold border border-gold/30 rounded px-1.5 py-px">
                          {p.verrou}
                        </span>
                      )}
                      {aValeur(p.temps) && (
                        <span className="ml-auto text-xs text-muted-foreground">⏱️ {String(p.temps)} min</span>
                      )}
                    </div>
                    <div className="text-[13px] text-foreground">
                      {p.icone ? `${p.icone} ` : ""}
                      {String(p.recette)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // render bloc_maitrise : bloc verrouillé (effet de maîtrise + coût ✨), badge de niveau.
        if (champ.render === "bloc_maitrise") {
          const effet = lireSource(champ.source, entite);
          if (!aValeur(effet)) return null;
          const cout = lireSource(champ.source_cout, entite);
          return (
            <div
              key={champ.cle}
              className="rounded-md border border-dashed border-gold/30 px-3.5 py-3"
              style={{ background: "rgba(201,168,76,0.03)" }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="text-xs font-bold tracking-wider"
                  style={{ color: "#c9a84c", fontVariant: "small-caps" }}
                >
                  🔒 {champ.label}
                </span>
                {champ.badge && (
                  <span className="text-[11px] text-gold border border-gold/30 rounded px-1.5 py-px">
                    {champ.badge}
                  </span>
                )}
                {aValeur(cout) && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    ✨ {String(cout)}
                    {champ.suffixe_cout ? ` ${champ.suffixe_cout}` : ""}
                  </span>
                )}
              </div>
              <p className="text-[13px] leading-relaxed text-foreground/90">{String(effet)}</p>
            </div>
          );
        }

        // === NOUVELLES branches Moteur V2 (PR2a) — AVANT le fallback « Mécanique simple ». ===

        // render liste : sorts paliers (primaire/secondaire) ; compétences niveaux en peek.
        if (champ.render === "liste") {
          const items = normaliserListe(lireSource(champ.source, entite));
          if (items.length === 0) return null;
          const it = (champ as any).item ?? {};
          const peek = champ.toggle === "peek";
          return (
            <div key={champ.cle}>
              {champ.titre && <LabelOr>{champ.titre}</LabelOr>}
              <div className="grid gap-2">
                {items.map((x: any, i: number) => (
                  <div key={i} className="rounded-md border border-gold/30 px-3 py-2.5" style={{ background: "rgba(201,168,76,0.06)" }}>
                    {peek ? (
                      <ItemPeek
                        titre={`${it.prefixe ?? ""}${x[it.primaire]}`}
                        xp={it.meta_xp ? x[it.meta_xp] : undefined}
                        suffixeXp={it.suffixe_xp}
                        verbatim={it.verbatim ? x[it.verbatim] : null}
                        apercu={it.abrege ? x[it.abrege] : null}
                        forceOpen={mode === "integral"}
                      />
                    ) : (
                      <div className="flex gap-3 items-baseline">
                        <b style={{ color: "#c9a84c", minWidth: 54 }}>{String(x[it.primaire])}</b>
                        <span className="text-sm text-foreground/90">{String(x[it.secondaire] ?? "")}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // render section : forge matériaux via `lignes` ; bestiaire prose via `source`.
        if (champ.render === "section") {
          const lignes = (champ as any).lignes as Array<{ label: string; source: string }> | undefined;
          if (Array.isArray(lignes)) {
            const items = lignes.map(l => ({ label: l.label, val: lireSource(l.source, entite) })).filter(l => aValeur(l.val));
            if (items.length === 0) return null;
            return (
              <div key={champ.cle}>
                <LabelOr>{champ.titre}</LabelOr>
                <div className="grid gap-1.5 text-[13px]">
                  {items.map((l, i) => (<div key={i}><span className="text-muted-foreground">{l.label} : </span><span className="text-foreground/90">{String(l.val)}</span></div>))}
                </div>
              </div>
            );
          }
          const val = lireSource(champ.source, entite);
          if (!aValeur(val)) return null;
          const corps = <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{String(val)}</p>;
          return (
            <div key={champ.cle}>
              <LabelOr>{champ.titre}</LabelOr>
              {(champ as any).encadre ? <Encadre>{corps}</Encadre> : corps}
            </div>
          );
        }

        // render relation : forge réparation = FK injectée ; compétences prérequis = dénormalisé par niveau.
        if (champ.render === "relation") {
          const rel = (champ as any).relation ?? {};
          if (rel.forme === "fk") {
            const id = lireSource(champ.source, entite);
            if (!aValeur(id)) return null;
            const row = (lookups?.[rel.lookup] ?? []).find((r: any) => r.id === id);
            if (!row) return null;
            return (
              <div key={champ.cle} className="flex items-baseline gap-2 text-sm text-foreground/90">
                <span className="text-muted-foreground">{champ.titre} :</span>
                <span className="font-semibold text-gold">{String(row[rel.affiche])}</span>
              </div>
            );
          }
          if (rel.forme === "par_niveau") {
            const obj = lireSource(champ.source, entite); // { "1": [{competence_nom, niveau_min}], ... }
            if (!obj || typeof obj !== "object") return null;
            const plat: Array<{ nom: string; niveau_min?: any }> = [];
            Object.values(obj as Record<string, any[]>).forEach(arr => (Array.isArray(arr) ? arr : []).forEach(p => plat.push({ nom: p[rel.denormalise], niveau_min: p[rel.niveau_min] })));
            if (plat.length === 0) return null;
            return (
              <div key={champ.cle}>
                <LabelOr>{champ.titre}</LabelOr>
                <div className="flex flex-wrap gap-2">
                  {plat.map((p, i) => (
                    <span key={i} className="rounded-full border border-gold/30 px-3 py-1 text-xs text-foreground/90" style={{ background: "rgba(201,168,76,0.06)" }}>
                      {p.nom}{aValeur(p.niveau_min) && p.niveau_min > 1 ? ` (niv. ${p.niveau_min})` : ""}
                    </span>
                  ))}
                </div>
              </div>
            );
          }
          return null;
        }

        // render si_flag : forge non_reparable (badge d'alerte si le drapeau est levé).
        if (champ.render === "si_flag") {
          const on = !!lireSource(champ.source, entite);
          if (!on) return null;
          return (
            <div key={champ.cle}>
              <span className="text-[11.5px] rounded-md px-2 py-0.5" style={{ color: "#e6b3b3", border: "1px solid #6b1f2a", background: "rgba(107,31,42,0.18)" }}>
                {(champ as any).texte}
              </span>
            </div>
          );
        }

        // render tableau : pièges (entite est un GROUPE porteur de `.rows`). Colonnes affichées si elles VARIENT.
        if (champ.render === "tableau") {
          const rows: any[] = Array.isArray((entite as any).rows) ? (entite as any).rows : [entite];
          if (rows.length === 0) return null;
          const cfg = champ as any;
          const varie = (k: string) => rows.some(r => r[k] !== rows[0][k]);
          const cols = (cfg.colonnes as any[]).filter(c => {
            if (!c.si_varie) return true;
            return rows.some(r => r[c.cle] != null) && varie(c.cle);
          });
          const effetTxt = rows[0][(cfg.effet.primaire as string).replace("col:", "")] ?? rows[0][(cfg.effet.fallback as string).replace("col:", "")];
          const meta = (cfg.meta as any[]).map(m => [m.label, lireSource(m.source, rows[0])]).filter(([, v]) => aValeur(v));
          const construction = rows.find(r => aValeur(r[(cfg.construction as string).replace("col:", "")]))?.[(cfg.construction as string).replace("col:", "")];
          const libCol = (c: any) => (c.lib_source ? rows[0][c.lib_source] : c.lib);
          return (
            <div key={champ.cle} className="flex flex-col gap-4">
              {aValeur(effetTxt) && (<div><LabelOr>Effet</LabelOr><Encadre><p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{String(effetTxt)}</p></Encadre></div>)}
              <div>
                <LabelOr>Niveaux</LabelOr>
                {meta.length > 0 && (
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm mb-3">
                    {meta.map(([k, v]) => (<span key={k as string}><span className="text-muted-foreground">{k} : </span><b className="text-gold">{String(v)}</b></span>))}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[13.5px]">
                    <thead><tr>{cols.map(c => (<th key={c.cle} className="text-left text-muted-foreground font-medium px-2.5 py-1.5 border-b border-border" style={{ fontVariant: "small-caps" }}>{libCol(c)}</th>))}</tr></thead>
                    <tbody>{rows.map((r, i) => (<tr key={i}>{cols.map(c => (<td key={c.cle} className="px-2.5 py-1.5 border-b border-border/60" style={c.cle_or ? { color: "#c9a84c", fontWeight: 700 } : undefined}>{r[c.cle]}</td>))}</tr>))}</tbody>
                  </table>
                </div>
              </div>
              {aValeur(construction) && (<div><LabelOr>Construction (niveau 1)</LabelOr><p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{String(construction)}</p></div>)}
            </div>
          );
        }

        // render religion : délègue à ReligionDetails (fiche double-couche, manuel interne).
        if (champ.render === "religion") {
          return <ReligionFiche key={champ.cle} entite={entite} />;
        }

        // render recette : alchimie. Intégral = verbatim parsé (RecetteSections) ;
        // abrégé = prose resume_condense. Fallback gracieux si pas de verbatim parsé.
        if (champ.render === "recette") {
          if (mode === "integral") {
            const sections = (entite as any)._sections;
            if (sections) {
              return (
                <div key={champ.cle} className="text-sm text-muted-foreground space-y-2">
                  <RecetteSections data={sections} />
                </div>
              );
            }
          }
          const src = (champ as any).abrege?.source;
          const txt = src ? lireSource(src, entite) : null;
          if (!aValeur(txt)) return null;
          return (
            <p key={champ.cle} className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {String(txt)}
            </p>
          );
        }

        // Mécanique simple : icone label : valeur
        const val = lireSource(champ.source, entite);
        if (!aValeur(val)) return null;
        return (
          <div key={champ.cle} className="flex items-baseline gap-2 text-sm text-foreground/90">
            {champ.icone && <span>{champ.icone}</span>}
            <span className="text-muted-foreground">{champ.label} :</span>
            <span className="font-semibold text-gold">
              {formaterValeur(val, champ)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
