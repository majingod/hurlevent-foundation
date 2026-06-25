import { useEffect, useState } from "react";
import { ChevronRight, Clock } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import EncyclopedieCard from "@/components/encyclopedie/EncyclopedieCard";
import { CardTitle } from "@/components/ui/card";

// Icône lingot (commun, Niveau 1) — embarquée pour éviter un asset externe.
const LINGOT_SRC = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAOS0lEQVR42tVaaZBc1XX+7vZe9+zSjDS7kNACAROEjFPGjktKQRkcU85S6U4gOImDS1ksE4PZFz9NjLCQAQVjxoBcwTEyFWaKIhBEsJ1yMnaMhYhWRlNICIQWFKTRaNbufu9uJz9e98wANhJCgH2rprp7prrnO+d85zvLbeBDPrlcTgBAFEU8iiKO36RTAT/99PT0iHfzGfLDAE5ELJ/P897eXnf1rdHvh1U13+BA/0QycVM+n99fiURXV5c/3mexD8Prvb29DgCui75+swqzq4RUkFLCGj1orbnlG7dcv65MK9nV1eUA0K+FAWVAdvkNN9Q3VDesq6quzRmtHTEQB0hIqYIwRJKUno2LY9eu+drXdr7V6Lce8UGDv/rWW8+pr2vcUFPX8HvWaMM4E4JzzjjnYIwceZetql4kZPCXSy/6tEdS2vjMM8+4KIpkX18ffeARmM7n66N/zIc1desymao6o7UhQFYQMABgDIwxAHBCCJmtqkZSKmwqTIxfverGa5+bhpk+EANyPT2iN593AHDj7atX1TbMvJkxBuecfWv0GcrgGcBSQwhgLpPNKu+sT0qltQePHlp5/8qVhdRWRu+rCkVRJLvyebv8mmuaWtvmfK+hcdZnjTHWO8c5FwIgMJQBV3xZcSdjZTuYdNY4AuEj5y7+atOhpvOXLVt20bJly3wlCu9HDrBJvt8c/U5757wNTc0tH3fOGc6YlFIyKQWklBBSQPyS51IISCXBOAfnnC2YvwDee12M4/ntc+btuO2GawfKOeHlqeb7ypUriTFmb7njm1+Y0TS7u6a+LmONMUpJmRJlystv4v60R8YYrLPIZBTmn346ho4dYwf2HxDZ6mriSt4E4AkA/pTmQE9Pj8infOddd9931+y2tquFlOSs85wzPgWQpdingZ2yiYFzBq0Nautq0dnRgVf37sUbbxxGGARw3nkupBg5euTS6JqrNkRRJOWp4ns+n7df+tJ1bR1nLfh+a3vnhc55S+S5CBQvJyU4Y2CMs4oBfEp1AIAYYzDGoKOzAw319ejfuRNjY+PIZEI452CtI+YB5+kWABsAeHYK+C66urrsdbet+lTLae3rm1vb51ijDRFkKu0MnHNwxlKpL/+u4v1UedLX1jnqaG8DEWHb9u0wxkJKAescrDFIEg2TaM8YRHFi7MI7b7vpJ/KU8H3Vmr9r7ui8d0Zjo7LGWM6F5JxDcAEhKjWKg3MGxjgYn6IS4xzeO3DGsXBOBzsyeJT6+3eCCwGlFJx3cNZBawOjNbTWJLiANvZ6AD9h76WqnnXWWcGfXfm397WdNnd5EASeiEgIwYUQkEIwIWTqfcFRiUaF52AMgnNY55ANQ7S1NGPXy3vwyqt7EYQBgQjOexhjkMQJdJJAxwmMNjDWEsEDxi1jJwv+iyu+Ou/0Mxaub5tz2icYYBgghJRMSgklFRMilUUhBBhPacQ4A2d8Mh+MdZhZX4f6umps3roDhw8PIpMN4bwn7zyMTcHHcQwTJ9Baw1oD66znnHNnXd8JG0BErLe3l+fzeXfNbV0Xt7R3/svs1tZm8s5wLqSUEkopBCpgQkrIsq7zVMshOAcDm4yEdQ4tsxpB3uEXmzajWCwhzARw3oO8h9aakiRBXEqgkxg60TBGp5Ry1kkZSKOTiRPKgVwuJxhjDoC74fY7r5vd3HJn/cyZzBpjlVRSSolAKaggZFLJtBiVvS84h2BThlBZvOe0NePo0BCe37wNICDMhCBK23/rHHQlabWG1RbWWjjv4L2zQZBRSRwf0bH5c3milMnlcjVnnn/Bgy0dnZcLpZwnj0AqIaSAUoqpIIBSCjJIwUsuIXlqBBcCQnA4IoRKorWxAbtfeRXbd76EMAjAOQMRgQA4a6ETnXo80bDawFgD5y3IOxuGGVUqll4qjYz+4T8/cO8ueUJ8/8pXzm7rmLe+tb1jsScyjLyQImQiVQoWqCnwSkooISFF2h5MgveEuuoqzKzJ4oVtL2Lv/gOoymQABhABRB7WWmhtkOg0YSfBOwsib8NsVk2MFf776ODBfO/DDw9GUSTZ8VrgL98U5RtnNT3UOKu5nsgbKYUMggBKhQgChTAMU+8HKqWRkFBSQSg5SSFHHk31dZDw+J9NmzE0PIpsJoQnAkDw3kMbA51oxHGMpBSTThIYY2CMIYL3QRjIsdGx9T99eveVAwO9ujLkiLfzvUd0d6/wfX19dM1tX79jVnPLvdW1tRnvvBVSSKUklAqgpIIKAqYCBaXKnk8VCFIpKCnBhQAxoK1pJuLCBP7ruU0oFErIhAEIBDDAl6VSJwniWEMnSUodY+Gs8RBgQggxPjK66oG77vjykSM7PQDe3d3t39ZOp1bl3ZVXXdU8Y2bLw42zmz/DOLfeea6UEqmmi7RASVHuKisdZIU2qSFgDEJwtDc1YN+Bg3hhaz845wjCYDJZvSvrfJIgjpMK78kaA+uMY4JLZ60fGx9d/t21a9blenoEY8xXGjkA4NNp09vb6y6/8m8+2djU9ouZs2Z/xlpnyHvBeNoGCJFW15TX0364gBQCQqTgPQiZMEBHUwNeHNiFjZt3TCoTUTpMOeegTfIW8AkZY2CdtVIJaY0dGR0dufS7a9esi6JIlocjettIWeH8njeOnfnRj31sc1yKM8VSyWSrqqQoS2QQBgiCAGEYIghCFobl52FKpyBI/04AGhtqUZ8NsXHLdhw8dBjZTJiqDBE8CM45GK2RJAmSZJI2ZIyBs8bKQKlisbB3aHjkj9Z/e+32ipj8yqF+9uzZvLu728+Zv+CeqqqaJeece06SJImKSyWEYZgOHBWeKwWlFKsUrvQx1X4C0D5rJhQIfRtfwNFjIyn48j/zRLDOpuB1KpVJnMBqTUZrOO9skAnVxPj4xiOHBi959MFv7Xkn8JVuknd1dVHuiivmGgQ7i4VS2NwyG5++5GKWaIMjRwZRU1NdjkCIMAwRhiELg3AyKlIKSKWwoKMVY2Nj+Pnm7XA27SS9Tz3vnHsT+CROk9VoTcYaIu+cCkI1OjL8+GsvbvmLp59+uvhO65TpERD79u3zC85eHCkVfkoKYScmJsSul3ahvaMDnZ2dKBQKEFJABQGkUJBSManSCBCAbJjBmXPbceDQITy/rR+cMwgxHbydVJokSd4GnoFICClHRobuuX/17V/cvXu3iaJoUmmOt5ljl152WSOn8GXOeT3BkxCSERESrXHekiU497zFKBQLABiy2SzCIEAmk2HEGGY1zsCiOW3Y8dLL2L13HzJBkHLde3jvYa2DMRpa65TvWsMkhqzRMEZ7xpjw3mN8dOQfHrh79beiKOJdK1cSyluH4x0OgDiCLwSZTAORt4xzRkRgjKOqqgrbtm7Ff/7oRxCco6a2ZvKNsTbU0TyLFnS04rktO7DntbSyUtr4lSXSItEJ4rLSJHECHSdkdAxttBNCCGNMYXh4+I/L4GVXV9cJgwcAtnz58qo3xuJ+IYO5npxnjHHG+OTKQ0oJrTWy2Swu+OQnMG/+fHDOsWheJ2qzWfx8y3ZWKBYRKAXnHLwvq4ypJGoy2ZSZxJC1Gs5Zq1SgCsXigWPHhv7k+99eu+l4yforc6Bj0dl/LVXweeecZwDnleUSpuZVJSWc93ht717EcYKPnrcYtVVZ/PSFLbDGIFCKee9BPuW7nsb3eNLrGtbqcjcZqvHxsc3Hjhy8+JHv3D9wsuABQJzxkcWPE2O1IJpy/LTtQcUIzjmUUjiwfz+q62qhiaFULEIpCe89855gKiqTaMRJjDhOKG0LDKyzBO9dEIRqZHj4yR17Bj731COPDOZ6ekT3ihXuZEdbCfJOilBYrw0Dm2wtCATQtD1OuYIqJVEsFJEJA7ByL+OsI2Mt00YjiVPgSZLAJgbWGBhniBERl1IdGxq8r3vNHVdVCmhXefV4socnsb5Q69LPgkyoAFh40JuqNdGUYFH6slQsppXVE5zz0NYgSWKKSyUqlWKKS+kIaIyGsdozEPNE4tjg4HXda+64KooiTkTsRC4wjmvAD5987LVXdmy+KC4W1kmlFEuHC1+JQrnjnWwFOGMoFItThcnoMtdjlEoxkjhONd4YGGucEFwYY+LRkaH8g/esvquiNOxdKM07GhBFER8YGDD//tj65XFhYgVAXggpQN4xpJOSJ58aAwJjDHGxlKqKMYjjGHGpVAZfboWthnPGKillsVh8ffDo4IUP3fPN3mnJekrAA4AoXxqwXC4n/q33sefnLzzjZ2DsIhWEDd47ywA+mdBlRgVBgDlzT8PY6Fjq/fLKw6YDCLyzVoWhGh8d23L49f+75NF19/e/F6U5XisBABgYGKClS5fKH//HhlfntZ/eC8WXZDLZ+d57R57K2+40pYXg6Oicg/Hx8RR8ko5/1tq0pwlDNTI8vGHPtuc/9+Tjjx1+r0pzQgYAwL59+3wulxNPPfX46G/3b18fn/FbM1UYfhxgIJBnUzcQaGtvx8REAUkpLs+ulkCehJRyeOjod7rX3H7Fnj17kiiKePeKFR7v03nbSDkwMEBRFPHuvj7a1b/jmdMXnvm6lOJiKZXyjixjjBMIzS0tiEul1PvWeMbAPREfHh66/sG7Vt8SRRFftmzZKVGak71mZUuXLhV9fX320txlFwSZ7A+CTHaeM84QSC45fwmSUoJiqeSkFDKJ49Lw8PBfPXzf3T0ncj36vkXgrZRaunSp/PEzT+9vPa3jX6VQ52Sy2UXOWtcwYwY8ecsZU6VS8fVjg0c++73uf/rh+5WsJ2XA9LzY8MQT4y/t2PaDhWedXS2k+t36hgaezVaJkeGhrYcOH7zk0Yce6P+gwb+rG5rpu6I/+NPPX97a2XljmMns2PW/z/39s88+Ozb9RvLX+bBf9o2S39hvmaTAiX2YWP4fyAJnxnrTNPUAAAAASUVORK5CYII=";
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
  notes: string | null;
}

/* ---------- Helpers d'affichage ---------- */

const TYPE_LABEL: Record<string, string> = {
  arme: "Armes",
  armure: "Armures",
  accessoire: "Accessoires d'armure",
  bouclier: "Boucliers",
};
const TYPE_ORDER = ["arme", "armure", "accessoire", "bouclier"];
const TYPE_INTRO: Record<string, string> = {
  arme: "Classées par taille puis par portée. La taille se mesure de la garde ou de la base du pommeau.",
  armure: "Protègent le torse pour un nombre de combats donné, puis nécessitent réparation.",
  accessoire: "+1 point d'armure ailleurs sur le corps. Nécessitent le torse de l'armure équipé.",
  bouclier: "Tenus en main, du plus petit au plus grand.",
};

// ordres canoniques (longueur pour armes, protection pour armures, manuel pour accessoires)
const ARME_ORDER = [
  "Arme courte", "Arme moyenne", "Arme longue", "Arme lourde", "Arme d'hast",
  "Arme de jet", "Arc / Arbalète", "Projectile",
];
const ARMURE_ORDER = ["Armure de cuir", "Armure de maille", "Armure de plaques"];
const ACCESSOIRE_ORDER = ["Casque", "Gorgerin", "Brassards", "Jambières", "Épaulettes", "Tassettes"];
const rangDansOrdre = (ordre: string[], nom: string | null) => {
  const i = ordre.indexOf(nom ?? "");
  return i === -1 ? 99 : i;
};
const rangObjet = (type: string, o: ObjetForge) => {
  if (type === "arme") return rangDansOrdre(ARME_ORDER, o.nom);
  if (type === "armure") return rangDansOrdre(ARMURE_ORDER, o.nom);
  if (type === "accessoire") return rangDansOrdre(ACCESSOIRE_ORDER, o.nom);
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

// badges affichés (fermé) sur la carte
const badgesObjet = (o: ObjetForge): string[] => {
  const b: string[] = [];
  if (o.prise) b.push(o.prise);
  if (o.emplacement) b.push(o.emplacement);
  if (o.portee === "Munition") b.push("Munition");
  return b;
};

// métas (label petites capitales + valeur) selon le type
const metasObjet = (o: ObjetForge): Array<[string, string]> => {
  const m: Array<[string, string]> = [];
  if (o.exemples) m.push(["Exemples", o.exemples]);
  const t = tailleTexte(o);
  if (t) m.push([o.pression_max != null ? "Pression" : "Taille", t]);
  const d = degatsTexte(o);
  if (d) m.push(["Dégâts", d]);
  if (o.points_armure != null) m.push(["Points d'armure", o.type === "accessoire" ? `+${o.points_armure}` : String(o.points_armure)]);
  if (o.combats != null) m.push(["Durée", `${o.combats} combats`]);
  if (o.effet) m.push(["Effet", o.effet]);
  return m;
};

/* ---------- Sous-composants ---------- */

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-stone-600 bg-stone-800 rounded px-1.5 py-px whitespace-nowrap">
    {children}
  </span>
);

const Meta = ({ label, valeur }: { label: string; valeur: string }) => (
  <div className="flex gap-3 text-sm items-baseline">
    <span className="text-primary uppercase text-[11px] font-bold tracking-wide min-w-[110px] shrink-0">{label}</span>
    <span className="font-semibold text-foreground">{valeur}</span>
  </div>
);

const Palier = ({
  tier, niveau, recette, temps,
}: { tier: string; niveau: 1 | 2; recette: string | null; temps?: number | null }) => (
  <div className="flex gap-3 items-start rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
    <div className="shrink-0 mt-0.5 w-6 flex justify-center">
      {niveau === 2 ? <span className="text-lg leading-none">{"💎"}</span> : <Lingot s={20} />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="font-bold text-sm text-foreground">{tier}</span>
        <span className="text-[11px] text-primary border border-primary/30 rounded px-1.5">Niveau {niveau}</span>
        {temps != null && <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1"><Clock className="h-3 w-3" />{temps} min</span>}
      </div>
      <div className="text-[13px] text-foreground">{recette ?? "—"}</div>
    </div>
  </div>
);

const AnimationTBD = () => (
  <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-3.5 py-2.5 text-[13px] text-muted-foreground">
    Fabrication / réparation <span className="text-primary font-semibold">à préciser par l'équipe Animation</span>.
  </div>
);

// Accordéon de catégorie (niveau 1)
const CategorieAccordeon = ({
  titre, intro, count, open, onToggle, children,
}: { titre: string; intro?: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode }) => (
  <div className="mb-3">
    <button
      onClick={onToggle}
      className="w-full text-left bg-primary/5 border border-primary/20 rounded-lg px-3.5 py-2.5 flex items-center gap-2.5"
    >
      <span className="font-heading text-lg font-bold text-primary flex-1">{titre}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
      <ChevronRight className={`h-4 w-4 text-primary transition-transform ${open ? "rotate-90" : ""}`} />
    </button>
    {open && (
      <div className="pt-2.5 space-y-3">
        {intro && <p className="text-xs text-muted-foreground px-0.5 leading-relaxed">{intro}</p>}
        {children}
      </div>
    )}
  </div>
);

/* ---------- Carte d'objet ---------- */

const CarteObjet = ({
  id, nom, sousTitre, badges, temps, metas, paliers, tbd, isOpen, onToggle,
}: {
  id: string; nom: string | null; sousTitre?: string | null; badges: string[];
  temps?: number | null; metas: Array<[string, string]>;
  paliers: Array<{ tier: string; niveau: 1 | 2; recette: string | null; temps?: number | null }>;
  tbd?: boolean; isOpen: boolean; onToggle: () => void;
}) => (
  <EncyclopedieCard
    id={id}
    isOpen={isOpen}
    onToggle={onToggle}
    maxHeight={1200}
    header={
      <>
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="font-heading text-base">{nom}</CardTitle>
          {badges.map((b) => <Badge key={b}>{b}</Badge>)}
        </div>
        {sousTitre && <p className="text-xs text-muted-foreground mt-0.5">{sousTitre}</p>}
        {temps != null && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3" /> Temps de fabrication : {temps} min
          </p>
        )}
      </>
    }
  >
    <div className="border-t border-primary/10 pt-3 mt-1 space-y-3.5">
      {metas.map(([l, v]) => <Meta key={l} label={l} valeur={v} />)}
      <div>
        <p className="text-primary uppercase text-[11px] font-bold tracking-wide mb-1.5">Fabrication</p>
        {tbd ? <AnimationTBD /> : (
          <div className="grid gap-2">
            {paliers.map((p) => <Palier key={p.tier} {...p} />)}
          </div>
        )}
      </div>
    </div>
  </EncyclopedieCard>
);

/* ---------- Bloc d'intro harmonisé ---------- */

const IntroBox = ({ blocks }: { blocks: Array<{ label: string; body: React.ReactNode }> }) => (
  <div className="rounded-md border border-primary/20 bg-primary/5 p-4 space-y-3.5 backdrop-blur-sm">
    {blocks.map((b) => (
      <div key={b.label}>
        <p className="text-primary uppercase text-[11px] font-bold tracking-wide mb-1.5">{b.label}</p>
        <div className="text-[13px] text-muted-foreground leading-relaxed">{b.body}</div>
      </div>
    ))}
  </div>
);

const Fort = ({ children }: { children: React.ReactNode }) => <span className="font-medium text-foreground">{children}</span>;

const niveauxBlock = (verbe: string) => ({
  label: `Niveaux de ${verbe}`,
  body: <p>Le niveau de compétence détermine le métal travaillé : <Fort>Niveau 1</Fort> communs · <Fort>Niveau 2</Fort> + rares.</p>,
});
const memeMetalBlock = {
  label: "Même métal",
  body: <p>Le métal choisi à la fabrication détermine les propriétés de l'objet. Toute réparation devra réutiliser <Fort>ce même métal</Fort> : il est impossible de réparer un objet avec un métal différent.</p>,
};

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
  // schémas reçus du parent mais non utilisés (rendu custom) — gardés pour compat de signature
  schemaForge?: unknown;
  schemaJoaillerie?: unknown;
  schemaReparation?: unknown;
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const [forgeOnglet, setForgeOnglet] = useState<"fabrication" | "reparation">("fabrication");
  const [catFermees, setCatFermees] = useState<Set<string>>(new Set());
  const toggleCat = (k: string) =>
    setCatFermees((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const q = searchQuery.trim().toLowerCase();

  useEffect(() => {
    if (!q) return;
    const matches: string[] = [];
    if (mode === "forge") {
      forge.forEach((o) => {
        if ((o.nom ?? "").toLowerCase().includes(q) || (o.exemples ?? "").toLowerCase().includes(q) || (o.description ?? "").toLowerCase().includes(q)) matches.push(o.id);
      });
      reparations.forEach((r) => {
        if (r.nom_affichage.toLowerCase().includes(q) || (r.notes ?? "").toLowerCase().includes(q)) matches.push(r.id);
      });
    } else {
      joaillerie.forEach((o) => {
        if ((o.nom ?? "").toLowerCase().includes(q) || (o.description ?? "").toLowerCase().includes(q) || (o.effet ?? "").toLowerCase().includes(q)) matches.push(o.id);
      });
    }
    setExpanded(new Set(matches));
  }, [q, mode, forge, reparations, joaillerie]);

  const fForge = !q ? forge : forge.filter((o) => (o.nom ?? "").toLowerCase().includes(q) || (o.exemples ?? "").toLowerCase().includes(q) || (o.description ?? "").toLowerCase().includes(q));
  const fJoail = !q ? joaillerie : joaillerie.filter((o) => (o.nom ?? "").toLowerCase().includes(q) || (o.description ?? "").toLowerCase().includes(q) || (o.effet ?? "").toLowerCase().includes(q));
  const fReps = !q ? reparations : reparations.filter((r) => r.nom_affichage.toLowerCase().includes(q) || (r.notes ?? "").toLowerCase().includes(q));

  // groupe forge par type, ordre canonique
  const forgeByType: Record<string, ObjetForge[]> = {};
  fForge.forEach((o) => { (forgeByType[o.type ?? "autre"] ||= []).push(o); });
  const typeKeys = [...TYPE_ORDER.filter((k) => k in forgeByType), ...Object.keys(forgeByType).filter((k) => !TYPE_ORDER.includes(k))];

  const repByCat: Record<string, Reparation[]> = {};
  fReps.forEach((r) => { (repByCat[r.categorie] ||= []).push(r); });
  const repKeys = ["arme", "armure", "bouclier"].filter((k) => k in repByCat);

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold text-primary mb-4">{mode === "forge" ? "Forge" : "Joaillerie"}</h2>

      {mode === "forge" && (
        <div className="flex gap-2 mb-4 border-b border-stone-700 pb-3">
          {(["fabrication", "reparation"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setForgeOnglet(tab)}
              className={forgeOnglet === tab
                ? "px-4 py-1.5 rounded-md text-sm font-semibold bg-amber-700 text-white border border-amber-500"
                : "px-4 py-1.5 rounded-md text-sm font-medium bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-600"}
            >
              {tab === "fabrication" ? "Fabrication" : "Réparation"}
            </button>
          ))}
        </div>
      )}

      {/* FORGE — FABRICATION */}
      {mode === "forge" && forgeOnglet === "fabrication" && (
        <section className="space-y-4">
          <IntroBox blocks={[
            { label: "Procédés", body: (
              <div className="space-y-1.5">
                <p><Fort>Fonte —</Fort> 10 pépites d'un même métal donnent 1 lingot. Joué en RP (15 min), puis présentez-vous au camp pour recevoir le lingot.</p>
                <p><Fort>Poudre —</Fort> transformer une gemme ou un minerai commun en poudre prend 1 minute.</p>
              </div>
            ) },
            niveauxBlock("forge"),
            memeMetalBlock,
          ]} />

          {fForge.length === 0 && q && <p className="text-muted-foreground text-center py-6">Aucun résultat.</p>}

          {typeKeys.map((type) => {
            const objets = [...forgeByType[type]].sort((a, b) => rangObjet(type, a) - rangObjet(type, b));
            const open = !catFermees.has(`fab-${type}`);
            // sous-groupes mêlée/distance pour les armes
            const sousGroupes: Array<{ sousTitre?: string; items: ObjetForge[] }> =
              type === "arme"
                ? [
                    { sousTitre: "Mêlée", items: objets.filter((o) => o.portee === "Mêlée") },
                    { sousTitre: "À distance", items: objets.filter((o) => o.portee !== "Mêlée") },
                  ].filter((g) => g.items.length > 0)
                : [{ items: objets }];
            return (
              <CategorieAccordeon key={type} titre={TYPE_LABEL[type] ?? type} intro={TYPE_INTRO[type]} count={objets.length} open={open} onToggle={() => toggleCat(`fab-${type}`)}>
                {sousGroupes.map((g, gi) => (
                  <div key={gi} className="space-y-2">
                    {g.sousTitre && <p className="text-primary uppercase text-xs font-bold tracking-wide px-0.5">{g.sousTitre}</p>}
                    {g.items.map((o) => (
                      <CarteObjet
                        key={o.id}
                        id={o.id}
                        nom={o.nom}
                        badges={badgesObjet(o)}
                        temps={o.fab_a_preciser ? null : o.temps_fabrication_minutes}
                        metas={metasObjet(o)}
                        tbd={!!o.fab_a_preciser}
                        paliers={[
                          { tier: "Métaux communs", niveau: 1, recette: o.materiaux_communs },
                          { tier: "Métaux rares", niveau: 2, recette: o.materiaux_rares },
                        ]}
                        isOpen={expanded.has(o.id)}
                        onToggle={() => toggleExpanded(o.id)}
                      />
                    ))}
                  </div>
                ))}
              </CategorieAccordeon>
            );
          })}
        </section>
      )}

      {/* FORGE — RÉPARATION */}
      {mode === "forge" && forgeOnglet === "reparation" && (
        <section className="space-y-4">
          <IntroBox blocks={[niveauxBlock("forge"), memeMetalBlock]} />
          {fReps.length === 0 && q && <p className="text-muted-foreground text-center py-6">Aucun résultat.</p>}
          {repKeys.map((cat) => {
            const open = !catFermees.has(`rep-${cat}`);
            return (
              <CategorieAccordeon key={cat} titre={TYPE_LABEL[cat] ?? cat} count={repByCat[cat].length} open={open} onToggle={() => toggleCat(`rep-${cat}`)}>
                {repByCat[cat].map((r) => (
                  <CarteObjet
                    key={r.id}
                    id={r.id}
                    nom={r.nom_affichage}
                    badges={[]}
                    metas={[]}
                    paliers={[
                      { tier: "Métaux communs", niveau: 1, recette: r.materiaux, temps: r.temps_minutes },
                      { tier: "Métaux rares", niveau: 2, recette: r.materiaux_rares, temps: r.temps_rare_minutes },
                    ]}
                    isOpen={expanded.has(r.id)}
                    onToggle={() => toggleExpanded(r.id)}
                  />
                ))}
              </CategorieAccordeon>
            );
          })}
        </section>
      )}

      {/* JOAILLERIE */}
      {mode === "joaillerie" && (
        <section className="space-y-4">
          <IntroBox blocks={[
            niveauxBlock("joaillerie"),
            { label: "Usage", body: <p>La joaillerie crée des <Fort>supports d'enchantement ou de rituel</Fort>. Ces pièces ne se réparent pas.</p> },
          ]} />
          {fJoail.length === 0 && q && <p className="text-muted-foreground text-center py-6">Aucun résultat.</p>}
          <div className="space-y-2">
            {fJoail.map((o) => (
              <CarteObjet
                key={o.id}
                id={o.id}
                nom={o.nom}
                sousTitre={o.description}
                badges={[]}
                temps={o.temps_fabrication_minutes}
                metas={o.effet ? [["Effet", o.effet]] : []}
                paliers={[
                  { tier: "Matériaux communs", niveau: 1, recette: o.materiaux_communs },
                  { tier: "Matériaux rares", niveau: 2, recette: o.materiaux_rares },
                ]}
                isOpen={expanded.has(o.id)}
                onToggle={() => toggleExpanded(o.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ForgeJoaillerieSection;
