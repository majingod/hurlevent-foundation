import { useMemo } from "react";

import {
  exigencesRaces,
  niveauEntree,
  objetsGenerateur,
  type ExigenceObjets,
  type VarianteObjets,
} from "@/moteurCreation/exigences";
import { getSnapshot } from "@/moteurCreation/snapshot";

import { ordonnerRaces, raceDemandeApprobation } from "./ordreRaces";

/**
 * [VIS-8 lot 1] Écran de constat « De quoi as-tu l'air ? » — ta race dépend
 * de ton costume (`objets_requis`, OU entre variantes, ET dedans).
 *
 * Décisions portées :
 * - GRISER, JAMAIS CACHER (décision 6) : une race hors de portée reste
 *   visible, 🔒, avec la phrase de la base (`libelleManque` — une seule
 *   maison) ;
 * - RATTRAPAGE SUR PLACE (décision 12) : « ✓ Je l'ai maintenant » coche la
 *   VRAIE case d'inventaire — tout ce qui en dépendait se dégrise, partout ;
 * - les races à approbation restent proposées, avec l'avertissement
 *   (décision Fred s340).
 *
 * Dégradation douce : sans les tables du lot 0 dans le snapshot, aucune race
 * n'est grisée (contrat du lecteur).
 */

type RaceSnapshot = ReturnType<typeof getSnapshot>["tables"]["races"][number];

/** Texte éditorial de la maquette validée s346 (n'existe pas en base). */
const NOTE_HUMAIN = "Seule race jouable sans costume — et 20 XP de plus.";

const variantesManquantes = (
  exigence: ExigenceObjets,
  inventaire: ReadonlySet<string>
): VarianteObjets[] =>
  exigence.variantes.filter((v) => !v.objets.every((o) => inventaire.has(o)));

interface EcranRaceProps {
  inventaire: ReadonlySet<string>;
  raceRetenueId: string | null;
  onChoisir: (raceId: string) => void;
  /** Rattrapage : coche ces cases dans l'inventaire (la seule vérité). */
  onCocherObjets: (ids: readonly string[]) => void;
}

const EcranRace = ({
  inventaire,
  raceRetenueId,
  onChoisir,
  onCocherObjets,
}: EcranRaceProps) => {
  const index = useMemo(() => exigencesRaces(), []);
  const libelles = useMemo(
    () => new Map(objetsGenerateur().map((o) => [o.id, o.libelle])),
    []
  );
  const races = useMemo(() => {
    // `nom` / `est_actif` sont nullables en base : le type-guard écarte les
    // lignes inaffichables et donne un `nom: string` au tri.
    const jouables = (getSnapshot().tables.races ?? []).filter(
      (r: RaceSnapshot): r is RaceSnapshot & { nom: string } =>
        !!r.est_jouable && !!r.est_actif && typeof r.nom === "string"
    );
    return ordonnerRaces(jouables, (r) => index.has(r.id));
  }, [index]);

  const libelleCourt = (id: string): string =>
    (libelles.get(id) ?? id).split(" (")[0];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h2 className="font-heading text-2xl text-gold">De quoi as-tu l'air ?</h2>
      <p className="mt-1 text-[13px] text-white/50">
        Ta race dépend de ton costume. Tout reste visible — ce qui te manque
        est écrit, et tu peux le régler ici même.
      </p>

      <div className="mt-4 grid gap-2.5">
        {races.map((r) => {
          const exigence = index.get(r.id);
          const ok = !exigence || niveauEntree(exigence, inventaire) !== null;
          const choisie = raceRetenueId === r.id;
          return (
            <div
              key={r.id}
              className={`rounded-xl border bg-card p-3.5 transition-opacity duration-500 ${
                choisie ? "border-gold" : "border-white/10"
              } ${ok ? "opacity-100" : "opacity-60"}`}
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-heading text-lg text-gold-accent">
                  {!ok && "🔒 "}
                  {r.emoji} {r.nom}
                </span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/50">
                  {r.xp_depart} XP de départ
                </span>
                {raceDemandeApprobation(r.nom) && (
                  <span className="rounded-full bg-bordeaux px-2 py-0.5 text-[11px] text-white">
                    approbation de l'organisation requise
                  </span>
                )}
                {choisie && (
                  <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-semibold text-black">
                    ✓ Choisie
                  </span>
                )}
              </div>

              {r.nom === "Humain" && (
                <div className="mt-1.5 text-xs text-white/50">{NOTE_HUMAIN}</div>
              )}

              {ok ? (
                <button
                  type="button"
                  onClick={() => onChoisir(r.id)}
                  className="mt-2.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gold-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-accent"
                >
                  Choisir →
                </button>
              ) : (
                <>
                  <div className="mt-1.5 text-[13px] text-white/80">
                    Il te faut {exigence?.libelleManque}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {variantesManquantes(exigence!, inventaire).map(
                      (v, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => onCocherObjets(v.objets)}
                          className="rounded-lg border border-gold-dark bg-white/5 px-2.5 py-1.5 text-[13px] text-gold-accent transition-colors hover:bg-gold/10"
                        >
                          ✓ {v.objets.length > 1 ? "Je les ai" : "Je l'ai"}{" "}
                          maintenant — {v.objets.map(libelleCourt).join(" + ")}
                        </button>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EcranRace;
