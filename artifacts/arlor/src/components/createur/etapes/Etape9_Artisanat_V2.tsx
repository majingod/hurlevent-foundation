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
import {
  Loader2,
  Sparkles,
  Hammer,
  Gem,
  Crown,
  Wrench,
  Bomb,
} from "lucide-react";
import { COUT_RECETTE_SUPPLEMENTAIRE } from "@/constants/artisanat";
import { TYPE_RECETTE_LABELS } from "@/constants/labels";

type RecetteRow = Database["public"]["Tables"]["recettes_alchimie"]["Row"];
type ObjetForgeRow = Database["public"]["Tables"]["objets_forge"]["Row"];
type ObjetJoaillerieRow =
  Database["public"]["Tables"]["objets_joaillerie"]["Row"];
type ReparationForgeRow =
  Database["public"]["Tables"]["reparations_forge"]["Row"];
type PersonnageRecetteRow =
  Database["public"]["Tables"]["personnage_recettes"]["Row"];
type PiegeRow = Database["public"]["Tables"]["pieges"]["Row"];
type PersonnagePiegeRow =
  Database["public"]["Tables"]["personnage_pieges"]["Row"];
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

const Etape9_Artisanat_V2 = ({
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

  const niveauAlchimie = quotas?.niveau_alchimie ?? 0;
  const niveauForge = quotas?.niveau_forge ?? 0;
  const niveauJoaillerie = quotas?.niveau_joaillerie ?? 0;

  // Quotas alchimie par niveau (Mineures / Intermédiaires / Majeures)
  // PR 8 — l'UI affiche les quotas séparés au lieu d'un total global trompeur.
  const quotaMineuresTotal = quotas?.quota_alchimie_mineure_total ?? 0;
  const quotaMineuresUtilises = quotas?.quota_alchimie_mineure_utilises ?? 0;
  const quotaIntermediairesTotal = quotas?.quota_alchimie_intermediaire_total ?? 0;
  const quotaIntermediairesUtilises = quotas?.quota_alchimie_intermediaire_utilises ?? 0;
  const quotaMajeuresTotal = quotas?.quota_alchimie_majeure_total ?? 0;
  const quotaMajeuresUtilises = quotas?.quota_alchimie_majeure_utilises ?? 0;

  const quotaMineuresRestant = Math.max(0, quotaMineuresTotal - quotaMineuresUtilises);
  const quotaIntermediairesRestant = Math.max(0, quotaIntermediairesTotal - quotaIntermediairesUtilises);
  const quotaMajeuresRestant = Math.max(0, quotaMajeuresTotal - quotaMajeuresUtilises);

  const getQuotaRestantPourNiveau = (niveauRequis: number): number => {
    if (niveauRequis === 1) return quotaMineuresRestant;
    if (niveauRequis === 2) return quotaIntermediairesRestant;
    if (niveauRequis === 3) return quotaMajeuresRestant;
    return 0;
  };

  const hasAlchimie = niveauAlchimie >= 1;
  const hasForge = niveauForge >= 1;
  const hasJoaillerie = niveauJoaillerie >= 1;

  // Pièges (compétence « Création et désarmement de piège », 3 niveaux).
  // Gate de l'onglet = niveau_pieges >= 1.
  const niveauPieges = quotas?.niveau_pieges ?? 0;
  const hasPieges = niveauPieges >= 1;

  // Quotas gratuits pièges (pools indépendants par palier) :
  // niv 1 comp → 3 pièges niv1 gratuits ; niv 2 → 2 améliorations→niv2 ;
  // niv 3 → 1 amélioration→niv3.
  const quotaPiegesNiv1Total = quotas?.quota_pieges_niv1_total ?? 0;
  const quotaPiegesNiv1Utilises = quotas?.quota_pieges_niv1_utilises ?? 0;
  const quotaPiegesNiv2Total =
    quotas?.quota_pieges_amelioration_niv2_total ?? 0;
  const quotaPiegesNiv2Utilises =
    quotas?.quota_pieges_amelioration_niv2_utilises ?? 0;
  const quotaPiegesNiv3Total =
    quotas?.quota_pieges_amelioration_niv3_total ?? 0;
  const quotaPiegesNiv3Utilises =
    quotas?.quota_pieges_amelioration_niv3_utilises ?? 0;

  const quotaPiegesNiv1Restant = Math.max(
    0,
    quotaPiegesNiv1Total - quotaPiegesNiv1Utilises,
  );
  const quotaPiegesNiv2Restant = Math.max(
    0,
    quotaPiegesNiv2Total - quotaPiegesNiv2Utilises,
  );
  const quotaPiegesNiv3Restant = Math.max(
    0,
    quotaPiegesNiv3Total - quotaPiegesNiv3Utilises,
  );

  // Quota gratuit restant pour le palier VISÉ par une amélioration
  // (niveau actuel + 1).
  const getQuotaPiegeRestantPourPalier = (palierVise: number): number => {
    if (palierVise === 2) return quotaPiegesNiv2Restant;
    if (palierVise === 3) return quotaPiegesNiv3Restant;
    return 0;
  };

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

  // Objets de forge (fabrication)
  const { data: objetsForge, isLoading: loadingForge } = useQuery({
    queryKey: ["objets-forge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("objets_forge")
        .select("*")
        .eq("est_actif", true)
        .order("temps_fabrication_minutes")
        .order("nom");
      if (error) throw error;
      return (data ?? []) as ObjetForgeRow[];
    },
    enabled: hasForge,
  });

  // Réparations forge (PR 6 — Bug 1)
  const { data: reparationsForge, isLoading: loadingReparations } = useQuery({
    queryKey: ["reparations-forge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reparations_forge")
        .select("*")
        .eq("est_actif", true)
        .order("categorie")
        .order("nom_affichage");
      if (error) throw error;
      return (data ?? []) as ReparationForgeRow[];
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
        .order("temps_fabrication_minutes")
        .order("nom");
      if (error) throw error;
      return (data ?? []) as ObjetJoaillerieRow[];
    },
    enabled: hasJoaillerie,
  });

  // Catalogue pièges (27 = 9 familles × 3 niveaux). Toutes les lignes sont
  // récupérées pour connaître les coûts par palier (achat niv1 + montées).
  const { data: piegesCatalogue, isLoading: loadingPiegesCatalogue } = useQuery(
    {
      queryKey: ["pieges-catalogue"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("pieges")
          .select("*")
          .eq("est_actif", true)
          .order("nom")
          .order("niveau");
        if (error) throw error;
        return (data ?? []) as PiegeRow[];
      },
      enabled: hasPieges,
    },
  );

  // Pièges possédés par le personnage (1 ligne par famille, niveau_actuel).
  const { data: personnagePieges, isLoading: loadingPersoPieges } = useQuery({
    queryKey: ["personnage-pieges", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnage_pieges")
        .select("*")
        .eq("personnage_id", personnageId);
      if (error) throw error;
      return (data ?? []) as PersonnagePiegeRow[];
    },
    enabled: !!personnageId && hasPieges,
  });
  const recettesAcquisesParRecetteId = useMemo(() => {
    const map = new Map<string, PersonnageRecetteRow>();
    (personnageRecettes ?? []).forEach((r) => {
      map.set(r.recette_id, r);
    });
    return map;
  }, [personnageRecettes]);

  // Catalogue groupé par famille (nom), trié par niveau croissant à
  // l'intérieur de chaque famille, familles triées alphabétiquement.
  const famillesPieges = useMemo(() => {
    const map = new Map<string, PiegeRow[]>();
    (piegesCatalogue ?? []).forEach((p) => {
      const arr = map.get(p.nom) ?? [];
      arr.push(p);
      map.set(p.nom, arr);
    });
    map.forEach((arr) =>
      arr.sort((a, b) => (a.niveau ?? 0) - (b.niveau ?? 0)),
    );
    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "fr"),
    );
  }, [piegesCatalogue]);

  // Map piege_nom → ligne de possession (pour connaître niveau_actuel + id).
  const piegesPossedesParNom = useMemo(() => {
    const map = new Map<string, PersonnagePiegeRow>();
    (personnagePieges ?? []).forEach((pp) => {
      map.set(pp.piege_nom, pp);
    });
    return map;
  }, [personnagePieges]);

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

  const desacheterMutation = useMutation({
    mutationFn: async (params: {
      p_personnage_recette_id: string;
    }) => {
      const { data, error } = await supabase.rpc("desacheter_recette", params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      toast.success("Recette retirée.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  const handleToggle = (recette: RecetteRow, acquise: PersonnageRecetteRow | undefined) => {
    if (acquise) {
      // Désacheter
      desacheterMutation.mutate({ p_personnage_recette_id: acquise.id });
    } else {
      // Acheter (le serveur décide gratuit vs payant selon quota)
      acheterMutation.mutate({
        p_personnage_id: personnageId,
        p_recette_id: recette.id,
      });
    }
  };

  // --- Mutations pièges (retour enveloppe standard {succes, erreurs, ...}) ---
  // Contrairement à acheter_recette, les RPC pièges renvoient les erreurs
  // métier dans data.succes=false → il faut inspecter le payload.
  const acheterPiegeMutation = useMutation({
    mutationFn: async (params: {
      p_personnage_id: string;
      p_piege_id: string;
    }) => {
      const { data, error } = await supabase.rpc("acheter_piege", params);
      if (error) throw error;
      const payload = (data ?? {}) as Record<string, any>;
      if (payload.succes !== true) {
        throw new Error(
          (payload.erreurs?.[0]?.message as string | undefined) ??
            (payload.erreurs?.[0]?.code as string | undefined) ??
            "Achat du piège impossible.",
        );
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      toast.success("Piège acquis !");
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  const ameliorerPiegeMutation = useMutation({
    mutationFn: async (params: { p_personnage_piege_id: string }) => {
      const { data, error } = await supabase.rpc("ameliorer_piege", params);
      if (error) throw error;
      const payload = (data ?? {}) as Record<string, any>;
      if (payload.succes !== true) {
        throw new Error(
          (payload.erreurs?.[0]?.message as string | undefined) ??
            (payload.erreurs?.[0]?.code as string | undefined) ??
            "Amélioration du piège impossible.",
        );
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      toast.success("Piège amélioré !");
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  const desacheterPiegeMutation = useMutation({
    mutationFn: async (params: { p_personnage_piege_id: string }) => {
      const { data, error } = await supabase.rpc("desacheter_piege", params);
      if (error) throw error;
      const payload = (data ?? {}) as Record<string, any>;
      if (payload.succes !== true) {
        throw new Error(
          (payload.erreurs?.[0]?.message as string | undefined) ??
            (payload.erreurs?.[0]?.code as string | undefined) ??
            "Retrait du piège impossible.",
        );
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      toast.success("Piège retiré.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  const handleAcheterPiege = (famille: PiegeRow[]) => {
    const niv1 = famille.find((p) => p.niveau === 1) ?? famille[0];
    if (!niv1) return;
    acheterPiegeMutation.mutate({
      p_personnage_id: personnageId,
      p_piege_id: niv1.id,
    });
  };

  const handleAmeliorerPiege = (possede: PersonnagePiegeRow) => {
    ameliorerPiegeMutation.mutate({ p_personnage_piege_id: possede.id });
  };

  const handleRetirerPiege = (possede: PersonnagePiegeRow) => {
    desacheterPiegeMutation.mutate({ p_personnage_piege_id: possede.id });
  };

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
  // (etapeCreation === 9) et qu'aucune competence d'artisanat n'est
  // acquise, on fait avancer etape_creation cote serveur immediatement.
  // La garde useRef + etapeCreation === N protege contre le re-trigger
  // et permet la navigation backward.
  const skipDeclencheRef = useRef(false);
  useEffect(() => {
    if (!autoSkipActif) return;
    if (skipDeclencheRef.current) return;
    if (etapeCreation == null || etapeCreation > 9) return;
    if (loadingQuotas) return;
    if (hasAlchimie || hasForge || hasJoaillerie || hasPieges) return;
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
    hasPieges,
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

  if (!hasAlchimie && !hasForge && !hasJoaillerie && !hasPieges) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">
              Étape 9 — Artisanat
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

  const tabsCount = [hasAlchimie, hasPieges, hasForge, hasJoaillerie].filter(
    Boolean,
  ).length;
  const defaultTab = hasAlchimie
    ? "alchimie"
    : hasPieges
      ? "pieges"
      : hasForge
        ? "forge"
        : "joaillerie";

  const mutationsPending = acheterMutation.isPending || desacheterMutation.isPending;
  const mutationsPiegesPending =
    acheterPiegeMutation.isPending ||
    ameliorerPiegeMutation.isPending ||
    desacheterPiegeMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Étape 9 — Artisanat
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
          {hasPieges && (
            <TabsTrigger value="pieges" className="flex items-center gap-2">
              <Bomb className="h-4 w-4" /> Pièges
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
                <div className="space-y-1 text-sm text-muted-foreground">
                    {niveauAlchimie >= 1 && (
                      <div>
                        Mineures gratuites :{" "}
                        <strong
                          className={
                            quotaMineuresRestant > 0
                              ? "text-primary"
                              : "text-amber-400"
                          }
                        >
                          {quotaMineuresUtilises} / {quotaMineuresTotal}
                        </strong>
                      </div>
                    )}
                    {niveauAlchimie >= 2 && (
                      <div>
                        Intermédiaires gratuites :{" "}
                        <strong
                          className={
                            quotaIntermediairesRestant > 0
                              ? "text-primary"
                              : "text-amber-400"
                          }
                        >
                          {quotaIntermediairesUtilises} / {quotaIntermediairesTotal}
                        </strong>
                      </div>
                    )}
                    {niveauAlchimie >= 3 && (
                      <div>
                        Majeures gratuites :{" "}
                        <strong
                          className={
                            quotaMajeuresRestant > 0
                              ? "text-primary"
                              : "text-amber-400"
                          }
                        >
                          {quotaMajeuresUtilises} / {quotaMajeuresTotal}
                        </strong>
                      </div>
                    )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
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
                  [1, 2, 3].map((niveau) => {
                    if (niveau > niveauAlchimie) return null;
                    const recettesNiveau = (recettes ?? []).filter(
                      (r) => r.niveau_requis === niveau,
                    );
                    if (recettesNiveau.length === 0) return null;
                    const label =
                      niveau === 1
                        ? "Mineures"
                        : niveau === 2
                          ? "Intermédiaires"
                          : "Majeures";
                    const quotaTotal =
                      niveau === 1
                        ? quotaMineuresTotal
                        : niveau === 2
                          ? quotaIntermediairesTotal
                          : quotaMajeuresTotal;
                    const quotaUtilises =
                      niveau === 1
                        ? quotaMineuresUtilises
                        : niveau === 2
                          ? quotaIntermediairesUtilises
                          : quotaMajeuresUtilises;

                    return (
                      <div key={niveau} className="space-y-3">
                        <h3 className="text-sm font-semibold text-foreground">
                          {label} (Niv. {niveau}) — {quotaUtilises}/
                          {quotaTotal} gratuites
                        </h3>
                        <div className="space-y-3">
                          {recettesNiveau.map((recette) => {
                            const acquise = recettesAcquisesParRecetteId.get(
                              recette.id,
                            );
                            const estAcquise = !!acquise;
                            const estGratuite = acquise?.est_gratuit ?? false;
                            const quotaRestantNiveau = getQuotaRestantPourNiveau(
                              recette.niveau_requis ?? 0,
                            );
                            const seraGratuite =
                              !estAcquise && quotaRestantNiveau > 0;
                            const xpInsuffisants =
                              !seraGratuite &&
                              !estAcquise &&
                              COUT_RECETTE_SUPPLEMENTAIRE > xpDisponible;

                            return (
                              <div
                                key={recette.id}
                                className={`space-y-2 rounded-lg border p-3 transition-colors ${
                                  estAcquise
                                    ? "border-primary/50 bg-primary/5"
                                    : "border-border"
                                }`}
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
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          {TYPE_RECETTE_LABELS[recette.type] ??
                                            recette.type}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 pt-1">
                                  <label
                                    className={`flex items-center gap-2 text-sm ${xpInsuffisants ? "opacity-50" : ""}`}
                                    title={
                                      xpInsuffisants
                                        ? `XP insuffisants (manque ${COUT_RECETTE_SUPPLEMENTAIRE - xpDisponible} XP)`
                                        : undefined
                                    }
                                  >
                                    <Checkbox
                                      checked={estAcquise}
                                      disabled={
                                        mutationsPending || xpInsuffisants
                                      }
                                      onCheckedChange={() =>
                                        handleToggle(recette, acquise)
                                      }
                                    />
                                    {estAcquise
                                      ? estGratuite
                                        ? "Sélectionnée (Gratuite)"
                                        : `Sélectionnée (${COUT_RECETTE_SUPPLEMENTAIRE} XP)`
                                      : seraGratuite
                                        ? "Sélectionner (Gratuite)"
                                        : `Sélectionner (${COUT_RECETTE_SUPPLEMENTAIRE} XP)`}
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Pièges — carte par famille, montée de palier (s60) */}
        {hasPieges && (
          <TabsContent value="pieges" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-heading">
                  Pièges — niveau {niveauPieges}
                </CardTitle>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {niveauPieges >= 1 && (
                    <div>
                      Pièges niv 1 gratuits :{" "}
                      <strong
                        className={
                          quotaPiegesNiv1Restant > 0
                            ? "text-primary"
                            : "text-amber-400"
                        }
                      >
                        {quotaPiegesNiv1Utilises} / {quotaPiegesNiv1Total}
                      </strong>
                    </div>
                  )}
                  {niveauPieges >= 2 && (
                    <div>
                      Améliorations → niv 2 gratuites :{" "}
                      <strong
                        className={
                          quotaPiegesNiv2Restant > 0
                            ? "text-primary"
                            : "text-amber-400"
                        }
                      >
                        {quotaPiegesNiv2Utilises} / {quotaPiegesNiv2Total}
                      </strong>
                    </div>
                  )}
                  {niveauPieges >= 3 && (
                    <div>
                      Améliorations → niv 3 gratuites :{" "}
                      <strong
                        className={
                          quotaPiegesNiv3Restant > 0
                            ? "text-primary"
                            : "text-amber-400"
                        }
                      >
                        {quotaPiegesNiv3Utilises} / {quotaPiegesNiv3Total}
                      </strong>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingPiegesCatalogue || loadingPersoPieges ? (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Chargement des pièges…
                  </div>
                ) : famillesPieges.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun piège disponible.
                  </p>
                ) : (
                  famillesPieges.map(([nom, niveaux]) => {
                    const possede = piegesPossedesParNom.get(nom);
                    const niveauActuel = possede?.niveau_actuel ?? 0;
                    const niv1 =
                      niveaux.find((p) => p.niveau === 1) ?? niveaux[0];
                    // Ligne affichée = niveau possédé, sinon niv 1.
                    const ligneAffichee =
                      niveaux.find((p) => p.niveau === niveauActuel) ?? niv1;
                    // Construction = matériaux niv 1 (peuplé niv 1 seulement).
                    const construction = niv1?.construction ?? null;

                    // NON POSSÉDÉ : bouton Sélectionner (achat niv 1).
                    const coutNiv1 = niv1?.cout_xp ?? 0;
                    const seraGratuitAchat = quotaPiegesNiv1Restant > 0;
                    const xpInsuffisantAchat =
                      !seraGratuitAchat && coutNiv1 > xpDisponible;

                    // POSSÉDÉ < 3 : bouton Améliorer (palier visé).
                    const palierVise = niveauActuel + 1;
                    const ligneSuivante = niveaux.find(
                      (p) => p.niveau === palierVise,
                    );
                    const coutPalier = ligneSuivante?.cout_xp ?? 0;
                    const quotaPalierRestant =
                      getQuotaPiegeRestantPourPalier(palierVise);
                    const seraGratuitAmel = quotaPalierRestant > 0;
                    const xpInsuffisantAmel =
                      !seraGratuitAmel && coutPalier > xpDisponible;

                    const estPossede = niveauActuel >= 1;
                    const estMax = niveauActuel >= 3;

                    return (
                      <div
                        key={nom}
                        className={`space-y-2 rounded-lg border p-3 transition-colors ${
                          estPossede
                            ? "border-primary/50 bg-primary/5"
                            : "border-border"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <strong className="font-heading text-primary">
                                {nom}
                              </strong>
                              {estPossede && (
                                <Badge variant="secondary" className="text-xs">
                                  Niveau {niveauActuel}
                                  {estMax ? " (max)" : ""}
                                </Badge>
                              )}
                            </div>
                            {ligneAffichee?.effets && (
                              <p className="text-xs text-muted-foreground">
                                {ligneAffichee.effets}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 pt-1">
                              {ligneAffichee?.cible && (
                                <Badge variant="outline" className="text-xs">
                                  Cible : {ligneAffichee.cible}
                                </Badge>
                              )}
                              {ligneAffichee?.duree && (
                                <Badge variant="outline" className="text-xs">
                                  Durée : {ligneAffichee.duree}
                                </Badge>
                              )}
                              {estPossede &&
                                (possede?.xp_depense ?? 0) > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {possede?.xp_depense} XP dépensés
                                  </Badge>
                                )}
                            </div>
                            {construction && (
                              <p className="text-xs">
                                <span className="text-amber-400">
                                  Construction :
                                </span>{" "}
                                {construction}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {!estPossede && (
                            <Button
                              size="sm"
                              disabled={
                                mutationsPiegesPending || xpInsuffisantAchat
                              }
                              onClick={() => handleAcheterPiege(niveaux)}
                              title={
                                xpInsuffisantAchat
                                  ? `XP insuffisants (manque ${coutNiv1 - xpDisponible} XP)`
                                  : undefined
                              }
                            >
                              {seraGratuitAchat
                                ? "Sélectionner (Gratuit)"
                                : `Sélectionner (${coutNiv1} XP)`}
                            </Button>
                          )}

                          {estPossede && !estMax && (
                            <Button
                              size="sm"
                              disabled={
                                mutationsPiegesPending || xpInsuffisantAmel
                              }
                              onClick={() =>
                                possede && handleAmeliorerPiege(possede)
                              }
                              title={
                                xpInsuffisantAmel
                                  ? `XP insuffisants (manque ${coutPalier - xpDisponible} XP)`
                                  : undefined
                              }
                            >
                              {seraGratuitAmel
                                ? `Améliorer → niv ${palierVise} (Gratuit)`
                                : `Améliorer → niv ${palierVise} (${coutPalier} XP)`}
                            </Button>
                          )}

                          {estPossede && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={mutationsPiegesPending}
                              onClick={() =>
                                possede && handleRetirerPiege(possede)
                              }
                            >
                              Retirer
                            </Button>
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

        {/* Forge — avec sous-onglets Fabrication / Réparation (PR 6 — Bug 1) */}
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
                      Liste des objets que vous pouvez fabriquer et réparer
                      (lecture seule).
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
              <CardContent>
                <Tabs defaultValue="fabrication" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger
                      value="fabrication"
                      className="flex items-center gap-2"
                    >
                      <Hammer className="h-4 w-4" /> Fabrication
                    </TabsTrigger>
                    <TabsTrigger
                      value="reparation"
                      className="flex items-center gap-2"
                    >
                      <Wrench className="h-4 w-4" /> Réparation
                    </TabsTrigger>
                  </TabsList>

                  {/* Sous-onglet Fabrication */}
                  <TabsContent
                    value="fabrication"
                    className="mt-4 space-y-3"
                  >
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
                          {obj.temps_fabrication_minutes != null && (
                            <p className="text-xs text-muted-foreground">
                              Temps de fabrication : {obj.temps_fabrication_minutes} min
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
                          {niveauForge >= 2 && obj.materiaux_rares && (
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
                  </TabsContent>

                  {/* Sous-onglet Réparation */}
                  <TabsContent value="reparation" className="mt-4 space-y-3">
                    {loadingReparations ? (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Chargement des réparations…
                      </div>
                    ) : (reparationsForge ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Aucune réparation disponible.
                      </p>
                    ) : (
                      (reparationsForge ?? []).map((rep) => (
                        <div
                          key={rep.id}
                          className="space-y-1 rounded-lg border border-border p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong className="font-heading text-primary">
                              {rep.nom_affichage}
                            </strong>
                            {rep.categorie && (
                              <Badge variant="outline">{rep.categorie}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Temps commun : {rep.temps_minutes} min
                            {niveauForge >= 2 &&
                              rep.temps_rare_minutes != null && (
                                <>
                                  {" — "}
                                  Temps rare : {rep.temps_rare_minutes} min
                                </>
                              )}
                          </p>
                          {rep.materiaux && (
                            <p className="text-xs">
                              <span className="text-amber-400">
                                Matériaux communs :
                              </span>{" "}
                              {rep.materiaux}
                            </p>
                          )}
                          {niveauForge >= 2 && rep.materiaux_rares && (
                            <p className="text-xs">
                              <span className="text-purple-400">
                                Matériaux rares :
                              </span>{" "}
                              {rep.materiaux_rares}
                            </p>
                          )}
                          {rep.notes && (
                            <p className="text-xs italic text-muted-foreground">
                              {rep.notes}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </TabsContent>
                </Tabs>
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
                      {obj.temps_fabrication_minutes != null && (
                        <p className="text-xs text-muted-foreground">
                          Temps de fabrication : {obj.temps_fabrication_minutes} min
                          {niveauJoaillerie >= 2 &&
                            obj.temps_rare_minutes != null && (
                              <>
                                {" (commun) — "}
                                {obj.temps_rare_minutes} min (rare)
                              </>
                            )}
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
                      {niveauJoaillerie >= 2 && obj.materiaux_rares && (
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

export default Etape9_Artisanat_V2;
