import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

export default function SteleMemorial({
  stele,
  onClose,
}: {
  stele: SteleMemorialData | null;
  onClose: () => void;
}) {
  const open = stele !== null;
  const s: SteleSnapshot = stele?.snapshot ?? {};
  const traits = Array.isArray(s.traits_raciaux_choisis)
    ? s.traits_raciaux_choisis
    : [];
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
          <DialogTitle className="font-heading text-2xl text-primary flex items-center gap-2">
            {s.race_emoji ? <span>{s.race_emoji}</span> : null}
            {stele?.nom}
          </DialogTitle>
        </DialogHeader>

        {/* Épitaphe */}
        {stele?.epitaphe ? (
          <p className="text-center italic text-muted-foreground border-y border-primary/20 py-3 px-2 leading-relaxed">
            « {stele.epitaphe} »
          </p>
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
          <section className="space-y-2">
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

        {/* Origines (traits raciaux) */}
        {traits.length > 0 ? (
          <section className="space-y-2">
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
