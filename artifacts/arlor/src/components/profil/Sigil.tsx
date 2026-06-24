// Sigil (blason) partagé — extrait de QuiJoue. Affiche les initiales d'un profil
// dans un écusson. Taille paramétrable. (Mutualisation : QuiJoue/Navbar à migrer plus tard.)
const T_OR = "hsl(43 51% 54%)";
const T_OR_DIM = "hsl(43 40% 38%)";
const T_NOIR2 = "hsl(0 0% 8%)";

const initiales = (nom: string) =>
  nom
    .trim()
    .split(/\s+/)
    .map((m) => m[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

interface SigilProps {
  nom: string;
  size?: number;
  actif?: boolean;
}

export default function Sigil({ nom, size = 56, actif = false }: SigilProps) {
  const trait = actif ? T_OR : T_OR_DIM;
  const w = size;
  const h = size * 1.083;
  return (
    <div style={{ width: w, height: h, position: "relative", flexShrink: 0 }}>
      <svg viewBox="0 0 100 110" width={w} height={h}>
        <path
          d="M50 4 L94 18 V58 C94 84 74 100 50 108 C26 100 6 84 6 58 V18 Z"
          fill={T_NOIR2}
          stroke={trait}
          strokeWidth="2.5"
        />
        <path d="M50 4 L94 18 V58 C94 84 74 100 50 108 Z" fill="hsl(0 0% 0% / .25)" />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: size * 0.08,
          fontFamily: '"Cinzel", serif',
          fontSize: size * 0.32,
          color: T_OR,
          letterSpacing: 1,
        }}
      >
        {initiales(nom)}
      </div>
    </div>
  );
}
