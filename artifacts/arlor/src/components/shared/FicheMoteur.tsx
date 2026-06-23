import React from "react";

/**
 * FicheMoteur — moteur de rendu schema-driven (Lot 1).
 *
 * Lit un schéma (champs de `fiches_schemas`) + la ligne d'une entité et rend
 * la fiche à une DENSITÉ donnée, dans un MODE manuel donné.
 *
 * Deux axes INDÉPENDANTS :
 *  - densité (imposée par la surface) : "carte" (compact) | "encyclo" (complet).
 *  - mode (choisi par le joueur, bascule) : "abrege" | "integral".
 *    → n'affecte QUE les champs texte (choix de la source c/v). Jamais les chiffres.
 *
 * Règles :
 *  - champ "mecanique" : toujours visible. carte = `icone valeur` ; encyclo = `icone label : valeur`.
 *    render:"liste_competences" → résout competence_id → nom via `competencesParId`.
 *  - champ "texte" : visible en encyclo seulement (le header carte n'affiche pas de lore).
 *    source = mode "integral" → v.source ; "abrege" → c.source.
 */

export type Densite = "carte" | "encyclo";
export type ModeManuel = "abrege" | "integral";

type SousSource = { source?: string; densite?: string };

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
  c?: SousSource;
  v?: SousSource;
};

type Props = {
  schema: ChampSchema[];
  entite: Record<string, any>;
  densite: Densite;
  mode: ModeManuel;
  competencesParId?: Record<string, string>;
};

// "col:xxx" -> entite.xxx (seule source supportée au Lot 1)
function lireSource(source: string | undefined, entite: Record<string, any>) {
  if (!source) return undefined;
  const [kind, key] = source.split(":");
  if (kind === "col") return entite[key];
  return undefined;
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

export function FicheMoteur({ schema, entite, densite, mode, competencesParId }: Props) {
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
            if (val === null || val === undefined || val === "") return null;
            return (
              <span key={champ.cle}>
                {champ.icone ? `${champ.icone} ` : ""}
                {String(val)}
                {champ.suffixe ? ` ${champ.suffixe}` : ""}
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
        // Champ texte (lore) : source pilotée par le MODE.
        if (champ.type === "texte") {
          const src = mode === "integral" ? champ.v?.source : champ.c?.source;
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

        // Mécanique simple : icone label : valeur
        const val = lireSource(champ.source, entite);
        if (val === null || val === undefined || val === "") return null;
        return (
          <div key={champ.cle} className="flex items-baseline gap-2 text-sm text-foreground/90">
            {champ.icone && <span>{champ.icone}</span>}
            <span className="text-muted-foreground">{champ.label} :</span>
            <span className="font-semibold text-gold">
              {String(val)}
              {champ.suffixe ? ` ${champ.suffixe}` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
