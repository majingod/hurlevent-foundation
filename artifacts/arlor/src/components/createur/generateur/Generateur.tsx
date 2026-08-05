import { useRef, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { GROUPES_OBJETS, objetsGenerateur } from "@/moteurCreation/exigences";
import {
  ErreurPontSnapshot,
  depsDepuisSnapshot,
} from "@/moteurCreation/generateur/pontSnapshot";
import {
  resoudreChoix,
  tirerPersonnage,
  type ChoixJoueur,
  type DepsResolveur,
  type ResultatTirage,
  type TiragePersonnage,
} from "@/moteurCreation/generateur/resoudre";
import type {
  ArtisanatTire,
  CompositionOk,
} from "@/moteurCreation/generateur/types";
import { tirerArtisanatNomme } from "@/moteurCreation/generateur/versBrouillon";
import { getSnapshot } from "@/moteurCreation/snapshot";

import AccueilPortes, { type PorteAffichee } from "./AccueilPortes";
import EcranBoussole from "./EcranBoussole";
import { PARCOURS_VIDE, type ParcoursBoussole } from "./boussole.logic";
import EcranInventaire, { CaseInventaire, TITRES_GROUPES } from "./EcranInventaire";
import EcranRace from "./EcranRace";
import FicheTirage from "./FicheTirage";
import { PORTES } from "./portes";

/**
 * [VIS-8] Conteneur du générateur : l'accueil des portes, les écrans de
 * constats de la phase 1 ET la fiche du tirage 🎲 (lot s364), DANS le
 * wizard partagé (visiteur hors ligne ET connecté — décision 3, s340).
 *
 * L'état des constats (équipement coché, race retenue) vit ICI, en
 * mémoire : pas dans le brouillon, qui ne contient que les choix du
 * personnage (invariant gardé par test structurel). C'est LE MÊME
 * inventaire qui alimente 🎲 (décision 31) : cocher côté 🧭 puis revenir
 * sur 🎲 en profite, sans aucun écran nouveau.
 *
 * Une porte n'est rendue que si elle est branchée — jamais de bouton mort
 * (décision 28, symétrie) :
 * - 🛠️ « Je bâtis moi-même » → `onBatirMoiMeme` (le wizard actuel) ;
 * - 🧭 « Guide-moi » → constats (équipement, race) puis l'ESCALIER
 *   (PR-β2) : voie → rôle → cercle/domaine → foi, `resoudreChoix`, et
 *   la MÊME fiche que 🎲 (décision 33) — « Ajuster » y revient sans
 *   rien perdre ;
 * - 🎲 « Surprends-moi » → tirage DIRECT depuis l'inventaire coché
 *   (contrat s346, décision 31), fiche par couches, re-roll. La porte
 *   n'apparaît que quand `onAppliquerTirage` est fourni : sans le
 *   « Continuer dans le créateur » (PR-B, `appliquerComposition`), la
 *   fiche serait un cul-de-sac.
 *
 * Le moteur est branché PARESSEUSEMENT au premier clic 🎲 : si le
 * snapshot ne porte pas la carte d'équipement (`objets_requis` — dette
 * [SNAPSHOT-COMMIT-STUB] sur le JSON committé), `ErreurPontSnapshot`
 * s'affiche en clair au lieu de tirer des races sans exigence de costume.
 */

/**
 * ⭐ [C2 s375-v2] Le résultat du résolveur AUGMENTÉ des items d'artisanat
 * NOMMÉS. C'est ICI que l'aléa du tirage vit (`Math.random`, `lancerTirage` /
 * `voirFiche`) et ici que le snapshot est en main — donc ici qu'on tire les
 * items UNE FOIS : la fiche les nomme, la conversion les consomme tels quels
 * (D34, tiré = affiché = acheté). Les tirer à la conversion nommerait sur la
 * fiche autre chose que ce que le joueur recevrait.
 */
type ResultatAffiche = ResultatTirage & { artisanatTire?: ArtisanatTire };

type EcranGenerateur =
  | "accueil"
  | "inventaire"
  | "race"
  | "boussole"
  | "tirage"
  | "ficheChoix";

/** Fil d'ariane de la phase 1 (constats 🧭) — la fiche 🎲 n'en fait pas partie. */
const FIL: readonly { id: EcranGenerateur; label: string }[] = [
  { id: "inventaire", label: "1. Équipement" },
  { id: "race", label: "2. Race" },
  { id: "boussole", label: "3. Grandes lignes" },
];

interface GenerateurProps {
  /** Adapte le sous-titre de l'accueil (validé Fred s348). */
  modeVisiteur: boolean;
  /** 🛠️ : referme l'accueil et rend la main au wizard actuel. */
  onBatirMoiMeme: () => void;
  /**
   * 🎲 (PR-B) : applique la composition tirée au personnage via le
   * guichet `ClientCreation` (décision 29). Tant qu'absent, la porte
   * n'est pas affichée et le bouton « Continuer » n'existe pas.
   */
  onAppliquerTirage?: (resultat: {
    tirage: TiragePersonnage;
    composition: CompositionOk;
    artisanatTire?: ArtisanatTire;
    /** [s376] 🎲 = 'de' · 🧭 = 'boussole' — pour la trace de génération. */
    mode: "de" | "boussole";
  }) => void;
}

const Generateur = ({
  modeVisiteur,
  onBatirMoiMeme,
  onAppliquerTirage,
}: GenerateurProps) => {
  const [ecran, setEcran] = useState<EcranGenerateur>("accueil");
  const [inventaire, setInventaire] = useState<ReadonlySet<string>>(new Set());
  const [raceRetenueId, setRaceRetenueId] = useState<string | null>(null);
  const [sacOuvert, setSacOuvert] = useState(false);
  const [resultat, setResultat] = useState<ResultatAffiche | null>(null);
  const [erreurPont, setErreurPont] = useState<string | null>(null);
  /** Refus parlant du dernier `resoudreChoix` — affiché dans l'escalier. */
  const [refusBoussole, setRefusBoussole] = useState<string | null>(null);
  /** [s368 #2] L'état de l'escalier 🧭 vit ICI : « ← Ajuster » démonte
   *  `EcranBoussole`, et le joueur doit retrouver ses réponses intactes
   *  (même maison que l'inventaire et la race — mesuré : l'écran les
   *  perdait toutes en revenant de la fiche). */
  const [parcours, setParcours] = useState<ParcoursBoussole>(PARCOURS_VIDE);

  /** Dépendances du résolveur — construites UNE fois, au premier besoin
   *  (🎲 comme escalier 🧭). Lève `ErreurPontSnapshot` si le snapshot ne
   *  porte pas la carte d'équipement ([SNAPSHOT-COMMIT-STUB]). */
  const depsRef = useRef<DepsResolveur | null>(null);
  const obtenirDeps = (): DepsResolveur =>
    (depsRef.current ??= depsDepuisSnapshot(getSnapshot()));

  /** [C2 s375-v2] Les items d'artisanat, tirés UNE FOIS sur le résultat qui
   *  vient d'être produit — même aléa de session, même instant. Une
   *  composition sans enveloppe ne pose rien (le champ reste absent, et la
   *  conversion garde son comportement v1). */
  const avecArtisanat = (res: ResultatTirage): ResultatAffiche =>
    res.ok && res.composition.artisanat.length > 0
      ? {
          ...res,
          artisanatTire: tirerArtisanatNomme(
            getSnapshot(),
            res.composition.artisanat,
            new Set<string>(),
            Math.random
          ),
        }
      : res;

  const lancerTirage = () => {
    try {
      setResultat(
        avecArtisanat(tirerPersonnage(obtenirDeps(), Math.random, inventaire))
      );
      setErreurPont(null);
    } catch (e) {
      setErreurPont(
        e instanceof ErreurPontSnapshot
          ? e.message
          : "Le générateur n'a pas pu démarrer. Réessaie, ou passe par « Je bâtis moi-même »."
      );
      setResultat(null);
    }
    setEcran("tirage");
  };

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

  /** [s368 #6] Nom de la race retenue pour le fil — `depsRef` est posé par
   *  `choisirRace` AVANT le set d'état, donc présent à ce rendu-ci. */
  const raceNomRetenu = raceRetenueId
    ? (depsRef.current?.monde.races.find((r) => r.id === raceRetenueId)?.nom ??
      null)
    : null;

  const choisirRace = (raceId: string) => {
    // [s368 #2] Changer de race invalide l'escalier (voies et rôles en
    // dépendent) — repartir à vide. Re-choisir la MÊME race ne perd rien.
    if (raceId !== raceRetenueId) setParcours(PARCOURS_VIDE);
    setRaceRetenueId(raceId);
    setRefusBoussole(null);
    try {
      obtenirDeps();
      setErreurPont(null);
    } catch (e) {
      setErreurPont(
        e instanceof ErreurPontSnapshot
          ? e.message
          : "Le générateur n'a pas pu démarrer. Réessaie, ou passe par « Je bâtis moi-même »."
      );
    }
    setEcran("boussole");
  };

  /** 🧭 → moteur : le refus parlant reste DANS l'escalier, jamais avalé. */
  const voirFiche = (choix: ChoixJoueur) => {
    const res = resoudreChoix(obtenirDeps(), choix);
    if (res.ok) {
      setResultat(avecArtisanat(res));
      setRefusBoussole(null);
      setEcran("ficheChoix");
    } else {
      setRefusBoussole(res.raison);
    }
  };

  const portes: PorteAffichee[] = PORTES.flatMap((p) => {
    if (p.id === "batir") return [{ ...p, onChoisir: onBatirMoiMeme }];
    if (p.id === "guide")
      return [{ ...p, onChoisir: () => setEcran("inventaire") }];
    // 🎲 : affichée seulement une fois « Continuer » branché (PR-B).
    return onAppliquerTirage ? [{ ...p, onChoisir: lancerTirage }] : [];
  });

  const surAccueil = ecran === "accueil";
  /** Les deux fiches (🎲 et 🧭) sortent du fil d'ariane. */
  const surTirage = ecran === "tirage" || ecran === "ficheChoix";
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
        {/* [s368 #6] Le fil porte les CHOIX FAITS (équipement compté, race
            nommée) — le joueur ne remonte plus vérifier ce qu'il a posé. */}
        {!surAccueil && (
          <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-2.5 px-4 pb-2 text-[11px] text-white/40">
            <button
              type="button"
              onClick={() =>
                setEcran(
                  ecran === "race"
                    ? "inventaire"
                    : ecran === "boussole"
                      ? "race"
                      : ecran === "ficheChoix"
                        ? "boussole"
                        : "accueil"
                )
              }
              className="rounded border border-white/15 px-2.5 py-0.5 text-xs text-white/80 hover:border-gold/40"
            >
              ← Retour
            </button>
            {!surTirage && (
              <>
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
                      {f.id === "inventaire" && inventaire.size > 0
                        ? `${f.label} (${inventaire.size})`
                        : f.id === "race" && raceNomRetenu
                          ? `2. ${raceNomRetenu}`
                          : f.label}
                      {i < FIL.length - 1 ? " ›" : ""}
                    </button>
                  );
                })}
              </>
            )}
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
      {ecran === "boussole" && (
        <>
          {erreurPont && (
            <div className="mx-auto max-w-2xl px-4 py-6">
              <div className="rounded-lg border border-white/10 border-l-2 border-l-bordeaux bg-white/5 px-3.5 py-3 text-sm text-white/80">
                ⚠️ {erreurPont}
              </div>
              <button
                type="button"
                onClick={() => setEcran("accueil")}
                className="mt-3 rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 transition-colors hover:border-gold/40"
              >
                ← Retour au menu
              </button>
            </div>
          )}
          {!erreurPont && raceRetenueId && (
            <EcranBoussole
              deps={obtenirDeps()}
              raceId={raceRetenueId}
              inventaire={inventaire}
              parcours={parcours}
              onParcours={setParcours}
              onVoirFiche={voirFiche}
              onSurprendsMoi={lancerTirage}
              refus={refusBoussole}
            />
          )}
        </>
      )}
      {ecran === "ficheChoix" && resultat?.ok && (
        <FicheTirage
          tirage={resultat.tirage}
          composition={resultat.composition}
          artisanatTire={resultat.artisanatTire}
          nbInventaire={inventaire.size}
          onAjuster={() => setEcran("boussole")}
          onContinuer={
            onAppliquerTirage
              ? () =>
                  onAppliquerTirage({
                    tirage: resultat.tirage,
                    composition: resultat.composition,
                    artisanatTire: resultat.artisanatTire,
                    mode: "boussole",
                  })
              : undefined
          }
        />
      )}
      {ecran === "tirage" && (
        <>
          {erreurPont && (
            <div className="mx-auto max-w-2xl px-4 py-6">
              <div className="rounded-lg border border-white/10 border-l-2 border-l-bordeaux bg-white/5 px-3.5 py-3 text-sm text-white/80">
                ⚠️ {erreurPont}
              </div>
              <button
                type="button"
                onClick={() => setEcran("accueil")}
                className="mt-3 rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 transition-colors hover:border-gold/40"
              >
                ← Retour au menu
              </button>
            </div>
          )}
          {!erreurPont && resultat && !resultat.ok && (
            <div className="mx-auto max-w-2xl px-4 py-6">
              <div className="rounded-lg border border-white/10 border-l-2 border-l-bordeaux bg-white/5 px-3.5 py-3 text-sm text-white/80">
                🎲 Ce tirage n'a pas abouti : {resultat.raison}
              </div>
              <button
                type="button"
                onClick={lancerTirage}
                className="mt-3 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/90 transition-colors hover:border-gold/40"
              >
                🎲 Relancer
              </button>
            </div>
          )}
          {!erreurPont && resultat?.ok && (
            <FicheTirage
              tirage={resultat.tirage}
              composition={resultat.composition}
              artisanatTire={resultat.artisanatTire}
              nbInventaire={inventaire.size}
              onRelancer={lancerTirage}
              onContinuer={
                onAppliquerTirage
                  ? () =>
                      onAppliquerTirage({
                        tirage: resultat.tirage,
                        composition: resultat.composition,
                        artisanatTire: resultat.artisanatTire,
                        mode: "de",
                      })
                  : undefined
              }
            />
          )}
        </>
      )}

      {/* 🎒 : LA seule vérité d'inventaire — ajouter/retirer ici met tout à
          jour, partout (décision 12). Sur la fiche 🎲, l'effet passe par
          « Relancer » : rien ne se recompose en silence. */}
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
