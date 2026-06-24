import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  lignerEpithetes,
  genererPhrase,
  grouperParNature,
  type SteleDetails,
} from "@/lib/cimetiereNarratif";

interface TraitRacial {
  id?: string;
  nom?: string;
  description?: string;
}

interface SteleSnapshot {
  race_nom?: string;
  race_nom_latin?: string | null;
  race_emoji?: string | null;
  classe_nom?: string | null;
  niveau?: number | null;
  pv_max?: number | null;
  ps_max?: number | null;
  xp_total?: number | null;
  historique?: string | null;
  ame_personnage?: string | null;
  traits_raciaux_choisis?: TraitRacial[] | null;
  gn_completes?: number | null;
  ouvertures_terrain?: number | null;
  details?: SteleDetails | null;
  [key: string]: unknown;
}

export interface SteleMemorialData {
  id: string;
  nom: string;
  race: string | null;
  classe: string | null;
  niveau: number | null;
  date_mort: string | null;
  epitaphe: string | null;
  joueur_nom: string | null;
  snapshot: SteleSnapshot | null;
}

const NATURE_EMOJI: Record<string, string> = {
  Combat: "⚔️",
  Magie: "✨",
  Foi: "🙏",
  Artisanat: "🔨",
  Savoirs: "📜",
};

function StatChip({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 py-2">
      <div className="text-lg font-bold text-primary">
        {value != null ? String(value) : "—"}
      </div>
      <div className="text-[0.66rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function SectionNature({
  nature,
  items,
}: {
  nature: string;
  items: { nom: string; niveau?: number | null; spe?: boolean }[];
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-t border-border pt-3 mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        <span>{NATURE_EMOJI[nature] ?? "•"}</span>
        <span className="font-heading text-sm uppercase tracking-wide text-primary">
          {nature}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <span
              key={`${it.nom}-${i}`}
              className={
                "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs " +
                (it.spe
                  ? "border-primary/50 bg-primary/10 text-primary font-medium"
                  : "border-border bg-muted text-foreground")
              }
            >
              {it.spe ? <span className="text-[0.6rem]">★</span> : null}
              {it.nom}
              {it.niveau != null ? ` · ${it.niveau}` : ""}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function SteleMemorial({
  stele,
  onClose,
}: {
  stele: SteleMemorialData | null;
  onClose: () => void;
}) {
  const open = stele !== null;
  const s: SteleSnapshot = stele?.snapshot ?? {};
  const details = (s.details ?? {}) as SteleDetails;
  const traits = Array.isArray(s.traits_raciaux_choisis)
    ? s.traits_raciaux_choisis
    : [];
  const epithetes = lignerEpithetes(details, 4);
  const phrase = genererPhrase(details, s.gn_completes ?? null);
  const sections = grouperParNature(details);
  const dateMort = stele?.date_mort
    ? new Date(stele.date_mort).toLocaleDateString("fr-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto bg-card border-primary/30">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-primary flex flex-col items-center gap-1">
            <span className="flex items-center gap-2">
              {s.race_emoji ? <span>{s.race_emoji}</span> : null}
              {stele?.nom}
            </span>
            {epithetes.length > 0 ? (
              <span className="text-xs font-normal italic text-muted-foreground">
                {epithetes.join("  ·  ")}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        {/* Épitaphe */}
        {stele?.epitaphe ? (
          <p className="text-center italic text-muted-foreground border-y border-primary/20 py-3 px-2 leading-relaxed">
            « {stele.epitaphe} »
          </p>
        ) : null}

        {/* Biographie auto (phrase template) */}
        {phrase ? (
          <p className="text-sm text-muted-foreground leading-relaxed bg-muted/50 border-l-2 border-primary/60 rounded-r-md px-3 py-2.5">
            {phrase}
          </p>
        ) : null}

        {/* Parcours */}
        {(s.gn_completes ?? 0) > 0 || (s.ouvertures_terrain ?? 0) > 0 ? (
          <div className="flex justify-center gap-6 py-1">
            {(s.gn_completes ?? 0) > 0 ? (
              <div className="text-center">
                <div className="font-heading text-xl text-primary">
                  {s.gn_completes}
                </div>
                <div className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                  Rassemblements vécus
                </div>
              </div>
            ) : null}
            {(s.ouvertures_terrain ?? 0) > 0 ? (
              <div className="text-center">
                <div className="font-heading text-xl text-primary">
                  {s.ouvertures_terrain}
                </div>
                <div className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                  Ouvertures de terrain
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Méta : race / classe / niveau */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          {s.race_nom ? (
            <span className="px-2.5 py-0.5 rounded-full bg-secondary/20 border border-secondary/40">
              {s.race_nom}
              {s.race_nom_latin ? ` · ${s.race_nom_latin}` : ""}
            </span>
          ) : null}
          {s.classe_nom ? (
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/30">
              {s.classe_nom}
            </span>
          ) : null}
          {s.niveau != null ? (
            <span className="px-2.5 py-0.5 rounded-full bg-muted border border-border">
              Niveau {s.niveau}
            </span>
          ) : null}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <StatChip label="PV" value={s.pv_max} />
          <StatChip label="PS" value={s.ps_max} />
          <StatChip label="XP" value={s.xp_total} />
        </div>

        {/* Son histoire */}
        {s.historique || s.ame_personnage ? (
          <section className="space-y-2 border-t border-border pt-3 mt-3">
            <h3 className="font-heading text-sm text-primary uppercase tracking-wide">
              Son histoire
            </h3>
            {s.historique ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {s.historique}
              </p>
            ) : null}
            {s.ame_personnage ? (
              <p className="text-sm text-muted-foreground/90 italic whitespace-pre-wrap leading-relaxed border-l-2 border-primary/30 pl-3">
                {s.ame_personnage}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Savoir-faire par nature */}
        {sections.map((sec) => (
          <SectionNature key={sec.nature} nature={sec.nature} items={sec.items} />
        ))}

        {/* Origines (traits raciaux) */}
        {traits.length > 0 ? (
          <section className="space-y-2 border-t border-border pt-3 mt-3">
            <h3 className="font-heading text-sm text-primary uppercase tracking-wide">
              Origines
            </h3>
            <ul className="space-y-1.5">
              {traits.map((t, i) => (
                <li key={t.id ?? i} className="text-sm">
                  <span className="text-foreground font-medium">{t.nom}</span>
                  {t.description ? (
                    <span className="text-muted-foreground"> — {t.description}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Crédit + date */}
        <footer className="text-center text-xs text-muted-foreground pt-2 border-t border-border space-y-0.5">
          {dateMort ? <p>Tombé·e le {dateMort}</p> : null}
          {stele?.joueur_nom ? (
            <p>
              Incarné·e par{" "}
              <span className="text-foreground">{stele.joueur_nom}</span>
            </p>
          ) : null}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
