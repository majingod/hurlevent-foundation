import { useEffect, useMemo, useRef } from "react";
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
  /**
   * Etape de creation actuelle cote serveur (personnages.etape_creation).
   * Sert de garde a l'auto-skip : on ne skip qu'en avancement (forward).
   */
  etapeCreation?: number;
  /**
   * XP disponible du personnage (xp_total - xp_depense, ajuste du delta
   * courant). Calcule par PersonnageNouveauV2.tsx. Sert a griser le
   * bouton « Acheter » quand XP insuffisant. Fallback 0 = bloque par
   * defaut si la prop manque.
   */
  xpDisponible?: number;
  /**
   * Drapeau parent : true seulement si on est sur l'etape la plus haute
   * jamais atteinte dans cette session. Si false (l'utilisateur est revenu
   * en arriere), l'auto-skip est desactive meme si etapeCreation === 9.
   * Defaut true pour compatibilite.
   */
  autoSkipActif?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onPrevious?: () => void;
}

const Etape9_Assemblages_V2 = ({
  personnageId,
  etapeCreation,
  xpDisponible = 0,
  autoSkipActif = true,
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

  // Map assemblage_id → personnage_assemblage (pour pouvoir désacheter)
  const assemblagesAcquisParAssemblageId = useMemo(() => {
    const map = new Map<string, PersonnageAssemblageRow>();
    (personnageAssemblages ?? []).forEach((a) => {
      map.set(a.assemblage_id, a);
    });
    return map;
  }, [personnageAssemblages]);

  const nbGratuits = [...assemblagesAcquisParAssemblageId.values()].filter((a) => a.est_gratuit).length;
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
      // Invalide toutes les queries qui contiennent personnageId dans leur
      // clef. Cela couvre ["personnage-assemblages", id], ["artisanat-quotas", id]
      // ET ["v2-personnage", id] du parent (header XP), sans avoir a lister
      // chaque queryKey explicitement.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      toast.success("Assemblage acquis !");
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  const desacheterMutation = useMutation({
    mutationFn: async (params: {
      p_personnage_assemblage_id: string;
    }) => {
      const { data, error } = await supabase.rpc("desacheter_assemblage", params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      toast.success("Assemblage retiré.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  // Avance etape_creation de 9 a 10 cote serveur. Les etapes 5-9 n'ont pas
  // de sauvegarder_etape_N : sans cet appel, le bouton « Suivant » ne ferait
  // que relire etape_creation et resterait bloque sur l'etape courante.
  const avancerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("avancer_etape", {
        p_personnage_id: personnageId,
        p_etape_courante: 9,
      });
      if (error) throw error;
      const payload = (data ?? {}) as Record<string, any>;
      if (payload.succes !== true) {
        const msg =
          (payload.erreurs?.[0]?.message as string | undefined) ??
          (payload.erreurs?.[0]?.code as string | undefined) ??
          "Impossible de passer a l'etape suivante.";
        throw new Error(msg);
      }
      return payload;
    },
    onSuccess: (payload) => {
      const avertissements =
        (payload?.avertissements as Array<{ message?: string }> | undefined) ??
        [];
      if (avertissements[0]?.message) toast.info(avertissements[0].message);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  // Auto-skip : si l'utilisateur arrive sur l'etape 9 en avancement
  // (etapeCreation === 9) et qu'il ne possede pas la competence
  // « Assemblage de Runes » (niveauRunes < 1, donc hasAssemblage = false),
  // on fait avancer etape_creation cote serveur immediatement. La garde
  // useRef + etapeCreation === N protege contre le re-trigger et permet
  // la navigation backward.
  const skipDeclencheRef = useRef(false);
  useEffect(() => {
    if (!autoSkipActif) return;
    if (skipDeclencheRef.current) return;
    if (etapeCreation == null || etapeCreation > 9) return;
    if (loadingQuotas) return;
    if (hasAssemblage) return;
    if (avancerMutation.isPending) return;
    skipDeclencheRef.current = true;
    avancerMutation.mutate();
  }, [autoSkipActif, etapeCreation, loadingQuotas, hasAssemblage, avancerMutation]);

  const handleToggle = (assemblage: AssemblageRow, acquis: PersonnageAssemblageRow | undefined) => {
    if (acquis) {
      // Désacheter
      desacheterMutation.mutate({ p_personnage_assemblage_id: acquis.id });
    } else {
      // Acheter (le serveur décide gratuit vs payant selon quota)
      acheterMutation.mutate({
        p_personnage_id: personnageId,
        p_assemblage_id: assemblage.id,
      });
    }
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
      <div className="space-y-6">
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
        <div className="flex justify-between pt-4">
          {onPrevious && (
            <Button variant="outline" onClick={onPrevious}>
              ← Précédent
            </Button>
          )}
          <Button
            className="ml-auto"
            onClick={() => avancerMutation.mutate()}
            disabled={avancerMutation.isPending}
          >
            {avancerMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Suivant →
          </Button>
        </div>
      </div>
    );
  }

  const mutationsPending = acheterMutation.isPending || desacheterMutation.isPending;

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
              const acquis = assemblagesAcquisParAssemblageId.get(assemblage.id);
              const estAcquis = !!acquis;
              const estGratuit = acquis?.est_gratuit ?? false;
              const seraGratuit = !estAcquis && quotaRestant > 0;

              return (
                <div
                  key={assemblage.id}
                  className={`space-y-2 rounded-lg border p-3 transition-colors ${
                    estAcquis
                      ? "border-primary/50 bg-primary/5"
                      : "border-border"
                  }`}
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
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={estAcquis}
                        disabled={mutationsPending}
                        onCheckedChange={() => handleToggle(assemblage, acquis)}
                      />
                      {estAcquis
                        ? estGratuit
                          ? "Sélectionné (Gratuit)"
                          : `Sélectionné (${COUT_ASSEMBLAGE_SUPPLEMENTAIRE} XP)`
                        : seraGratuit
                          ? "Sélectionner (Gratuit)"
                          : `Sélectionner (${COUT_ASSEMBLAGE_SUPPLEMENTAIRE} XP)`}
                    </label>
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
        <Button
          className="ml-auto"
          onClick={() => avancerMutation.mutate()}
          disabled={avancerMutation.isPending}
        >
          {avancerMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Suivant →
        </Button>
      </div>
    </div>
  );
};

export default Etape9_Assemblages_V2;
