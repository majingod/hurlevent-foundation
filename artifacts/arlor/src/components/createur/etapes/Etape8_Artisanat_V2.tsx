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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Hammer, Gem, Crown } from "lucide-react";
import { COUT_RECETTE_SUPPLEMENTAIRE } from "@/constants/artisanat";
import { NIVEAU_ALCHIMIE_LABELS, TYPE_RECETTE_LABELS } from "@/constants/labels";

type RecetteRow = Database["public"]["Tables"]["recettes_alchimie"]["Row"];
type ObjetForgeRow = Database["public"]["Tables"]["objets_forge"]["Row"];
type ObjetJoaillerieRow =
  Database["public"]["Tables"]["objets_joaillerie"]["Row"];
type PersonnageRecetteRow =
  Database["public"]["Tables"]["personnage_recettes"]["Row"];
type QuotasRow = Database["public"]["Views"]["vue_artisanat_quotas"]["Row"];

interface Etape8Props {
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
   * en arriere), l'auto-skip est desactive meme si etapeCreation === 8.
   * Defaut true pour compatibilite.
   */
  autoSkipActif?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onPrevious?: () => void;
}

const Etape8_Artisanat_V2 = ({
  personnageId,
  etapeCreation,
  xpDisponible = 0,
  autoSkipActif = true,
  onSuccess,
  onError,
  onPrevious,
}: Etape8Props) => {
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

  const niveauAlchimie = quotas?.niveau_alchimie ?? 0;
  const niveauForge = quotas?.niveau_forge ?? 0;
  const niveauJoaillerie = quotas?.niveau_joaillerie ?? 0;
  const quotaRecettesTotal = quotas?.quota_recettes_total ?? 0;

  const hasAlchimie = niveauAlchimie >= 1;
  const hasForge = niveauForge >= 1;
  const hasJoaillerie = niveauJoaillerie >= 1;

  // Recettes accessibles (niveau_requis ≤ niveau_alchimie)
  const { data: recettes, isLoading: loadingRecettes } = useQuery({
    queryKey: ["recettes-disponibles", niveauAlchimie],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recettes_alchimie")
        .select("*")
        .eq("est_actif", true)
        .lte("niveau_requis", niveauAlchimie)
        .order("niveau_requis")
        .order("nom");
      if (error) throw error;
      return (data ?? []) as RecetteRow[];
    },
    enabled: hasAlchimie,
  });

  // Recettes déjà acquises par le personnage
  const { data: personnageRecettes, isLoading: loadingPersoRecettes } =
    useQuery({
      queryKey: ["personnage-recettes", personnageId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("personnage_recettes")
          .select("*")
          .eq("personnage_id", personnageId);
        if (error) throw error;
        return (data ?? []) as PersonnageRecetteRow[];
      },
      enabled: !!personnageId && hasAlchimie,
    });

  // Objets de forge
  const { data: objetsForge, isLoading: loadingForge } = useQuery({
    queryKey: ["objets-forge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("objets_forge")
        .select("*")
        .eq("est_actif", true)
        .order("difficulte")
        .order("nom");
      if (error) throw error;
      return (data ?? []) as ObjetForgeRow[];
    },
    enabled: hasForge,
  });

  // Objets de joaillerie
  const { data: objetsJoaillerie, isLoading: loadingJoaillerie } = useQuery({
    queryKey: ["objets-joaillerie"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("objets_joaillerie")
        .select("*")
        .eq("est_actif", true)
        .order("difficulte")
        .order("nom");
      if (error) throw error;
      return (data ?? []) as ObjetJoaillerieRow[];
    },
    enabled: hasJoaillerie,
  });

  const recettesGratuitesIds = useMemo(
    () =>
      new Set(
        (personnageRecettes ?? [])
          .filter((r) => r.est_gratuit)
          .map((r) => r.recette_id),
      ),
    [personnageRecettes],
  );
  const recettesAcheteesIds = useMemo(
    () =>
      new Set(
        (personnageRecettes ?? [])
          .filter((r) => !r.est_gratuit)
          .map((r) => r.recette_id),
      ),
    [personnageRecettes],
  );

  const nbGratuites = recettesGratuitesIds.size;
  const quotaRestant = Math.max(0, quotaRecettesTotal - nbGratuites);

  const acheterMutation = useMutation({
    mutationFn: async (params: {
      p_personnage_id: string;
      p_recette_id: string;
    }) => {
      const { data, error } = await supabase.rpc("acheter_recette", params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalide toutes les queries qui contiennent personnageId dans leur
      // clef. Cela couvre ["personnage-recettes", id], ["artisanat-quotas", id]
      // ET ["v2-personnage", id] du parent (header XP), sans avoir a lister
      // chaque queryKey explicitement.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      toast.success("Recette acquise !");
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  const handleCocherGratuit = (recette: RecetteRow) => {
    if (quotaRestant <= 0) {
      toast.error("Quota gratuit épuisé.");
      return;
    }
    acheterMutation.mutate({
      p_personnage_id: personnageId,
      p_recette_id: recette.id,
    });
  };

  const handleAcheter = (recette: RecetteRow) => {
    acheterMutation.mutate({
      p_personnage_id: personnageId,
      p_recette_id: recette.id,
    });
  };

  // Avance etape_creation de 8 a 9 cote serveur. Les etapes 5-9 n'ont pas
  // de sauvegarder_etape_N : sans cet appel, le bouton « Suivant » ne ferait
  // que relire etape_creation et resterait bloque sur l'etape courante.
  const avancerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("avancer_etape", {
        p_personnage_id: personnageId,
        p_etape_courante: 8,
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

  // Auto-skip : si l'utilisateur arrive sur l'etape 8 en avancement
  // (etapeCreation === 8) et qu'aucune competence d'artisanat n'est
  // acquise, on fait avancer etape_creation cote serveur immediatement.
  // La garde useRef + etapeCreation === N protege contre le re-trigger
  // et permet la navigation backward.
  const skipDeclencheRef = useRef(false);
  useEffect(() => {
    if (!autoSkipActif) return;
    if (skipDeclencheRef.current) return;
    if (etapeCreation == null || etapeCreation > 8) return;
    if (loadingQuotas) return;
    if (hasAlchimie || hasForge || hasJoaillerie) return;
    if (avancerMutation.isPending) return;
    skipDeclencheRef.current = true;
    avancerMutation.mutate();
  }, [
    autoSkipActif,
    etapeCreation,
    loadingQuotas,
    hasAlchimie,
    hasForge,
    hasJoaillerie,
    avancerMutation,
  ]);

  if (loadingQuotas) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Chargement des quotas d'artisanat…
      </div>
    );
  }

  if (!hasAlchimie && !hasForge && !hasJoaillerie) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">
              Étape 8 — Artisanat
            </CardTitle>
            <CardDescription>
              Aucune compétence d'artisanat acquise — cette étape ne s'applique
              pas à ce personnage.
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

  const tabsCount = [hasAlchimie, hasForge, hasJoaillerie].filter(
    Boolean,
  ).length;
  const defaultTab = hasAlchimie
    ? "alchimie"
    : hasForge
      ? "forge"
      : "joaillerie";

  const mutationsPending = acheterMutation.isPending;
  const xpInsuffisantAlchimie = xpDisponible < COUT_RECETTE_SUPPLEMENTAIRE;
  // Tant qu'il reste des gratuités a consommer, on grise les boutons « Acheter »
  // pour forcer l'utilisateur a epuiser ses gratuites d'abord.
  const aGratuitesRestantesAlchimie = quotaRestant > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Étape 8 — Artisanat
        </h2>
        <p className="text-sm text-muted-foreground">
          Sélectionnez vos recettes gratuites et complétez avec des recettes
          payantes si vous le souhaitez.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList
          className="grid w-full gap-1"
          style={{ gridTemplateColumns: `repeat(${tabsCount}, 1fr)` }}
        >
          {hasAlchimie && (
            <TabsTrigger value="alchimie" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Alchimie
            </TabsTrigger>
          )}
          {hasForge && (
            <TabsTrigger value="forge" className="flex items-center gap-2">
              <Hammer className="h-4 w-4" /> Forge
            </TabsTrigger>
          )}
          {hasJoaillerie && (
            <TabsTrigger value="joaillerie" className="flex items-center gap-2">
              <Gem className="h-4 w-4" /> Joaillerie
            </TabsTrigger>
          )}
        </TabsList>

        {/* Alchimie */}
        {hasAlchimie && (
          <TabsContent value="alchimie" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-heading">
                  Alchimie — niveau {niveauAlchimie}
                </CardTitle>
                <CardDescription>
                  Quota gratuit restant :{" "}
                  <strong
                    className={
                      quotaRestant > 0 ? "text-primary" : "text-amber-400"
                    }
                  >
                    {quotaRestant} / {quotaRecettesTotal}
                  </strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingRecettes || loadingPersoRecettes ? (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Chargement des recettes…
                  </div>
                ) : (recettes ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune recette disponible pour ce niveau.
                  </p>
                ) : (
                  (recettes ?? []).map((recette) => {
                    const estGratuite = recettesGratuitesIds.has(recette.id);
                    const estAchetee = recettesAcheteesIds.has(recette.id);
                    const dejaAcquise = estGratuite || estAchetee;
                    const peutCocherGratuit = estGratuite || quotaRestant > 0;

                    return (
                      <div
                        key={recette.id}
                        className="space-y-2 rounded-lg border border-border p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <strong className="font-heading text-primary">
                              {recette.nom}
                            </strong>
                            {recette.effet && (
                              <p className="text-xs text-muted-foreground">
                                {recette.effet}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 pt-1">
                              {recette.type && (
                                <Badge variant="outline" className="text-xs">
                                  {TYPE_RECETTE_LABELS[recette.type] ??
                                    recette.type}
                                </Badge>
                              )}
                              {recette.niveau_requis != null && (
                                <Badge variant="secondary" className="text-xs">
                                  {NIVEAU_ALCHIMIE_LABELS[
                                    recette.niveau_requis
                                  ] ?? `Niveau ${recette.niveau_requis}`}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <label
                            className={`flex items-center gap-2 text-sm ${
                              !peutCocherGratuit && !estGratuite
                                ? "opacity-50"
                                : ""
                            }`}
                          >
                            <Checkbox
                              checked={estGratuite}
                              disabled={
                                mutationsPending ||
                                dejaAcquise ||
                                quotaRestant <= 0
                              }
                              onCheckedChange={(c) => {
                                if (c === true && !dejaAcquise) {
                                  handleCocherGratuit(recette);
                                }
                              }}
                            />
                            Gratuite
                          </label>

                          {!estGratuite && !estAchetee && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                mutationsPending ||
                                xpInsuffisantAlchimie ||
                                aGratuitesRestantesAlchimie
                              }
                              className={
                                xpInsuffisantAlchimie || aGratuitesRestantesAlchimie
                                  ? "opacity-50"
                                  : ""
                              }
                              title={
                                aGratuitesRestantesAlchimie
                                  ? `Sélectionnez d'abord toutes vos recettes gratuites (${quotaRestant} restante${quotaRestant > 1 ? "s" : ""})`
                                  : xpInsuffisantAlchimie
                                    ? `XP insuffisant (${xpDisponible}/${COUT_RECETTE_SUPPLEMENTAIRE})`
                                    : undefined
                              }
                              onClick={() => handleAcheter(recette)}
                            >
                              Acheter ({COUT_RECETTE_SUPPLEMENTAIRE} XP)
                            </Button>
                          )}

                          {estAchetee && (
                            <Badge className="bg-amber-700/30 text-amber-300">
                              Achetée ({COUT_RECETTE_SUPPLEMENTAIRE} XP)
                            </Badge>
                          )}

                          {estGratuite && (
                            <Badge className="bg-green-700/30 text-green-300">
                              Gratuite sélectionnée
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Forge */}
        {hasForge && (
          <TabsContent value="forge" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-heading">
                      Forge — niveau {niveauForge}
                    </CardTitle>
                    <CardDescription>
                      Liste des objets que vous pouvez fabriquer (lecture
                      seule).
                    </CardDescription>
                  </div>
                  {niveauForge === 3 && (
                    <Badge className="border-[#c9a84c]/40 bg-[#c9a84c]/10 text-[#c9a84c]">
                      <Crown className="mr-1 h-3 w-3" />
                      Droit légendaire
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingForge ? (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Chargement des objets de forge…
                  </div>
                ) : (objetsForge ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun objet de forge disponible.
                  </p>
                ) : (
                  (objetsForge ?? []).map((obj) => (
                    <div
                      key={obj.id}
                      className="space-y-1 rounded-lg border border-border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="font-heading text-primary">
                          {obj.nom}
                        </strong>
                        {obj.type && (
                          <Badge variant="outline">{obj.type}</Badge>
                        )}
                      </div>
                      {obj.description && (
                        <p className="text-xs text-muted-foreground">
                          {obj.description}
                        </p>
                      )}
                      {obj.difficulte != null && (
                        <p className="text-xs text-muted-foreground">
                          Temps de fabrication : {obj.difficulte} min
                        </p>
                      )}
                      {obj.materiaux_communs && (
                        <p className="text-xs">
                          <span className="text-amber-400">
                            Matériaux communs :
                          </span>{" "}
                          {obj.materiaux_communs}
                        </p>
                      )}
                      {obj.materiaux_rares && (
                        <p className="text-xs">
                          <span className="text-purple-400">
                            Matériaux rares :
                          </span>{" "}
                          {obj.materiaux_rares}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Joaillerie */}
        {hasJoaillerie && (
          <TabsContent value="joaillerie" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-heading">
                      Joaillerie — niveau {niveauJoaillerie}
                    </CardTitle>
                    <CardDescription>
                      Liste des pièces que vous pouvez créer (lecture seule).
                    </CardDescription>
                  </div>
                  {niveauJoaillerie === 3 && (
                    <Badge className="border-[#c9a84c]/40 bg-[#c9a84c]/10 text-[#c9a84c]">
                      <Crown className="mr-1 h-3 w-3" />
                      Droit légendaire
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingJoaillerie ? (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Chargement des objets de joaillerie…
                  </div>
                ) : (objetsJoaillerie ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun objet de joaillerie disponible.
                  </p>
                ) : (
                  (objetsJoaillerie ?? []).map((obj) => (
                    <div
                      key={obj.id}
                      className="space-y-1 rounded-lg border border-border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="font-heading text-primary">
                          {obj.nom}
                        </strong>
                      </div>
                      {obj.description && (
                        <p className="text-xs text-muted-foreground">
                          {obj.description}
                        </p>
                      )}
                      {obj.effet && (
                        <p className="text-xs">
                          <span className="font-medium text-foreground">
                            Effet :
                          </span>{" "}
                          {obj.effet}
                        </p>
                      )}
                      {obj.difficulte != null && (
                        <p className="text-xs text-muted-foreground">
                          Temps de fabrication : {obj.difficulte} min
                        </p>
                      )}
                      {obj.materiaux_communs && (
                        <p className="text-xs">
                          <span className="text-amber-400">
                            Matériaux communs :
                          </span>{" "}
                          {obj.materiaux_communs}
                        </p>
                      )}
                      {obj.materiaux_rares && (
                        <p className="text-xs">
                          <span className="text-purple-400">
                            Matériaux rares :
                          </span>{" "}
                          {obj.materiaux_rares}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

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

export default Etape8_Artisanat_V2;
