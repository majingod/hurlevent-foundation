// Pastille de type de magie (effet / effet bénéfique / dégâts) — affichée sur
// toutes les cartes sorts et prières. Couleurs validées sur maquette (s162).
// Type inconnu / null → ne rien rendre.

export type TypeMagie = "effet" | "effet bénéfique" | "dégâts";

// Inclut aussi les types d'alchimie (potion/poison), aux mêmes couleurs que la
// magie (potion = vert bénéfique, poison = rouge dégâts) — pastille de type
// partagée sorts / prières / recettes.
const CONFIG: Record<string, { libelle: string; couleur: string }> = {
  "effet bénéfique": { libelle: "Bénéfique", couleur: "hsl(142 55% 48%)" },
  effet: { libelle: "Effet", couleur: "hsl(210 75% 62%)" },
  "dégâts": { libelle: "Dégâts", couleur: "hsl(0 65% 55%)" },
  potion: { libelle: "Potion", couleur: "hsl(142 55% 48%)" },
  poison: { libelle: "Poison", couleur: "hsl(0 65% 55%)" },
};

// hsl(...) → hsl(... / a) : fond à 12 %, bordure à 35 %.
const avecAlpha = (couleur: string, alpha: number) =>
  couleur.replace(")", ` / ${alpha})`);

export const PastilleType = ({ type }: { type?: string | null }) => {
  const cfg = type ? CONFIG[type as TypeMagie] : undefined;
  if (!cfg) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide"
      style={{
        color: cfg.couleur,
        backgroundColor: avecAlpha(cfg.couleur, 0.12),
        border: `1px solid ${avecAlpha(cfg.couleur, 0.35)}`,
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: cfg.couleur }}
      />
      {cfg.libelle}
    </span>
  );
};

export default PastilleType;
