import { useEffect, useState } from "react";
import { CardTitle } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { LEGENDE_CONSTRUCTION_PIEGES } from "@/constants/artisanat";
import EncyclopedieCard from "@/components/encyclopedie/EncyclopedieCard";
import { ManuelGlobalSwitch } from "@/components/shared/ToggleManuel";
import { useModeManuel } from "@/hooks/useModeManuel";
import { lireStockage, ecrireStockage } from "@/components/createur/aide/stockageLocal";

interface Piege {
  id: string;
  nom: string;
  niveau: number;
  cout_xp: number;
  cible: string;
  duree: string;
  effets: string;
  effet_generique: string | null;
  niveau_effet: number | null;
  magnitude: string | null;
  magnitude_label: string | null;
  type_piege: string;
  construction: string | null;
  resume_condense: string | null;
}

// Ingrédients « En Jeu » (présence physique requise) → mis en gras dans la construction.
// L'encre noire n'en fait PAS partie (volontaire).
const EN_JEU = [
  "Poulfis",
  "Manille",
  "Noligraf",
  "Fulard",
  "catalyseur à potion",
  "catalysant à potion",
  "pépites de fer",
  "pépites de cuivre",
];

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

const tousIdentiques = (vals: Array<string | number | null>) =>
  vals.every((v) => v === vals[0]);

// Extrait le rayon (en pieds) depuis une cible du type « Rayon de N pieds … ».
const rayonDe = (cible: string | null): number | null => {
  if (!cible) return null;
  const m = cible.match(/Rayon de\s+(\d+)\s+pied/i);
  return m ? Number(m[1]) : null;
};

/* ---------- Primitifs visuels (alignés sur ForgeJoaillerieSection) ---------- */

const Meta = ({ label, valeur }: { label: string; valeur: string }) => (
  <div className="text-sm">
    <div className="flex gap-3 items-baseline">
      <span className="text-primary uppercase text-[11px] font-bold tracking-wide min-w-[120px] shrink-0">{label}</span>
      <span className="font-semibold text-foreground">{valeur}</span>
    </div>
  </div>
);

const BlocLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-primary uppercase text-[11px] font-bold tracking-wide mb-1.5">{children}</p>
);

const Accordeon = ({
  titre, open, onToggle, children,
}: {
  titre: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) => (
  <div className="mb-3">
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left bg-primary/5 border border-primary/20 rounded-lg px-3.5 py-2.5 flex items-center gap-2.5"
    >
      <span className="font-heading font-bold text-primary flex-1 text-lg">{titre}</span>
      <ChevronRight className={`h-4 w-4 text-primary transition-transform ${open ? "rotate-90" : ""}`} />
    </button>
    {open && (
      <div className="pt-2.5 space-y-3 text-[13px] text-muted-foreground leading-relaxed">{children}</div>
    )}
  </div>
);

// Met en gras les ingrédients « En Jeu » dans une portion de texte.
const surlignerEnJeu = (texte: string): React.ReactNode => {
  const motifs = EN_JEU.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${motifs.join("|")})`, "gi");
  return texte.split(regex).map((part, i) =>
    EN_JEU.some((m) => m.toLowerCase() === part.toLowerCase())
      ? <span key={i} className="font-bold text-foreground">{part}</span>
      : <span key={i}>{part}</span>
  );
};

/* ---------- Bloc Construction (niveau 1) ---------- */

const BlocConstruction = ({ texte }: { texte: string }) => {
  const lignes = texte.split("\n").map((l) => l.trim()).filter(Boolean);
  const entete = lignes[0] ?? "";
  const tempsMatch = entete.match(/Construction\s*:\s*(.+)/i);
  const temps = tempsMatch ? tempsMatch[1] : entete;
  const ingredients = lignes.slice(1);
  return (
    <div>
      <BlocLabel>Construction (niveau 1)</BlocLabel>
      <p className="text-[13px] text-foreground mb-2">
        <span className="text-muted-foreground">Temps : </span>{temps}
      </p>
      <ul className="space-y-1.5">
        {ingredients.map((ligne, i) => {
          const consomme = ligne.includes("(===)");
          const propre = ligne.replace(/\((---|===)\)/g, "").replace(/\s{2,}/g, " ").replace(/\s:/g, " :").trim();
          return (
            <li key={i} className="flex gap-2 text-[13px]">
              <span className={`shrink-0 font-mono ${consomme ? "text-amber-500" : "text-emerald-500"}`}>
                {consomme ? "(===)" : "(---)"}
              </span>
              <span className="text-foreground">{surlignerEnJeu(propre)}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-[11.5px] text-muted-foreground italic mt-2">
        Avec l'outillage ou la forge appropriés, le temps de construction est réduit de moitié.
      </p>
    </div>
  );
};

/* ---------- Tableau des niveaux (colonnes dynamiques) ---------- */

const TableauNiveaux = ({ niveaux }: { niveaux: Piege[] }) => {
  const rayons = niveaux.map((n) => rayonDe(n.cible));
  const showRayon = rayons.some((r) => r != null) && !tousIdentiques(rayons);
  const showDuree = !tousIdentiques(niveaux.map((n) => n.duree));
  const showNivEffet = !tousIdentiques(niveaux.map((n) => n.niveau_effet));
  const magLabel = niveaux.find((n) => n.magnitude_label)?.magnitude_label ?? null;
  const showMag = niveaux.some((n) => n.magnitude != null);

  const cols: Array<{ key: string; header: string; cell: (n: Piege) => React.ReactNode }> = [
    { key: "niv", header: "Niveau", cell: (n) => n.niveau },
    { key: "cout", header: "Coût", cell: (n) => `${n.cout_xp} XP` },
  ];
  if (showRayon) cols.push({ key: "rayon", header: "Rayon", cell: (n) => { const r = rayonDe(n.cible); return r != null ? `${r} pieds` : "—"; } });
  if (showDuree) cols.push({ key: "duree", header: "Durée", cell: (n) => n.duree });
  if (showNivEffet) cols.push({ key: "ne", header: "Niv. d'effet", cell: (n) => n.niveau_effet ?? "—" });
  if (showMag) cols.push({ key: "mag", header: magLabel ?? "Valeur", cell: (n) => n.magnitude ?? "—" });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="border-b border-primary/20">
            {cols.map((c) => (
              <th key={c.key} className="text-left text-primary uppercase text-[10px] font-bold tracking-wide px-2 py-1.5 whitespace-nowrap">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {niveaux.map((n) => (
            <tr key={n.id} className="border-b border-border/40">
              {cols.map((c) => (
                <td key={c.key} className="px-2 py-1.5 text-foreground whitespace-nowrap">{c.cell(n)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ---------- Métas constantes (affichées une fois) ---------- */

const metasConstants = (niveaux: Piege[]): Array<{ label: string; valeur: string }> => {
  const metas: Array<{ label: string; valeur: string }> = [];
  const estRayon = niveaux.some((n) => rayonDe(n.cible) != null);
  if (estRayon) {
    const rayons = niveaux.map((n) => rayonDe(n.cible));
    if (tousIdentiques(rayons) && rayons[0] != null) {
      metas.push({ label: "Rayon", valeur: `${rayons[0]} pieds autour de la carte du piège` });
    } else {
      metas.push({ label: "Rayon", valeur: "autour de la carte du piège" });
    }
  } else if (tousIdentiques(niveaux.map((n) => n.cible))) {
    metas.push({ label: "Cible", valeur: niveaux[0].cible });
  }
  if (tousIdentiques(niveaux.map((n) => n.duree))) {
    metas.push({ label: "Durée", valeur: niveaux[0].duree });
  }
  if (tousIdentiques(niveaux.map((n) => n.niveau_effet)) && niveaux[0].niveau_effet != null) {
    metas.push({ label: "Niv. d'effet", valeur: String(niveaux[0].niveau_effet) });
  }
  return metas;
};

const effetAffiche = (mode: "abrege" | "integral", principal: Piege): string =>
  mode === "abrege"
    ? (principal.resume_condense ?? principal.effet_generique ?? principal.effets)
    : (principal.effet_generique ?? principal.effets);

/* ---------- Section ---------- */

// Accordéons d'aide : ouverts par défaut, état persisté en localStorage par joueur.
const CLE_AIDE = "hv-pieges-aide:";
const lireAide = (k: string): boolean => {
  const v = lireStockage(CLE_AIDE + k);
  return v === null ? true : v === "true";
};

const PiegesSection = ({
  pieges,
  searchQuery = "",
}: {
  pieges: Piege[];
  searchQuery?: string;
}) => {
  const [mode, setMode] = useModeManuel("encyclopedie", "integral");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [aide, setAide] = useState<{ marche: boolean; legende: boolean }>(() => ({
    marche: lireAide("marche"),
    legende: lireAide("legende"),
  }));

  useEffect(() => {
    ecrireStockage(CLE_AIDE + "marche", String(aide.marche));
    ecrireStockage(CLE_AIDE + "legende", String(aide.legende));
  }, [aide]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const matchPiege = (p: Piege, q: string) =>
    p.nom.toLowerCase().includes(q) ||
    (p.effets ?? "").toLowerCase().includes(q) ||
    (p.effet_generique ?? "").toLowerCase().includes(q) ||
    (p.resume_condense ?? "").toLowerCase().includes(q) ||
    (p.cible ?? "").toLowerCase().includes(q);

  useEffect(() => {
    if (!searchQuery) return;
    const qLow = searchQuery.toLowerCase();
    setExpanded(new Set(pieges.filter((p) => matchPiege(p, qLow)).map((p) => p.nom)));
  }, [searchQuery, pieges]);

  const q = searchQuery.trim().toLowerCase();
  const filtered = q ? pieges.filter((p) => matchPiege(p, q)) : pieges;

  const grouped = groupBy(filtered, (p) => p.nom);
  const keys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold text-primary mb-2">Pièges</h2>

      <ManuelGlobalSwitch
        allOpen={mode === "integral"}
        onToggle={() => setMode((m) => (m === "integral" ? "abrege" : "integral"))}
        title="Texte du manuel"
        subtitle="Intégral (verbatim du manuel) ou abrégé"
      />

      <Accordeon titre="Comment fonctionnent les pièges" open={aide.marche} onToggle={() => setAide((a) => ({ ...a, marche: !a.marche }))}>
        <p><span className="font-semibold text-foreground">Découverte.</span> Un joueur qui découvre un piège lit la carte et en subit les effets, puis l'empoche et la remet à l'animation dès que possible.</p>
        <p><span className="font-semibold text-foreground">Sabotage.</span> Saboter un piège prend 5 minutes et permet d'en ignorer les effets. Après son passage, on peut réactiver le piège, ou empocher la carte et la remettre à l'animation.</p>
        <p><span className="font-semibold text-foreground">Rachat.</span> Si vous sabotez un piège et possédez Connaissances criminelles d'un niveau au moins égal à celui du piège, vous pouvez le racheter au camp des DM pour 50 % de son coût.</p>
        <p><span className="font-semibold text-foreground">Pièges magiques.</span> Un piège magique ne peut pas être récupéré (compétence Piège magique + Canalisation ; l'effet dépend du sort emprisonné). Maximum 1 piège par coffre.</p>
        <div className="border-t border-primary/10 pt-2 space-y-1">
          <p><span className="text-primary font-semibold">Niveau 1</span> — installe les pièges de niveau 1 ; 3 recettes de niveau 1 offertes à l'achat de la compétence.</p>
          <p><span className="text-primary font-semibold">Niveau 2</span> — installe les pièges de niveau 2 ; améliore gratuitement 2 recettes de niveau 1 vers le niveau 2.</p>
          <p><span className="text-primary font-semibold">Niveau 3</span> — installe les pièges de niveau 3 ; améliore gratuitement 1 recette de niveau 2 vers le niveau 3.</p>
        </div>
      </Accordeon>

      <Accordeon titre="Légende des symboles" open={aide.legende} onToggle={() => setAide((a) => ({ ...a, legende: !a.legende }))}>
        <p><span className="font-semibold text-foreground">Niveau d'effet</span> — valeur de l'effet du piège utilisée par les règles de résistance et de dissipation.</p>
        <p><span className="font-semibold text-foreground">Construction</span> — {LEGENDE_CONSTRUCTION_PIEGES}</p>
      </Accordeon>

      {keys.length === 0 ? (
        <p className="text-muted-foreground text-center py-6">Aucun résultat pour cette recherche.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {keys.map((nom) => {
            const niveaux = [...grouped[nom]].sort((a, b) => a.niveau - b.niveau);
            const principal = niveaux[0];
            const construction = niveaux.find((n) => n.construction)?.construction ?? null;
            return (
              <EncyclopedieCard
                key={nom}
                id={nom}
                isOpen={expanded.has(nom)}
                onToggle={() => toggleExpanded(nom)}
                maxHeight={2400}
                header={
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="font-heading text-base">{nom}</CardTitle>
                      {principal.type_piege && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-stone-600 bg-stone-800 rounded px-1.5 py-px whitespace-nowrap">
                          {principal.type_piege}
                        </span>
                      )}
                    </div>
                    {principal.resume_condense && (
                      <p className="text-xs text-muted-foreground mt-0.5">{principal.resume_condense}</p>
                    )}
                  </>
                }
              >
                <div className="border-t border-primary/10 pt-3 mt-1 space-y-3.5">
                  <p className="text-[13px] text-foreground leading-relaxed">{effetAffiche(mode, principal)}</p>
                  {metasConstants(niveaux).map((m) => <Meta key={m.label} {...m} />)}
                  <div>
                    <BlocLabel>Niveaux</BlocLabel>
                    <TableauNiveaux niveaux={niveaux} />
                  </div>
                  {construction && <BlocConstruction texte={construction} />}
                </div>
              </EncyclopedieCard>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PiegesSection;
