import { useEffect } from "react";
import {
  ArrowRight, X, Check, CornerDownRight, Coins, Lock, ChevronDown,
  AlertTriangle, Plus, ShieldCheck, EyeOff, Gift, Circle, CheckCircle2, Loader2,
} from "lucide-react";

/* ============================================================
 *  Modale « Modifier la classe » — présentational (câblée s126)
 *  Issue de la maquette s124. Reçoit `d` (forme mappée depuis le
 *  dry_run de changer_classe_personnage). Sélecteur multi-choix
 *  contrôlé par le parent (re-appel dry_run = total XP live).
 *  Tokens réels Hurlevent. Styles inline.
 * ============================================================ */

export interface DPerdueSimple {
  nom: string;
  niv: number;
  xp: number;
  gratuit: boolean;
  why: string;
}
export interface DPerdueCascade {
  nom: string;
  cascade: true;
  why: string;
  levels: Array<{ niv: number; gratuit: boolean; xp: number }>;
}
export interface DMultiChoix {
  competence_id: string;
  nom: string;
  why: string;
  options: Array<{ id: string; label: string; xp: number }>;
}
export interface DChangementClasse {
  from: { n: string; e: string };
  to: { n: string; e: string };
  perso: string;
  perdues: Array<DPerdueSimple | DPerdueCascade>;
  reduites: Array<{ nom: string; from: number; to: number; why: string; xp: number }>;
  offertesRefund: Array<{ nom: string; niv: number; why: string; xp: number }>;
  multiChoix: DMultiChoix[];
  dormants: { items: Array<{ nom: string; niv: number }>; xp: number; why: string };
  maitre: Array<{ nom: string; niv: number; why: string }>;
  nouvelles: Array<{ nom: string; niv: number }>;
  inchangees: string[];
  xpRembourse: number;
}

interface Props {
  d: DChangementClasse;
  selections: Record<string, string>;
  onSelect: (competenceId: string, choixAchat: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

const C = {
  bg: "hsl(0 0% 4%)", bgElev: "hsl(0 0% 7%)", bgMuted: "hsl(0 0% 12%)",
  fg: "hsl(36 33% 93%)", fgMut: "hsl(36 15% 60%)",
  gold: "hsl(43 51% 54%)", amber: "hsl(40 80% 63%)",
  wine: "hsl(348 60% 46%)", red: "hsl(0 64% 55%)",
  dorm: "hsl(214 22% 64%)", border: "hsl(0 0% 16%)",
};
const tint = (c: string, a: number) => c.replace(")", ` / ${a})`);
const HEAD = { fontFamily: "'Cinzel', serif" } as const;
const BODY = { fontFamily: "'Inter', sans-serif" } as const;

const Badge = ({ niv, struck }: { niv: number; struck?: boolean }) => (
  <span style={{ ...BODY, fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
    background: C.bgMuted, color: struck ? C.fgMut : C.fg, border: `1px solid ${C.border}`,
    textDecoration: struck ? "line-through" : "none", whiteSpace: "nowrap" }}>niv {niv}</span>
);
const Xp = ({ xp, gratuit }: { xp: number; gratuit?: boolean }) =>
  gratuit && xp === 0
    ? <span style={{ ...BODY, fontSize: 11, color: C.fgMut, whiteSpace: "nowrap" }}>0 XP</span>
    : <span style={{ ...BODY, fontSize: 12, fontWeight: 700, color: C.gold, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}><Coins size={12} /> +{xp} XP</span>;

const Card = ({ children, accentBg }: { children: React.ReactNode; accentBg?: string }) => (
  <div style={{ background: accentBg || C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 11px" }}>{children}</div>
);
const RowTop = ({ children }: { children: React.ReactNode }) => <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{children}</div>;
const Why = ({ children }: { children: React.ReactNode }) => <p style={{ ...BODY, fontSize: 11, color: C.fgMut, margin: "4px 0 0", lineHeight: 1.4 }}>{children}</p>;
const Pill = ({ e, n, dim }: { e: string; n: string; dim?: boolean }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 9, background: dim ? C.bgMuted : tint(C.gold, 0.12), border: `1px solid ${dim ? C.border : C.gold}`, opacity: dim ? 0.7 : 1 }}>
    <span style={{ fontSize: 15 }}>{e}</span>
    <span style={{ ...HEAD, fontSize: 14, fontWeight: 700, color: dim ? C.fgMut : C.gold }}>{n}</span>
  </div>
);

function Section({ icon, title, accent, count, children, open = true }: {
  icon: React.ReactNode; title: string; accent: string; count?: number; children: React.ReactNode; open?: boolean;
}) {
  return (
    <details open={open} style={{ background: C.bgElev, border: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 10, overflow: "hidden" }}>
      <summary style={{ listStyle: "none", display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", cursor: "pointer" }}>
        <span style={{ color: accent, display: "flex" }}>{icon}</span>
        <span style={{ ...BODY, fontSize: 13, fontWeight: 600, color: C.fg, flex: 1, textAlign: "left" }}>{title}</span>
        {typeof count === "number" && <span style={{ ...BODY, fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 999, background: tint(accent, 0.16), color: accent }}>{count}</span>}
        <ChevronDown size={15} style={{ color: C.fgMut }} />
      </summary>
      <div style={{ padding: "2px 13px 12px", display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </details>
  );
}

export default function ModaleChangementClasse({ d, selections, onSelect, onConfirm, onCancel, busy }: Props) {
  // Fermeture clavier (Échap)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [busy, onCancel]);

  const hasOffertes = d.offertesRefund.length > 0 || d.multiChoix.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => { if (!busy) onCancel(); }}
      style={{ ...BODY, position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 12px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 440, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 18, boxShadow: "0 24px 60px -12px rgba(0,0,0,.85)", display: "flex", flexDirection: "column", maxHeight: "88vh", position: "relative" }}
      >
        {/* header */}
        <div style={{ padding: "18px 20px 15px", borderBottom: `1px solid ${C.border}`, background: `linear-gradient(180deg, ${C.bgElev}, ${C.bg})`, borderRadius: "18px 18px 0 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ ...BODY, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: C.gold }}>Modifier la classe</span>
            <button onClick={() => !busy && onCancel()} aria-label="Fermer" style={{ background: "transparent", border: "none", cursor: busy ? "default" : "pointer", padding: 0, display: "flex" }}>
              <X size={18} style={{ color: C.fgMut }} />
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <Pill e={d.from.e} n={d.from.n} dim /><ArrowRight size={18} style={{ color: C.gold }} /><Pill e={d.to.e} n={d.to.n} />
          </div>
          <p style={{ ...BODY, fontSize: 12, color: C.fgMut, textAlign: "center", margin: 0 }}>{d.perso}</p>
        </div>

        {/* body */}
        <div style={{ padding: "15px 16px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
          <p style={{ ...BODY, fontSize: 12.5, color: C.fg, margin: 0, lineHeight: 1.45 }}>Ce changement de classe a des conséquences. Vérifie-les avant de confirmer.</p>

          {/* perdues + cascade */}
          {d.perdues.length > 0 && (
            <Section icon={<Lock size={16} />} title="Compétences perdues & remboursées" accent={C.red} count={d.perdues.length}>
              {d.perdues.map((p, i) => "cascade" in p ? (
                <Card key={i}>
                  <RowTop><span style={{ ...BODY, fontSize: 13, fontWeight: 600, color: C.fg, flex: 1 }}>{p.nom}</span></RowTop>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 6 }}>
                    {p.levels.map((l, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        {j > 0 && <CornerDownRight size={13} style={{ color: C.wine }} />}
                        <Badge niv={l.niv} struck />
                        <span style={{ ...BODY, fontSize: 11, color: C.fgMut, flex: 1 }}>{l.gratuit ? "acquis gratuitement" : "niveau payé — retiré en cascade"}</span>
                        <Xp xp={l.xp} gratuit={l.gratuit} />
                      </div>
                    ))}
                  </div>
                  <Why>{p.why}</Why>
                </Card>
              ) : (
                <Card key={i}>
                  <RowTop>
                    <span style={{ ...BODY, fontSize: 13, fontWeight: 600, color: C.fg, flex: 1, textDecoration: "line-through", textDecorationColor: tint(C.red, 0.7) }}>{p.nom}</span>
                    <Badge niv={p.niv} struck /><Xp xp={p.xp} gratuit={p.gratuit} />
                  </RowTop>
                  <Why>{p.why}</Why>
                </Card>
              ))}
            </Section>
          )}

          {/* reduites (over-cap) */}
          {d.reduites.length > 0 && (
            <Section icon={<AlertTriangle size={16} />} title="Niveaux réduits (au-dessus du plafond)" accent={C.wine} count={d.reduites.length}>
              {d.reduites.map((r, i) => (
                <Card key={i}>
                  <RowTop>
                    <span style={{ ...BODY, fontSize: 13, fontWeight: 600, color: C.fg, flex: 1 }}>{r.nom}</span>
                    <Badge niv={r.from} struck /><ArrowRight size={12} style={{ color: C.fgMut }} /><Badge niv={r.to} /><Xp xp={r.xp} />
                  </RowTop>
                  <Why>{r.why}</Why>
                </Card>
              ))}
            </Section>
          )}

          {/* offertes (single + multi-choix) */}
          {hasOffertes && (
            <Section icon={<Gift size={16} />} title="Déjà acquises, désormais offertes — remboursées" accent={C.gold} count={d.offertesRefund.length + d.multiChoix.length}>
              {d.offertesRefund.map((o, i) => (
                <Card key={`r${i}`}>
                  <RowTop>
                    <Gift size={13} style={{ color: C.gold }} />
                    <span style={{ ...BODY, fontSize: 13, fontWeight: 600, color: C.fg, flex: 1 }}>{o.nom}</span>
                    <Badge niv={o.niv} /><Xp xp={o.xp} />
                  </RowTop>
                  <Why>{o.why}</Why>
                </Card>
              ))}
              {d.multiChoix.map((m) => {
                const sel = selections[m.competence_id] ?? (m.options[0]?.id ?? "");
                const selXp = m.options.find((o) => o.id === sel)?.xp ?? 0;
                return (
                  <Card key={m.competence_id} accentBg={tint(C.gold, 0.06)}>
                    <RowTop>
                      <span style={{ ...BODY, fontSize: 13, fontWeight: 600, color: C.fg, flex: 1 }}>{m.nom}</span>
                      <Xp xp={selXp} />
                    </RowTop>
                    <Why>{m.why}</Why>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      {m.options.map((opt) => {
                        const on = sel === opt.id;
                        return (
                          <button key={opt.id} onClick={() => !busy && onSelect(m.competence_id, opt.id)} disabled={busy} style={{
                            display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 7, cursor: busy ? "default" : "pointer", textAlign: "left",
                            background: on ? tint(C.gold, 0.14) : C.bg, border: `1px solid ${on ? C.gold : C.border}`,
                          }}>
                            {on ? <CheckCircle2 size={16} style={{ color: C.gold }} /> : <Circle size={16} style={{ color: C.fgMut }} />}
                            <span style={{ ...BODY, fontSize: 12.5, fontWeight: on ? 700 : 500, color: on ? C.fg : C.fgMut, flex: 1 }}>{opt.label}</span>
                            <span style={{ ...BODY, fontSize: 11, color: on ? C.gold : C.fgMut }}>{on ? `→ gratuite (+${opt.xp} XP)` : "reste payée"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </Section>
          )}

          {/* dormants INVISIBLES + message */}
          {d.dormants.items.length > 0 && (
            <Section icon={<EyeOff size={16} />} title="Sorts & prières inaccessibles" accent={C.dorm} count={d.dormants.items.length}>
              {d.dormants.items.map((s, i) => (
                <Card key={i}>
                  <RowTop>
                    <EyeOff size={13} style={{ color: C.dorm }} />
                    <span style={{ ...BODY, fontSize: 13, fontWeight: 600, color: C.fg, flex: 1 }}>{s.nom}</span>
                    <Badge niv={s.niv} />
                  </RowTop>
                </Card>
              ))}
              <Card accentBg={tint(C.dorm, 0.08)}>
                <p style={{ ...BODY, fontSize: 11.5, color: C.fg, margin: 0, lineHeight: 1.45 }}>
                  <b>Ils ne sont pas effacés.</b> {d.dormants.why} Ils disparaissent de ta fiche et de tes impressions, mais <b>réapparaîtront automatiquement</b> si tu regagnes les prérequis. XP remboursé : <b style={{ color: C.gold }}>+{d.dormants.xp} XP</b>.
                </p>
              </Card>
            </Section>
          )}

          {/* maître */}
          {d.maitre.length > 0 && (
            <Section icon={<AlertTriangle size={16} />} title="Maître à reconfirmer" accent={C.amber} count={d.maitre.length}>
              {d.maitre.map((m, i) => (
                <Card key={i}>
                  <RowTop>
                    <span style={{ ...BODY, fontSize: 13, fontWeight: 600, color: C.fg, flex: 1 }}>{m.nom}</span>
                    <Badge niv={m.niv} />
                    <span style={{ ...BODY, fontSize: 10.5, fontWeight: 700, color: C.amber, background: tint(C.amber, 0.14), padding: "2px 6px", borderRadius: 4 }}>en attente</span>
                  </RowTop>
                  <Why>{m.why}</Why>
                </Card>
              ))}
            </Section>
          )}

          {/* nouvelles gratuites */}
          {d.nouvelles.length > 0 && (
            <Section icon={<Plus size={16} />} title={`Compétences offertes par ${d.to.n}`} accent={C.gold} count={d.nouvelles.length}>
              {d.nouvelles.map((a, i) => (
                <Card key={i}>
                  <RowTop>
                    <Plus size={13} style={{ color: C.gold }} />
                    <span style={{ ...BODY, fontSize: 13, fontWeight: 600, color: C.fg, flex: 1 }}>{a.nom}</span>
                    <Badge niv={a.niv} /><span style={{ ...BODY, fontSize: 11, color: C.fgMut }}>offerte</span>
                  </RowTop>
                </Card>
              ))}
            </Section>
          )}

          {/* conservées */}
          {d.inchangees.length > 0 && (
            <Section icon={<ShieldCheck size={16} />} title="Conservées (inchangées)" accent={C.fgMut} count={d.inchangees.length} open={false}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {d.inchangees.map((n, i) => <span key={i} style={{ ...BODY, fontSize: 11, padding: "4px 8px", borderRadius: 5, background: C.bgMuted, color: C.fgMut, border: `1px solid ${C.border}` }}>{n}</span>)}
              </div>
            </Section>
          )}
        </div>

        {/* footer */}
        <div style={{ padding: "15px 20px", borderTop: `1px solid ${C.border}`, background: C.bgElev, borderRadius: "0 0 18px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ ...BODY, fontSize: 12, color: C.fgMut }}>XP remboursé au total</span>
            <span style={{ ...HEAD, fontSize: 18, fontWeight: 700, color: C.gold, display: "inline-flex", alignItems: "center", gap: 6 }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Coins size={16} />} +{d.xpRembourse} XP
            </span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => !busy && onCancel()} disabled={busy} style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 7, padding: "11px 0", borderRadius: 9, ...BODY, fontSize: 13, fontWeight: 600, background: "transparent", color: C.fg, border: `1px solid ${C.border}`, cursor: busy ? "default" : "pointer" }}><X size={15} /> Annuler</button>
            <button onClick={() => !busy && onConfirm()} disabled={busy} style={{ flex: 1.5, display: "flex", justifyContent: "center", alignItems: "center", gap: 7, padding: "11px 0", borderRadius: 9, ...BODY, fontSize: 13, fontWeight: 700, background: C.gold, color: C.bg, border: "none", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Confirmer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
