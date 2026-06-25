import { useEffect, useState } from "react";
import { ChevronRight, Clock } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import EncyclopedieCard from "@/components/encyclopedie/EncyclopedieCard";
import { CardTitle } from "@/components/ui/card";

// Icône lingot (commun, Niveau 1) — embarquée pour éviter un asset externe.
const LINGOT_SRC = "data:image/png;base64,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";
const Lingot = ({ s = 20 }: { s?: number }) => (
  <img src={LINGOT_SRC} alt="" width={s} height={s} className="block shrink-0" />
);

interface ObjetForge {
  id: string;
  nom: string | null;
  description: string | null;
  type: string | null;
  stats: Json | null;
  temps_fabrication_minutes: number | null;
  materiaux_communs: string | null;
  materiaux_rares: string | null;
  exemples: string | null;
  prise: string | null;
  emplacement: string | null;
  portee: string | null;
  degats_membre: number | null;
  degats_torse: number | null;
  points_armure: number | null;
  combats: number | null;
  effet: string | null;
  taille_min: number | null;
  taille_max: number | null;
  pression_max: number | null;
  fab_a_preciser: boolean | null;
  reparation_id: string | null;
}

interface ObjetJoaillerie {
  id: string;
  nom: string | null;
  description: string | null;
  effet: string | null;
  temps_fabrication_minutes: number | null;
  materiaux_communs: string | null;
  materiaux_rares: string | null;
}

interface Reparation {
  id: string;
  categorie: string;
  nom_affichage: string;
  temps_minutes: number;
  temps_rare_minutes: number;
  materiaux: string;
  materiaux_rares: string;
  materiaux_a_preciser: boolean | null;
  notes: string | null;
}

type PalierData = {
  tier: string;
  niveau: 1 | 2;
  recette: string | null;
  temps?: number | null;
  attente?: boolean;
};

type MetaData = { label: string; valeur: string; note?: string };

type EtatReparation =
  | { etat: "paliers"; paliers: PalierData[]; matAttente?: boolean }
  | { etat: "tbd" }
  | { etat: "none" };

const JOAILLERIE_RARE_SURCOUT = 10; // manuel : joaillerie rare = +10 min

/* ---------- Persistance localStorage ---------- */

function lireBool(key: string, def: boolean): boolean {
  try {
    const s = localStorage.getItem(key);
    return s === null ? def : s === "1";
  } catch {
    return def;
  }
}
function usePersistBool(key: string, def: boolean) {
  const [v, setV] = useState<boolean>(() => lireBool(key, def));
  useEffect(() => {
    try {
      localStorage.setItem(key, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [key, v]);
  return [v, setV] as const;
}
function usePersistSet(key: string) {
  const [s, setS] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify([...s]));
    } catch {
      /* ignore */
    }
  }, [key, s]);
  const toggle = (k: string) =>
    setS((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  return [s, toggle] as const;
}

/* ---------- Helpers d'affichage ---------- */

// Catégories d'AFFICHAGE de la forge (les accessoires sont regroupés sous « Armures »)
const FORGE_CATS: Array<{ key: string; titre: string; intro: string; types: string[] }> = [
  { key: "arme", titre: "Armes", types: ["arme"], intro: "Classées par taille puis par portée. La taille se mesure de la garde ou de la base du pommeau." },
  { key: "armure", titre: "Armures", types: ["armure", "accessoire"], intro: "Le torse protège pour un nombre de combats donné, puis nécessite réparation. Les accessoires ajoutent +1 ailleurs." },
  { key: "bouclier", titre: "Boucliers", types: ["bouclier"], intro: "Tenus en main, du plus petit au plus grand." },
];

const ARME_ORDER = [
  "Arme courte", "Arme moyenne", "Arme longue", "Arme lourde", "Arme d'hast et bâton",
  "Arme de jet", "Arc / Arbalète", "Projectile",
];
const ARMURE_ORDER = ["Armure de cuir", "Armure de maille", "Armure de plaques"];
const ACCESSOIRE_ORDER = ["Casque", "Gorgerin", "Brassards", "Jambières", "Épaulettes", "Tassettes"];
const rangDansOrdre = (ordre: string[], nom: string | null) => {
  const i = ordre.indexOf(nom ?? "");
  return i === -1 ? 99 : i;
};
const rangObjet = (o: ObjetForge) => {
  if (o.type === "arme") return rangDansOrdre(ARME_ORDER, o.nom);
  if (o.type === "armure") return rangDansOrdre(ARMURE_ORDER, o.nom);
  if (o.type === "accessoire") return rangDansOrdre(ACCESSOIRE_ORDER, o.nom);
  return o.taille_max ?? 0; // bouclier : par taille
};

const tailleTexte = (o: ObjetForge): string | null => {
  if (o.pression_max != null) return `${o.pression_max} lb max`;
  if (o.taille_min != null && o.taille_max != null) return `${o.taille_min}–${o.taille_max} cm`;
  if (o.taille_max != null) return `≤${o.taille_max} cm`;
  return null;
};

const degatsTexte = (o: ObjetForge): string | null => {
  if (o.portee === "Munition") return "1 (peu importe la zone)";
  if (o.degats_membre != null && o.degats_torse != null)
    return `membre ${o.degats_membre} · torse ${o.degats_torse}`;
  return null;
};

const badgesObjet = (o: ObjetForge): string[] => {
  const b: string[] = [];
  if (o.prise) b.push(o.prise);
  if (o.emplacement) b.push(o.emplacement);
  if (o.portee === "Munition") b.push("Munition");
  return b;
};

// métas (label + valeur + note) ; notes spécifiques aux accessoires (PA conditionnel, effet conservé)
const metasObjet = (o: ObjetForge): MetaData[] => {
  const m: MetaData[] = [];
  const estAccessoire = o.type === "accessoire";
  if (o.exemples) m.push({ label: "Exemples", valeur: o.exemples });
  const t = tailleTexte(o);
  if (t) m.push({ label: o.pression_max != null ? "Pression" : "Taille", valeur: t });
  const d = degatsTexte(o);
  if (d) m.push({ label: "Dégâts", valeur: d });
  if (o.points_armure != null)
    m.push({
      label: "Points d'armure",
      valeur: estAccessoire ? `+${o.points_armure}` : String(o.points_armure),
      note: estAccessoire ? "Nécessite un torse d'armure ; perdu si le torse est détruit." : undefined,
    });
  if (o.combats != null) m.push({ label: "Durée", valeur: `${o.combats} combats` });
  if (o.effet)
    m.push({
      label: "Effet",
      valeur: o.effet,
      note: estAccessoire ? "Conservé même si le torse d'armure est détruit." : undefined,
    });
  return m;
};

// état de réparation d'un objet de forge
const etatReparation = (o: ObjetForge, reparations: Reparation[]): EtatReparation => {
  const r = o.reparation_id ? reparations.find((x) => x.id === o.reparation_id) : undefined;
  if (r) {
    if (r.materiaux_a_preciser) {
      return {
        etat: "paliers",
        matAttente: true,
        paliers: [
          { tier: "Métaux communs", niveau: 1, recette: "à préciser par l'équipe Animation", temps: r.temps_minutes, attente: true },
          { tier: "Métaux rares", niveau: 2, recette: "à préciser par l'équipe Animation", temps: r.temps_rare_minutes, attente: true },
        ],
      };
    }
    return {
      etat: "paliers",
      paliers: [
        { tier: "Métaux communs", niveau: 1, recette: r.materiaux, temps: r.temps_minutes },
        { tier: "Métaux rares", niveau: 2, recette: r.materiaux_rares, temps: r.temps_rare_minutes },
      ],
    };
  }
  // pas de réparation liée : fab_a_preciser → « à préciser » (jet, hast) ; sinon → non réparable (arc, accessoires)
  if (o.fab_a_preciser) return { etat: "tbd" };
  return { etat: "none" };
};

/* ---------- Sous-composants ---------- */

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-stone-600 bg-stone-800 rounded px-1.5 py-px whitespace-nowrap">
    {children}
  </span>
);

const Meta = ({ label, valeur, note }: MetaData) => (
  <div className="text-sm">
    <div className="flex gap-3 items-baseline">
      <span className="text-primary uppercase text-[11px] font-bold tracking-wide min-w-[120px] shrink-0">{label}</span>
      <span className="font-semibold text-foreground">{valeur}</span>
    </div>
    {note && <p className="text-[11.5px] text-muted-foreground italic mt-0.5">{note}</p>}
  </div>
);

const Palier = ({ tier, niveau, recette, temps, attente }: PalierData) => (
  <div className="flex gap-3 items-start rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
    <div className="shrink-0 mt-0.5 w-6 flex justify-center">
      {niveau === 2 ? <span className="text-lg leading-none">{"💎"}</span> : <Lingot s={20} />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
        <span className="font-bold text-sm text-foreground">{tier}</span>
        <span className="text-[11px] text-primary border border-primary/30 rounded px-1.5">Niveau {niveau}</span>
        {temps != null && (
          <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
            <Clock className="h-3 w-3" />{temps} min
          </span>
        )}
      </div>
      <div className={`text-[13px] ${attente ? "text-muted-foreground italic" : "text-foreground"}`}>{recette ?? "—"}</div>
    </div>
  </div>
);

const BlocLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-primary uppercase text-[11px] font-bold tracking-wide mb-1.5">{children}</p>
);

const ATraiter = ({ quoi }: { quoi: string }) => (
  <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-3.5 py-2.5 text-[13px] text-muted-foreground">
    {quoi} <span className="text-primary font-semibold">à préciser par l'équipe Animation</span>.
  </div>
);

const BlocPaliers = ({ paliers }: { paliers: PalierData[] }) => (
  <div className="grid gap-2">
    {paliers.map((p) => <Palier key={p.tier} {...p} />)}
  </div>
);

// Bloc Réparation (3 états)
const BlocReparation = ({ etat }: { etat: EtatReparation }) => {
  if (etat.etat === "tbd") {
    return (
      <div>
        <BlocLabel>Réparation</BlocLabel>
        <ATraiter quoi="Réparation" />
      </div>
    );
  }
  if (etat.etat === "none") {
    return (
      <div>
        <BlocLabel>Réparation</BlocLabel>
        <p className="text-[12.5px] text-muted-foreground">Cet objet ne se répare pas.</p>
      </div>
    );
  }
  return (
    <div>
      <BlocLabel>Réparation</BlocLabel>
      <BlocPaliers paliers={etat.paliers} />
      {etat.matAttente && (
        <p className="text-[11.5px] text-muted-foreground italic mt-1.5">
          Temps sourcés du manuel. Matériaux à confirmer : le manuel les exprime par point d'armure, que les boucliers n'ont pas.
        </p>
      )}
    </div>
  );
};

// Accordéon générique (aide + catégories)
const Accordeon = ({
  titre, count, open, onToggle, taille = "lg", children,
}: {
  titre: string; count?: number; open: boolean; onToggle: () => void;
  taille?: "lg" | "sm"; children: React.ReactNode;
}) => (
  <div className="mb-3">
    <button
      onClick={onToggle}
      className="w-full text-left bg-primary/5 border border-primary/20 rounded-lg px-3.5 py-2.5 flex items-center gap-2.5"
    >
      <span className={`font-heading font-bold text-primary flex-1 ${taille === "lg" ? "text-lg" : "text-[15px]"}`}>{titre}</span>
      {count != null && <span className="text-xs text-muted-foreground">{count}</span>}
      <ChevronRight className={`h-4 w-4 text-primary transition-transform ${open ? "rotate-90" : ""}`} />
    </button>
    {open && <div className="pt-2.5">{children}</div>}
  </div>
);

/* ---------- Carte d'objet (fabrication + réparation) ---------- */

const CarteObjet = ({
  id, nom, sousTitre, badges, metas, fabPaliers, fabTbd, reparation, isOpen, onToggle,
}: {
  id: string; nom: string | null; sousTitre?: string | null; badges: string[];
  metas: MetaData[]; fabPaliers: PalierData[]; fabTbd?: boolean;
  reparation?: EtatReparation | null; isOpen: boolean; onToggle: () => void;
}) => (
  <EncyclopedieCard
    id={id}
    isOpen={isOpen}
    onToggle={onToggle}
    maxHeight={1600}
    header={
      <>
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="font-heading text-base">{nom}</CardTitle>
          {badges.map((b) => <Badge key={b}>{b}</Badge>)}
        </div>
        {sousTitre && <p className="text-xs text-muted-foreground mt-0.5">{sousTitre}</p>}
      </>
    }
  >
    <div className="border-t border-primary/10 pt-3 mt-1 space-y-3.5">
      {metas.map((m) => <Meta key={m.label} {...m} />)}
      <div>
        <BlocLabel>Fabrication</BlocLabel>
        {fabTbd ? <ATraiter quoi="Fabrication" /> : <BlocPaliers paliers={fabPaliers} />}
      </div>
      {reparation && <BlocReparation etat={reparation} />}
    </div>
  </EncyclopedieCard>
);

/* ---------- Carte de procédé (Préparation des matériaux) ---------- */

const CarteProcede = ({
  id, nom, metas, description, isOpen, onToggle,
}: {
  id: string; nom: string; metas: MetaData[]; description: string; isOpen: boolean; onToggle: () => void;
}) => (
  <EncyclopedieCard
    id={id}
    isOpen={isOpen}
    onToggle={onToggle}
    maxHeight={800}
    header={<CardTitle className="font-heading text-base">{nom}</CardTitle>}
  >
    <div className="border-t border-primary/10 pt-3 mt-1 space-y-3.5">
      {metas.map((m) => <Meta key={m.label} {...m} />)}
      <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
    </div>
  </EncyclopedieCard>
);

const PROCEDES: Array<{ id: string; nom: string; metas: MetaData[]; description: string }> = [
  {
    id: "procede-lingot",
    nom: "Lingot",
    metas: [
      { label: "Temps", valeur: "15 min, joués en RP" },
      { label: "Coût", valeur: "10 pépites d'un même métal" },
      { label: "Résultat", valeur: "1 lingot" },
    ],
    description: "Une fois la fonte jouée, présentez-vous au camp de l'organisation pour recevoir le lingot du métal choisi. Sert à forger armes, armures et boucliers.",
  },
  {
    id: "procede-poudre",
    nom: "Poudre",
    metas: [
      { label: "Temps", valeur: "1 min" },
      { label: "Coût", valeur: "1 gemme ou 1 minerai commun" },
      { label: "Résultat", valeur: "Poudre fine" },
    ],
    description: "Réduit en poudre fine, ingrédient des préparations d'alchimie.",
  },
];

/* ---------- Contenu statique : aide + légende ---------- */

const Fort = ({ children }: { children: React.ReactNode }) => <span className="font-medium text-foreground">{children}</span>;

const AideForge = () => (
  <div className="rounded-md border border-primary/20 bg-primary/5 p-4 space-y-3.5">
    <div>
      <BlocLabel>Obtenir des pépites</BlocLabel>
      <p className="text-[13px] text-muted-foreground leading-relaxed">
        Les pépites sont le matériau de base. On les obtient via la compétence <Fort>Mineur</Fort> (pépites en début de GN), par <Fort>achat</Fort> à d'autres joueurs, ou auprès d'un PNJ.
      </p>
    </div>
    <div>
      <BlocLabel>Préparer ses matériaux</BlocLabel>
      <p className="text-[13px] text-muted-foreground leading-relaxed">
        Avant de forger, le métal se prépare : voir la catégorie <Fort>Préparation des matériaux</Fort> plus bas.
      </p>
    </div>
    <div>
      <BlocLabel>Niveaux de forge</BlocLabel>
      <p className="text-[13px] text-muted-foreground leading-relaxed">
        Le niveau de compétence détermine le métal travaillé : <Fort>Niveau 1</Fort> communs · <Fort>Niveau 2</Fort> + rares.
      </p>
    </div>
    <div>
      <BlocLabel>Même métal</BlocLabel>
      <p className="text-[13px] text-muted-foreground leading-relaxed">
        Le métal choisi à la fabrication détermine les propriétés de l'objet. Toute réparation doit réutiliser <Fort>ce même métal</Fort>.
      </p>
    </div>
  </div>
);

const LegendeRow = ({ sym, children }: { sym: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex items-start gap-2.5 text-[13px] mb-2">
    <span className="shrink-0 min-w-[62px] flex items-center gap-1.5 flex-wrap">{sym}</span>
    <span className="text-muted-foreground pt-px">{children}</span>
  </div>
);

const LegendeForge = () => (
  <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
    <LegendeRow sym={<Lingot s={20} />}><Fort>Lingot</Fort> — recette en <Fort>Métaux communs</Fort> (Niveau 1).</LegendeRow>
    <LegendeRow sym={<span className="text-lg">💎</span>}>Recette en <Fort>Métaux rares</Fort> (Niveau 2).</LegendeRow>
    <LegendeRow sym={<Clock className="h-4 w-4 text-muted-foreground" />}>Temps requis pour l'opération (fabrication ou réparation).</LegendeRow>
    <LegendeRow sym={<Badge>1 main</Badge>}>L'objet se manie à une main.</LegendeRow>
    <LegendeRow sym={<Badge>2 mains</Badge>}>L'objet se manie à deux mains.</LegendeRow>
    <LegendeRow sym={<Badge>À distance</Badge>}>Arme à distance (tir).</LegendeRow>
    <LegendeRow sym={<Badge>Munition</Badge>}>Projectile, consommable de tir.</LegendeRow>
    <LegendeRow sym={<Badge>Torse</Badge>}>Emplacement protégé (aussi : Tête, Cou, Épaules, Avant-bras, Hanches, Jambes).</LegendeRow>
  </div>
);

/* ============================================================ */

const ForgeJoaillerieSection = ({
  mode,
  forge = [],
  joaillerie = [],
  reparations = [],
  searchQuery = "",
}: {
  mode: "forge" | "joaillerie";
  forge?: ObjetForge[];
  joaillerie?: ObjetJoaillerie[];
  reparations?: Reparation[];
  searchQuery?: string;
  schemaForge?: unknown;
  schemaJoaillerie?: unknown;
  schemaReparation?: unknown;
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Aide : ouverte au 1er accès, repli mémorisé. Catégories : fermées par défaut, ouverture mémorisée.
  const [aideOuverte, setAideOuverte] = usePersistBool(`hv:${mode}:aide`, true);
  const [legendeOuverte, setLegendeOuverte] = usePersistBool(`hv:${mode}:legende`, true);
  const [catsOuvertes, toggleCat] = usePersistSet(`hv:${mode}:cats`);

  const q = searchQuery.trim().toLowerCase();

  useEffect(() => {
    if (!q) return;
    const matches: string[] = [];
    if (mode === "forge") {
      forge.forEach((o) => {
        if ((o.nom ?? "").toLowerCase().includes(q) || (o.exemples ?? "").toLowerCase().includes(q) || (o.description ?? "").toLowerCase().includes(q)) matches.push(o.id);
      });
    } else {
      joaillerie.forEach((o) => {
        if ((o.nom ?? "").toLowerCase().includes(q) || (o.description ?? "").toLowerCase().includes(q) || (o.effet ?? "").toLowerCase().includes(q)) matches.push(o.id);
      });
    }
    setExpanded(new Set(matches));
  }, [q, mode, forge, joaillerie]);

  const fForge = !q ? forge : forge.filter((o) => (o.nom ?? "").toLowerCase().includes(q) || (o.exemples ?? "").toLowerCase().includes(q) || (o.description ?? "").toLowerCase().includes(q));
  const fJoail = !q ? joaillerie : joaillerie.filter((o) => (o.nom ?? "").toLowerCase().includes(q) || (o.description ?? "").toLowerCase().includes(q) || (o.effet ?? "").toLowerCase().includes(q));

  const forgeByType: Record<string, ObjetForge[]> = {};
  fForge.forEach((o) => { (forgeByType[o.type ?? "autre"] ||= []).push(o); });

  if (mode === "joaillerie") {
    return (
      <div className="space-y-6">
        <h2 className="font-heading text-2xl font-bold text-primary mb-4">Joaillerie</h2>
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4 space-y-3.5">
          <div>
            <BlocLabel>Niveaux de joaillerie</BlocLabel>
            <p className="text-[13px] text-muted-foreground leading-relaxed">Le niveau de compétence détermine le métal travaillé : <Fort>Niveau 1</Fort> communs · <Fort>Niveau 2</Fort> + rares.</p>
          </div>
          <div>
            <BlocLabel>Usage</BlocLabel>
            <p className="text-[13px] text-muted-foreground leading-relaxed">La joaillerie crée des <Fort>supports d'enchantement ou de rituel</Fort>. Ces pièces ne se réparent pas.</p>
          </div>
        </div>
        {fJoail.length === 0 && q && <p className="text-muted-foreground text-center py-6">Aucun résultat.</p>}
        <div className="space-y-2">
          {fJoail.map((o) => {
            const tc = o.temps_fabrication_minutes;
            const tr = tc != null ? tc + JOAILLERIE_RARE_SURCOUT : null;
            return (
              <CarteObjet
                key={o.id}
                id={o.id}
                nom={o.nom}
                sousTitre={o.description}
                badges={[]}
                metas={o.effet ? [{ label: "Effet", valeur: o.effet }] : []}
                fabPaliers={[
                  { tier: "Métaux communs", niveau: 1, recette: o.materiaux_communs, temps: tc },
                  { tier: "Métaux rares", niveau: 2, recette: o.materiaux_rares, temps: tr },
                ]}
                reparation={null}
                isOpen={expanded.has(o.id)}
                onToggle={() => toggleExpanded(o.id)}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // ---- MODE FORGE (unifié) ----
  const fProc = !q ? PROCEDES : PROCEDES.filter((p) => p.nom.toLowerCase().includes(q));

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">Forge</h2>

      {!q && (
        <>
          <Accordeon titre="Comment fonctionne la Forge" taille="sm" open={aideOuverte} onToggle={() => setAideOuverte(!aideOuverte)}>
            <AideForge />
          </Accordeon>
          <Accordeon titre="Légende des symboles" taille="sm" open={legendeOuverte} onToggle={() => setLegendeOuverte(!legendeOuverte)}>
            <LegendeForge />
          </Accordeon>
        </>
      )}

      {fForge.length === 0 && fProc.length === 0 && q && <p className="text-muted-foreground text-center py-6">Aucun résultat.</p>}

      {FORGE_CATS.map((cat) => {
        const objets = cat.types
          .flatMap((t) => forgeByType[t] ?? [])
          .sort((a, b) => rangObjet(a) - rangObjet(b));
        if (objets.length === 0) return null;
        const open = !!q || catsOuvertes.has(cat.key);

        // sous-groupes : armes (Mêlée/Distance) · armures (Pièces de torse / Accessoires)
        let sousGroupes: Array<{ sousTitre?: string; items: ObjetForge[] }>;
        if (cat.key === "arme") {
          sousGroupes = [
            { sousTitre: "Mêlée", items: objets.filter((o) => o.portee === "Mêlée") },
            { sousTitre: "À distance", items: objets.filter((o) => o.portee !== "Mêlée") },
          ].filter((g) => g.items.length > 0);
        } else if (cat.key === "armure") {
          sousGroupes = [
            { sousTitre: "Pièces de torse", items: objets.filter((o) => o.type === "armure") },
            { sousTitre: "Accessoires d'armure", items: objets.filter((o) => o.type === "accessoire") },
          ].filter((g) => g.items.length > 0);
        } else {
          sousGroupes = [{ items: objets }];
        }

        return (
          <Accordeon key={cat.key} titre={cat.titre} count={objets.length} open={open} onToggle={() => toggleCat(cat.key)}>
            <p className="text-xs text-muted-foreground px-0.5 leading-relaxed mb-2">{cat.intro}</p>
            {sousGroupes.map((g, gi) => (
              <div key={gi} className="space-y-2 mb-2">
                {g.sousTitre && <p className="text-primary uppercase text-xs font-bold tracking-wide px-0.5">{g.sousTitre}</p>}
                {g.items.map((o) => (
                  <CarteObjet
                    key={o.id}
                    id={o.id}
                    nom={o.nom}
                    badges={badgesObjet(o)}
                    metas={metasObjet(o)}
                    fabTbd={!!o.fab_a_preciser}
                    fabPaliers={[
                      { tier: "Métaux communs", niveau: 1, recette: o.materiaux_communs, temps: o.temps_fabrication_minutes },
                      { tier: "Métaux rares", niveau: 2, recette: o.materiaux_rares, temps: o.temps_fabrication_minutes },
                    ]}
                    reparation={etatReparation(o, reparations)}
                    isOpen={expanded.has(o.id)}
                    onToggle={() => toggleExpanded(o.id)}
                  />
                ))}
              </div>
            ))}
          </Accordeon>
        );
      })}

      {fProc.length > 0 && (
        <Accordeon
          titre="Préparation des matériaux"
          count={fProc.length}
          open={!!q || catsOuvertes.has("prep")}
          onToggle={() => toggleCat("prep")}
        >
          <p className="text-xs text-muted-foreground px-0.5 leading-relaxed mb-2">Transformer les pépites en lingots, et réduire gemmes ou minerais en poudre.</p>
          <div className="space-y-2">
            {fProc.map((p) => (
              <CarteProcede
                key={p.id}
                id={p.id}
                nom={p.nom}
                metas={p.metas}
                description={p.description}
                isOpen={expanded.has(p.id)}
                onToggle={() => toggleExpanded(p.id)}
              />
            ))}
          </div>
        </Accordeon>
      )}
    </div>
  );
};

export default ForgeJoaillerieSection;
