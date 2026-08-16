/**
 * [s406] LA FORGE DES NOMS — LA FENÊTRE.
 *
 * Port shadcn de la maquette s405 validée par Fred : pastilles de race,
 * groupe « Sonorité du nom » (Masculin / Féminin / Autre), toggle nom de
 * famille, sous-type Chiméride, huit plaques. Toucher une plaque = remonter
 * le nom au parent (qui remplit le champ) et fermer.
 *
 * Contrat Fred (s405, ⛔ ne pas rouvrir) :
 * - Personnage AVEC race : la Forge la SUIT (pastille unique, non cliquable),
 *   elle ne la change jamais. Chiméride lit `sous_type_chimeride` s'il existe.
 * - Personnage SANS race : la race choisie ici est remontée au parent comme
 *   PRÉSÉLECTION d'écran pour l'étape 2 — rien ne s'écrit, la validation de
 *   l'étape 2 reste souveraine.
 * - Rien ne s'écrit en base depuis cette fenêtre.
 */
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  NOMS_PAR_RACE,
  ORDRE_RACES_FORGE,
  type RaceForgeId,
  type SexeSonorite,
  type SousTypeChimeride,
} from "./noms";
import { TEXTES, forgerNoms } from "./logique";

interface ForgeNomsDialogProps {
  ouvert: boolean;
  onOuvertChange: (ouvert: boolean) => void;
  /** Race déjà posée sur le personnage : la Forge la suit, ne la change pas. */
  raceFigee?: RaceForgeId | null;
  /** Sous-type Chiméride déjà posé sur le personnage. */
  sousTypeFige?: SousTypeChimeride | null;
  /** Un nom touché : `raceNom` est le label (byte-exact avec races.nom). */
  onChoisir: (nom: string, raceNom: string) => void;
}

const ForgeNomsDialog = ({
  ouvert,
  onOuvertChange,
  raceFigee = null,
  sousTypeFige = null,
  onChoisir,
}: ForgeNomsDialogProps) => {
  const [raceId, setRaceId] = useState<RaceForgeId>(raceFigee ?? "humain");
  const [sexe, setSexe] = useState<SexeSonorite>("M");
  const [sousType, setSousType] = useState<SousTypeChimeride>(
    sousTypeFige ?? "carnivore",
  );
  const [avecFamille, setAvecFamille] = useState(true);
  const [noms, setNoms] = useState<string[]>([]);

  // Chaque ouverture repart de la forge froide, alignée sur le personnage.
  useEffect(() => {
    if (!ouvert) return;
    setRaceId(raceFigee ?? "humain");
    setSousType(sousTypeFige ?? "carnivore");
    setNoms([]);
  }, [ouvert, raceFigee, sousTypeFige]);

  const race = NOMS_PAR_RACE[raceId];
  const montrerSousType =
    raceId === "chimeride" && race.familles.type === "sousType" && !sousTypeFige;

  const forger = () =>
    setNoms(forgerNoms({ race, sexe, sousType, avecFamille }));

  const toucher = (nom: string) => {
    onChoisir(nom, race.label);
    onOuvertChange(false);
  };

  const boutonBascule = (actif: boolean) =>
    `rounded-lg border px-3 py-2 text-sm transition-colors ${
      actif
        ? "border-gold bg-gold/15 text-gold"
        : "border-white/15 bg-white/5 text-white/60"
    }`;

  return (
    <Dialog open={ouvert} onOpenChange={onOuvertChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-gold">
            {TEXTES.titre}
          </DialogTitle>
          <DialogDescription>{TEXTES.sousTitre}</DialogDescription>
        </DialogHeader>

        {/* La race : pastille unique si le personnage en a déjà une. */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">
            La race
          </p>
          {raceFigee ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-gold bg-gold/10 px-3.5 py-2 text-sm text-gold">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: race.hue }}
              />
              {race.label}
            </span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {ORDRE_RACES_FORGE.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRaceId(id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors ${
                    id === raceId
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-white/15 bg-white/5 text-white/70"
                  }`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: NOMS_PAR_RACE[id].hue }}
                  />
                  {NOMS_PAR_RACE[id].label}
                </button>
              ))}
            </div>
          )}
          <p className="rounded-r-lg border-l-2 border-gold bg-white/5 px-3 py-2 text-[13px] italic leading-relaxed text-white/60">
            <b className="not-italic text-white/90">{race.note.titre}</b> —{" "}
            {race.note.texte}
          </p>
        </div>

        {/* Sonorité du nom */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">
            {TEXTES.groupeSonorite}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5">
              {(
                [
                  ["M", TEXTES.masculin],
                  ["F", TEXTES.feminin],
                  ["A", TEXTES.autre],
                ] as const
              ).map(([valeur, libelle]) => (
                <button
                  key={valeur}
                  type="button"
                  onClick={() => setSexe(valeur)}
                  className={boutonBascule(sexe === valeur)}
                >
                  {libelle}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-white/60">
              <input
                type="checkbox"
                checked={avecFamille}
                onChange={(e) => setAvecFamille(e.target.checked)}
                className="h-4 w-4 accent-[#d4a94e]"
              />
              {TEXTES.nomDeFamille}
            </label>
          </div>
          {montrerSousType && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setSousType("carnivore")}
                className={boutonBascule(sousType === "carnivore")}
              >
                🥩 Carnivore
              </button>
              <button
                type="button"
                onClick={() => setSousType("herbivore")}
                className={boutonBascule(sousType === "herbivore")}
              >
                🌿 Herbivore
              </button>
            </div>
          )}
        </div>

        {/* Les huit plaques */}
        <div className="space-y-2">
          {noms.length === 0 ? (
            <p className="py-5 text-center text-sm italic text-white/50">
              {TEXTES.vide}
            </p>
          ) : (
            noms.map((nom) => (
              <button
                key={nom}
                type="button"
                onClick={() => toucher(nom)}
                className="flex w-full items-center justify-between rounded-lg border border-white/15 bg-white/5 px-3.5 py-3 text-left transition-colors hover:border-gold/60"
                style={{ borderLeft: `3px solid ${race.hue}` }}
              >
                <span className="font-heading text-lg text-white/90">
                  {nom}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-white/40">
                  choisir
                </span>
              </button>
            ))
          )}
        </div>

        <Button
          type="button"
          onClick={forger}
          className="w-full bg-gradient-to-b from-gold-accent to-gold font-heading text-base font-bold text-black hover:from-gold hover:to-gold"
        >
          {TEXTES.forger}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default ForgeNomsDialog;
