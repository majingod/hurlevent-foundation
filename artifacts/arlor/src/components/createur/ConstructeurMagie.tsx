import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Lock } from "lucide-react";
import { COUT_ZONE, DUREES, PORTEES, ZONES_PAR_TYPE } from "@/constants/magie";
import {
  calculerCoutPS,
  calculerCoutXP,
  calculerDureeIncantation,
  filterDureesDisponibles,
  filterPorteesDisponibles,
  getNoteZone,
  isZoneUnique,
} from "@/utils/calculsMagie";

export interface ValeursConstructeur {
  zone: string;
  portee: string;
  duree: string;
  niveau: number;
  nom: string;
}

// Plancher des variables d'un sort/prière déjà acquis : utilisé par PR-B
// (éditeur « Modifier ») pour verrouiller les options en dessous de l'acquis.
// Comparaison par coût pts — miroir exact de la RPC modifier_sort.
export interface PlancherMagie {
  niveau: number;
  zone: string;
  portee: string;
  duree: string;
}

interface ConstructeurMagieProps {
  type: "sort" | "priere";
  zoneEffet: string; // sorts.zone_effet / prieres.zone_effet
  porteeMax: string; // sorts.portee / prieres.portee
  dureeMax: string; // sorts.duree / prieres.duree
  coutXpBase: number;
  niveauMax: number; // niveau_max du cercle/domaine
  valeurs: ValeursConstructeur;
  onChange: (v: ValeursConstructeur) => void;
  plancher?: PlancherMagie | null; // null/undefined = achat (aucun verrou)
}

const ptsZone = (zone: string) => COUT_ZONE[zone] ?? 0;
const ptsPortee = (portee: string) =>
  PORTEES.find((p) => p.label === portee)?.cout ?? 0;
const ptsDuree = (duree: string) =>
  DUREES.find((d) => d.label === duree)?.cout ?? 0;

interface PillOption {
  label: string;
  cout: number;
}

const RangeePills = ({
  label,
  options,
  selection,
  plancherPts,
  onSelect,
}: {
  label: string;
  options: PillOption[];
  selection: string;
  plancherPts: number | null;
  onSelect: (label: string) => void;
}) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {options.map((opt) => {
        const sousPlancher = plancherPts !== null && opt.cout < plancherPts;
        const selectionnee = selection === opt.label;
        return (
          <button
            key={opt.label}
            type="button"
            disabled={sousPlancher}
            title={sousPlancher ? "Acquis — plancher" : undefined}
            onClick={() => onSelect(opt.label)}
            className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors ${
              selectionnee
                ? "border-primary bg-primary font-semibold text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary/50"
            } ${sousPlancher ? "opacity-40" : ""}`}
          >
            {sousPlancher && <Lock className="h-3 w-3" />}
            {opt.label} · {opt.cout}pt
          </button>
        );
      })}
    </div>
  </div>
);

/**
 * Constructeur de sort/prière partagé (achat étapes 6-7, éditeur Modifier
 * PR-B) : pills zone/portée/durée, slider niveau, nom personnalisé et barre
 * de formule live. Composant contrôlé, purement présentation + calcul local
 * (aucun fetch).
 */
const ConstructeurMagie = ({
  type,
  zoneEffet,
  porteeMax,
  dureeMax,
  coutXpBase,
  niveauMax,
  valeurs,
  onChange,
  plancher,
}: ConstructeurMagieProps) => {
  const zoneUnique = isZoneUnique(zoneEffet);
  const noteZone = getNoteZone(zoneEffet);
  const zonesDisponibles = ZONES_PAR_TYPE[zoneEffet] ?? [];
  const porteesDispo = filterPorteesDisponibles(porteeMax);
  const dureesDispo = filterDureesDisponibles(dureeMax);

  const niveauMin = plancher?.niveau ?? 1;

  const complet = !!valeurs.zone && !!valeurs.portee && !!valeurs.duree;
  const ptsTotal = complet
    ? ptsZone(valeurs.zone) +
      ptsPortee(valeurs.portee) +
      ptsDuree(valeurs.duree) +
      valeurs.niveau
    : 0;
  const coutXp = complet
    ? calculerCoutXP(
        valeurs.zone,
        valeurs.portee,
        valeurs.duree,
        valeurs.niveau,
        coutXpBase,
      )
    : 0;
  const coutPS = coutXp > 0 ? calculerCoutPS(coutXp) : 0;

  return (
    <div className="space-y-4">
      {/* Zone */}
      {zoneUnique ? (
        <div className="space-y-2">
          <Label>Zone d'effet</Label>
          <p className="text-sm text-muted-foreground">
            {valeurs.zone} ({ptsZone(valeurs.zone)} pts) — imposée par{" "}
            {type === "sort" ? "le sort" : "la prière"}
          </p>
          {noteZone && (
            <p className="text-xs italic text-muted-foreground">{noteZone}</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <RangeePills
            label="Zone d'effet"
            options={zonesDisponibles.map((z) => ({
              label: z,
              cout: ptsZone(z),
            }))}
            selection={valeurs.zone}
            plancherPts={plancher ? ptsZone(plancher.zone) : null}
            onSelect={(zone) => onChange({ ...valeurs, zone })}
          />
          {noteZone && (
            <p className="text-xs italic text-muted-foreground">{noteZone}</p>
          )}
        </div>
      )}

      {/* Portée */}
      <RangeePills
        label="Portée"
        options={porteesDispo}
        selection={valeurs.portee}
        plancherPts={plancher ? ptsPortee(plancher.portee) : null}
        onSelect={(portee) => onChange({ ...valeurs, portee })}
      />

      {/* Durée */}
      <RangeePills
        label="Durée"
        options={dureesDispo}
        selection={valeurs.duree}
        plancherPts={plancher ? ptsDuree(plancher.duree) : null}
        onSelect={(duree) => onChange({ ...valeurs, duree })}
      />

      {/* Niveau */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Niveau : {valeurs.niveau}</Label>
          <span className="text-xs text-muted-foreground">
            {plancher && plancher.niveau > 1 && `min ${niveauMin} (acquis) · `}
            max {niveauMax}
          </span>
        </div>
        <Slider
          value={[valeurs.niveau]}
          onValueChange={(v) => onChange({ ...valeurs, niveau: v[0] })}
          min={niveauMin}
          max={Math.max(niveauMin, niveauMax)}
          step={1}
        />
      </div>

      {/* Nom personnalisé (toujours libre, jamais verrouillé) */}
      <div className="space-y-2">
        <Label>Nom personnalisé</Label>
        <Input
          value={valeurs.nom}
          onChange={(e) => onChange({ ...valeurs, nom: e.target.value })}
          placeholder={type === "sort" ? "Nom du sort" : "Nom de la prière"}
        />
      </div>

      {/* Barre de formule live */}
      <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Calcul du coût
        </p>
        <p>
          ( zone {valeurs.zone ? ptsZone(valeurs.zone) : "?"} + portée{" "}
          {valeurs.portee ? ptsPortee(valeurs.portee) : "?"} + durée{" "}
          {valeurs.duree ? ptsDuree(valeurs.duree) : "?"} + niv{" "}
          {valeurs.niveau} ) × {coutXpBase}{" "}
          {complet ? (
            <strong className="text-primary">= {coutXp} XP</strong>
          ) : (
            "= …"
          )}
        </p>
        {complet && (
          <p className="text-xs text-muted-foreground">
            {ptsTotal} pts au total · {coutPS} PS à l'incantation
          </p>
        )}
        {type === "priere" && complet && (
          <p className="text-xs text-muted-foreground">
            Incantation :{" "}
            {calculerDureeIncantation(
              valeurs.portee,
              valeurs.zone,
              valeurs.duree,
              valeurs.niveau,
            )}{" "}
            s
          </p>
        )}
      </div>
    </div>
  );
};

export default ConstructeurMagie;
