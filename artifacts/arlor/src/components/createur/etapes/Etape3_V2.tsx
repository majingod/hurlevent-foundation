import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QueryState } from "@/components/ui/QueryState";
import type { EtapeProps } from "@/pages/PersonnageNouveauV2";

interface TraitChoisi {
  trait_id: string;
  est_gratuit: boolean;
  xp_depense: number;
}

interface TraitDispo {
  id: string;
  nom: string;
  description: string;
  cout_xp: number;
}

const Etape3_V2 = ({ personnageId, onSuccess, onPrevious, onXpDeltaChange }: EtapeProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [gratuits, setGratuits] = useState<Set<string>>(new Set());
  const [achetes, setAchetes] = useState<Set<string>>(new Set());
  const [chargementInit, setChargementInit] = useState(true);
  // Sprint 5.5 Section 1 : modal bloquante quand l'utilisateur tente de
  // décocher un trait gratuit alors qu'il a des achats payants en attente
  // (l'état DB serait incohérent : payants sans gratuit acquis).
  const [blocChangementGratuit, setBlocChangementGratuit] = useState<{
    traitId: string;
    nbAchats: number;
  } | null>(null);

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
      let q = supabase
        .from("vue_traits_par_race")
        .select("trait_id, sous_type, trait_nom, trait_description, cout_xp")
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
  // Sprint 5.5 Section 1 : true quand le quota de traits gratuits est rempli.
  // Tant que false, les Checkbox "Acheter (X XP)" sont désactivées.
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
    // Sprint 5.5 Section 1 : si on décoche un gratuit et qu'il y a des
    // achats payants, on bloque via modal. L'utilisateur doit retirer ses
    // achats payants avant de pouvoir changer son trait gratuit.
    if (gratuits.has(id) && achetes.size > 0) {
      setBlocChangementGratuit({ traitId: id, nbAchats: achetes.size });
      return;
    }
    setGratuits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= quotaGratuits) {
          toast.error(
            `Tu ne peux choisir que ${quotaGratuits} trait(s) gratuit(s).`
          );
          return prev;
        }
        next.add(id);
        // Si déjà acheté, on retire de la liste payante
        setAchetes((a) => {
          const na = new Set(a);
          na.delete(id);
          return na;
        });
      }
      return next;
    });
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
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="font-heading text-2xl text-gold">Traits raciaux</h2>
            <p className="text-sm text-white/60">
              Choisis {quotaGratuits} trait(s) gratuit(s). Tu peux en acheter
              d'autres avec ton XP.
            </p>
            <div className="flex gap-4 text-sm">
              <span
                className={
                  gratuits.size === quotaGratuits
                    ? "text-green-400"
                    : "text-amber-400"
                }
              >
                Gratuits : {gratuits.size} / {quotaGratuits}
              </span>
              <span className="text-white/60">
                Achetés : {achetes.size} ({xpTraits} XP)
              </span>
            </div>
            {!gratuitChoixComplet && (
              <p className="text-xs text-amber-300">
                💡 Tu dois choisir {quotaGratuits - gratuits.size} trait
                {quotaGratuits - gratuits.size > 1 ? "s" : ""} gratuit
                {quotaGratuits - gratuits.size > 1 ? "s" : ""} avant d'en
                acheter d'autres.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {traitsDispo.map((t) => {
              const estGratuit = gratuits.has(t.id);
              const estAchete = achetes.has(t.id);
              const selectionne = estGratuit || estAchete;
              return (
                <Card
                  key={t.id}
                  className={`border-white/10 bg-black/30 transition-colors ${
                    selectionne ? "border-gold/50 bg-gold/5" : ""
                  }`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base text-gold">
                      <span>{t.nom}</span>
                      <span className="text-xs text-white/50">{t.cout_xp} XP</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-white/70">{t.description}</p>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={estGratuit}
                          onCheckedChange={() => toggleGratuit(t.id)}
                        />
                        Gratuit
                      </label>
                      <label
                        className={`flex items-center gap-2 text-sm ${
                          !gratuitChoixComplet && !estAchete ? "opacity-50" : ""
                        }`}
                      >
                        <Checkbox
                          checked={estAchete}
                          disabled={!gratuitChoixComplet && !estAchete}
                          onCheckedChange={() => toggleAchete(t.id)}
                        />
                        Acheter ({t.cout_xp} XP)
                      </label>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-between pt-2">
            <Button type="button" variant="outline" onClick={onPrevious}>
              Étape précédente
            </Button>
            <Button
              onClick={onSubmit}
              disabled={submitting}
              className="bg-gold text-black hover:bg-gold/90"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Suivant
            </Button>
          </div>

          {/* Sprint 5.5 Section 1 : modal bloquante de changement de trait
              gratuit. Affichée quand l'utilisateur tente de décocher un
              trait gratuit alors que des achats payants existent. */}
          <Dialog
            open={!!blocChangementGratuit}
            onOpenChange={(open) => {
              if (!open) setBlocChangementGratuit(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Impossible de changer ce trait gratuit</DialogTitle>
                <DialogDescription>
                  {blocChangementGratuit && (
                    <>
                      Tu as déjà acheté{" "}
                      <strong>{blocChangementGratuit.nbAchats}</strong> trait
                      {blocChangementGratuit.nbAchats > 1 ? "s" : ""}{" "}
                      supplémentaire
                      {blocChangementGratuit.nbAchats > 1 ? "s" : ""}. Retire
                      d'abord ces achats avant de changer ton trait gratuit.
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setBlocChangementGratuit(null)}>
                  Compris
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </QueryState>
  );
};

export default Etape3_V2;
