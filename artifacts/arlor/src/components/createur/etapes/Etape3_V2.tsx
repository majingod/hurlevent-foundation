import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { QueryState } from "@/components/ui/QueryState";
import JaugeXP from "@/components/createur/aide/JaugeXP";
import SectionCard from "@/components/createur/aide/SectionCard";
import IntroEtape, { IntroEtapeItem } from "@/components/createur/aide/IntroEtape";
import type { EtapeProps } from "@/pages/PersonnageNouveauV2";

interface Etape3Props extends EtapeProps {
  xpDisponible?: number;
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
  cout_xp: number;
}

const Etape3_V2 = ({
  personnageId,
  onSuccess,
  onPrevious,
  onXpDeltaChange,
  xpDisponible = 0,
}: Etape3Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [gratuits, setGratuits] = useState<Set<string>>(new Set());
  const [achetes, setAchetes] = useState<Set<string>>(new Set());
  const [chargementInit, setChargementInit] = useState(true);
  // Détails déroulés (verbatim manuel). Set manuel — PAS de Radix Accordion à
  // enfants interactifs (gotcha s152).
  const [detailsOuverts, setDetailsOuverts] = useState<Set<string>>(new Set());

  // Charger l'état du personnage (race + sous-type + traits déjà choisis)
  const { data: perso } = useQuery({
    queryKey: ["v2-perso-traits", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnages")
        .select("race_id, sous_type_chimeride, traits_raciaux_choisis")
        .eq("id", personnageId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const raceId = perso?.race_id ?? null;
  const sousType =
    (perso?.sous_type_chimeride as "carnivore" | "herbivore" | null) ?? null;

  // Charger la race (pour quota nb_traits_raciaux)
  const { data: race } = useQuery({
    queryKey: ["v2-race-quota", raceId],
    enabled: !!raceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("races")
        .select("id, nom, nb_traits_raciaux")
        .eq("id", raceId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Traits filtrés par race + sous-type via la vue dédiée
  const { data: traits, isLoading: traitsLoading, error: traitsError, refetch } = useQuery<TraitDispo[]>({
    queryKey: ["v2-traits-par-race", raceId, sousType],
    enabled: !!raceId,
    queryFn: async () => {
      // `trait_texte_manuel` n'est pas encore dans types.ts (dette
      // RESYNC-TYPES-SUPABASE) → cast local pour ne pas faire échouer le
      // typecheck sur le `.select()`. Le mapping ci-dessous reste en `any`.
      let q = (supabase as any)
        .from("vue_traits_par_race")
        .select("trait_id, sous_type, trait_nom, trait_description, trait_texte_manuel, cout_xp")
        .eq("race_id", raceId!)
        .order("trait_nom");

      if (sousType) {
        q = q.or(`sous_type.eq.${sousType},sous_type.is.null`);
      } else {
        q = q.is("sous_type", null);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        id: t.trait_id as string,
        nom: t.trait_nom as string,
        description: t.trait_description as string,
        texte_manuel: (t.trait_texte_manuel as string | null) ?? null,
        cout_xp: t.cout_xp as number,
      })) as TraitDispo[];
    },
  });

  // Initialiser depuis traits_raciaux_choisis
  useEffect(() => {
    if (!perso) return;
    const choisis = (perso.traits_raciaux_choisis as TraitChoisi[] | null) ?? [];
    const g = new Set<string>();
    const a = new Set<string>();
    choisis.forEach((c) => {
      if (c.est_gratuit) g.add(c.trait_id);
      else a.add(c.trait_id);
    });
    setGratuits(g);
    setAchetes(a);
    setChargementInit(false);
  }, [perso]);

  const quotaGratuits = race?.nb_traits_raciaux ?? 0;
  const gratuitChoixComplet = gratuits.size >= quotaGratuits;

  const xpTraits = useMemo(() => {
    let total = 0;
    achetes.forEach((id) => {
      const t = (traits ?? []).find((x) => x.id === id);
      if (t) total += t.cout_xp;
    });
    return total;
  }, [achetes, traits]);

  useEffect(() => {
    onXpDeltaChange?.(xpTraits);
    return () => {
      onXpDeltaChange?.(0);
    };
  }, [xpTraits, onXpDeltaChange]);

  const toggleGratuit = (id: string) => {
    if (gratuits.has(id)) {
      // Décocher un gratuit : promotion FIFO du premier payant (miroir du
      // recalcul serveur dans sauvegarder_etape_3, Option B session 34).
      const premierPayant =
        achetes.size > 0
          ? (achetes.values().next().value as string)
          : null;

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
      toast.error(
        `Tu ne peux choisir que ${quotaGratuits} trait(s) gratuit(s).`
      );
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

  // Harmonisation s186 — checkbox UNIQUE par trait. Les `quotaGratuits` premiers
  // cochés sont gratuits ; les suivants coûtent leur cout_xp. Aiguilleur : on ne
  // change NI le calcul NI le payload, on réutilise toggleGratuit (avec sa
  // promotion FIFO) et toggleAchete tels quels.
  const toggleTrait = (id: string) => {
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

  const toggleDetail = (id: string) => {
    setDetailsOuverts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSubmit = async () => {
    if (gratuits.size < quotaGratuits) {
      toast.error(
        `Tu dois choisir ${quotaGratuits} trait(s) gratuit(s) avant de continuer.`
      );
      return;
    }

    const payloadTraits: TraitChoisi[] = [
      ...Array.from(gratuits).map((id) => ({
        trait_id: id,
        est_gratuit: true,
        xp_depense: 0,
      })),
      ...Array.from(achetes).map((id) => {
        const t = (traits ?? []).find((x) => x.id === id);
        return {
          trait_id: id,
          est_gratuit: false,
          xp_depense: t?.cout_xp ?? 0,
        };
      }),
    ];

    setSubmitting(true);
    const { data, error } = await supabase.rpc("sauvegarder_etape_3", {
      p_personnage_id: personnageId,
      p_traits_raciaux_choisis: payloadTraits as unknown as never,
    });
    setSubmitting(false);

    if (error) {
      console.error("[V2 Etape3] RPC error:", error);
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    const resp = (data ?? {}) as Record<string, unknown>;
    const erreurs =
      (resp.erreurs as Array<Record<string, unknown>> | undefined) ?? [];
    const premiereErreur = erreurs[0] ?? {};
    const succes = resp.succes !== false;
    if (!succes) {
      const code =
        (premiereErreur.code as string) ?? (resp.code as string) ?? "erreur";
      const message =
        (premiereErreur.message as string) ??
        (resp.message as string) ??
        "Sauvegarde refusée.";
      toast.error(`[${code}] ${message}`);
      return;
    }

    toast.success("Traits raciaux enregistrés.");
    onSuccess();
  };

  const restantGratuit = quotaGratuits - gratuits.size;
  const sousTitre = useMemo(
    () =>
      `${quotaGratuits} trait${quotaGratuits > 1 ? "s" : ""} gratuit${
        quotaGratuits > 1 ? "s" : ""
      } · chaque trait suivant coûte 10 XP`,
    [quotaGratuits]
  );

  if (!chargementInit && !raceId) {
    return (
      <div className="space-y-4">
        <p className="text-amber-300">
          Aucune race sélectionnée — retourne à l'étape 2 pour la choisir.
        </p>
        <Button variant="outline" onClick={onPrevious}>
          Étape précédente
        </Button>
      </div>
    );
  }

  return (
    <QueryState<TraitDispo[]>
      isLoading={chargementInit || traitsLoading}
      error={traitsError as Error | null}
      data={traits ?? null}
      loadingLabel="Chargement des traits raciaux..."
      emptyLabel="Aucun trait disponible pour cette race"
      onRetry={() => refetch()}
      isEmpty={(d) => Array.isArray(d) && d.length === 0}
    >
      {(traitsDispo) => (
        <div className="space-y-5">
          <JaugeXP xpDisponible={xpDisponible} />

          <IntroEtape
            storageKey="hv-e3-intro-replie"
            titre="Comment fonctionne cette étape ?"
          >
            <IntroEtapeItem n={1}>
              Ta race t'offre{" "}
              <strong>
                {quotaGratuits} trait{quotaGratuits > 1 ? "s" : ""} racial
                {quotaGratuits > 1 ? "s" : ""} gratuit
                {quotaGratuits > 1 ? "s" : ""}
              </strong>{" "}
              : coche celui que tu veux.
            </IntroEtapeItem>
            <IntroEtapeItem n={2}>
              Tu peux en prendre d'autres pour <strong>10 XP</strong> chacun —
              c'est optionnel.
            </IntroEtapeItem>
            <IntroEtapeItem n={3}>
              « Voir le détail » affiche la description complète du manuel.
            </IntroEtapeItem>
          </IntroEtape>

          <SectionCard
            titre="Choisis tes traits"
            sousTitre={sousTitre}
            badge={
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
            }
          >
            <div className="grid grid-cols-1 gap-2.5">
              {traitsDispo.map((t) => {
                const estGratuit = gratuits.has(t.id);
                const estAchete = achetes.has(t.id);
                const selectionne = estGratuit || estAchete;
                const detailOuvert = detailsOuverts.has(t.id);
                const verbatim = t.texte_manuel ?? t.description;
                return (
                  <div
                    key={t.id}
                    className={`overflow-hidden rounded-lg border transition-colors ${
                      selectionne
                        ? "border-gold/50 bg-gold/5"
                        : "border-white/10 bg-black/25"
                    }`}
                  >
                    {/* Zone de sélection (clic = cocher/décocher) */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleTrait(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleTrait(t.id);
                        }
                      }}
                      className="flex cursor-pointer items-start gap-3 px-3 pb-2 pt-2.5"
                    >
                      <Checkbox
                        checked={selectionne}
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
                        {/* Glance : description courte */}
                        <p className="mt-1 text-[12.5px] leading-snug text-white/60">
                          {t.description}
                        </p>
                      </div>
                    </div>

                    {/* Affordance « Voir le détail » — contrôle distinct */}
                    <button
                      type="button"
                      onClick={() => toggleDetail(t.id)}
                      aria-expanded={detailOuvert}
                      className={`mb-2 ml-11 flex items-center gap-1.5 rounded-md border border-gold/40 px-2 py-1 text-[11.5px] font-semibold text-gold transition-colors ${
                        detailOuvert ? "bg-gold/10" : "bg-transparent hover:bg-gold/5"
                      }`}
                    >
                      <ChevronRight
                        className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                          detailOuvert ? "rotate-90" : ""
                        }`}
                      />
                      {detailOuvert ? "Masquer le détail" : "Voir le détail"}
                    </button>

                    {/* Verbatim manuel déroulé */}
                    {detailOuvert && (
                      <div className="mb-3 ml-11 mr-3 rounded-md border-l-2 border-gold/50 bg-white/[0.03] px-3 py-2.5">
                        <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-white/[0.78]">
                          {verbatim}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3.5 flex items-center justify-between text-sm">
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

            {!gratuitChoixComplet && (
              <p className="mt-2 text-xs text-amber-300">
                💡 Choisis{" "}
                {restantGratuit > 1
                  ? `tes ${restantGratuit} traits gratuits`
                  : "ton trait gratuit"}{" "}
                pour continuer.
              </p>
            )}
          </SectionCard>

          <div className="flex justify-between pt-1">
            <Button type="button" variant="outline" onClick={onPrevious}>
              Étape précédente
            </Button>
            <Button
              onClick={onSubmit}
              disabled={submitting || !gratuitChoixComplet}
              className="bg-gold text-black hover:bg-gold/90"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Suivant
            </Button>
          </div>
        </div>
      )}
    </QueryState>
  );
};

export default Etape3_V2;
