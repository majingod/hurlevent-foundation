import { useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { clientActif } from "@/creation/clientActif";
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
import { ChevronRight, Loader2, Lock, Sparkles, Trash2 } from "lucide-react";
import ConstructeurMagie, {
  type ValeursConstructeur,
  type PlancherMagie,
} from "@/components/createur/ConstructeurMagie";
import { PastilleType } from "@/components/shared/PastilleType";
import JaugeXP, { type CoutEnCours } from "@/components/createur/aide/JaugeXP";
import IntroEtape, {
  IntroEtapeItem,
} from "@/components/createur/aide/IntroEtape";
import LegendeDynamique from "@/components/createur/magie/LegendeDynamique";
import { TapBulle, useTapBulle } from "@/components/createur/aide/TapBulle";
import Astuce from "@/components/createur/aide/Astuce";
import BasculeAbregeIntegral from "@/components/shared/BasculeAbregeIntegral";
import ErreurChargement from "@/components/shared/ErreurChargement";
import { useModeAffichage } from "@/contexts/ModeAffichageContext";
import { AvantApres } from "@/components/createur/magie/ApercuEffet";
import FiltreTypeMagie from "@/components/createur/magie/FiltreTypeMagie";
import { useDernierePhotoCompo } from "@/hooks/useDernierePhotoCompo";
import { estSortAcquis, plancherInstanceSort } from "@/lib/acquisCampagne";
import { texteIndisponibleSorts } from "./textePorteMagique";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { COUT_ZONE, DUREES, PORTEES, ZONES_PAR_TYPE } from "@/constants/magie";
import {
  calculerCoutPS,
  calculerCoutXP,
  coutXpMaxAutorise,
  filterDureesDisponibles,
  filterPorteesDisponibles,
  isZoneUnique,
  type BonusNiveau,
  type EffetInstance,
  type PalierSort,
} from "@/utils/calculsMagie";

type SortRow = Database["public"]["Tables"]["sorts"]["Row"];
/** sorts.effet_instance (s162) absent des types générés — cast local, comme
 *  paliers (on ne régénère pas les types Supabase pour ces colonnes jsonb). */
type SortCatalogue = SortRow & { effet_instance?: EffetInstance | null };
type PersonnageSortRow = Database["public"]["Tables"]["personnage_sorts"]["Row"];
type CercleDispo =
  Database["public"]["Views"]["vue_cercles_disponibles"]["Row"];

/** Join sorts(...) du select personnage_sorts — + type_sort, effet_instance (s171). */
interface SortJoint {
  nom: string | null;
  cercle: string | null;
  zone_effet: string | null;
  portee: string | null;
  duree: string | null;
  cout_xp_base: number | null;
  bonus_niveau: BonusNiveau | null;
  description_tronc: string | null;
  resume_condense: string | null;
  description: string | null;
  paliers: unknown;
  type_sort: string | null;
  effet_instance: unknown;
}
type AchatSort = PersonnageSortRow & { sorts: SortJoint | null };

interface Etape6Props {
  personnageId: string;
  /**
   * XP encore disponibles pour le personnage (xp_total - xp_depense).
   * Sert au grisage UI du bouton d'achat quand le budget est insuffisant.
   * Le serveur reste l'arbitre final de la validation.
   */
  xpDisponible?: number;
  /** [MAGIE-PLAFOND] Niveau du PERSONNAGE : plafonne le prix d'une instance. */
  niveauPersonnage?: number;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onPrevious?: () => void;
  /**
   * Mode campagne (évolution) : verrouille visuellement le désachat des sorts
   * acquis (PR-C2). Miroir d'INV-3 backend, qui reste l'autorité.
   */
  modeCampagne?: boolean;
}

interface AcheterSortParams {
  p_personnage_id: string;
  p_sort_id: string;
  p_zone_choisie: string;
  p_portee_choisie: string;
  p_duree_choisie: string;
  p_niveau_sort: number;
  p_nom_personnalise: string;
}

// Préfixe localStorage paramétrable (réutilisation É7 : « hv-e7 »).
const PREFIXE_LS = "hv-e6";

// Coût pts par variable — mêmes barèmes que ConstructeurMagie / cout_pts_* SQL.
const ptsZone = (zone: string) => COUT_ZONE[zone] ?? 0;
const ptsPortee = (portee: string) =>
  PORTEES.find((p) => p.label === portee)?.cout ?? 0;
const ptsDuree = (duree: string) =>
  DUREES.find((d) => d.label === duree)?.cout ?? 0;

// L2 : textes d'aide des pastilles de type (tap → TapBulle).
const AIDE_TYPES: Record<string, { libelle: string; texte: string }> = {
  "effet bénéfique": {
    libelle: "Bénéfique",
    texte: "Sort qui avantage ses cibles (protection, soin, bonus).",
  },
  effet: {
    libelle: "Effet",
    texte: "Sort qui altère ou contraint ses cibles sans infliger de dégâts.",
  },
  "dégâts": {
    libelle: "Dégâts",
    texte: "Sort qui inflige des dégâts.",
  },
};

// Ordre canonique des types pour la légende.
const ORDRE_TYPES = ["effet bénéfique", "effet", "dégâts"];

const Chevron = ({
  ouvert,
  className = "",
}: {
  ouvert: boolean;
  className?: string;
}) => (
  <ChevronRight
    className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
      ouvert ? "rotate-90" : ""
    } ${className}`}
  />
);

const Etape6_Sorts_V2 = ({
  personnageId,
  xpDisponible = 0,
  niveauPersonnage = 1,
  onSuccess,
  onError,
  onPrevious,
  modeCampagne = false,
}: Etape6Props) => {
  const queryClient = useQueryClient();

  // PR-C2 : photo de compo (frontière des acquis). Fetch seulement en campagne.
  const { data: photo } = useDernierePhotoCompo(personnageId, modeCampagne);

  // Accordéons en état manuel (pattern É5 / maquette useSet) — PAS de Radix
  // Accordion : enfants interactifs → bug connu.
  const [cerclesOuverts, setCerclesOuverts] = useState<Set<string>>(new Set());
  const { mode, toggleMode } = useModeAffichage();
  const [cerclesAchetesOuverts, setCerclesAchetesOuverts] = useState<
    Set<string>
  >(new Set());
  const [sectionAchetesOuverte, setSectionAchetesOuverte] = useState(true);
  // Un seul sort du catalogue ouvert à la fois (radio).
  const [sortOuvertId, setSortOuvertId] = useState<string | null>(null);
  const [valeursAchat, setValeursAchat] = useState<ValeursConstructeur>({
    zone: "",
    portee: "",
    duree: "",
    niveau: 1,
    nom: "",
  });
  // Une seule instance possédée ouverte à la fois — ouverte = en modification.
  const [instanceOuverteId, setInstanceOuverteId] = useState<string | null>(
    null,
  );
  const [valeursModif, setValeursModif] = useState<ValeursConstructeur | null>(
    null,
  );
  // I7 : filtre par type, indépendant par cercle.
  const [filtres, setFiltres] = useState<Record<string, string | null>>({});
  type RepriseRabais = {
    competence: string;
    niveau: number;
    choix: string;
    montant: number;
  };
  type ApercuDesachat = {
    type: "sort" | "priere";
    nom: string;
    cercle?: string;
    domaine?: string;
    xp_rembourse: number;
    reprises: RepriseRabais[];
    reprise_totale: number;
    net: number;
    bloque: boolean;
    message_action?: string;
  };
  const [aSupprimer, setASupprimer] = useState<{
    personnage_sort_id: string;
    nom: string;
    apercu: ApercuDesachat;
  } | null>(null);
  const [calculSuppression, setCalculSuppression] = useState(false);
  // L2 : bulle d'aide au tap sur un symbole.
  const { aide, montrer: montrerAide, fermer: fermerAide } = useTapBulle();

  const basculerSet = (
    set: Set<string>,
    setSet: (s: Set<string>) => void,
    cle: string,
  ) => {
    const suivant = new Set(set);
    if (suivant.has(cle)) suivant.delete(cle);
    else suivant.add(cle);
    setSet(suivant);
  };

  // Cercles disponibles (vue_cercles_disponibles)
  const { data: cerclesDisponibles, isLoading: loadingCercles, isError: cerclesError, refetch: refetchCercles } = useQuery({
    queryKey: ["cercles-disponibles", personnageId],
    queryFn: async () => {
      const { data, error } = await clientActif.lireCerclesDisponibles(
        personnageId,
      );
      if (error) throw error;
      return (data ?? []) as CercleDispo[];
    },
    enabled: !!personnageId,
  });

  // Compétence "Acquisition de Sort" : niveau ≥ 1 (gate opt-in étape 6)
  const { data: acquisitionSort, isLoading: loadingAcquisition } = useQuery({
    queryKey: ["acquisition-sort", personnageId],
    queryFn: async () => {
      const { data, error } = await clientActif.lireNiveauCompetenceParNom(
        personnageId,
        "Acquisition de Sort",
      );
      if (error) throw error;
      const niveau = data?.[0]?.niveau_acquis ?? 0;
      return niveau;
    },
    enabled: !!personnageId,
  });

  const niveauAcquisition = acquisitionSort ?? 0;
  const conditionsRemplies = niveauAcquisition >= 1;

  // Sorts par cercle (niveau ≤ niveau_max_sorts) — une query par cercle,
  // select("*") inchangé ; chargées d'avance pour les compteurs des headers.
  const sortsQueries = useQueries({
    queries: (cerclesDisponibles ?? []).map((c) => ({
      queryKey: ["sorts-cercle", c.cercle, c.niveau_max_sorts],
      queryFn: async () => {
        const { data, error } = await clientActif.lireSorts(
          c.cercle ?? "",
          c.niveau_max_sorts ?? 0,
        );
        if (error) throw error;
        return (data ?? []) as SortCatalogue[];
      },
      enabled: !!c.cercle && (c.niveau_max_sorts ?? 0) > 0,
    })),
  });
  const sortsParCercle: Record<string, SortCatalogue[] | undefined> = {};
  (cerclesDisponibles ?? []).forEach((c, i) => {
    if (c.cercle) sortsParCercle[c.cercle] = sortsQueries[i]?.data;
  });

  // Sorts déjà achetés — ⚠️ seule modification de données s171 : le join
  // récupère aussi type_sort, effet_instance (pastilles + effet AVANT→APRÈS).
  const { data: sortsAchetes, isLoading: loadingAchats } = useQuery({
    queryKey: ["personnage-sorts", personnageId],
    queryFn: async () => {
      const { data, error } = await clientActif.lirePersonnageSorts(
        personnageId,
      );
      if (error) throw error;
      return (data ?? []) as unknown as AchatSort[];
    },
    enabled: !!personnageId,
  });

  const achats = sortsAchetes ?? [];

  const mutation = useMutation({
    mutationFn: async (params: AcheterSortParams) => {
      const { data, error } = await clientActif.acheterSort(params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalide toutes les queries qui contiennent personnageId dans leur
      // clef. Cela couvre ["personnage-sorts", id], ["cercles-disponibles", id]
      // ET ["v2-personnage", id] du parent (header XP), sans avoir a lister
      // chaque queryKey explicitement.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      toast.success("Sort acheté !");
      setSortOuvertId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  const desacheterMutation = useMutation({
    mutationFn: async (personnageSortId: string) => {
      const { data, error } = await clientActif.desacheterSort({
        p_personnage_sort_id: personnageSortId,
      });
      if (error) throw error;
      const payload = (data ?? {}) as Record<string, any>;
      if (payload.succes !== true) {
        const msg =
          (payload.erreurs?.[0]?.message as string | undefined) ??
          "Impossible de supprimer ce sort.";
        throw new Error(msg);
      }
      return payload;
    },
    onSuccess: (_payload, personnageSortId) => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      toast.success("Sort supprimé et XP remboursés.");
      setASupprimer(null);
      if (instanceOuverteId === personnageSortId) setInstanceOuverteId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  // Aperçu (dry-run) avant suppression : calcule rabais repris + net,
  // puis ouvre TOUJOURS la fenêtre de confirmation (contenu adaptatif).
  const demanderSuppression = (ps: { id: string; nom: string }) => {
    setCalculSuppression(true);
    void (async () => {
      let apercu: ApercuDesachat;
      try {
        const { data, error } = await clientActif.desacheterSort({
          p_personnage_sort_id: ps.id,
          p_dry_run: true,
        });
        if (error) throw error;
        const payload = (data ?? {}) as Record<string, any>;
        const donnees = (payload.donnees ?? {}) as ApercuDesachat;
        // bloqué => succes:false mais donnees.bloque:true (cas légitime).
        if (payload.succes !== true && donnees?.bloque !== true) {
          throw new Error(
            (payload.erreurs?.[0]?.message as string | undefined) ??
              "Impossible de calculer l'aperçu du retrait.",
          );
        }
        apercu = donnees;
      } catch (e) {
        toast.error((e as Error).message);
        return;
      } finally {
        setCalculSuppression(false);
      }
      setASupprimer({ personnage_sort_id: ps.id, nom: ps.nom, apercu });
    })();
  };

  // Modification M2 inline — mutation reprise de l'éditeur « Modifier »
  // partagé (PR-B) : RPC modifier_sort, nom envoyé seulement s'il change,
  // gestion d'erreur acquis_regression avec affichage du plancher, toasts
  // xp_diff identiques.
  const modifierMutation = useMutation({
    mutationFn: async (args: {
      personnageSortId: string;
      valeurs: ValeursConstructeur;
      nomActuel: string;
    }) => {
      const nomTrim = args.valeurs.nom.trim();
      // Nom envoyé seulement s'il change : DEFAULT NULL ⇒ COALESCE conserve l'actuel.
      const params: Database["public"]["Functions"]["modifier_sort"]["Args"] = {
        p_personnage_sort_id: args.personnageSortId,
        p_niveau_sort: args.valeurs.niveau,
        p_zone_choisie: args.valeurs.zone,
        p_portee_choisie: args.valeurs.portee,
        p_duree_choisie: args.valeurs.duree,
        ...(nomTrim !== args.nomActuel ? { p_nom_personnalise: nomTrim } : {}),
      };

      const { data, error } = await clientActif.modifierSort(params);
      if (error) throw error;
      const payload = (data ?? {}) as Record<string, any>;
      if (payload.succes !== true) {
        const err = new Error(
          (payload.erreurs?.[0]?.message as string | undefined) ??
            "Modification impossible.",
        );
        (err as any).code = payload.erreurs?.[0]?.code as string | undefined;
        (err as any).plancher = payload.donnees?.plancher;
        throw err;
      }
      return payload;
    },
    onSuccess: (payload) => {
      // Convention B1 : invalide toute query dont la clef contient personnageId.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      const xpDiff = (payload.donnees?.xp_diff as number | undefined) ?? 0;
      if (xpDiff > 0) toast.success(`Sort modifié (−${xpDiff} XP).`);
      else if (xpDiff < 0)
        toast.success(`Sort modifié, ${-xpDiff} XP remboursés.`);
      else toast.success("Sort modifié.");
    },
    onError: (error: any) => {
      if (error?.code === "acquis_regression" && error?.plancher) {
        const pl = error.plancher as PlancherMagie;
        toast.error(
          `${error.message} (plancher : niv ${pl.niveau} · ${pl.zone} · ${pl.portee} · ${pl.duree})`,
        );
      } else {
        toast.error(error?.message ?? "Modification impossible.");
      }
    },
  });

  // Avance etape_creation de 6 a 7 cote serveur. Les etapes 5-9 n'ont pas
  // de sauvegarder_etape_N : sans cet appel, le bouton « Suivant » ne ferait
  // que relire etape_creation et resterait bloque sur l'etape courante.
  const avancerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await clientActif.avancerEtape({
        p_personnage_id: personnageId,
        p_etape_courante: 6,
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

  // ---------- Dérivés ----------

  const nivMaxCercle = (cercle: string | null | undefined) =>
    Math.max(
      1,
      cerclesDisponibles?.find((c) => c.cercle === cercle)?.niveau_max_sorts ??
        1,
    );

  // ⧉ ×N (I9) : nombre d'instances possédées par sort de base.
  const compteParSortId: Record<string, number> = {};
  achats.forEach((ps) => {
    compteParSortId[ps.sort_id] = (compteParSortId[ps.sort_id] ?? 0) + 1;
  });

  const achatsParCercle: Record<string, AchatSort[]> = {};
  achats.forEach((ps) => {
    const cercle = ps.sorts?.cercle ?? "?";
    (achatsParCercle[cercle] ??= []).push(ps);
  });

  const nbAcquis = achats.filter((ps) =>
    estSortAcquis(modeCampagne, photo, ps.sort_id, ps.id),
  ).length;

  // Sort du catalogue actuellement ouvert (radio global).
  const sortOuvert = sortOuvertId
    ? Object.values(sortsParCercle)
        .flatMap((liste) => liste ?? [])
        .find((s) => s.id === sortOuvertId) ?? null
    : null;

  const coutXpBaseAchat = Number(sortOuvert?.cout_xp_base ?? 0);
  const achatComplet =
    !!valeursAchat.zone && !!valeursAchat.portee && !!valeursAchat.duree;
  const coutXpAchat =
    sortOuvert && achatComplet
      ? calculerCoutXP(
          valeursAchat.zone,
          valeursAchat.portee,
          valeursAchat.duree,
          valeursAchat.niveau,
          coutXpBaseAchat,
        )
      : 0;

  const peutAcheter =
    !!sortOuvert &&
    achatComplet &&
    valeursAchat.nom.trim().length > 0 &&
    coutXpAchat > 0;

  const handleAcheter = () => {
    if (!peutAcheter || !sortOuvert) return;
    mutation.mutate({
      p_personnage_id: personnageId,
      p_sort_id: sortOuvert.id,
      p_zone_choisie: valeursAchat.zone,
      p_portee_choisie: valeursAchat.portee,
      p_duree_choisie: valeursAchat.duree,
      p_niveau_sort: valeursAchat.niveau,
      p_nom_personnalise: valeursAchat.nom.trim(),
    });
  };

  // I4 : coût de la config active (modification prioritaire, sinon achat).
  const instanceOuverte = instanceOuverteId
    ? achats.find((ps) => ps.id === instanceOuverteId) ?? null
    : null;
  let coutEnCours: CoutEnCours | null = null;
  if (
    instanceOuverte &&
    valeursModif?.zone &&
    valeursModif.portee &&
    valeursModif.duree
  ) {
    const delta =
      calculerCoutXP(
        valeursModif.zone,
        valeursModif.portee,
        valeursModif.duree,
        valeursModif.niveau,
        Number(instanceOuverte.sorts?.cout_xp_base ?? 0),
      ) - instanceOuverte.xp_depense;
    if (delta !== 0)
      coutEnCours = {
        delta,
        libelle: delta > 0 ? "modification en cours" : "remboursement",
      };
  }
  if (!coutEnCours && sortOuvert && achatComplet) {
    coutEnCours = { delta: coutXpAchat, libelle: "achat en cours" };
  }

  // L1 : entrées dynamiques de la légende (uniquement ce que CE joueur voit).
  const sortsCharges = Object.values(sortsParCercle).flatMap(
    (liste) => liste ?? [],
  );
  const typesVisibles = new Set(
    [
      ...sortsCharges.map((s) => s.type_sort),
      ...achats.map((ps) => ps.sorts?.type_sort),
    ].filter((t): t is string => !!t),
  );
  const typesPresents = ORDRE_TYPES.filter((t) => typesVisibles.has(t));
  const plafonds = [
    ...new Set(
      (cerclesDisponibles ?? [])
        .map((c) => c.niveau_max_sorts ?? 0)
        .filter((n) => n > 0),
    ),
  ].sort((a, b) => a - b);
  const multiples = [...new Set(Object.values(compteParSortId))].sort(
    (a, b) => a - b,
  );
  const niveauxMin = [
    ...new Set(sortsCharges.map((s) => s.niveau).filter((n) => n > 1)),
  ].sort((a, b) => a - b);

  // I6 : tout est au plafond → MAX ; sinon ↑ (au moins un réglage peut monter).
  const estInstanceAuMax = (ps: AchatSort) => {
    const maxZonePts = Math.max(
      0,
      ...(ZONES_PAR_TYPE[ps.sorts?.zone_effet ?? ""] ?? []).map(ptsZone),
    );
    const maxPorteePts = Math.max(
      0,
      ...filterPorteesDisponibles(ps.sorts?.portee ?? "").map((p) => p.cout),
    );
    const maxDureePts = Math.max(
      0,
      ...filterDureesDisponibles(ps.sorts?.duree ?? "").map((d) => d.cout),
    );
    return (
      ps.niveau_sort >= nivMaxCercle(ps.sorts?.cercle) &&
      ptsZone(ps.zone_choisie ?? "") >= maxZonePts &&
      ptsPortee(ps.portee_choisie ?? "") >= maxPorteePts &&
      ptsDuree(ps.duree_choisie ?? "") >= maxDureePts
    );
  };

  const tapSort = (s: SortCatalogue) => {
    if (sortOuvertId === s.id) {
      setSortOuvertId(null);
      return;
    }
    const zoneUnique = !!s.zone_effet && isZoneUnique(s.zone_effet);
    const zones = zoneUnique ? ZONES_PAR_TYPE[s.zone_effet!] ?? [] : [];
    setSortOuvertId(s.id);
    setValeursAchat({
      zone: zoneUnique ? zones[0] ?? "" : "",
      portee: "",
      duree: "",
      niveau: s.niveau ?? 1,
      nom: s.nom,
    });
  };

  const tapInstance = (ps: AchatSort) => {
    if (instanceOuverteId === ps.id) {
      setInstanceOuverteId(null);
      return;
    }
    setInstanceOuverteId(ps.id);
    setValeursModif({
      zone: ps.zone_choisie ?? "",
      portee: ps.portee_choisie ?? "",
      duree: ps.duree_choisie ?? "",
      niveau: ps.niveau_sort,
      nom: ps.nom_personnalise ?? ps.sorts?.nom ?? "",
    });
  };

  // Pastille de type tappable (L2) — stopPropagation pour ne pas basculer la rangée.
  const pastilleAide = (type: string | null | undefined) => {
    if (!type) return null;
    const cfg = AIDE_TYPES[type];
    return (
      <span
        onClick={(e) => {
          e.stopPropagation();
          if (cfg)
            montrerAide({
              titre: `Pastille « ${cfg.libelle} »`,
              texte: cfg.texte,
            });
        }}
        className={cfg ? "cursor-pointer" : undefined}
      >
        <PastilleType type={type} />
      </span>
    );
  };

  // ---------- États vides / chargement (conservés) ----------

  if (loadingCercles || loadingAcquisition) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Chargement des cercles disponibles…
      </div>
    );
  }

  if (!conditionsRemplies) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">
              Sorts arcaniques indisponibles
            </CardTitle>
            <CardDescription>{texteIndisponibleSorts()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>• Retourne à l'étape 5, catégorie Mage, pour acheter un Cercle.</p>
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
  }

  if (!cerclesDisponibles || cerclesDisponibles.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">
              Aucun cercle disponible
            </CardTitle>
            <CardDescription>
              Ce personnage n'a accès à aucun cercle de magie pour l'instant.
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

  // Premier cercle ouvert (ordre d'affichage) : porte l'astuce W3 catalogue.
  const premierCercleOuvert =
    cerclesDisponibles.find((c) => cerclesOuverts.has(c.cercle ?? ""))
      ?.cercle ?? null;

  return (
    <div className="relative space-y-5">
      {/* I4 : jauge XP live, AU-DESSUS du bandeau calcul (z-20 > z-[15]) */}
      <JaugeXP xpDisponible={xpDisponible} coutEnCours={coutEnCours} />

      <BasculeAbregeIntegral mode={mode} onToggle={toggleMode} />

      {(cerclesError || sortsQueries.some((q) => q.isError)) && (
        <ErreurChargement
          onRetry={() => {
            refetchCercles();
            sortsQueries.forEach((q) => q.refetch());
          }}
        />
      )}

      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Achat de sorts arcaniques
        </h2>
        <p className="text-sm text-muted-foreground">
          Choisissez un cercle, touchez un sort, personnalisez-le — vos sorts
          achetés sont regroupés en bas.
        </p>
      </div>

      {/* W1 : intro d'étape (ouverte par défaut, repli mémorisé) */}
      <IntroEtape
        storageKey={`${PREFIXE_LS}-intro-replie`}
        titre="Comment fonctionne cette étape ?"
      >
        <IntroEtapeItem n={1}>
          Votre personnage maîtrise des{" "}
          <strong>cercles de magie</strong> — les cartes ci-dessous. Ouvrez un
          cercle pour découvrir ses sorts.
        </IntroEtapeItem>
        <IntroEtapeItem n={2}>
          Touchez un sort pour lire ce qu'il fait. Pour le préparer, vous devez{" "}
          <strong>choisir un réglage dans chacune des 4 familles</strong> :{" "}
          <strong>zone</strong> (combien de cibles), <strong>portée</strong> (à
          quelle distance), <strong>durée</strong> et <strong>niveau</strong>{" "}
          (la puissance).
        </IntroEtapeItem>
        <IntroEtapeItem n={3}>
          Chaque réglage a un coût : le <strong>coût d'achat en XP</strong> se
          calcule tout seul — (zone + portée + durée + niveau) × le{" "}
          <strong>coefficient</strong> propre au sort. L'encadré doré montre{" "}
          <strong>l'effet exact</strong> que vous obtiendrez.
        </IntroEtapeItem>
        <IntroEtapeItem n={4}>
          Lancer un sort en jeu coûte aussi des{" "}
          <strong>points de spiritualité (PS)</strong> : ce coût s'affiche juste
          sous le calcul du coût d'achat, et change avec vos réglages.
        </IntroEtapeItem>
        <IntroEtapeItem n={5}>
          Quand ça vous plaît, donnez-lui un nom et <strong>achetez</strong>. Le
          sort rejoint « Sorts déjà achetés », tout en bas.
        </IntroEtapeItem>
        <IntroEtapeItem n={6}>
          Changé d'avis ? Touchez un sort possédé pour{" "}
          <strong>l'améliorer</strong>
          {modeCampagne
            ? " — ou le supprimer s'il n'a pas encore été joué en GN"
            : " ou le supprimer"}
          .
        </IntroEtapeItem>
        {modeCampagne && (
          <p className="border-t pt-2 text-[11.5px] leading-relaxed text-muted-foreground">
            En campagne : <strong className="text-gold">fond doré 🔒</strong> =
            sort scellé à un GN (il ne peut que s'améliorer) ·{" "}
            <strong className="text-emerald-700 dark:text-emerald-400">
              fond vert ＋
            </strong>{" "}
            = ajout récent, encore annulable.
          </p>
        )}
      </IntroEtape>

      {/* L1 : légende dynamique */}
      <LegendeDynamique
        type="sort"
        storageKey={`${PREFIXE_LS}-legende-repliee`}
        typesPresents={typesPresents}
        plafonds={plafonds}
        multiples={multiples}
        niveauxMin={niveauxMin}
        aDesAcquis={modeCampagne && nbAcquis > 0}
        aDesAchats={achats.length > 0}
        modeCampagne={modeCampagne}
      />

      {/* Catalogue : un accordéon par cercle, tout fermé par défaut */}
      <div className="space-y-2.5">
        {cerclesDisponibles.map((c) => {
          const cercle = c.cercle ?? "";
          const ouvert = cerclesOuverts.has(cercle);
          const sortsDuCercle = sortsParCercle[cercle];
          const filtre = filtres[cercle] ?? null;
          const visibles = (sortsDuCercle ?? []).filter(
            (s) => !filtre || s.type_sort === filtre,
          );
          const nbAchetesCercle = achatsParCercle[cercle]?.length ?? 0;
          const compteParType: Record<string, number> = {};
          (sortsDuCercle ?? []).forEach((s) => {
            if (s.type_sort)
              compteParType[s.type_sort] =
                (compteParType[s.type_sort] ?? 0) + 1;
          });

          return (
            <div key={cercle} className="rounded-lg border bg-card">
              <div
                onClick={() =>
                  basculerSet(cerclesOuverts, setCerclesOuverts, cercle)
                }
                className="flex cursor-pointer flex-wrap items-center gap-2 px-3.5 py-3"
              >
                <Chevron ouvert={ouvert} />
                <span className="flex-1 font-heading text-[15px] font-bold text-foreground">
                  {cercle}
                </span>
                <Badge variant="outline">≤ niv {c.niveau_max_sorts}</Badge>
                {sortsDuCercle && (
                  <Badge variant="secondary">
                    {sortsDuCercle.length} sorts
                  </Badge>
                )}
                {nbAchetesCercle > 0 && (
                  <span
                    className={`whitespace-nowrap rounded-full border px-2 py-px text-[10.5px] font-bold ${
                      modeCampagne
                        ? "border-gold/50 text-gold"
                        : "border-primary/50 text-primary"
                    }`}
                  >
                    {nbAchetesCercle} acheté{nbAchetesCercle > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {ouvert && (
                <div>
                  {/* W3 : astuce à la première découverte du catalogue */}
                  {cercle === premierCercleOuvert && (
                    <Astuce
                      storageKey={`${PREFIXE_LS}-astuce-catalogue-vue`}
                      texte="Touchez un sort pour lire sa description et le configurer. Les réglages (zone, portée, durée, niveau) font varier sa puissance et son coût en XP."
                    />
                  )}

                  {/* I7 : filtre par type (masqué si < 2 types) */}
                  <FiltreTypeMagie
                    compteParType={compteParType}
                    total={(sortsDuCercle ?? []).length}
                    filtre={filtre}
                    onFiltre={(f) => setFiltres({ ...filtres, [cercle]: f })}
                  />

                  {sortsDuCercle === undefined ? (
                    <div className="flex items-center border-t px-3 py-2.5 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Chargement des sorts…
                    </div>
                  ) : visibles.length === 0 ? (
                    <p className="border-t px-3 py-2.5 text-xs text-muted-foreground">
                      {filtre
                        ? "Aucun sort de ce type dans ce cercle."
                        : "Aucun sort disponible pour ce cercle."}
                    </p>
                  ) : (
                    visibles.map((s) => {
                      const selectionne = sortOuvertId === s.id;
                      const possede = compteParSortId[s.id] ?? 0;
                      return (
                        <div key={s.id} className="border-t">
                          <div
                            onClick={() => tapSort(s)}
                            className={`flex cursor-pointer items-start gap-2 px-3 py-2.5 ${
                              selectionne ? "bg-primary/5" : ""
                            }`}
                          >
                            <Chevron ouvert={selectionne} className="mt-0.5" />
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                              <strong className="font-heading text-[13.5px] text-primary">
                                {s.nom}
                              </strong>
                              {/* I9 : déjà possédé ×N */}
                              {possede > 0 && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    montrerAide({
                                      titre: `⧉ ×${possede}`,
                                      texte: `Vous possédez déjà ${possede} version${possede > 1 ? "s" : ""} de ce sort (configurations différentes possibles). Retrouvez-les dans « Sorts déjà achetés ».`,
                                    });
                                  }}
                                  className="cursor-pointer whitespace-nowrap rounded-full border border-gold/50 px-2 py-px text-[10px] font-bold text-gold"
                                >
                                  ⧉ ×{possede}
                                </span>
                              )}
                              {s.niveau > 1 && (
                                <Badge variant="outline">Niv. {s.niveau}+</Badge>
                              )}
                              {pastilleAide(s.type_sort)}
                            </div>
                          </div>

                          {selectionne && (
                            <div className="space-y-2.5 border-l-[3px] border-l-primary px-3 pb-4 pt-1">
                              {(s.resume_condense || s.description) && (
                                <p className="whitespace-pre-line text-sm text-muted-foreground">
                                  {mode === "integral"
                                    ? s.description ?? s.resume_condense
                                    : s.resume_condense ?? s.description}
                                </p>
                              )}
                              <ConstructeurMagie
                                type="sort"
                                zoneEffet={s.zone_effet ?? ""}
                                porteeMax={s.portee ?? ""}
                                dureeMax={s.duree ?? ""}
                                coutXpBase={Number(s.cout_xp_base ?? 0)}
                                niveauMax={Math.max(
                                  1,
                                  c.niveau_max_sorts ?? 1,
                                )}
                                niveauPersonnage={niveauPersonnage}
                                valeurs={valeursAchat}
                                onChange={setValeursAchat}
                                plancher={null}
                                bonusNiveau={
                                  s.bonus_niveau as BonusNiveau | null
                                }
                                paliers={s.paliers as PalierSort[] | null}
                                stickyTop={54}
                                preReglages
                                effetInstance={
                                  (s.effet_instance ??
                                    null) as EffetInstance | null
                                }
                                afficherProchainPalier
                              />
                              {(() => {
                                const xpInsuffisants =
                                  peutAcheter && coutXpAchat > xpDisponible;
                                // [MAGIE-PLAFOND] meme motif que les XP : on grise plutot que de laisser le serveur refuser.
                                const horsPlafond =
                                  peutAcheter &&
                                  coutXpAchat > coutXpMaxAutorise(niveauPersonnage);
                                return (
                                  <Button
                                    onClick={handleAcheter}
                                    disabled={
                                      !peutAcheter ||
                                      mutation.isPending ||
                                      xpInsuffisants ||
                                      horsPlafond
                                    }
                                    title={
                                      xpInsuffisants
                                        ? `XP insuffisants (manque ${coutXpAchat - xpDisponible} XP)`
                                        : undefined
                                    }
                                    className={`w-full ${
                                      xpInsuffisants ? "opacity-50" : ""
                                    }`}
                                  >
                                    {mutation.isPending ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Sparkles className="mr-2 h-4 w-4" />
                                    )}
                                    Acheter ce sort ({coutXpAchat} XP)
                                  </Button>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sorts déjà achetés : accordéon à 2 niveaux (section → cercle →
          instances), tap sur une instance = modification directe (M2). */}
      <div className="rounded-lg border bg-card">
        <div
          onClick={() => setSectionAchetesOuverte((o) => !o)}
          className="flex cursor-pointer items-center gap-2 px-3.5 py-3"
        >
          <Chevron ouvert={sectionAchetesOuverte} />
          <span className="flex-1 font-heading text-[15px] font-bold text-foreground">
            Sorts déjà achetés
          </span>
          <Badge variant="secondary">{achats.length}</Badge>
          {modeCampagne && (
            <span className="whitespace-nowrap text-[10.5px] font-bold text-gold">
              🔒 {nbAcquis} · ＋ {achats.length - nbAcquis}
            </span>
          )}
        </div>

        {sectionAchetesOuverte && (
          <div>
            {/* W3 : astuce à la première visite des achetés */}
            {achats.length > 0 && (
              <Astuce
                storageKey={`${PREFIXE_LS}-astuce-achetes-vue`}
                texte={`Touchez un de vos sorts pour l'améliorer${
                  modeCampagne
                    ? " — fond doré 🔒 = scellé à un GN (améliorable seulement), fond vert ＋ = encore annulable"
                    : ""
                }.`}
              />
            )}

            {loadingAchats ? (
              <div className="flex items-center border-t px-3 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Chargement…
              </div>
            ) : achats.length === 0 ? (
              <p className="border-t px-3.5 py-3 text-sm text-muted-foreground">
                Aucun sort acheté pour le moment.
              </p>
            ) : (
              Object.entries(achatsParCercle).map(([cercle, liste]) => {
                const cercleOuvert = cerclesAchetesOuverts.has(cercle);
                return (
                  <div key={cercle} className="border-t">
                    <div
                      onClick={() =>
                        basculerSet(
                          cerclesAchetesOuverts,
                          setCerclesAchetesOuverts,
                          cercle,
                        )
                      }
                      className="flex cursor-pointer items-center gap-2 py-2.5 pl-6 pr-3.5"
                    >
                      <Chevron ouvert={cercleOuvert} />
                      <span className="flex-1 font-heading text-[13.5px] font-semibold text-foreground">
                        {cercle}
                      </span>
                      <Badge variant="outline">{liste.length}</Badge>
                    </div>

                    {cercleOuvert &&
                      liste.map((ps) => {
                        const acquis = estSortAcquis(
                          modeCampagne,
                          photo,
                          ps.sort_id,
                          ps.id,
                        );
                        const ajout = modeCampagne && !acquis;
                        const auMax = estInstanceAuMax(ps);
                        const ouverte = instanceOuverteId === ps.id;
                        const nomActuel =
                          ps.nom_personnalise ?? ps.sorts?.nom ?? "Sort";
                        const valeursActuelles = {
                          niveau: ps.niveau_sort,
                          zone: ps.zone_choisie ?? "",
                          portee: ps.portee_choisie ?? "",
                          duree: ps.duree_choisie ?? "",
                        };
                        // Plancher photo (acquis) — valeurs de la PHOTO, pas
                        // l'état courant (plancherInstanceSort, tel quel).
                        const plancher = plancherInstanceSort(
                          modeCampagne,
                          photo,
                          ps.sort_id,
                          ps.id,
                          valeursActuelles,
                        );

                        return (
                          <div
                            key={ps.id}
                            className={`ml-2.5 border-t ${
                              acquis
                                ? "border-l-4 border-l-gold bg-gold/10"
                                : ajout
                                  ? "border-l-[3px] border-l-emerald-600/60 bg-emerald-600/[0.07]"
                                  : ""
                            }`}
                          >
                            <div
                              onClick={() => tapInstance(ps)}
                              className={`flex cursor-pointer items-start gap-1.5 px-3 py-2.5 ${
                                ouverte ? "bg-primary/5" : ""
                              }`}
                            >
                              <Chevron ouvert={ouverte} className="mt-0.5" />
                              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                                <strong className="font-heading text-[13.5px] text-primary">
                                  {nomActuel}
                                </strong>
                                <Badge variant="secondary">
                                  Niv. {ps.niveau_sort}
                                </Badge>
                                {pastilleAide(ps.sorts?.type_sort)}
                                {/* I6 : indicateur de balayage pur — tap = aide L2 */}
                                {auMax ? (
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      montrerAide({
                                        titre: "MAX",
                                        texte:
                                          "Ce sort est au maximum : niveau, zone, portée et durée sont tous au plafond. Seul le nom peut encore changer.",
                                      });
                                    }}
                                    className="cursor-pointer rounded-full border border-border px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-muted-foreground"
                                  >
                                    MAX
                                  </span>
                                ) : (
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      montrerAide({
                                        titre: "↑ Améliorable",
                                        texte:
                                          "Ce sort peut encore monter : au moins un réglage (niveau, zone, portée ou durée) n'est pas au plafond. Touchez-le pour l'améliorer.",
                                      });
                                    }}
                                    className="cursor-pointer px-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400"
                                  >
                                    ↑
                                  </span>
                                )}
                                {acquis && (
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      montrerAide({
                                        titre: "🔒 Acquis (scellé)",
                                        texte:
                                          "Confirmé à un GN : impossible à supprimer ou à affaiblir. Vous pouvez seulement l'améliorer (jamais sous son plancher).",
                                      });
                                    }}
                                    className="cursor-pointer text-xs"
                                  >
                                    🔒
                                  </span>
                                )}
                                {ajout && (
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      montrerAide({
                                        titre: "＋ Ajout annulable",
                                        texte:
                                          "Acheté dans la fenêtre courante (pas encore joué en GN) : modifiable et supprimable librement, XP remboursés.",
                                      });
                                    }}
                                    className="cursor-pointer text-xs font-bold text-emerald-700 dark:text-emerald-400"
                                  >
                                    ＋
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* M2 : bloc de MODIFICATION directe */}
                            {ouverte && valeursModif && (
                              <div className="space-y-2.5 border-l-[3px] border-l-primary py-2 pl-5 pr-3 pb-4">
                                {/* Config actuelle + désachat */}
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge variant="outline">
                                    {ps.zone_choisie} ·{" "}
                                    {ptsZone(ps.zone_choisie ?? "")} XP
                                  </Badge>
                                  <Badge variant="outline">
                                    {ps.portee_choisie} ·{" "}
                                    {ptsPortee(ps.portee_choisie ?? "")} XP
                                  </Badge>
                                  <Badge variant="outline">
                                    {ps.duree_choisie} ·{" "}
                                    {ptsDuree(ps.duree_choisie ?? "")} XP
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    · {ps.xp_depense} XP ·{" "}
                                    {calculerCoutPS(ps.xp_depense)} PS
                                  </span>
                                  <span className="flex-1" />
                                  {!acquis && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        demanderSuppression({
                                          id: ps.id,
                                          nom: nomActuel,
                                        });
                                      }}
                                      disabled={
                                        desacheterMutation.isPending ||
                                        calculSuppression
                                      }
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  )}
                                </div>

                                {auMax && (
                                  <p className="text-xs text-muted-foreground">
                                    Déjà au maximum — seul le nom peut changer.
                                  </p>
                                )}

                                {/* Bandeau d'état (plancher OR / ajout vert) */}
                                {plancher !== null ? (
                                  <div className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold">
                                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <span>
                                      Acquis : confirmé à un GN. Améliorable
                                      seulement — jamais sous niv{" "}
                                      {plancher.niveau} · {plancher.zone} ·{" "}
                                      {plancher.portee} · {plancher.duree}.
                                    </span>
                                  </div>
                                ) : modeCampagne ? (
                                  <div className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                                    Ajout de la fenêtre courante : modification
                                    libre dans les deux sens (baisser =
                                    remboursement).
                                  </div>
                                ) : null}

                                {(ps.sorts?.resume_condense || ps.sorts?.description) && (
                                  <p className="whitespace-pre-line text-sm text-muted-foreground">
                                    {mode === "integral"
                                      ? ps.sorts?.description ?? ps.sorts?.resume_condense
                                      : ps.sorts?.resume_condense ?? ps.sorts?.description}
                                  </p>
                                )}

                                {/* Effet calculé AVANT → APRÈS (live) */}
                                <AvantApres
                                  effet={
                                    (ps.sorts?.effet_instance ??
                                      null) as EffetInstance | null
                                  }
                                  paliers={
                                    ps.sorts?.paliers as PalierSort[] | null
                                  }
                                  niveauAvant={ps.niveau_sort}
                                  niveauApres={valeursModif.niveau}
                                />

                                <ConstructeurMagie
                                  type="sort"
                                  zoneEffet={ps.sorts?.zone_effet ?? ""}
                                  porteeMax={ps.sorts?.portee ?? ""}
                                  dureeMax={ps.sorts?.duree ?? ""}
                                  coutXpBase={Number(
                                    ps.sorts?.cout_xp_base ?? 0,
                                  )}
                                  niveauMax={nivMaxCercle(ps.sorts?.cercle)}
                                  niveauPersonnage={niveauPersonnage}
                                  valeurs={valeursModif}
                                  onChange={setValeursModif}
                                  plancher={plancher}
                                  bonusNiveau={ps.sorts?.bonus_niveau ?? null}
                                  paliers={
                                    ps.sorts?.paliers as PalierSort[] | null
                                  }
                                  stickyTop={54}
                                  afficherProchainPalier
                                />

                                {/* Delta signé + bouton Modifier (M2) */}
                                {(() => {
                                  const complet =
                                    !!valeursModif.zone &&
                                    !!valeursModif.portee &&
                                    !!valeursModif.duree;
                                  const coutApres = complet
                                    ? calculerCoutXP(
                                        valeursModif.zone,
                                        valeursModif.portee,
                                        valeursModif.duree,
                                        valeursModif.niveau,
                                        Number(ps.sorts?.cout_xp_base ?? 0),
                                      )
                                    : ps.xp_depense;
                                  const diff = coutApres - ps.xp_depense;
                                  const nomTrim = valeursModif.nom.trim();
                                  const inchange =
                                    valeursModif.zone ===
                                      (ps.zone_choisie ?? "") &&
                                    valeursModif.portee ===
                                      (ps.portee_choisie ?? "") &&
                                    valeursModif.duree ===
                                      (ps.duree_choisie ?? "") &&
                                    valeursModif.niveau === ps.niveau_sort &&
                                    nomTrim === nomActuel;
                                  const xpInsuffisants = diff > xpDisponible;
                                  // [MAGIE-PLAFOND] miroir du serveur : ne mord que si le cout augmente.
                                  const horsPlafond =
                                    diff > 0 &&
                                    coutApres > coutXpMaxAutorise(niveauPersonnage);
                                  return (
                                    <>
                                      {diff > 0 ? (
                                        <div className="space-y-0.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
                                          <p className="font-semibold">
                                            Coût de la modification : +{diff} XP
                                          </p>
                                          <p className="text-xs opacity-90">
                                            {ps.xp_depense} XP → {coutApres} XP
                                            · il vous reste {xpDisponible} XP
                                          </p>
                                        </div>
                                      ) : diff < 0 ? (
                                        <div className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                          Remboursement : {-diff} XP
                                        </div>
                                      ) : (
                                        <p className="text-sm text-muted-foreground">
                                          Aucun changement de coût
                                        </p>
                                      )}
                                      {xpInsuffisants && (
                                        <p className="text-sm font-medium text-destructive">
                                          XP insuffisants : il manque{" "}
                                          {diff - xpDisponible} XP
                                        </p>
                                      )}
                                      <Button
                                        className="w-full"
                                        disabled={
                                          !complet ||
                                          inchange ||
                                          xpInsuffisants ||
                                          horsPlafond ||
                                          modifierMutation.isPending
                                        }
                                        onClick={() =>
                                          modifierMutation.mutate({
                                            personnageSortId: ps.id,
                                            valeurs: valeursModif,
                                            nomActuel,
                                          })
                                        }
                                      >
                                        {modifierMutation.isPending && (
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        )}
                                        {diff > 0
                                          ? `Modifier (+${diff} XP)`
                                          : diff < 0
                                            ? `Modifier (récupérer ${-diff} XP)`
                                            : "Modifier"}
                                      </Button>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <AlertDialog
        open={aSupprimer !== null}
        onOpenChange={(open) => !open && setASupprimer(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce sort ?</AlertDialogTitle>
            {aSupprimer && (
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  {aSupprimer.apercu.bloque ? (
                    <p className="text-destructive">
                      {aSupprimer.apercu.message_action}
                    </p>
                  ) : aSupprimer.apercu.reprise_totale === 0 ? (
                    <p>
                      Le sort « {aSupprimer.nom} » sera supprimé et tu
                      récupéreras{" "}
                      <strong>+{aSupprimer.apercu.xp_rembourse} XP</strong>.
                    </p>
                  ) : (
                    <>
                      <p>
                        Supprimer le sort « {aSupprimer.nom} » du Cercle «{" "}
                        {aSupprimer.apercu.cercle} » va :
                      </p>
                      <ul className="list-disc space-y-1 pl-5">
                        <li>
                          te rendre son coût (+
                          {aSupprimer.apercu.xp_rembourse} XP)
                        </li>
                        {aSupprimer.apercu.reprises.map((r, idx) => (
                          <li key={idx}>
                            reprendre le rabais qu'il donnait sur{" "}
                            {r.competence} niveau {r.niveau} pour le Cercle «{" "}
                            {r.choix} » (−{r.montant} XP)
                          </li>
                        ))}
                        <li className="font-medium">
                          Résultat net : +{aSupprimer.apercu.net} XP
                        </li>
                      </ul>
                    </>
                  )}
                  {!aSupprimer.apercu.bloque && (
                    <p className="text-muted-foreground">
                      ⚠️ Ce choix est définitif.
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desacheterMutation.isPending}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={
                desacheterMutation.isPending ||
                (aSupprimer?.apercu.bloque ?? false)
              }
              onClick={() => {
                if (aSupprimer && !aSupprimer.apercu.bloque) {
                  desacheterMutation.mutate(aSupprimer.personnage_sort_id);
                }
              }}
            >
              {desacheterMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* L2 : bulle d'aide au tap */}
      <TapBulle aide={aide} onClose={fermerAide} />
    </div>
  );
};

export default Etape6_Sorts_V2;
