import { useMemo, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
import ManuelDepliable from "@/components/createur/magie/ManuelDepliable";
import { AvantApres } from "@/components/createur/magie/ApercuEffet";
import FiltreTypeMagie from "@/components/createur/magie/FiltreTypeMagie";
import { useDernierePhotoCompo } from "@/hooks/useDernierePhotoCompo";
import { estPriereAcquise, plancherInstancePriere } from "@/lib/acquisCampagne";
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
  filterDureesDisponibles,
  filterPorteesDisponibles,
  isZoneUnique,
  type BonusNiveau,
  type EffetInstance,
  type PalierSort,
} from "@/utils/calculsMagie";

type PriereRow = Database["public"]["Tables"]["prieres"]["Row"];
/** prieres.effet_instance (s162) absent des types générés — cast local, comme
 *  paliers (on ne régénère pas les types Supabase pour ces colonnes jsonb). */
type PriereCatalogue = PriereRow & { effet_instance?: EffetInstance | null };
type PersonnagePriereRow =
  Database["public"]["Tables"]["personnage_prieres"]["Row"];
type DomaineDispo =
  Database["public"]["Views"]["vue_domaines_disponibles"]["Row"];

/** Join prieres(...) du select personnage_prieres — + type_priere, effet_instance (s171). */
interface PriereJointe {
  nom: string | null;
  domaine: string | null;
  zone_effet: string | null;
  portee: string | null;
  duree: string | null;
  cout_xp_base: number | null;
  bonus_niveau: BonusNiveau | null;
  description_courte: string | null;
  description_tronc: string | null;
  paliers: unknown;
  type_priere: string | null;
  effet_instance: unknown;
}
type AchatPriere = PersonnagePriereRow & { prieres: PriereJointe | null };

interface Etape7Props {
  personnageId: string;
  /**
   * XP encore disponibles pour le personnage (xp_total - xp_depense).
   * Sert au grisage UI du bouton d'achat quand le budget est insuffisant.
   * Le serveur reste l'arbitre final de la validation.
   */
  xpDisponible?: number;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onPrevious?: () => void;
  /**
   * Mode campagne (évolution) : verrouille visuellement le désachat des prières
   * acquises (PR-C2). Miroir d'INV-3 backend, qui reste l'autorité.
   */
  modeCampagne?: boolean;
}

interface AcheterPriereParams {
  p_personnage_id: string;
  p_priere_id: string;
  p_zone_choisie: string;
  p_portee_choisie: string;
  p_duree_choisie: string;
  p_niveau_priere: number;
  p_nom_personnalise: string;
}

// Préfixe localStorage paramétrable (miroir É6 : « hv-e7 »).
const PREFIXE_LS = "hv-e7";

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
    texte: "Prière qui avantage ses cibles (protection, soin, bonus).",
  },
  effet: {
    libelle: "Effet",
    texte:
      "Prière qui altère ou contraint ses cibles sans infliger de dégâts.",
  },
  "dégâts": {
    libelle: "Dégâts",
    texte: "Prière qui inflige des dégâts.",
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

const Etape7_Prieres_V2 = ({
  personnageId,
  xpDisponible = 0,
  onSuccess,
  onError,
  onPrevious,
  modeCampagne = false,
}: Etape7Props) => {
  const queryClient = useQueryClient();

  // PR-C2 : photo de compo (frontière des acquis). Fetch seulement en campagne.
  const { data: photo } = useDernierePhotoCompo(personnageId, modeCampagne);

  // Accordéons en état manuel (pattern É5 / maquette useSet) — PAS de Radix
  // Accordion : enfants interactifs → bug connu.
  const [domainesOuverts, setDomainesOuverts] = useState<Set<string>>(
    new Set(),
  );
  const [domainesAchetesOuverts, setDomainesAchetesOuverts] = useState<
    Set<string>
  >(new Set());
  const [sectionAchetesOuverte, setSectionAchetesOuverte] = useState(true);
  // Une seule prière du catalogue ouverte à la fois (radio).
  const [priereOuverteId, setPriereOuverteId] = useState<string | null>(null);
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
  // I7 : filtre par type, indépendant par domaine.
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
    personnage_priere_id: string;
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

  // Personnage : religion (domaines proscrits). Aucun prérequis de croyance.
  const { data: personnage, isLoading: loadingPersonnage } = useQuery({
    queryKey: ["personnage-prieres-meta", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnages")
        .select("id, religion_id")
        .eq("id", personnageId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!personnageId,
  });

  // Compétence "Acquisition de Prière" : niveau ≥ 1 (gate opt-in étape 7)
  const { data: acquisitionPriere, isLoading: loadingAcquisition } = useQuery({
    queryKey: ["acquisition-priere", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnage_competences")
        .select("niveau_acquis, competences!inner(nom)")
        .eq("personnage_id", personnageId)
        .eq("competences.nom", "Acquisition de Prière")
        .order("niveau_acquis", { ascending: false })
        .limit(1);
      if (error) throw error;
      const niveau = data?.[0]?.niveau_acquis ?? 0;
      return niveau;
    },
    enabled: !!personnageId,
  });

  const niveauAcquisition = acquisitionPriere ?? 0;
  const religionId = personnage?.religion_id ?? null;
  // Aucun prérequis de croyance pour Acquisition de Prière selon le Manuel
  // 2026. Le backend a déjà été corrigé en session 26 ; régression frontend
  // corrigée en session 33 — ne pas réintroduire de garde de croyance ici.
  const conditionsRemplies = niveauAcquisition >= 1;

  // Domaines disponibles (vue_domaines_disponibles)
  const { data: domainesDisponibles, isLoading: loadingDomaines } = useQuery({
    queryKey: ["domaines-disponibles", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vue_domaines_disponibles")
        .select("domaine, niveau_max_prieres, personnage_id")
        .eq("personnage_id", personnageId)
        .order("domaine");
      if (error) throw error;
      return (data ?? []) as DomaineDispo[];
    },
    enabled: !!personnageId && conditionsRemplies,
  });

  // Domaines proscrits par la religion
  const { data: domainesProscrits, isLoading: loadingProscrits } = useQuery({
    queryKey: ["domaines-proscrits", religionId],
    queryFn: async () => {
      if (!religionId) return [] as string[];
      const { data, error } = await supabase
        .from("religions")
        .select("domaines_proscrits")
        .eq("id", religionId)
        .single();
      if (error) throw error;
      return (data?.domaines_proscrits ?? []) as string[];
    },
    enabled: !!religionId,
  });

  // Tant que la liste des proscrits n'est pas résolue, on ne risque pas
  // d'afficher un domaine proscrit.
  const proscritsResolus = !religionId || !loadingProscrits;

  const domainesAffiches = useMemo(() => {
    const proscrits = new Set(domainesProscrits ?? []);
    return (domainesDisponibles ?? []).filter(
      (d) => d.domaine && !proscrits.has(d.domaine),
    );
  }, [domainesDisponibles, domainesProscrits]);

  // Prières par domaine (niveau ≤ niveau_max_prieres) — une query par domaine,
  // select("*") inchangé ; chargées d'avance pour les compteurs des headers.
  const prieresQueries = useQueries({
    queries: domainesAffiches.map((d) => ({
      queryKey: ["prieres-domaine", d.domaine, d.niveau_max_prieres],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("prieres")
          .select("*")
          .eq("domaine", d.domaine ?? "")
          .lte("niveau", d.niveau_max_prieres ?? 0)
          .eq("est_actif", true)
          .order("nom");
        if (error) throw error;
        return (data ?? []) as PriereCatalogue[];
      },
      enabled: !!d.domaine && (d.niveau_max_prieres ?? 0) > 0,
    })),
  });
  const prieresParDomaine: Record<string, PriereCatalogue[] | undefined> = {};
  domainesAffiches.forEach((d, i) => {
    if (d.domaine) prieresParDomaine[d.domaine] = prieresQueries[i]?.data;
  });

  // Prières déjà achetées — le join récupère aussi type_priere, effet_instance
  // (pastilles + effet AVANT→APRÈS), miroir exact d'É6.
  const { data: prieresAchetees, isLoading: loadingAchats } = useQuery({
    queryKey: ["personnage-prieres", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnage_prieres")
        .select(
          "*, prieres(nom, domaine, zone_effet, portee, duree, cout_xp_base, bonus_niveau, description_courte, description_tronc, paliers, type_priere, effet_instance)",
        )
        .eq("personnage_id", personnageId)
        .order("date_acquisition");
      if (error) throw error;
      return (data ?? []) as unknown as AchatPriere[];
    },
    enabled: !!personnageId,
  });

  const achats = prieresAchetees ?? [];

  const mutation = useMutation({
    mutationFn: async (params: AcheterPriereParams) => {
      const { data, error } = await supabase.rpc("acheter_priere", params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalide toutes les queries qui contiennent personnageId dans leur
      // clef. Cela couvre ["personnage-prieres", id],
      // ["domaines-disponibles", id] ET ["v2-personnage", id] du parent
      // (header XP), sans avoir a lister chaque queryKey explicitement.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      toast.success("Prière acquise !");
      setPriereOuverteId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  const desacheterMutation = useMutation({
    mutationFn: async (personnagePriereId: string) => {
      const { data, error } = await supabase.rpc("desacheter_priere", {
        p_personnage_priere_id: personnagePriereId,
      });
      if (error) throw error;
      const payload = (data ?? {}) as Record<string, any>;
      if (payload.succes !== true) {
        const msg =
          (payload.erreurs?.[0]?.message as string | undefined) ??
          "Impossible de supprimer cette prière.";
        throw new Error(msg);
      }
      return payload;
    },
    onSuccess: (_payload, personnagePriereId) => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      toast.success("Prière supprimée et XP remboursés.");
      setASupprimer(null);
      if (instanceOuverteId === personnagePriereId) setInstanceOuverteId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  // Aperçu (dry-run) avant suppression : calcule rabais repris + net,
  // puis ouvre TOUJOURS la fenêtre de confirmation (contenu adaptatif).
  const demanderSuppression = (pp: { id: string; nom: string }) => {
    setCalculSuppression(true);
    void (async () => {
      let apercu: ApercuDesachat;
      try {
        const { data, error } = await supabase.rpc("desacheter_priere", {
          p_personnage_priere_id: pp.id,
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
      setASupprimer({ personnage_priere_id: pp.id, nom: pp.nom, apercu });
    })();
  };

  // Modification M2 inline — RPC modifier_priere, nom envoyé seulement s'il
  // change, gestion d'erreur acquis_regression avec affichage du plancher,
  // toasts xp_diff identiques (miroir exact de modifier_sort d'É6).
  const modifierMutation = useMutation({
    mutationFn: async (args: {
      personnagePriereId: string;
      valeurs: ValeursConstructeur;
      nomActuel: string;
    }) => {
      const nomTrim = args.valeurs.nom.trim();
      // Nom envoyé seulement s'il change : DEFAULT NULL ⇒ COALESCE conserve l'actuel.
      const params: Database["public"]["Functions"]["modifier_priere"]["Args"] = {
        p_personnage_priere_id: args.personnagePriereId,
        p_niveau_priere: args.valeurs.niveau,
        p_zone_choisie: args.valeurs.zone,
        p_portee_choisie: args.valeurs.portee,
        p_duree_choisie: args.valeurs.duree,
        ...(nomTrim !== args.nomActuel ? { p_nom_personnalise: nomTrim } : {}),
      };

      const { data, error } = await supabase.rpc("modifier_priere", params);
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
      if (xpDiff > 0) toast.success(`Prière modifiée (−${xpDiff} XP).`);
      else if (xpDiff < 0)
        toast.success(`Prière modifiée, ${-xpDiff} XP remboursés.`);
      else toast.success("Prière modifiée.");
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

  // Avance etape_creation de 7 a 8 cote serveur. Les etapes 5-9 n'ont pas
  // de sauvegarder_etape_N : sans cet appel, le bouton « Suivant » ne ferait
  // que relire etape_creation et resterait bloque sur l'etape courante.
  const avancerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("avancer_etape", {
        p_personnage_id: personnageId,
        p_etape_courante: 7,
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

  const nivMaxDomaine = (domaine: string | null | undefined) =>
    Math.max(
      1,
      domainesDisponibles?.find((d) => d.domaine === domaine)
        ?.niveau_max_prieres ?? 1,
    );

  // ⧉ ×N (I9) : nombre d'instances possédées par prière de base.
  const compteParPriereId: Record<string, number> = {};
  achats.forEach((pp) => {
    compteParPriereId[pp.priere_id] =
      (compteParPriereId[pp.priere_id] ?? 0) + 1;
  });

  const achatsParDomaine: Record<string, AchatPriere[]> = {};
  achats.forEach((pp) => {
    const domaine = pp.prieres?.domaine ?? "?";
    (achatsParDomaine[domaine] ??= []).push(pp);
  });

  const nbAcquis = achats.filter((pp) =>
    estPriereAcquise(modeCampagne, photo, pp.priere_id, pp.id),
  ).length;

  // Prière du catalogue actuellement ouverte (radio global).
  const priereOuverte = priereOuverteId
    ? Object.values(prieresParDomaine)
        .flatMap((liste) => liste ?? [])
        .find((p) => p.id === priereOuverteId) ?? null
    : null;

  const coutXpBaseAchat = Number(priereOuverte?.cout_xp_base ?? 0);
  const achatComplet =
    !!valeursAchat.zone && !!valeursAchat.portee && !!valeursAchat.duree;
  const coutXpAchat =
    priereOuverte && achatComplet
      ? calculerCoutXP(
          valeursAchat.zone,
          valeursAchat.portee,
          valeursAchat.duree,
          valeursAchat.niveau,
          coutXpBaseAchat,
        )
      : 0;

  const peutAcheter =
    !!priereOuverte &&
    achatComplet &&
    valeursAchat.nom.trim().length > 0 &&
    coutXpAchat > 0;

  const handleAcheter = () => {
    if (!peutAcheter || !priereOuverte) return;
    mutation.mutate({
      p_personnage_id: personnageId,
      p_priere_id: priereOuverte.id,
      p_zone_choisie: valeursAchat.zone,
      p_portee_choisie: valeursAchat.portee,
      p_duree_choisie: valeursAchat.duree,
      p_niveau_priere: valeursAchat.niveau,
      p_nom_personnalise: valeursAchat.nom.trim(),
    });
  };

  // I4 : coût de la config active (modification prioritaire, sinon achat).
  const instanceOuverte = instanceOuverteId
    ? achats.find((pp) => pp.id === instanceOuverteId) ?? null
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
        Number(instanceOuverte.prieres?.cout_xp_base ?? 0),
      ) - instanceOuverte.xp_depense;
    if (delta !== 0)
      coutEnCours = {
        delta,
        libelle: delta > 0 ? "modification en cours" : "remboursement",
      };
  }
  if (!coutEnCours && priereOuverte && achatComplet) {
    coutEnCours = { delta: coutXpAchat, libelle: "achat en cours" };
  }

  // L1 : entrées dynamiques de la légende (uniquement ce que CE joueur voit).
  const prieresChargees = Object.values(prieresParDomaine).flatMap(
    (liste) => liste ?? [],
  );
  const typesVisibles = new Set(
    [
      ...prieresChargees.map((p) => p.type_priere),
      ...achats.map((pp) => pp.prieres?.type_priere),
    ].filter((t): t is string => !!t),
  );
  const typesPresents = ORDRE_TYPES.filter((t) => typesVisibles.has(t));
  const plafonds = [
    ...new Set(
      domainesAffiches
        .map((d) => d.niveau_max_prieres ?? 0)
        .filter((n) => n > 0),
    ),
  ].sort((a, b) => a - b);
  const multiples = [...new Set(Object.values(compteParPriereId))].sort(
    (a, b) => a - b,
  );
  const niveauxMin = [
    ...new Set(prieresChargees.map((p) => p.niveau).filter((n) => n > 1)),
  ].sort((a, b) => a - b);

  // I6 : tout est au plafond → MAX ; sinon ↑ (au moins un réglage peut monter).
  const estInstanceAuMax = (pp: AchatPriere) => {
    const maxZonePts = Math.max(
      0,
      ...(ZONES_PAR_TYPE[pp.prieres?.zone_effet ?? ""] ?? []).map(ptsZone),
    );
    const maxPorteePts = Math.max(
      0,
      ...filterPorteesDisponibles(pp.prieres?.portee ?? "").map((p) => p.cout),
    );
    const maxDureePts = Math.max(
      0,
      ...filterDureesDisponibles(pp.prieres?.duree ?? "").map((d) => d.cout),
    );
    return (
      pp.niveau_priere >= nivMaxDomaine(pp.prieres?.domaine) &&
      ptsZone(pp.zone_choisie ?? "") >= maxZonePts &&
      ptsPortee(pp.portee_choisie ?? "") >= maxPorteePts &&
      ptsDuree(pp.duree_choisie ?? "") >= maxDureePts
    );
  };

  const tapPriere = (p: PriereCatalogue) => {
    if (priereOuverteId === p.id) {
      setPriereOuverteId(null);
      return;
    }
    const zoneUnique = !!p.zone_effet && isZoneUnique(p.zone_effet);
    const zones = zoneUnique ? ZONES_PAR_TYPE[p.zone_effet!] ?? [] : [];
    setPriereOuverteId(p.id);
    setValeursAchat({
      zone: zoneUnique ? zones[0] ?? "" : "",
      portee: "",
      duree: "",
      niveau: p.niveau ?? 1,
      nom: p.nom,
    });
  };

  const tapInstance = (pp: AchatPriere) => {
    if (instanceOuverteId === pp.id) {
      setInstanceOuverteId(null);
      return;
    }
    setInstanceOuverteId(pp.id);
    setValeursModif({
      zone: pp.zone_choisie ?? "",
      portee: pp.portee_choisie ?? "",
      duree: pp.duree_choisie ?? "",
      niveau: pp.niveau_priere,
      nom: pp.nom_personnalise ?? pp.prieres?.nom ?? "",
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

  if (loadingPersonnage || loadingAcquisition) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Vérification des conditions…
      </div>
    );
  }

  if (!conditionsRemplies) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">
              Prières divines indisponibles
            </CardTitle>
            <CardDescription>
              Pour acquérir des prières, ce personnage doit posséder la
              compétence « Acquisition de Prière » au niveau 1 minimum.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>
              • Acquisition de Prière :{" "}
              <strong
                className={
                  niveauAcquisition >= 1 ? "text-primary" : "text-destructive"
                }
              >
                niveau {niveauAcquisition}
              </strong>
            </p>
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

  if (loadingDomaines || !proscritsResolus) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Chargement des domaines disponibles…
      </div>
    );
  }

  if (!domainesAffiches || domainesAffiches.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">
              Aucun domaine disponible
            </CardTitle>
            <CardDescription>
              Ce personnage n'a accès à aucun domaine de prières (tous proscrits
              par sa religion ou aucun acquis pour l'instant).
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

  // Premier domaine ouvert (ordre d'affichage) : porte l'astuce W3 catalogue.
  const premierDomaineOuvert =
    domainesAffiches.find((d) => domainesOuverts.has(d.domaine ?? ""))
      ?.domaine ?? null;

  return (
    <div className="relative space-y-5">
      {/* I4 : jauge XP live, AU-DESSUS du bandeau calcul (z-20 > z-[15]) */}
      <JaugeXP xpDisponible={xpDisponible} coutEnCours={coutEnCours} />

      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Achat de prières divines
        </h2>
        <p className="text-sm text-muted-foreground">
          Choisissez un domaine, touchez une prière, personnalisez-la — vos
          prières acquises sont regroupées en bas.
        </p>
      </div>

      {/* W1 : intro d'étape (ouverte par défaut, repli mémorisé) */}
      <IntroEtape
        storageKey={`${PREFIXE_LS}-intro-replie`}
        titre="Comment fonctionne cette étape ?"
      >
        <IntroEtapeItem n={1}>
          Grâce à la compétence{" "}
          <strong>« Acquisition de Prière »</strong>, votre personnage invoque
          les prières de certains <strong>domaines divins</strong> — les cartes
          ci-dessous. Ouvrez un domaine pour découvrir ses prières.
        </IntroEtapeItem>
        <IntroEtapeItem n={2}>
          Touchez une prière pour lire ce qu'elle fait. Pour la préparer, vous
          devez <strong>choisir un réglage dans chacune des 4 familles</strong>{" "}
          : <strong>zone</strong> (combien de cibles), <strong>portée</strong> (à
          quelle distance), <strong>durée</strong> et <strong>niveau</strong>{" "}
          (la puissance).
        </IntroEtapeItem>
        <IntroEtapeItem n={3}>
          Chaque réglage a un coût : le <strong>coût d'achat en XP</strong> se
          calcule tout seul — (zone + portée + durée + niveau) × le{" "}
          <strong>coefficient</strong> propre à la prière. L'encadré doré montre{" "}
          <strong>l'effet exact</strong> que vous obtiendrez.
        </IntroEtapeItem>
        <IntroEtapeItem n={4}>
          Invoquer une prière en jeu coûte aussi des{" "}
          <strong>points de spiritualité (PS)</strong> : ce coût s'affiche juste
          sous le calcul du coût d'achat, et change avec vos réglages.
        </IntroEtapeItem>
        <IntroEtapeItem n={5}>
          Quand ça vous plaît, donnez-lui un nom et <strong>achetez</strong>. La
          prière rejoint « Prières déjà achetées », tout en bas.
        </IntroEtapeItem>
        <IntroEtapeItem n={6}>
          Changé d'avis ? Touchez une prière possédée pour{" "}
          <strong>l'améliorer</strong>
          {modeCampagne
            ? " — ou la supprimer si elle n'a pas encore été jouée en GN"
            : " ou la supprimer"}
          .
        </IntroEtapeItem>
        {modeCampagne && (
          <p className="border-t pt-2 text-[11.5px] leading-relaxed text-muted-foreground">
            En campagne : <strong className="text-gold">fond doré 🔒</strong> =
            prière scellée à un GN (elle ne peut que s'améliorer) ·{" "}
            <strong className="text-emerald-700 dark:text-emerald-400">
              fond vert ＋
            </strong>{" "}
            = ajout récent, encore annulable.
          </p>
        )}
      </IntroEtape>

      {/* L1 : légende dynamique */}
      <LegendeDynamique
        type="priere"
        storageKey={`${PREFIXE_LS}-legende-repliee`}
        typesPresents={typesPresents}
        plafonds={plafonds}
        multiples={multiples}
        niveauxMin={niveauxMin}
        aDesAcquis={modeCampagne && nbAcquis > 0}
        aDesAchats={achats.length > 0}
        modeCampagne={modeCampagne}
      />

      {/* Catalogue : un accordéon par domaine, tout fermé par défaut */}
      <div className="space-y-2.5">
        {domainesAffiches.map((d) => {
          const domaine = d.domaine ?? "";
          const ouvert = domainesOuverts.has(domaine);
          const prieresDuDomaine = prieresParDomaine[domaine];
          const filtre = filtres[domaine] ?? null;
          const visibles = (prieresDuDomaine ?? []).filter(
            (p) => !filtre || p.type_priere === filtre,
          );
          const nbAchetesDomaine = achatsParDomaine[domaine]?.length ?? 0;
          const compteParType: Record<string, number> = {};
          (prieresDuDomaine ?? []).forEach((p) => {
            if (p.type_priere)
              compteParType[p.type_priere] =
                (compteParType[p.type_priere] ?? 0) + 1;
          });

          return (
            <div key={domaine} className="rounded-lg border bg-card">
              <div
                onClick={() =>
                  basculerSet(domainesOuverts, setDomainesOuverts, domaine)
                }
                className="flex cursor-pointer flex-wrap items-center gap-2 px-3.5 py-3"
              >
                <Chevron ouvert={ouvert} />
                <span className="flex-1 font-heading text-[15px] font-bold text-foreground">
                  {domaine}
                </span>
                <Badge variant="outline">≤ niv {d.niveau_max_prieres}</Badge>
                {prieresDuDomaine && (
                  <Badge variant="secondary">
                    {prieresDuDomaine.length} prières
                  </Badge>
                )}
                {nbAchetesDomaine > 0 && (
                  <span
                    className={`whitespace-nowrap rounded-full border px-2 py-px text-[10.5px] font-bold ${
                      modeCampagne
                        ? "border-gold/50 text-gold"
                        : "border-primary/50 text-primary"
                    }`}
                  >
                    {nbAchetesDomaine} achetée{nbAchetesDomaine > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {ouvert && (
                <div>
                  {/* W3 : astuce à la première découverte du catalogue */}
                  {domaine === premierDomaineOuvert && (
                    <Astuce
                      storageKey={`${PREFIXE_LS}-astuce-catalogue-vue`}
                      texte="Touchez une prière pour lire sa description et la configurer. Les réglages (zone, portée, durée, niveau) font varier sa puissance et son coût en XP."
                    />
                  )}

                  {/* I7 : filtre par type (masqué si < 2 types) */}
                  <FiltreTypeMagie
                    compteParType={compteParType}
                    total={(prieresDuDomaine ?? []).length}
                    filtre={filtre}
                    onFiltre={(f) => setFiltres({ ...filtres, [domaine]: f })}
                  />

                  {prieresDuDomaine === undefined ? (
                    <div className="flex items-center border-t px-3 py-2.5 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Chargement des prières…
                    </div>
                  ) : visibles.length === 0 ? (
                    <p className="border-t px-3 py-2.5 text-xs text-muted-foreground">
                      {filtre
                        ? "Aucune prière de ce type dans ce domaine."
                        : "Aucune prière disponible pour ce domaine."}
                    </p>
                  ) : (
                    visibles.map((p) => {
                      const selectionnee = priereOuverteId === p.id;
                      const possede = compteParPriereId[p.id] ?? 0;
                      return (
                        <div key={p.id} className="border-t">
                          <div
                            onClick={() => tapPriere(p)}
                            className={`flex cursor-pointer items-start gap-2 px-3 py-2.5 ${
                              selectionnee ? "bg-primary/5" : ""
                            }`}
                          >
                            <Chevron ouvert={selectionnee} className="mt-0.5" />
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                              <strong className="font-heading text-[13.5px] text-primary">
                                {p.nom}
                              </strong>
                              {/* I9 : déjà possédé ×N */}
                              {possede > 0 && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    montrerAide({
                                      titre: `⧉ ×${possede}`,
                                      texte: `Vous possédez déjà ${possede} version${possede > 1 ? "s" : ""} de cette prière (configurations différentes possibles). Retrouvez-les dans « Prières déjà achetées ».`,
                                    });
                                  }}
                                  className="cursor-pointer whitespace-nowrap rounded-full border border-gold/50 px-2 py-px text-[10px] font-bold text-gold"
                                >
                                  ⧉ ×{possede}
                                </span>
                              )}
                              {p.niveau > 1 && (
                                <Badge variant="outline">Niv. {p.niveau}+</Badge>
                              )}
                              {pastilleAide(p.type_priere)}
                            </div>
                          </div>

                          {selectionnee && (
                            <div className="space-y-2.5 border-l-[3px] border-l-primary px-3 pb-4 pt-1">
                              {p.description_courte && (
                                <p className="text-sm text-muted-foreground">
                                  {p.description_courte}
                                </p>
                              )}
                              <ManuelDepliable
                                tronc={p.description_tronc}
                                description={p.description}
                              />
                              <ConstructeurMagie
                                type="priere"
                                zoneEffet={p.zone_effet ?? ""}
                                porteeMax={p.portee ?? ""}
                                dureeMax={p.duree ?? ""}
                                coutXpBase={Number(p.cout_xp_base ?? 0)}
                                niveauMax={Math.max(
                                  1,
                                  d.niveau_max_prieres ?? 1,
                                )}
                                valeurs={valeursAchat}
                                onChange={setValeursAchat}
                                plancher={null}
                                bonusNiveau={
                                  p.bonus_niveau as BonusNiveau | null
                                }
                                paliers={p.paliers as PalierSort[] | null}
                                stickyTop={54}
                                preReglages
                                effetInstance={
                                  (p.effet_instance ??
                                    null) as EffetInstance | null
                                }
                                afficherProchainPalier
                              />
                              {(() => {
                                const xpInsuffisants =
                                  peutAcheter && coutXpAchat > xpDisponible;
                                return (
                                  <Button
                                    onClick={handleAcheter}
                                    disabled={
                                      !peutAcheter ||
                                      mutation.isPending ||
                                      xpInsuffisants
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
                                    Acheter cette prière ({coutXpAchat} XP)
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

      {/* Prières déjà achetées : accordéon à 2 niveaux (section → domaine →
          instances), tap sur une instance = modification directe (M2). */}
      <div className="rounded-lg border bg-card">
        <div
          onClick={() => setSectionAchetesOuverte((o) => !o)}
          className="flex cursor-pointer items-center gap-2 px-3.5 py-3"
        >
          <Chevron ouvert={sectionAchetesOuverte} />
          <span className="flex-1 font-heading text-[15px] font-bold text-foreground">
            Prières déjà achetées
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
                texte={`Touchez une de vos prières pour l'améliorer${
                  modeCampagne
                    ? " — fond doré 🔒 = scellée à un GN (améliorable seulement), fond vert ＋ = encore annulable"
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
                Aucune prière achetée pour le moment.
              </p>
            ) : (
              Object.entries(achatsParDomaine).map(([domaine, liste]) => {
                const domaineOuvert = domainesAchetesOuverts.has(domaine);
                return (
                  <div key={domaine} className="border-t">
                    <div
                      onClick={() =>
                        basculerSet(
                          domainesAchetesOuverts,
                          setDomainesAchetesOuverts,
                          domaine,
                        )
                      }
                      className="flex cursor-pointer items-center gap-2 py-2.5 pl-6 pr-3.5"
                    >
                      <Chevron ouvert={domaineOuvert} />
                      <span className="flex-1 font-heading text-[13.5px] font-semibold text-foreground">
                        {domaine}
                      </span>
                      <Badge variant="outline">{liste.length}</Badge>
                    </div>

                    {domaineOuvert &&
                      liste.map((pp) => {
                        const acquis = estPriereAcquise(
                          modeCampagne,
                          photo,
                          pp.priere_id,
                          pp.id,
                        );
                        const ajout = modeCampagne && !acquis;
                        const auMax = estInstanceAuMax(pp);
                        const ouverte = instanceOuverteId === pp.id;
                        const nomActuel =
                          pp.nom_personnalise ?? pp.prieres?.nom ?? "Prière";
                        const valeursActuelles = {
                          niveau: pp.niveau_priere,
                          zone: pp.zone_choisie ?? "",
                          portee: pp.portee_choisie ?? "",
                          duree: pp.duree_choisie ?? "",
                        };
                        // Plancher photo (acquis) — valeurs de la PHOTO, pas
                        // l'état courant (plancherInstancePriere, tel quel).
                        const plancher = plancherInstancePriere(
                          modeCampagne,
                          photo,
                          pp.priere_id,
                          pp.id,
                          valeursActuelles,
                        );

                        return (
                          <div
                            key={pp.id}
                            className={`ml-2.5 border-t ${
                              acquis
                                ? "border-l-4 border-l-gold bg-gold/10"
                                : ajout
                                  ? "border-l-[3px] border-l-emerald-600/60 bg-emerald-600/[0.07]"
                                  : ""
                            }`}
                          >
                            <div
                              onClick={() => tapInstance(pp)}
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
                                  Niv. {pp.niveau_priere}
                                </Badge>
                                {pastilleAide(pp.prieres?.type_priere)}
                                {/* I6 : indicateur de balayage pur — tap = aide L2 */}
                                {auMax ? (
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      montrerAide({
                                        titre: "MAX",
                                        texte:
                                          "Cette prière est au maximum : niveau, zone, portée et durée sont tous au plafond. Seul le nom peut encore changer.",
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
                                          "Cette prière peut encore monter : au moins un réglage (niveau, zone, portée ou durée) n'est pas au plafond. Touchez-la pour l'améliorer.",
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
                                          "Confirmée à un GN : impossible à supprimer ou à affaiblir. Vous pouvez seulement l'améliorer (jamais sous son plancher).",
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
                                          "Achetée dans la fenêtre courante (pas encore jouée en GN) : modifiable et supprimable librement, XP remboursés.",
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
                                    {pp.zone_choisie} ·{" "}
                                    {ptsZone(pp.zone_choisie ?? "")} XP
                                  </Badge>
                                  <Badge variant="outline">
                                    {pp.portee_choisie} ·{" "}
                                    {ptsPortee(pp.portee_choisie ?? "")} XP
                                  </Badge>
                                  <Badge variant="outline">
                                    {pp.duree_choisie} ·{" "}
                                    {ptsDuree(pp.duree_choisie ?? "")} XP
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    · {pp.xp_depense} XP ·{" "}
                                    {calculerCoutPS(pp.xp_depense)} PS
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
                                          id: pp.id,
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

                                {/* Incantation : conservée des instances É7 */}
                                {pp.duree_incantation_calculee != null && (
                                  <p className="text-xs text-muted-foreground">
                                    Incantation : {pp.duree_incantation_calculee}{" "}
                                    s
                                  </p>
                                )}

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
                                      Acquis : confirmée à un GN. Améliorable
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

                                {pp.prieres?.description_courte && (
                                  <p className="text-sm text-muted-foreground">
                                    {pp.prieres.description_courte}
                                  </p>
                                )}
                                <ManuelDepliable
                                  tronc={pp.prieres?.description_tronc}
                                  description={pp.prieres?.description_courte}
                                />

                                {/* Effet calculé AVANT → APRÈS (live) */}
                                <AvantApres
                                  effet={
                                    (pp.prieres?.effet_instance ??
                                      null) as EffetInstance | null
                                  }
                                  paliers={
                                    pp.prieres?.paliers as PalierSort[] | null
                                  }
                                  niveauAvant={pp.niveau_priere}
                                  niveauApres={valeursModif.niveau}
                                />

                                <ConstructeurMagie
                                  type="priere"
                                  zoneEffet={pp.prieres?.zone_effet ?? ""}
                                  porteeMax={pp.prieres?.portee ?? ""}
                                  dureeMax={pp.prieres?.duree ?? ""}
                                  coutXpBase={Number(
                                    pp.prieres?.cout_xp_base ?? 0,
                                  )}
                                  niveauMax={nivMaxDomaine(pp.prieres?.domaine)}
                                  valeurs={valeursModif}
                                  onChange={setValeursModif}
                                  plancher={plancher}
                                  bonusNiveau={pp.prieres?.bonus_niveau ?? null}
                                  paliers={
                                    pp.prieres?.paliers as PalierSort[] | null
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
                                        Number(pp.prieres?.cout_xp_base ?? 0),
                                      )
                                    : pp.xp_depense;
                                  const diff = coutApres - pp.xp_depense;
                                  const nomTrim = valeursModif.nom.trim();
                                  const inchange =
                                    valeursModif.zone ===
                                      (pp.zone_choisie ?? "") &&
                                    valeursModif.portee ===
                                      (pp.portee_choisie ?? "") &&
                                    valeursModif.duree ===
                                      (pp.duree_choisie ?? "") &&
                                    valeursModif.niveau === pp.niveau_priere &&
                                    nomTrim === nomActuel;
                                  const xpInsuffisants = diff > xpDisponible;
                                  return (
                                    <>
                                      {diff > 0 ? (
                                        <div className="space-y-0.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
                                          <p className="font-semibold">
                                            Coût de la modification : +{diff} XP
                                          </p>
                                          <p className="text-xs opacity-90">
                                            {pp.xp_depense} XP → {coutApres} XP ·
                                            il vous reste {xpDisponible} XP
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
                                          modifierMutation.isPending
                                        }
                                        onClick={() =>
                                          modifierMutation.mutate({
                                            personnagePriereId: pp.id,
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
            <AlertDialogTitle>Supprimer cette prière ?</AlertDialogTitle>
            {aSupprimer && (
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  {aSupprimer.apercu.bloque ? (
                    <p className="text-destructive">
                      {aSupprimer.apercu.message_action}
                    </p>
                  ) : aSupprimer.apercu.reprise_totale === 0 ? (
                    <p>
                      La prière « {aSupprimer.nom} » sera supprimée et tu
                      récupéreras{" "}
                      <strong>+{aSupprimer.apercu.xp_rembourse} XP</strong>.
                    </p>
                  ) : (
                    <>
                      <p>
                        Supprimer la prière « {aSupprimer.nom} » du Domaine «{" "}
                        {aSupprimer.apercu.domaine} » va :
                      </p>
                      <ul className="list-disc space-y-1 pl-5">
                        <li>
                          te rendre son coût (+
                          {aSupprimer.apercu.xp_rembourse} XP)
                        </li>
                        {aSupprimer.apercu.reprises.map((r, idx) => (
                          <li key={idx}>
                            reprendre le rabais qu'elle donnait sur{" "}
                            {r.competence} niveau {r.niveau} pour le Domaine «{" "}
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
                  desacheterMutation.mutate(aSupprimer.personnage_priere_id);
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

export default Etape7_Prieres_V2;
