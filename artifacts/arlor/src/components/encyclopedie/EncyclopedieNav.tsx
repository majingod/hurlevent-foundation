import React from "react";
// Navigation groupée de l'encyclopédie — réutilisable (admin v2 + future page joueur).
// 14 catégories regroupées par thème. Deux rendus : Hub (accueil) et Switcher (compact).

export type CatNav = { cle: string; label: string; emoji: string };

export const GROUPES_ENCYCLO: { titre: string; cats: CatNav[] }[] = [
  {
    titre: "Personnage",
    cats: [
      { cle: "race", label: "Races", emoji: "🧝" },
      { cle: "trait_racial", label: "Traits raciaux", emoji: "✨" },
      { cle: "classe", label: "Classes", emoji: "⚔️" },
      { cle: "competences", label: "Compétences", emoji: "🎯" },
    ],
  },
  {
    titre: "Magie",
    cats: [
      { cle: "sorts", label: "Sorts", emoji: "🔮" },
      { cle: "prieres", label: "Prières", emoji: "🙏" },
      { cle: "religions", label: "Religions", emoji: "⛪" },
    ],
  },
  {
    titre: "Artisanat",
    cats: [
      { cle: "forge", label: "Forge", emoji: "🔨" },
      { cle: "joaillerie", label: "Joaillerie", emoji: "💎" },
      { cle: "alchimie", label: "Alchimie", emoji: "⚗️" },
      { cle: "assemblages", label: "Assemblages", emoji: "🔧" },
      { cle: "pieges", label: "Pièges", emoji: "🪤" },
    ],
  },
  {
    titre: "Monde",
    cats: [
      { cle: "bestiaire", label: "Bestiaire", emoji: "🐉" },
      { cle: "lore", label: "Régions / Lore", emoji: "🗺️" },
    ],
  },
];

export const CATS_ENCYCLO: CatNav[] = GROUPES_ENCYCLO.flatMap((g) => g.cats);

const GROUPE_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#c9a84c",
  opacity: 0.75,
  margin: "0 0 6px",
};
const GOLD_SOFT = "rgba(201,168,76,0.06)";

/** Accueil : grille de catégories groupées par thème. */
export function EncyclopedieHub({ onPick }: { onPick: (cle: string) => void }) {
  return (
    <div className="grid gap-4">
      {GROUPES_ENCYCLO.map((g) => (
        <div key={g.titre}>
          <p style={GROUPE_LABEL}>{g.titre}</p>
          <div className="grid grid-cols-2 gap-2">
            {g.cats.map((c) => (
              <button
                key={c.cle}
                onClick={() => onPick(c.cle)}
                className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-3 text-left transition-all hover:border-gold"
                style={{ background: GOLD_SOFT }}
              >
                <span className="text-xl leading-none">{c.emoji}</span>
                <span className="font-heading text-sm text-foreground">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Dans une catégorie : pastilles compactes groupées (wrap, zéro scroll horizontal). */
export function EncyclopedieSwitcher({
  active,
  onPick,
}: {
  active: string;
  onPick: (cle: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-6">
      {CATS_ENCYCLO.map((c) => {
        const on = c.cle === active;
        return (
          <button
            key={c.cle}
            onClick={() => onPick(c.cle)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-heading transition-all ${
              on
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            style={on ? undefined : { background: GOLD_SOFT }}
          >
            <span className="leading-none">{c.emoji}</span>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
