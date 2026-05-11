import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Gem } from "lucide-react";
import { COUT_ASSEMBLAGE_SUPPLEMENTAIRE } from "@/constants/artisanat";

type AssemblageRow = Database["public"]["Tables"]["assemblages_runes"]["Row"];
type PersonnageAssemblageRow =
  Database["public"]["Tables"]["personnage_assemblages"]["Row"];
type QuotasRow = Database["public"]["Views"]["vue_artisanat_quotas"]["Row"];

interface Etape9Props {
  personnageId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onPrevious?: () => void;
}

const Etape9_Assemblages_V2 = ({
  personnageId,
  onSuccess,
  onError,
  onPrevious,
}: Etape9Props) => {
  const queryClient = useQueryClient();

  // Quotas (vue_artisanat_quotas)
  const { data: quotas, isLoading: loadingQuotas } = useQuery({
    queryKey: ["artisanat-quotas", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vue_artisanat_quotas")
        .select("*")
        .eq("personnage_id", personnageId)
        .maybeSingle();
      if (error) throw error;
      return data as QuotasRow | null;
    },
    enabled: !!personnageId,
  });

  const niveauRunes = quotas?.niveau_runes ?? 0;
  const quotaAssemblagesTotal = quotas?.quota_assemblages_total ?? 0;
  const hasAssemblage = niveauRunes >= 1;

  // Liste des assemblages de runes
  const { data: assemblages, isLoading: loadingAssemblages } = useQuery({
    queryKey: ["assemblages-runes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assemblages_runes")
        .select("*")
        .eq("est_actif", true)
        .order("nom");
      if (error) throw error;
      return (data ?? []) as AssemblageRow[];
    },
    enabled: hasAssemblage,
  });

  // Assemblages déjà acquis par le personnage
  const { data: personnageAssemblages, isLoading: loadingPersoAssemblages } =
    useQuery({
      queryKey: ["personnage-assemblages", personnageId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("personnage_assemblages")
          .select("*")
          .eq("personnage_id", personnageId);
        if (error) throw error;
        return (data ?? []) as PersonnageAssemblageRow[];
      },
      enabled: !!personnageId && hasAssemblage,
    });

  const assemblagesGratuitsIds = useMemo(
    () =>
      new Set(
        (personnageAssemblages ?? [])
          .filter((a) => a.est_gratuit)
          .map((a) => a.assemblage_id),
      ),
    [personnageAssemblages],
  );
  const assemblagesAchetesIds = useMemo(
    () =>
      new Set(
        (personnageAssemblages ?? [])
          .filter((a) => !a.est_gratuit)
          .map((a) => a.assemblage_id),
      ),
    [personnageAssemblages],
  );

  const nbGratuits = assemblagesGratuitsIds.size;
  const quotaRestant = Math.max(0, quotaAssemblagesTotal - nbGratuits);

  const acheterMutation = useMutation({
    mutationFn: async (params: {
      p_personnage_id: string;
      p_assemblage_id: string;
    }) => {
      const { data, error } = await supabase.rpc("acheter_assemblage", params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["personnage-assemblages", personnageId],
      });
      queryClient.invalidateQueries({
        queryKey: ["artisanat-quotas", personnageId],
      });
      queryClient.invalidateQueries({ queryKey: ["personnage", personnageId] });
      toast.success("Assemblage acquis !");
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  const handleCocherGratuit = (assemblage: AssemblageRow) => {
    if (quotaRestant <= 0) {
      toast.error("Quota gratuit épuisé.");
      return;
    }
    acheterMutation.mutate({
      p_personnage_id: personnageId,
      p_assemblage_id: assemblage.id,
    });
  };

  const handleAcheter = (assemblage: AssemblageRow) => {
    acheterMutation.mutate({
      p_personnage_id: personnageId,
      p_assemblage_id: assemblage.id,
    });
  };

  if (loadingQuotas) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Chargement des quotas d'assemblages…
      </div>
    );
  }

  if (!hasAssemblage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">
            Étape 9 — Assemblages de runes
          </CardTitle>
          <CardDescription>
            Vous ne possédez pas la compétence « Assemblage de Runes ». Vous
            pouvez passer à l'étape suivante.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const mutationsPending = acheterMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Étape 9 — Assemblages de runes
        </h2>
        <p className="text-sm text-muted-foreground">
          Sélectionnez vos assemblages gratuits et complétez avec des
          assemblages payants si vous le souhaitez.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-heading">
            <Gem className="h-4 w-4" />
            Assemblage de Runes — niveau {niveauRunes}
          </CardTitle>
          <CardDescription>
            Quota gratuit restant :{" "}
            <strong
              className={quotaRestant > 0 ? "text-primary" : "text-amber-400"}
            >
              {quotaRestant} / {quotaAssemblagesTotal}
            </strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingAssemblages || loadingPersoAssemblages ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Chargement des assemblages…
            </div>
          ) : (assemblages ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun assemblage disponible.
            </p>
          ) : (
            (assemblages ?? []).map((assemblage) => {
              const estGratuit = assemblagesGratuitsIds.has(assemblage.id);
              const estAchete = assemblagesAchetesIds.has(assemblage.id);
              const dejaAcquis = estGratuit || estAchete;
              const peutCocherGratuit = estGratuit || quotaRestant > 0;

              return (
                <div
                  key={assemblage.id}
                  className="space-y-2 rounded-lg border border-border p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <strong className="font-heading text-primary">
                        {assemblage.nom}
                      </strong>
                      {assemblage.description_longue && (
                        <p className="text-xs text-muted-foreground">
                          {assemblage.description_longue}
                        </p>
                      )}
                      {assemblage.effet && (
                        <p className="text-xs">
                          <span className="font-medium text-foreground">
                            Effet :
                          </span>{" "}
                          {assemblage.effet}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {assemblage.cible && (
                          <Badge variant="outline" className="text-xs">
                            Cible : {assemblage.cible}
                          </Badge>
                        )}
                        {assemblage.cout_ps != null && (
                          <Badge variant="secondary" className="text-xs">
                            Coût PS : {assemblage.cout_ps}
                          </Badge>
                        )}
                        {assemblage.runes_requises &&
                          assemblage.runes_requises.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              Runes : {assemblage.runes_requises.join(", ")}
                            </Badge>
                          )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <label
                      className={`flex items-center gap-2 text-sm ${
                        !peutCocherGratuit && !estGratuit ? "opacity-50" : ""
                      }`}
                    >
                      <Checkbox
                        checked={estGratuit}
                        disabled={
                          mutationsPending || dejaAcquis || quotaRestant <= 0
                        }
                        onCheckedChange={(c) => {
                          if (c === true && !dejaAcquis) {
                            handleCocherGratuit(assemblage);
                          }
                        }}
                      />
                      Gratuit
                    </label>

                    {!estGratuit && !estAchete && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={mutationsPending}
                        onClick={() => handleAcheter(assemblage)}
                      >
                        Acheter ({COUT_ASSEMBLAGE_SUPPLEMENTAIRE} XP)
                      </Button>
                    )}

                    {estAchete && (
                      <Badge className="bg-amber-700/30 text-amber-300">
                        Acheté ({COUT_ASSEMBLAGE_SUPPLEMENTAIRE} XP)
                      </Badge>
                    )}

                    {estGratuit && (
                      <Badge className="bg-green-700/30 text-green-300">
                        Gratuit sélectionné
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between pt-4">
        {onPrevious && (
          <Button variant="outline" onClick={onPrevious}>
            ← Précédent
          </Button>
        )}
        <Button className="ml-auto" onClick={() => onSuccess?.()}>
          Suivant →
        </Button>
      </div>
    </div>
  );
};

export default Etape9_Assemblages_V2;
