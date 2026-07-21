import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { GROUPES_OBJETS, objetsGenerateur } from "@/moteurCreation/exigences";

import AccueilPortes, { type PorteAffichee } from "./AccueilPortes";
import EcranInventaire, { CaseInventaire, TITRES_GROUPES } from "./EcranInventaire";
import EcranRace from "./EcranRace";
import { PORTES } from "./portes";

/**
 * [VIS-8 lot 1] Conteneur du générateur : l'accueil des portes et les écrans
 * de constats de la phase 1, DANS le wizard partagé (visiteur hors ligne ET
 * connecté — décision 3, s340).
 *
 * L'état des constats (équipement coché, race retenue) vit ICI, en mémoire :
 * pas dans le brouillon, qui ne contient que les choix du personnage
 * (invariant gardé par test structurel). Le résolveur (lot suivant) le
 * consommera directement.
 *
 * Une porte n'est rendue que si elle est branchée — jamais de bouton mort :
 * - 🛠️ « Je bâtis moi-même » → `onBatirMoiMeme` (le wizard actuel, inchangé) ;
 * - 🧭 « Guide-moi » → écrans de constats (ce lot) ; la suite (« On frappe à
 *   ta porte… ») s'y branchera au lot résolveur via `onConstatsTermines` ;
 * - 🎲 « Surprends-moi » → n'apparaît que quand `onTirage` sera fourni
 *   (lot 🎲) — tirage DIRECT, sans écran de constats (contrat s346,
 *   re-confirmé Fred s348).
 */

type EcranGenerateur = "accueil" | "inventaire" | "race";

/** Fil d'ariane de la phase 1 — s'étendra au lot résolveur. */
const FIL: readonly { id: EcranGenerateur; label: string }[] = [
  { id: "inventaire", label: "1. Équipement" },
  { id: "race", label: "2. Race" },
];

interface GenerateurProps {
  /** Adapte le sous-titre de l'accueil (validé Fred s348). */
  modeVisiteur: boolean;
  /** 🛠️ : referme l'accueil et rend la main au wizard actuel. */
  onBatirMoiMeme: () => void;
  /** 🎲 (lot 🎲) : tant qu'absent, la porte n'est pas affichée. */
  onTirage?: () => void;
  /**
   * Fin des constats (race retenue) — branché au lot résolveur.
   * Tant qu'absent, l'écran race retient le choix sans naviguer.
   */
  onConstatsTermines?: (constats: {
    inventaire: ReadonlySet<string>;
    raceId: string;
  }) => void;
}

const Generateur = ({
  modeVisiteur,
  onBatirMoiMeme,
  onTirage,
  onConstatsTermines,
}: GenerateurProps) => {
  const [ecran, setEcran] = useState<EcranGenerateur>("accueil");
  const [inventaire, setInventaire] = useState<ReadonlySet<string>>(new Set());
  const [raceRetenueId, setRaceRetenueId] = useState<string | null>(null);
  const [sacOuvert, setSacOuvert] = useState(false);

  const basculer = (id: string) =>
    setInventaire((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const cocherTous = (ids: readonly string[]) =>
    setInventaire((s) => {
      const n = new Set(s);
      ids.forEach((id) => n.add(id));
      return n;
    });

  const choisirRace = (raceId: string) => {
    setRaceRetenueId(raceId);
    onConstatsTermines?.({ inventaire, raceId });
  };

  const portes: PorteAffichee[] = PORTES.flatMap((p) => {
    if (p.id === "batir") return [{ ...p, onChoisir: onBatirMoiMeme }];
    if (p.id === "guide")
      return [{ ...p, onChoisir: () => setEcran("inventaire") }];
    // 🎲 : affichée seulement une fois le tirage branché (lot 🎲).
    return onTirage ? [{ ...p, onChoisir: onTirage }] : [];
  });

  const surAccueil = ecran === "accueil";
  const indexCourant = FIL.findIndex((f) => f.id === ecran);

  return (
    <>
      {/* En-tête du générateur : retour menu + 🎒 + fil d'ariane cliquable
          (décisions 12 et 13 — navigation libre, un seul inventaire). */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setEcran("accueil")}
            title="Retour au menu"
            className="flex items-baseline gap-2"
          >
            <span className="font-heading text-[17px] font-bold text-gold">
              HURLEVENT
            </span>
            <span className="text-xs text-white/40">· générateur</span>
          </button>
          <span className="flex-1" />
          {!surAccueil && (
            <button
              type="button"
              onClick={() => setSacOuvert(true)}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-[13px] text-white/80 transition-colors hover:border-gold/40"
            >
              🎒 Mon équipement{" "}
              <span className="ml-1 rounded-full bg-bordeaux px-2 py-0.5 text-[11px] text-white">
                {inventaire.size}
              </span>
            </button>
          )}
        </div>
        {!surAccueil && (
          <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2.5 px-4 pb-2 text-[11px] text-white/40">
            <button
              type="button"
              onClick={() =>
                setEcran(ecran === "race" ? "inventaire" : "accueil")
              }
              className="rounded border border-white/15 px-2.5 py-0.5 text-xs text-white/80 hover:border-gold/40"
            >
              ← Retour
            </button>
            {FIL.map((f, i) => {
              const visitable = i < indexCourant;
              const courant = f.id === ecran;
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={!visitable && !courant}
                  onClick={() => visitable && setEcran(f.id)}
                  className={
                    courant
                      ? "font-bold text-gold"
                      : visitable
                        ? "text-white/80 underline underline-offset-2"
                        : "text-white/40"
                  }
                >
                  {f.label}
                  {i < FIL.length - 1 ? " ›" : ""}
                </button>
              );
            })}
            <span className="opacity-60">› …</span>
          </div>
        )}
      </div>

      {ecran === "accueil" && (
        <AccueilPortes
          sousTitre={
            modeVisiteur
              ? "Aucun compte requis. Tout fonctionne sans réseau, ici, sur ton téléphone."
              : "Trois chemins, un même personnage. Tu pourras revenir ici à tout moment."
          }
          portes={portes}
        />
      )}
      {ecran === "inventaire" && (
        <EcranInventaire
          inventaire={inventaire}
          onBasculer={basculer}
          onContinuer={() => setEcran("race")}
          onRien={() => {
            setInventaire(new Set());
            setEcran("race");
          }}
        />
      )}
      {ecran === "race" && (
        <EcranRace
          inventaire={inventaire}
          raceRetenueId={raceRetenueId}
          onChoisir={choisirRace}
          onCocherObjets={cocherTous}
        />
      )}

      {/* 🎒 : LA seule vérité d'inventaire — ajouter/retirer ici met tout à
          jour, partout (décision 12). */}
      <Sheet open={sacOuvert} onOpenChange={setSacOuvert}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-heading text-gold">
              🎒 Mon équipement
            </SheetTitle>
            <SheetDescription className="text-xs">
              Ajouter ou retirer ici met tout à jour, partout. Si tu retires un
              objet dont ton personnage a besoin, on te le dira clairement —
              rien ne disparaît en silence.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-3 space-y-3 pb-2">
            {GROUPES_OBJETS.map((grp) => {
              const duGroupe = objetsGenerateur().filter(
                (o) => o.groupe === grp
              );
              if (duGroupe.length === 0) return null;
              return (
                <div key={grp}>
                  <div className="mb-1.5 text-[11px] uppercase tracking-widest text-white/40">
                    {TITRES_GROUPES[grp]}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {duGroupe.map((o) => (
                      <CaseInventaire
                        key={o.id}
                        id={o.id}
                        libelle={o.libelle}
                        cochee={inventaire.has(o.id)}
                        onBasculer={basculer}
                        taille="compacte"
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default Generateur;
