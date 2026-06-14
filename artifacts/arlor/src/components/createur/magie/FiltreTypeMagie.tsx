// I7 — Filtre par type (spec s171) : chips « Filtrer : Tous (n) / Bénéfique
// (n) / Effet (n) / Dégâts (n) » sous le header d'un cercle/domaine ouvert,
// aux couleurs PastilleType. Masqué si moins de 2 types présents. État
// indépendant par cercle (porté par le parent).

// Couleurs identiques à PastilleType (s162) — CONFIG y est privé.
const TYPES_CONNUS: { type: string; libelle: string; couleur: string }[] = [
  { type: "effet bénéfique", libelle: "Bénéfique", couleur: "hsl(142 55% 48%)" },
  { type: "effet", libelle: "Effet", couleur: "hsl(210 75% 62%)" },
  { type: "dégâts", libelle: "Dégâts", couleur: "hsl(0 65% 55%)" },
];

const avecAlpha = (couleur: string, alpha: number) =>
  couleur.replace(")", ` / ${alpha})`);

interface FiltreTypeMagieProps {
  /** Nombre d'items par type présent dans le groupe ouvert. */
  compteParType: Record<string, number>;
  total: number;
  filtre: string | null;
  onFiltre: (filtre: string | null) => void;
  /** Liste des types reconnus. Défaut = types de magie. Permet de réutiliser
   * le filtre pour l'alchimie (potion/poison). */
  typesConnus?: { type: string; libelle: string; couleur: string }[];
}

const FiltreTypeMagie = ({
  compteParType,
  total,
  filtre,
  onFiltre,
  typesConnus = TYPES_CONNUS,
}: FiltreTypeMagieProps) => {
  const presents = typesConnus.filter((t) => (compteParType[t.type] ?? 0) > 0);
  if (presents.length < 2) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-2">
      <span className="text-[11px] font-semibold text-muted-foreground">
        Filtrer :
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onFiltre(null);
        }}
        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
          filtre === null
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-muted-foreground"
        }`}
      >
        Tous ({total})
      </button>
      {presents.map((t) => {
        const actif = filtre === t.type;
        return (
          <button
            key={t.type}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFiltre(actif ? null : t.type);
            }}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
            style={{
              color: t.couleur,
              borderColor: actif ? t.couleur : avecAlpha(t.couleur, 0.35),
              backgroundColor: actif ? avecAlpha(t.couleur, 0.2) : "transparent",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: t.couleur }}
            />
            {t.libelle} ({compteParType[t.type]})
          </button>
        );
      })}
    </div>
  );
};

export default FiltreTypeMagie;
