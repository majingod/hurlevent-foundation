import { useEffect, useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Sparkles,
  Hammer,
  Gem,
  Crown,
  Wrench,
  Bomb,
  Lock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { COUT_RECETTE_SUPPLEMENTAIRE } from "@/constants/artisanat";
import { SectionAlchimieAccordion } from "./SectionAlchimieAccordion";
import { BadgeAcquis } from "@/components/createur/BadgeAcquis";
import { LabelAjoutAnnulable } from "@/components/createur/LabelAjoutAnnulable";
import { useDernierePhotoCompo } from "@/hooks/useDernierePhotoCompo";
import { estRecetteAcquise, estPiegeAcquis } from "@/lib/acquisCampagne";

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

/**
 * Contexte de la modale de confirmation de cascade (décochage d'un palier de
 * piège). Miroir du `CascadeContext` de l'étape 5 : décocher le palier N d'une
 * famille supprime N + tous les paliers supérieurs (cascade ascendante DB) et
 * rembourse uniquement les paliers payés.
 */
interface CascadePiegeContext {
  piegeNom: string;
  cible: PersonnagePiegeRow;
  paliersAnnules: PersonnagePiegeRow[];
  xpTotalRembourse: number;
}

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
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onPrevious?: () => void;
  /**
   * Mode campagne (évolution) : verrouille visuellement le désachat des
   * recettes et paliers de pièges acquis (PR-C2). Miroir d'INV-3 backend,
   * qui reste l'autorité.
   */
  modeCampagne?: boolean;
}

const Etape9_Artisanat_V2 = ({
  personnageId,
  etapeCreation,
  xpDisponible = 0,
  onSuccess,
  onError,
  onPrevious,
  modeCampagne = false,
}: Etape9Props) => {
  const queryClient = useQueryClient();

  // PR-C2 : photo de compo (frontière des acquis). Fetch seulement en campagne
  // (une seule fois pour les deux sections recettes + pièges).
  const { data: photo } = useDernierePhotoCompo(personnageId, modeCampagne);

  // Modale de confirmation de cascade (décochage d'un palier de piège).
  const [cascadePiege, setCascadePiege] = useState<CascadePiegeContext | null>(
    null,
  );
  // Familles dont le détail verbatim des 3 niveaux est déplié (densité C).
  const [famillesDepliees, setFamillesDepliees] = useState<Set<string>>(
    new Set(),
  );

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

  // Quota gratuit restant pour un niveau de palier donné (1, 2 ou 3).
  const quotaPiegeRestantPourNiveau = (niveau: number): number => {
    if (niveau === 1) return quotaPiegesNiv1Restant;
    if (niveau === 2) return quotaPiegesNiv2Restant;
    if (niveau === 3) return quotaPiegesNiv3Restant;
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

  // Pièges possédés par le personnage (post-PR-2 : 1 ligne par palier acquis).
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

  // Map piege_nom → Map<niveau_acquis, ligne de possession>.
  // Post-PR-2 : 1 ligne par palier acquis (miroir personnage_competences).
  const paliersParFamille = useMemo(() => {
    const map = new Map<string, Map<number, PersonnagePiegeRow>>();
    (personnagePieges ?? []).forEach((pp) => {
      const inner =
        map.get(pp.piege_nom) ?? new Map<number, PersonnagePiegeRow>();
      inner.set(pp.niveau_acquis, pp);
      map.set(pp.piege_nom, inner);
    });
    return map;
  }, [personnagePieges]);

  // Niveau de palier le plus haut acquis pour une famille (0 si aucun).
  const maxAcquisPourFamille = (nom: string): number => {
    const inner = paliersParFamille.get(nom);
    if (!inner || inner.size === 0) return 0;
    return Math.max(...Array.from(inner.keys()));
  };

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
      // PR-C2 : garde défensive — une recette scellée par la photo ne peut
      // être retirée (le backend INV-3 refuserait de toute façon).
      if (estRecetteAcquise(modeCampagne, photo, recette.id)) {
        toast.error(
          "Cet acquis a été joué en événement — il ne peut plus être retiré.",
        );
        return;
      }
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

  // Achat d'un palier précis (niveau 1/2/3) d'une famille. Le coût XP est
  // calculé en interne par la RPC ; on ne transmet que l'id du palier visé.
  const handleAcheterPiege = (paliersCatalogue: PiegeRow[], niveau: number) => {
    const palier = paliersCatalogue.find((p) => p.niveau === niveau);
    if (!palier) return;
    acheterPiegeMutation.mutate({
      p_personnage_id: personnageId,
      p_piege_id: palier.id,
    });
  };

  // Décochage d'un palier. La DB (desacheter_piege) supprime ce palier + tous
  // les paliers supérieurs de la même famille (cascade ascendante) et rembourse
  // uniquement les paliers payés. Si >1 palier sera supprimé → modale de
  // confirmation (miroir cascadeDialog étape 5). Un palier gratuit reste
  // décochable (la DB ne le bloque pas).
  const handleDecocherPiege = (nom: string, niveau: number) => {
    // PR-C2 : garde défensive — un palier scellé par la photo ne peut être
    // retiré (le backend INV-3 refuserait de toute façon).
    if (estPiegeAcquis(modeCampagne, photo, nom, niveau)) {
      toast.error(
        "Cet acquis a été joué en événement — il ne peut plus être retiré.",
      );
      return;
    }
    const inner = paliersParFamille.get(nom);
    const cible = inner?.get(niveau);
    if (!inner || !cible) return;
    const aSupprimer = Array.from(inner.values()).filter(
      (pp) => pp.niveau_acquis >= niveau,
    );
    if (aSupprimer.length <= 1) {
      desacheterPiegeMutation.mutate({ p_personnage_piege_id: cible.id });
      return;
    }
    const xpRembourse = aSupprimer.reduce(
      (s, pp) => s + (pp.xp_depense ?? 0),
      0,
    );
    setCascadePiege({
      piegeNom: nom,
      cible,
      paliersAnnules: aSupprimer.sort(
        (a, b) => a.niveau_acquis - b.niveau_acquis,
      ),
      xpTotalRembourse: xpRembourse,
    });
  };

  const confirmCascadePiege = () => {
    if (!cascadePiege) return;
    desacheterPiegeMutation.mutate({
      p_personnage_piege_id: cascadePiege.cible.id,
    });
    setCascadePiege(null);
  };

  const toggleFamilleDepliee = (nom: string) => {
    setFamillesDepliees((prev) => {
      const next = new Set(prev);
      if (next.has(nom)) next.delete(nom);
      else next.add(nom);
      return next;
    });
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
    acheterPiegeMutation.isPending || desacheterPiegeMutation.isPending;

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
              </CardHeader>
              <CardContent>
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
                  <SectionAlchimieAccordion
                    niveauAlchimie={niveauAlchimie}
                    recettes={recettes ?? []}
                    recettesAcquisesParRecetteId={recettesAcquisesParRecetteId}
                    quotaParNiveau={{
                      1: { total: quotaMineuresTotal, utilises: quotaMineuresUtilises },
                      2: { total: quotaIntermediairesTotal, utilises: quotaIntermediairesUtilises },
                      3: { total: quotaMajeuresTotal, utilises: quotaMajeuresUtilises },
                    }}
                    getQuotaRestantPourNiveau={getQuotaRestantPourNiveau}
                    xpDisponible={xpDisponible}
                    coutSupplementaire={COUT_RECETTE_SUPPLEMENTAIRE}
                    mutationsPending={mutationsPending}
                    onToggle={handleToggle}
                    estRecetteScellee={(recetteId) =>
                      estRecetteAcquise(modeCampagne, photo, recetteId)
                    }
                    modeCampagne={modeCampagne}
                  />
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
                    const maxAcquis = maxAcquisPourFamille(nom);
                    const estPossede = maxAcquis >= 1;
                    const depliee = famillesDepliees.has(nom);
                    // Ligne catalogue du palier le plus haut acquis (détail
                    // verbatim toujours visible), sinon niv 1.
                    const ligneHaute =
                      niveaux.find((p) => p.niveau === maxAcquis) ??
                      niveaux.find((p) => p.niveau === 1) ??
                      niveaux[0];
                    const construction =
                      niveaux.find((p) => p.niveau === 1)?.construction ?? null;

                    return (
                      <div
                        key={nom}
                        className={`space-y-3 rounded-lg border p-3 transition-colors ${
                          estPossede
                            ? "border-primary/50 bg-primary/5"
                            : "border-border"
                        }`}
                      >
                        {/* En-tête famille */}
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="font-heading text-primary">
                            {nom}
                          </strong>
                          {estPossede && (
                            <Badge variant="secondary" className="text-xs">
                              Niveau {maxAcquis}
                              {maxAcquis >= 3 ? " (max)" : ""}
                            </Badge>
                          )}
                        </div>

                        {/* Cases à cocher par niveau (grisage séquentiel) */}
                        <div className="space-y-2">
                          {niveaux.map((palier) => {
                            const niv = palier.niveau ?? 0;
                            const acquis =
                              paliersParFamille.get(nom)?.has(niv) ?? false;
                            const ligneAcquise =
                              paliersParFamille.get(nom)?.get(niv) ?? null;
                            const niveauPrecedentRequis =
                              niv > 1 && niv - 1 > maxAcquis;
                            const cout = palier.cout_xp ?? 0;
                            const seraGratuit =
                              quotaPiegeRestantPourNiveau(niv) > 0;
                            const xpInsuffisant =
                              !acquis && !seraGratuit && cout > xpDisponible;
                            // PR-C2 : palier scellé par la photo (désachat refusé).
                            const scelle = estPiegeAcquis(
                              modeCampagne,
                              photo,
                              nom,
                              niv,
                            );
                            const disabled = acquis
                              ? mutationsPiegesPending || scelle
                              : niveauPrecedentRequis ||
                                mutationsPiegesPending ||
                                xpInsuffisant;
                            return (
                              <div
                                key={niv}
                                className={`flex flex-wrap items-center gap-3 rounded border p-2 ${
                                  scelle
                                    ? "border-gold/60 border-l-4 border-l-gold bg-gold/15"
                                    : acquis && modeCampagne
                                      ? "border-emerald-600/40 bg-emerald-600/10"
                                      : "border-border"
                                } ${
                                  !scelle && niveauPrecedentRequis && !acquis
                                    ? "opacity-50"
                                    : ""
                                }`}
                              >
                                <Checkbox
                                  id={`piege-${nom}-${niv}`}
                                  checked={acquis}
                                  disabled={disabled}
                                  title={
                                    xpInsuffisant
                                      ? `XP insuffisants (manque ${cout - xpDisponible} XP)`
                                      : undefined
                                  }
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      handleAcheterPiege(niveaux, niv);
                                    } else {
                                      handleDecocherPiege(nom, niv);
                                    }
                                  }}
                                />
                                <Label
                                  htmlFor={`piege-${nom}-${niv}`}
                                  className="flex-1 cursor-pointer space-y-1 text-xs"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <strong>Niveau {niv}</strong>
                                    {scelle && <BadgeAcquis />}
                                    {!scelle && acquis && modeCampagne && (
                                      <LabelAjoutAnnulable />
                                    )}
                                    {acquis && ligneAcquise?.est_gratuit ? (
                                      <Badge className="border border-green-600/30 bg-green-600/20 text-xs text-green-400">
                                        Acquis gratuitement
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {seraGratuit && !acquis
                                          ? "Gratuit"
                                          : `${cout} XP`}
                                      </Badge>
                                    )}
                                    {palier.niveau_effet != null && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        Effet de niveau {palier.niveau_effet}
                                      </Badge>
                                    )}
                                  </div>
                                  {niveauPrecedentRequis && !acquis && (
                                    <p className="flex items-center gap-1 text-muted-foreground">
                                      <Lock className="h-3 w-3" />
                                      Acheter d'abord le niveau {niv - 1}
                                    </p>
                                  )}
                                </Label>
                              </div>
                            );
                          })}
                        </div>

                        {/* Détail verbatim du palier le plus haut acquis */}
                        {estPossede && ligneHaute && (
                          <div className="space-y-1 rounded border border-border/60 bg-background/40 p-2 text-xs">
                            <div className="flex flex-wrap gap-2">
                              {ligneHaute.cible && (
                                <Badge variant="outline" className="text-xs">
                                  Cible : {ligneHaute.cible}
                                </Badge>
                              )}
                              {ligneHaute.duree && (
                                <Badge variant="outline" className="text-xs">
                                  Durée : {ligneHaute.duree}
                                </Badge>
                              )}
                            </div>
                            {ligneHaute.effets && (
                              <p className="text-muted-foreground">
                                {ligneHaute.effets}
                              </p>
                            )}
                            {construction && (
                              <p>
                                <span className="text-amber-400">
                                  Construction :
                                </span>{" "}
                                {construction}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Toggle « Voir le détail des 3 niveaux » (densité C) */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto px-1 py-1 text-xs text-muted-foreground"
                          onClick={() => toggleFamilleDepliee(nom)}
                        >
                          {depliee ? (
                            <ChevronDown className="mr-1 h-3 w-3" />
                          ) : (
                            <ChevronRight className="mr-1 h-3 w-3" />
                          )}
                          {depliee
                            ? "Masquer le détail des 3 niveaux"
                            : "Voir le détail des 3 niveaux"}
                        </Button>

                        {depliee && (
                          <div className="space-y-2 border-l-2 border-border pl-3">
                            {niveaux.map((palier) => (
                              <div
                                key={`detail-${palier.niveau}`}
                                className="space-y-1 text-xs"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <strong>Niveau {palier.niveau}</strong>
                                  {palier.niveau_effet != null && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      Effet de niveau {palier.niveau_effet}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {palier.cible && (
                                    <Badge variant="outline" className="text-xs">
                                      Cible : {palier.cible}
                                    </Badge>
                                  )}
                                  {palier.duree && (
                                    <Badge variant="outline" className="text-xs">
                                      Durée : {palier.duree}
                                    </Badge>
                                  )}
                                </div>
                                {palier.effets && (
                                  <p className="text-muted-foreground">
                                    {palier.effets}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
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

      {/* Modale de confirmation cascade — décochage d'un palier de piège */}
      <Dialog
        open={!!cascadePiege}
        onOpenChange={(open) => {
          if (!open) setCascadePiege(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler ce piège ?</DialogTitle>
            <DialogDescription>
              {cascadePiege && (
                <>
                  Annuler le niveau {cascadePiege.cible.niveau_acquis} de{" "}
                  <strong>{cascadePiege.piegeNom}</strong> annulera aussi tous
                  les niveaux supérieurs de ce piège.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {cascadePiege && (
            <div className="space-y-2 py-2 text-sm">
              <p className="font-semibold">
                Paliers qui seront annulés (
                {cascadePiege.paliersAnnules.length}) :
              </p>
              <ul className="ml-4 list-disc space-y-1 text-xs">
                {cascadePiege.paliersAnnules.map((pp) => (
                  <li key={pp.id}>
                    Niveau {pp.niveau_acquis} —{" "}
                    {pp.est_gratuit
                      ? "gratuit"
                      : `${pp.xp_depense} XP remboursés`}
                  </li>
                ))}
              </ul>
              <p className="pt-2 font-semibold text-green-500">
                Total remboursé : {cascadePiege.xpTotalRembourse} XP
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCascadePiege(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCascadePiege}
              disabled={mutationsPiegesPending}
            >
              {mutationsPiegesPending && (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              )}
              Confirmer l'annulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
