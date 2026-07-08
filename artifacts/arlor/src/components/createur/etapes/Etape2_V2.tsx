import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Info,
  Loader2,
} from "lucide-react";

import { clientActif } from "@/creation/clientActif";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import JaugeXP from "@/components/createur/aide/JaugeXP";
import IntroEtape, { IntroEtapeItem } from "@/components/createur/aide/IntroEtape";
import BasculeAbregeIntegral from "@/components/shared/BasculeAbregeIntegral";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { useModeAffichage } from "@/contexts/ModeAffichageContext";
import type { EtapeProps } from "@/pages/PersonnageNouveauV2";
import { xpDisponibleJaugeEtape2 } from "./Etape2_V2.calc";

const CHIMERIDE_ID = "926b6948-e192-4d41-9909-efabaa3059b5";
const NON_RACES_ID = "4d7e2226-76cb-4b94-9df4-b8f12ff486e1";

/**
 * WIZARD-REFONTE-UX (PR2) — Étape UI 2 « Race + Traits » = fusion des étapes
 * DB 2 (race) et DB 3 (traits raciaux). DB inchangée : le « Suivant » appelle
 * sauvegarder_etape_2 PUIS sauvegarder_etape_3 (avance etape_creation 2→3→4).
 *
 * Gabarit visuel : maquette WizardRefonteV6 (s213) — accordéon par race
 * (pattern Set manuel, gotcha s152 : pas de Radix Accordion à enfants
 * interactifs), traits intégrés dans la carte race ouverte, grisés tant que la
 * race n'est pas cochée.
 *
 * Logique des traits : portée verbatim d'Etape3_V2 (Sets gratuits/achetés +
 * promotion FIFO, quota = race.nb_traits_raciaux), MAIS branchée sur la race
 * SÉLECTIONNÉE LOCALEMENT (et non plus la race persistée). Reset au changement
 * de race / sous-type.
 */

interface Etape2Props extends EtapeProps {
  xpDisponible?: number;
}

interface Race {
  id: string;
  nom: string;
  nom_latin: string | null;
  description: string | null;
  resume_condense: string | null;
  xp_depart: number | null;
  emoji: string | null;
  esperance_vie: string | null;
  exigences_costume: string | null;
  restrictions_classes: string[] | null;
  nb_traits_raciaux: number | null;
  est_jouable: boolean;
}

interface TraitChoisi {
  trait_id: string;
  est_gratuit: boolean;
  xp_depense: number;
}

interface TraitDispo {
  id: string;
  nom: string;
  description: string;
  texte_manuel: string | null;
  resume_condense: string | null;
  cout_xp: number;
}

const Etape2_V2 = ({
  personnageId,
  onSuccess,
  onPrevious,
  onXpDeltaChange,
  onXpGainChange,
  xpDisponible = 0,
}: Etape2Props) => {
  const [submitting, setSubmitting] = useState(false);
  const { mode, toggleMode } = useModeAffichage();

  // Sélection (state simple — pas de react-hook-form : on doit réinitialiser
  // les traits au changement de race, ce qui est plus limpide en useState).
  const [raceId, setRaceId] = useState<string | null>(null);
  const [sousType, setSousType] = useState<"carnivore" | "herbivore" | null>(
    null,
  );

  // Pattern Set manuel (gotcha s152) — accordéon « Plus de détails » par race
  // (MONO-ouverture), traits cochés (gratuits / achetés). Le verbatim manuel
  // (race + trait) est piloté par le switch global Abrégé⇄Intégral.
  const [racesOuvertes, setRacesOuvertes] = useState<Set<string>>(new Set());
  const [gratuits, setGratuits] = useState<Set<string>>(new Set());
  const [achetes, setAchetes] = useState<Set<string>>(new Set());

  // Init unique depuis le serveur (reprise etape_creation=2 ou 3).
  const initFait = useRef(false);

  // PR4 persist-au-choix : timer de debounce pour l'autosave brouillon.
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const estChimeride = raceId === CHIMERIDE_ID;
  const estNonRace = raceId === NON_RACES_ID;
  const necessiteJustification = estChimeride || estNonRace;

  // -- Données -------------------------------------------------------------
  const { data: races = [], isLoading: racesLoading, isError: racesError, refetch: refetchRaces } = useQuery({
    queryKey: ["v2-races"],
    queryFn: async () => {
      const { data, error } = await clientActif.lireRaces();
      if (error) throw error;
      return (data ?? []) as Race[];
    },
  });

  const { data: parametres } = useQuery({
    queryKey: ["v2-parametres-jeu"],
    queryFn: async () => {
      const { data, error } = await clientActif.lireParametresJeu();
      if (error) throw error;
      return data ?? null;
    },
  });

  // État persisté du personnage (race + sous-type + traits + xp_total).
  const { data: perso } = useQuery({
    queryKey: ["v2-perso-race-traits", personnageId],
    queryFn: async () => {
      const { data, error } = await clientActif.lirePersonnageRace(personnageId);
      if (error) throw error;
      return data;
    },
    // PR4 fix : pas de cache entre deux visites de l'etape. Sinon, au retour via
    // navigation SPA, l'init one-shot (initFait) fige la valeur perimee du cache
    // et ignore le refetch frais → la race / les traits persistes n'apparaissent
    // qu'apres un vrai reload. gcTime:0 jette le cache a la sortie => fetch frais.
    gcTime: 0,
  });

  // Traits filtrés par la race SÉLECTIONNÉE (locale) + sous-type — vue dédiée.
  const {
    data: traits = [],
    isLoading: traitsLoading,
  } = useQuery<TraitDispo[]>({
    queryKey: ["v2-traits-par-race", raceId, sousType],
    enabled: !!raceId,
    queryFn: async () => {
      const { data, error } = await clientActif.lireTraitsParRace(
        raceId!,
        sousType,
      );
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        id: t.trait_id as string,
        nom: t.trait_nom as string,
        description: t.trait_description as string,
        texte_manuel: (t.trait_texte_manuel as string | null) ?? null,
        resume_condense: (t.trait_resume_condense as string | null) ?? null,
        cout_xp: t.cout_xp as number,
      })) as TraitDispo[];
    },
  });

  const raceSelectionnee = races.find((r) => r.id === raceId) ?? null;
  const quotaGratuits = raceSelectionnee?.nb_traits_raciaux ?? 0;
  const gratuitChoixComplet = gratuits.size >= quotaGratuits;
  // Traits actifs uniquement si la race est cochée (et, pour Chiméride, le
  // sous-type choisi) — gating race→traits de la maquette.
  const traitsActifs = !!raceId && (!estChimeride || !!sousType);

  // -- Initialisation depuis le serveur (une seule fois) -------------------
  useEffect(() => {
    if (initFait.current) return;
    if (!perso) return;
    const rid = (perso.race_id as string | null) ?? null;
    setRaceId(rid);
    setSousType(
      (perso.sous_type_chimeride as "carnivore" | "herbivore" | null) ?? null,
    );
    const choisis = (perso.traits_raciaux_choisis as TraitChoisi[] | null) ?? [];
    const g = new Set<string>();
    const a = new Set<string>();
    choisis.forEach((c) => {
      if (c.est_gratuit) g.add(c.trait_id);
      else a.add(c.trait_id);
    });
    setGratuits(g);
    setAchetes(a);
    if (rid) setRacesOuvertes(new Set([rid])); // ouvrir la carte de la race reprise
    initFait.current = true;
  }, [perso]);

  // XP des traits DÉJÀ persistés (déjà comptés dans xp_depense serveur). Le
  // delta remonté ne doit représenter QUE le changement non sauvegardé, sinon
  // double-comptage à la ré-entrée sur l'étape (gotcha s195).
  const xpTraitsPersistes = useMemo(() => {
    const choisis =
      (perso?.traits_raciaux_choisis as TraitChoisi[] | null) ?? [];
    return choisis.reduce(
      (s, c) => s + (c.est_gratuit ? 0 : c.xp_depense ?? 0),
      0,
    );
  }, [perso]);

  const xpTraits = useMemo(() => {
    let total = 0;
    achetes.forEach((id) => {
      const t = traits.find((x) => x.id === id);
      if (t) total += t.cout_xp;
    });
    return total;
  }, [achetes, traits]);

  // Projection de l'XP de départ de la race AVANT sauvegarde (maquette : la
  // jauge montre xp_depart dès la sélection). On ne projette QUE si l'XP serveur
  // n'a pas déjà dépassé ce départ (création) — en édition admin d'un perso
  // ayant accumulé de l'XP de jeu, xp_total serveur fait foi (gain = 0).
  const xpTotalServeur = (perso?.xp_total as number | null) ?? 0;
  const xpDepartCible = raceSelectionnee?.xp_depart ?? 0;
  const gainProjete =
    xpDepartCible > xpTotalServeur ? xpDepartCible - xpTotalServeur : 0;

  useEffect(() => {
    onXpGainChange?.(gainProjete);
    return () => onXpGainChange?.(0);
  }, [gainProjete, onXpGainChange]);

  useEffect(() => {
    onXpDeltaChange?.(xpTraits - xpTraitsPersistes);
    return () => onXpDeltaChange?.(0);
  }, [xpTraits, xpTraitsPersistes, onXpDeltaChange]);

  // -- Sélection de race ---------------------------------------------------
  const pickRace = (id: string) => {
    if (id === raceId) {
      // Décocher la race : tout réinitialiser.
      setRaceId(null);
      setSousType(null);
      setGratuits(new Set());
      setAchetes(new Set());
      return;
    }
    setRaceId(id);
    setSousType(null);
    setGratuits(new Set());
    setAchetes(new Set());
    setRacesOuvertes(new Set([id])); // ouvrir la carte choisie (mono-ouverture)
  };

  const choisirSousType = (st: "carnivore" | "herbivore") => {
    setSousType(st);
    // Le set de traits dépend du sous-type → on repart à zéro.
    setGratuits(new Set());
    setAchetes(new Set());
  };

  // Mono-ouverture : ouvrir une race ferme les autres (au plus 1 texte intégral
  // affiché à la fois).
  const toggleAccordeon = (id: string) =>
    setRacesOuvertes((prev) => (prev.has(id) ? new Set() : new Set([id])));

  // -- Logique traits (portée d'Etape3_V2 : Sets + promotion FIFO) ---------
  const toggleGratuit = (id: string) => {
    if (gratuits.has(id)) {
      // Décocher un gratuit : promotion FIFO du premier payant (miroir du
      // recalcul serveur dans sauvegarder_etape_3).
      const premierPayant =
        achetes.size > 0 ? (achetes.values().next().value as string) : null;
      setGratuits((prev) => {
        const next = new Set(prev);
        next.delete(id);
        if (premierPayant) next.add(premierPayant);
        return next;
      });
      if (premierPayant) {
        setAchetes((prev) => {
          const next = new Set(prev);
          next.delete(premierPayant);
          return next;
        });
      }
      return;
    }
    if (gratuits.size >= quotaGratuits) {
      toast.error(`Tu ne peux choisir que ${quotaGratuits} trait(s) gratuit(s).`);
      return;
    }
    setGratuits((prev) => new Set(prev).add(id));
    if (achetes.has(id)) {
      setAchetes((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleAchete = (id: string) => {
    if (gratuits.has(id)) {
      toast.error("Ce trait est déjà sélectionné comme gratuit.");
      return;
    }
    setAchetes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Checkbox UNIQUE par trait : les `quotaGratuits` premiers cochés sont
  // gratuits, les suivants coûtent leur cout_xp. Aiguilleur sans changer le
  // calcul ni le payload.
  const toggleTrait = (id: string) => {
    if (!traitsActifs) return;
    if (gratuits.has(id)) {
      toggleGratuit(id);
      return;
    }
    if (achetes.has(id)) {
      toggleAchete(id);
      return;
    }
    if (gratuits.size < quotaGratuits) toggleGratuit(id);
    else toggleAchete(id);
  };

  // -- Validité « Suivant » ------------------------------------------------
  const isValid = useMemo(() => {
    if (!raceId) return false;
    if (estChimeride && !sousType) return false;
    if (gratuits.size < quotaGratuits) return false;
    return true;
  }, [raceId, estChimeride, sousType, gratuits.size, quotaGratuits]);

  // -- PR4 persist-au-choix : autosave brouillon (race + traits) ----------
  // Persiste l'etat AU CLIC (p_brouillon=true) sans valider, avancer ni logger
  // (contrat e2/e3). Debounce 900 ms (gabarit Etape1). Fire-and-forget.
  const sauvegarderBrouillon = useCallback(() => {
    if (!initFait.current) return;
    if (!raceId) return; // rien a persister tant qu'aucune race n'est choisie
    const sousTypePayload = estChimeride ? sousType : null;
    clientActif
      .sauvegarderEtape2({
        p_personnage_id: personnageId,
        p_race_id: raceId,
        p_sous_type_chimeride: sousTypePayload as unknown as string,
        p_brouillon: true,
      })
      .then(() => {
        // Traits seulement apres succes e2 (le perso a desormais sa race).
        const payloadTraits: TraitChoisi[] = [
          ...Array.from(gratuits).map((id) => ({
            trait_id: id,
            est_gratuit: true,
            xp_depense: 0,
          })),
          ...Array.from(achetes).map((id) => {
            const t = traits.find((x) => x.id === id);
            return {
              trait_id: id,
              est_gratuit: false,
              xp_depense: t?.cout_xp ?? 0,
            };
          }),
        ];
        clientActif
          .sauvegarderEtape3({
            p_personnage_id: personnageId,
            p_traits_raciaux_choisis: payloadTraits as unknown as never,
            p_brouillon: true,
          })
          .then(
            () => {},
            () => {},
          );
      }, () => {});
  }, [raceId, sousType, estChimeride, gratuits, achetes, traits, personnageId]);

  useEffect(() => {
    if (!initFait.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      sauvegarderBrouillon();
      autosaveTimer.current = null;
    }, 900);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [raceId, sousType, gratuits, achetes, sauvegarderBrouillon]);

  // Ref toujours à jour vers le dernier brouillon : la cleanup ci-dessous
  // dispatche ainsi les VALEURS FRAÎCHES (closure non périmée).
  const flushRef = useRef(sauvegarderBrouillon);
  useEffect(() => {
    flushRef.current = sauvegarderBrouillon;
  }, [sauvegarderBrouillon]);

  // Si un autosave est EN ATTENTE quand le joueur quitte l'étape (démontage SPA)
  // ou met l'onglet en arrière-plan / le ferme (mobile), on dispatche le save
  // tout de suite au lieu de l'annuler. Best-effort (fire-and-forget).
  useEffect(() => {
    const flushSiEnAttente = () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
        flushRef.current();
      }
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushSiEnAttente();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flushSiEnAttente);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flushSiEnAttente);
      flushSiEnAttente();
    };
  }, []);

  // -- Soumission : sauvegarder_etape_2 PUIS sauvegarder_etape_3 -----------
  const onSubmit = async () => {
    // Annule un autosave brouillon en attente : le « Suivant » fait foi.
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    if (!raceId) {
      toast.error("Choisis une race.");
      return;
    }
    if (estChimeride && !sousType) {
      toast.error("Choisis le sous-type Chiméride (carnivore ou herbivore).");
      return;
    }
    if (gratuits.size < quotaGratuits) {
      toast.error(
        `Tu dois choisir ${quotaGratuits} trait(s) gratuit(s) avant de continuer.`,
      );
      return;
    }

    setSubmitting(true);

    // 1) Race (avance etape_creation 2→3 côté serveur).
    const sousTypePayload = estChimeride ? sousType : null;
    const { data: d2, error: e2 } = await clientActif.sauvegarderEtape2({
      p_personnage_id: personnageId,
      p_race_id: raceId,
      p_sous_type_chimeride: sousTypePayload as unknown as string,
    });
    if (e2) {
      setSubmitting(false);
      console.error("[V2 Etape2 fusion] sauvegarder_etape_2:", e2);
      toast.error(`Erreur : ${e2.message}`);
      return;
    }
    const p2 = (d2 ?? {}) as Record<string, unknown>;
    if (p2.succes === false) {
      setSubmitting(false);
      const err =
        ((p2.erreurs as Array<{ code?: string; message?: string }>) ?? [])[0] ??
        {};
      toast.error(`[${err.code ?? "erreur"}] ${err.message ?? "Sauvegarde de la race refusée."}`);
      return;
    }
    ((p2.avertissements as Array<{ message?: string }>) ?? []).forEach((a) => {
      if (a.message) toast.info(a.message);
    });

    // 2) Traits raciaux (avance etape_creation 3→4 côté serveur).
    const payloadTraits: TraitChoisi[] = [
      ...Array.from(gratuits).map((id) => ({
        trait_id: id,
        est_gratuit: true,
        xp_depense: 0,
      })),
      ...Array.from(achetes).map((id) => {
        const t = traits.find((x) => x.id === id);
        return { trait_id: id, est_gratuit: false, xp_depense: t?.cout_xp ?? 0 };
      }),
    ];
    const { data: d3, error: e3 } = await clientActif.sauvegarderEtape3({
      p_personnage_id: personnageId,
      p_traits_raciaux_choisis: payloadTraits as unknown as never,
    });
    setSubmitting(false);
    if (e3) {
      console.error("[V2 Etape2 fusion] sauvegarder_etape_3:", e3);
      toast.error(`Race enregistrée, mais erreur sur les traits : ${e3.message}`);
      return;
    }
    const p3 = (d3 ?? {}) as Record<string, unknown>;
    if (p3.succes === false) {
      const err =
        ((p3.erreurs as Array<{ code?: string; message?: string }>) ?? [])[0] ??
        {};
      toast.error(`[${err.code ?? "erreur"}] ${err.message ?? "Sauvegarde des traits refusée."}`);
      return;
    }

    toast.success("Race et traits enregistrés.");
    onSuccess();
  };

  const restantGratuit = Math.max(0, quotaGratuits - gratuits.size);

  return (
    <div className="space-y-6">
      <JaugeXP
        xpDisponible={xpDisponibleJaugeEtape2(xpDisponible, xpTraits, xpTraitsPersistes)}
        coutEnCours={
          xpTraits - xpTraitsPersistes !== 0
            ? {
                delta: xpTraits - xpTraitsPersistes,
                libelle: "traits raciaux",
              }
            : null
        }
      />

      <IntroEtape
        storageKey="hv-e2-intro-replie"
        titre="Comment fonctionne cette étape ?"
      >
        <IntroEtapeItem n={1}>
          Touche <span className="text-primary">« Plus de détails »</span> pour
          déplier une race, puis coche la case pour la choisir.
        </IntroEtapeItem>
        <IntroEtapeItem n={2}>
          Le bouton <span className="text-primary">Abrégé ⇄ Intégral</span> en
          haut bascule entre résumé et texte complet du manuel.
        </IntroEtapeItem>
        <IntroEtapeItem n={3}>
          Une fois la race cochée, choisis ton trait gratuit. Les suivants
          coûtent <span className="text-primary">10 XP</span> chacun.
        </IntroEtapeItem>
      </IntroEtape>

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-2xl text-gold">Choisis ta race</h2>
        <span className="shrink-0 text-xs text-white/45">
          {quotaGratuits || 1} trait gratuit · +10 XP / trait
        </span>
      </div>

      <BasculeAbregeIntegral mode={mode} onToggle={toggleMode} />

      {racesError && <ErreurChargement onRetry={() => refetchRaces()} />}

      {racesLoading ? (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des races…
        </div>
      ) : (
        <div className="space-y-2.5">
          {races.map((r) => {
            const sel = raceId === r.id;
            const ouvert = racesOuvertes.has(r.id);
            const estChim = r.id === CHIMERIDE_ID;
            const estNonR = r.id === NON_RACES_ID;
            const texteRace =
              mode === "integral"
                ? r.description ?? r.resume_condense
                : r.resume_condense ?? r.description;
            return (
              <div
                key={r.id}
                className={`overflow-hidden rounded-xl border transition-colors ${
                  sel ? "border-gold/50 bg-gold/5" : "border-white/10 bg-black/25"
                }`}
              >
                {/* En-tête : case (sélection) + identité + chevron (accordéon) */}
                <div className="flex items-start gap-3 px-3 pb-2 pt-3">
                  <Checkbox
                    checked={sel}
                    onCheckedChange={() => pickRace(r.id)}
                    className="mt-1"
                  />
                  <button
                    type="button"
                    onClick={() => toggleAccordeon(r.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-bold text-gold">
                        {r.emoji ? `${r.emoji} ` : ""}
                        {r.nom}
                        {r.nom_latin && (
                          <span className="ml-1.5 text-[11px] font-normal italic text-white/45">
                            {r.nom_latin}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {r.xp_depart != null && (
                          <span className="rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 text-[11px] font-bold text-gold">
                            {r.xp_depart} XP
                          </span>
                        )}
                        <ChevronRight
                          className={`h-4 w-4 text-gold transition-transform ${
                            ouvert ? "rotate-90" : ""
                          }`}
                        />
                      </span>
                    </div>
                    {!ouvert && (r.resume_condense ?? r.description) && (
                      <p className="mt-1.5 text-[12.5px] leading-snug text-white/60">
                        {r.resume_condense ?? r.description}
                      </p>
                    )}
                  </button>
                </div>

                {/* Description — pilotée par le switch global, visible quand la
                    carte est dépliée (équivalent « fiche » de l'encyclopédie). */}
                {ouvert && texteRace && (
                  <div className="px-3 pb-2 pl-11">
                    <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-white/[0.78]">
                      {texteRace}
                    </p>
                  </div>
                )}

                {/* Accordéon « Plus de détails » : vie, costume, sous-type,
                    approbation, traits raciaux */}
                {ouvert && (
                  <div className="space-y-3 px-3 pb-2 pl-11">
                    <div className="space-y-3 border-t border-white/10 pt-3">
                      {r.esperance_vie && (
                        <p className="text-[12.5px] text-white/80">
                          <span className="font-semibold text-gold">
                            Espérance de vie :
                          </span>{" "}
                          {r.esperance_vie}
                        </p>
                      )}
                      {r.exigences_costume && (
                        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                          <div className="mb-1 flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-amber-300">
                            <AlertTriangle className="h-3 w-3" /> Exigences de
                            costume
                          </div>
                          <p className="whitespace-pre-line text-[12.5px] leading-snug text-amber-100/90">
                            {r.exigences_costume}
                          </p>
                        </div>
                      )}
                      {r.restrictions_classes &&
                        r.restrictions_classes.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10.5px] uppercase tracking-wide text-white/55">
                              Classes interdites
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {r.restrictions_classes.map((c) => (
                                <span
                                  key={c}
                                  className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-200"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>

                    {/* Sous-type Chiméride (race sélectionnée uniquement) */}
                    {estChim && sel && (
                      <div className="rounded-lg border border-gold/40 bg-gold/5 p-3">
                        <div className="mb-2 text-[13px] font-bold text-gold">
                          Sous-type Chiméride
                        </div>
                        <div className="flex gap-2.5">
                          {(["carnivore", "herbivore"] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => choisirSousType(st)}
                              className={`flex-1 rounded-md border px-3 py-2 text-[13px] font-semibold capitalize transition-colors ${
                                sousType === st
                                  ? "border-gold bg-gold/10 text-gold"
                                  : "border-white/20 text-white/80"
                              }`}
                            >
                              {sousType === st ? "● " : "○ "}
                              {st}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Race spéciale : bloc d'approbation (Chiméride / Non-Races) */}
                    {(estChim || estNonR) && sel && (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 rounded-md border border-gold/25 bg-gold/5 p-3 text-[12.5px] text-white/80">
                          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                          <p>
                            Ton{" "}
                            <span className="text-gold">historique</span>{" "}
                            (étape 1) servira de background pour la demande
                            d'approbation. Aucune longueur minimale.
                          </p>
                        </div>
                        <div className="flex items-start gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 p-3 text-[12.5px] text-sky-100">
                          <Info className="mt-0.5 h-4 w-4 shrink-0" />
                          <div className="space-y-2">
                            <p>
                              Ta demande sera revue par l'équipe d'animation
                              après soumission de la fiche. Tu peux continuer à
                              compléter les autres étapes en attendant.
                            </p>
                            {parametres?.texte_envoi_photos_race && (
                              <p className="text-sky-100/80">
                                {parametres.texte_envoi_photos_race}
                              </p>
                            )}
                            {(parametres?.lien_facebook ||
                              parametres?.lien_discord) && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {parametres.lien_facebook && (
                                  <a
                                    href={parametres.lien_facebook}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-md border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs text-sky-100"
                                  >
                                    Facebook
                                  </a>
                                )}
                                {parametres.lien_discord && (
                                  <a
                                    href={parametres.lien_discord}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-md border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs text-sky-100"
                                  >
                                    Discord
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ----- Traits raciaux intégrés ----- */}
                    <div className="pt-1">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="font-heading text-[14.5px] text-gold">
                          Traits raciaux
                        </span>
                        {sel && (
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                              gratuitChoixComplet
                                ? "border-green-500/40 bg-green-500/10 text-green-400"
                                : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                            }`}
                          >
                            {gratuitChoixComplet ? "✓ " : ""}
                            {gratuits.size} / {quotaGratuits} gratuit
                            {quotaGratuits > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {!sel && (
                        <p className="mb-2 text-[11.5px] text-amber-300">
                          🔒 Coche la case de cette race (en haut) pour
                          sélectionner ses traits.
                        </p>
                      )}

                      {sel && traitsLoading ? (
                        <div className="flex items-center gap-2 text-sm text-white/50">
                          <Loader2 className="h-4 w-4 animate-spin" /> Chargement
                          des traits…
                        </div>
                      ) : sel && traits.length === 0 ? (
                        <p className="text-[12.5px] text-white/50">
                          Aucun trait disponible pour cette race.
                        </p>
                      ) : (
                        <div
                          className={`grid grid-cols-1 gap-2 ${
                            traitsActifs ? "" : "opacity-55"
                          }`}
                        >
                          {traits.map((t) => {
                            const estGratuit = gratuits.has(t.id);
                            const estAchete = achetes.has(t.id);
                            const selectionne = estGratuit || estAchete;
                            const texteTrait =
                              mode === "integral"
                                ? t.texte_manuel ?? t.description
                                : t.resume_condense ?? t.description;
                            return (
                              <div
                                key={t.id}
                                className={`overflow-hidden rounded-lg border transition-colors ${
                                  selectionne
                                    ? "border-gold/50 bg-gold/5"
                                    : "border-white/10 bg-black/25"
                                }`}
                              >
                                <div
                                  role="button"
                                  tabIndex={traitsActifs ? 0 : -1}
                                  onClick={() => toggleTrait(t.id)}
                                  onKeyDown={(e) => {
                                    if (
                                      traitsActifs &&
                                      (e.key === "Enter" || e.key === " ")
                                    ) {
                                      e.preventDefault();
                                      toggleTrait(t.id);
                                    }
                                  }}
                                  className={`flex items-start gap-3 px-3 pb-2 pt-2.5 ${
                                    traitsActifs
                                      ? "cursor-pointer"
                                      : "cursor-not-allowed"
                                  }`}
                                >
                                  <Checkbox
                                    checked={selectionne}
                                    disabled={!traitsActifs}
                                    onCheckedChange={() => toggleTrait(t.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-0.5"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-semibold text-gold">
                                        {t.nom}
                                      </span>
                                      {selectionne ? (
                                        estGratuit ? (
                                          <span className="shrink-0 rounded-full border border-gold bg-gold/15 px-2 py-0.5 text-[11px] font-bold text-gold">
                                            ✦ Gratuit
                                          </span>
                                        ) : (
                                          <span className="shrink-0 rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-400">
                                            − {t.cout_xp} XP
                                          </span>
                                        )
                                      ) : (
                                        <span className="shrink-0 text-[11px] text-white/40">
                                          {t.cout_xp} XP
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-white/[0.78]">
                                      {texteTrait}
                                    </p>
                                  </div>
                                </div>

                              </div>
                            );
                          })}

                          {sel && (
                            <div className="mt-1 flex items-center justify-between text-sm">
                              <span className="text-white/60">
                                {gratuits.size} gratuit · {achetes.size} acheté
                                {achetes.size > 1 ? "s" : ""}
                              </span>
                              <span
                                className={`font-bold ${
                                  xpTraits > 0 ? "text-amber-400" : "text-white/45"
                                }`}
                              >
                                Coût : {xpTraits} XP
                              </span>
                            </div>
                          )}

                          {sel && !gratuitChoixComplet && (
                            <p className="mt-1 text-xs text-amber-300">
                              💡 Choisis{" "}
                              {restantGratuit > 1
                                ? `tes ${restantGratuit} traits gratuits`
                                : "ton trait gratuit"}{" "}
                              pour continuer.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Pied : « Plus de détails » / « Réduire » */}
                <button
                  type="button"
                  onClick={() => toggleAccordeon(r.id)}
                  className="flex w-full items-center justify-center gap-1.5 border-t border-white/10 bg-gold/[0.04] py-2 text-[11.5px] font-bold tracking-wide text-gold"
                >
                  {ouvert ? "Réduire" : "Plus de détails"}
                  {ouvert ? (
                    <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!isValid && (
        <p className="text-xs text-amber-300">
          💡{" "}
          {!raceId
            ? "Choisis une race."
            : estChimeride && !sousType
              ? "Choisis le sous-type Chiméride."
              : "Coche ton trait racial gratuit pour continuer."}
        </p>
      )}

      <div className="flex justify-between pt-1">
        <Button type="button" variant="outline" onClick={onPrevious}>
          Étape précédente
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !isValid}
          className="bg-gold text-black hover:bg-gold/90"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Suivant
        </Button>
      </div>
    </div>
  );
};

export default Etape2_V2;
