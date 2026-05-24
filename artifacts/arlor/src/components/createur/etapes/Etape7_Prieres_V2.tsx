import { useEffect, useMemo, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
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
  getNoteZone,
  isZoneUnique,
} from "@/utils/calculsMagie";

type PriereRow = Database["public"]["Tables"]["prieres"]["Row"];
type PersonnagePriereRow =
  Database["public"]["Tables"]["personnage_prieres"]["Row"];
type DomaineDispo =
  Database["public"]["Views"]["vue_domaines_disponibles"]["Row"];

interface Etape7Props {
  personnageId: string;
  /**
   * Etape de creation actuelle cote serveur (personnages.etape_creation).
   * Sert de garde a l'auto-skip : on ne skip qu'en avancement (forward).
   */
  etapeCreation?: number;
  /**
   * Drapeau parent : true seulement si on est sur l'etape la plus haute
   * jamais atteinte dans cette session. Si false (l'utilisateur est revenu
   * en arriere), l'auto-skip est desactive meme si etapeCreation === 7.
   * Defaut true pour compatibilite.
   */
  autoSkipActif?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onPrevious?: () => void;
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

const Etape7_Prieres_V2 = ({
  personnageId,
  etapeCreation,
  autoSkipActif = true,
  onSuccess,
  onError,
  onPrevious,
}: Etape7Props) => {
  const queryClient = useQueryClient();

  const [domaineSelectionne, setDomaineSelectionne] = useState<string | null>(
    null,
  );
  const [priereId, setPriereId] = useState<string | null>(null);
  const [zoneChoisie, setZoneChoisie] = useState<string>("");
  const [porteeChoisie, setPorteeChoisie] = useState<string>("");
  const [dureeChoisie, setDureeChoisie] = useState<string>("");
  const [niveauPriere, setNiveauPriere] = useState<number>(1);
  const [nomPersonnalise, setNomPersonnalise] = useState<string>("");
  const [aSupprimer, setASupprimer] = useState<{
    personnage_priere_id: string;
    nom: string;
    xp_depense: number;
  } | null>(null);

  // Personnage : est_croyant + religion
  const { data: personnage, isLoading: loadingPersonnage } = useQuery({
    queryKey: ["personnage-prieres-meta", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnages")
        .select("id, est_croyant, religion_id")
        .eq("id", personnageId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!personnageId,
  });

  // Compétence "Acquisition de Domaine" : niveau ≥ 1
  const { data: acquisitionDomaine, isLoading: loadingAcquisition } = useQuery({
    queryKey: ["acquisition-domaine", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnage_competences")
        .select("niveau_acquis, competences!inner(nom)")
        .eq("personnage_id", personnageId)
        .eq("competences.nom", "Acquisition de Domaine")
        .order("niveau_acquis", { ascending: false })
        .limit(1);
      if (error) throw error;
      const niveau = data?.[0]?.niveau_acquis ?? 0;
      return niveau;
    },
    enabled: !!personnageId,
  });

  const niveauAcquisition = acquisitionDomaine ?? 0;
  const estCroyant = personnage?.est_croyant ?? false;
  const religionId = personnage?.religion_id ?? null;
  const conditionsRemplies = estCroyant && niveauAcquisition >= 1;

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

  const domaineObj = domainesAffiches.find(
    (d) => d.domaine === domaineSelectionne,
  );
  const niveauMaxDomaine = domaineObj?.niveau_max_prieres ?? 0;

  // Prières du domaine (niveau ≤ niveau_max_prieres)
  const { data: prieres, isLoading: loadingPrieres } = useQuery({
    queryKey: ["prieres-domaine", domaineSelectionne, niveauMaxDomaine],
    queryFn: async () => {
      if (!domaineSelectionne) return [] as PriereRow[];
      const { data, error } = await supabase
        .from("prieres")
        .select("*")
        .eq("domaine", domaineSelectionne)
        .lte("niveau", niveauMaxDomaine)
        .eq("est_actif", true)
        .order("niveau")
        .order("nom");
      if (error) throw error;
      return (data ?? []) as PriereRow[];
    },
    enabled: !!domaineSelectionne && niveauMaxDomaine > 0,
  });

  // Prières déjà achetées (lecture seule)
  const { data: prieresAchetees, isLoading: loadingAchats } = useQuery({
    queryKey: ["personnage-prieres", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnage_prieres")
        .select("*, prieres(nom, domaine)")
        .eq("personnage_id", personnageId)
        .order("date_acquisition");
      if (error) throw error;
      return (data ?? []) as (PersonnagePriereRow & {
        prieres: { nom: string | null; domaine: string | null } | null;
      })[];
    },
    enabled: !!personnageId,
  });

  const priereSelectionnee = prieres?.find((p) => p.id === priereId) ?? null;

  // Reset quand on change de domaine
  useEffect(() => {
    setPriereId(null);
  }, [domaineSelectionne]);

  // Reset / pré-remplissage quand on change de prière
  useEffect(() => {
    if (!priereSelectionnee) {
      setZoneChoisie("");
      setPorteeChoisie("");
      setDureeChoisie("");
      setNiveauPriere(1);
      setNomPersonnalise("");
      return;
    }
    setNomPersonnalise(priereSelectionnee.nom);
    setNiveauPriere(priereSelectionnee.niveau ?? 1);
    if (
      priereSelectionnee.zone_effet &&
      isZoneUnique(priereSelectionnee.zone_effet)
    ) {
      const zones = ZONES_PAR_TYPE[priereSelectionnee.zone_effet] ?? [];
      setZoneChoisie(zones[0] ?? "");
    } else {
      setZoneChoisie("");
    }
    setPorteeChoisie("");
    setDureeChoisie("");
  }, [priereId, priereSelectionnee]);

  const zonesDisponibles = useMemo(() => {
    if (!priereSelectionnee?.zone_effet) return [] as string[];
    return ZONES_PAR_TYPE[priereSelectionnee.zone_effet] ?? [];
  }, [priereSelectionnee]);

  const porteesDispo = useMemo(
    () =>
      priereSelectionnee?.portee
        ? filterPorteesDisponibles(priereSelectionnee.portee)
        : PORTEES,
    [priereSelectionnee],
  );

  const dureesDispo = useMemo(
    () =>
      priereSelectionnee?.duree
        ? filterDureesDisponibles(priereSelectionnee.duree)
        : DUREES,
    [priereSelectionnee],
  );

  const coutXpBase = Number(priereSelectionnee?.cout_xp_base ?? 0);
  const coutXp =
    priereSelectionnee && zoneChoisie && porteeChoisie && dureeChoisie
      ? calculerCoutXP(
          zoneChoisie,
          porteeChoisie,
          dureeChoisie,
          niveauPriere,
          coutXpBase,
        )
      : 0;
  const coutPS = coutXp > 0 ? calculerCoutPS(coutXp) : 0;

  const zoneEstUnique = priereSelectionnee?.zone_effet
    ? isZoneUnique(priereSelectionnee.zone_effet)
    : false;
  const noteZone = priereSelectionnee?.zone_effet
    ? getNoteZone(priereSelectionnee.zone_effet)
    : null;

  const mutation = useMutation({
    mutationFn: async (params: AcheterPriereParams) => {
      const { data, error } = await supabase.rpc("acheter_priere", params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalide toutes les queries qui contiennent personnageId dans leur
      // clef. Cela couvre ["personnage-prieres", id], ["domaines-disponibles", id]
      // ET ["v2-personnage", id] du parent (header XP), sans avoir a lister
      // chaque queryKey explicitement.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      toast.success("Prière acquise !");
      setPriereId(null);
      setDomaineSelectionne(null);
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      toast.success("Prière supprimée et XP remboursés.");
      setASupprimer(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
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

  // Auto-skip : si l'utilisateur arrive sur l'etape 7 en avancement
  // (etapeCreation === 7) et qu'aucune prière n'est achetable pour ce
  // personnage, on fait avancer etape_creation cote serveur immédiatement.
  // Deux cas couverts :
  //   1. !conditionsRemplies : Non-croyant ou sans Acquisition de Domaine
  //   2. conditionsRemplies mais domaines tous proscrits / aucun disponible
  // La garde queriesPrerequisChargees évite un déclenchement prématuré
  // avant que personnage + acquisitionDomaine soient résolus (pattern
  // PR #139 réinstauré).
  const queriesPrerequisChargees =
    !loadingPersonnage && !loadingAcquisition;
  const aucunePriereAchetable =
    queriesPrerequisChargees &&
    (!conditionsRemplies ||
      (!loadingDomaines &&
        proscritsResolus &&
        domainesAffiches.length === 0));

  const skipDeclencheRef = useRef(false);
  useEffect(() => {
    if (!autoSkipActif) return;
    if (skipDeclencheRef.current) return;
    if (etapeCreation == null || etapeCreation > 7) return;
    if (!aucunePriereAchetable) return;
    if (avancerMutation.isPending) return;
    skipDeclencheRef.current = true;
    avancerMutation.mutate();
  }, [autoSkipActif, etapeCreation, aucunePriereAchetable, avancerMutation]);

  const peutAcheter =
    !!priereSelectionnee &&
    !!zoneChoisie &&
    !!porteeChoisie &&
    !!dureeChoisie &&
    nomPersonnalise.trim().length > 0 &&
    coutXp > 0;

  const handleAcheter = () => {
    if (!peutAcheter || !priereSelectionnee) return;
    mutation.mutate({
      p_personnage_id: personnageId,
      p_priere_id: priereSelectionnee.id,
      p_zone_choisie: zoneChoisie,
      p_portee_choisie: porteeChoisie,
      p_duree_choisie: dureeChoisie,
      p_niveau_priere: niveauPriere,
      p_nom_personnalise: nomPersonnalise.trim(),
    });
  };

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
              Étape 7 — Prières divines indisponibles
            </CardTitle>
            <CardDescription>
              Pour acquérir des prières, ce personnage doit posséder la compétence
              « Acquisition de Domaine » au niveau 1 minimum, et être croyant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>
              • Acquisition de Domaine :{" "}
              <strong
                className={
                  niveauAcquisition >= 1 ? "text-primary" : "text-destructive"
                }
              >
                niveau {niveauAcquisition}
              </strong>
            </p>
            <p>
              • Croyant :{" "}
              <strong
                className={estCroyant ? "text-primary" : "text-destructive"}
              >
                {estCroyant ? "oui" : "non"}
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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Étape 7 — Achat de prières divines
        </h2>
        <p className="text-sm text-muted-foreground">
          Choisissez un domaine, sélectionnez une prière, puis personnalisez sa
          zone, sa portée, sa durée et son niveau.
        </p>
      </div>

      {/* 1. Domaine */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">
            1. Choisir un domaine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={domaineSelectionne ?? ""}
            onValueChange={(v) => setDomaineSelectionne(v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un domaine" />
            </SelectTrigger>
            <SelectContent>
              {domainesAffiches.map((d) => (
                <SelectItem key={d.domaine ?? ""} value={d.domaine ?? ""}>
                  {d.domaine} — prières jusqu'au niveau {d.niveau_max_prieres}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 2. Prière */}
      {domaineSelectionne && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">
              2. Choisir une prière
            </CardTitle>
            <CardDescription>
              Prières du domaine « {domaineSelectionne} » jusqu'au niveau{" "}
              {niveauMaxDomaine}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingPrieres ? (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Chargement des prières…
              </div>
            ) : (prieres ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune prière disponible pour ce domaine.
              </p>
            ) : (
              (prieres ?? []).map((p) => (
                <Card
                  key={p.id}
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    priereId === p.id
                      ? "border-2 border-primary ring-2 ring-primary/20"
                      : ""
                  }`}
                  onClick={() => setPriereId(p.id)}
                >
                  <CardContent className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="font-heading text-primary">
                        {p.nom}
                      </strong>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Niv. {p.niveau}</Badge>
                        {p.type_priere && (
                          <Badge variant="secondary">{p.type_priere}</Badge>
                        )}
                        <Badge>{p.cout_xp_base} XP base</Badge>
                      </div>
                    </div>
                    {p.description && (
                      <p className="text-sm text-muted-foreground">
                        {p.description}
                      </p>
                    )}
                    {p.duree_incantation && (
                      <p className="text-xs italic text-muted-foreground">
                        Durée d'incantation : {p.duree_incantation}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. Personnalisation */}
      {priereSelectionnee && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">
              3. Personnaliser la prière
            </CardTitle>
            <CardDescription>
              Coût XP = (zone + portée + durée + niveau) × coût de base.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Zone */}
            <div className="space-y-2">
              <Label>Zone d'effet</Label>
              {zoneEstUnique ? (
                <Input value={zoneChoisie} readOnly className="opacity-60" />
              ) : (
                <Select value={zoneChoisie} onValueChange={setZoneChoisie}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zonesDisponibles.map((z) => (
                      <SelectItem key={z} value={z}>
                        {z} ({COUT_ZONE[z] ?? 0} pts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {noteZone && (
                <p className="text-xs italic text-muted-foreground">
                  {noteZone}
                </p>
              )}
            </div>

            {/* Portée */}
            <div className="space-y-2">
              <Label>Portée</Label>
              <Select value={porteeChoisie} onValueChange={setPorteeChoisie}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une portée" />
                </SelectTrigger>
                <SelectContent>
                  {porteesDispo.map((p) => (
                    <SelectItem key={p.label} value={p.label}>
                      {p.label} ({p.cout} pts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Durée */}
            <div className="space-y-2">
              <Label>Durée</Label>
              <Select value={dureeChoisie} onValueChange={setDureeChoisie}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une durée" />
                </SelectTrigger>
                <SelectContent>
                  {dureesDispo.map((d) => (
                    <SelectItem key={d.label} value={d.label}>
                      {d.label} ({d.cout} pts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Niveau */}
            <div className="space-y-2">
              <Label>Niveau de la prière : {niveauPriere}</Label>
              <Slider
                value={[niveauPriere]}
                onValueChange={(v) => setNiveauPriere(v[0])}
                min={1}
                max={Math.max(1, niveauMaxDomaine)}
                step={1}
              />
            </div>

            {/* Nom personnalisé */}
            <div className="space-y-2">
              <Label>Nom personnalisé</Label>
              <Input
                value={nomPersonnalise}
                onChange={(e) => setNomPersonnalise(e.target.value)}
                placeholder="Nom de la prière"
              />
            </div>

            {/* Récapitulatif coûts */}
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between">
                <span>Coût XP :</span>
                <strong className="text-primary">{coutXp} XP</strong>
              </div>
              <div className="flex justify-between">
                <span>Coût PS à l'invocation :</span>
                <strong>{coutPS} PS</strong>
              </div>
              {priereSelectionnee.duree_incantation && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Durée d'incantation :</span>
                  <span>{priereSelectionnee.duree_incantation}</span>
                </div>
              )}
            </div>

            <Button
              onClick={handleAcheter}
              disabled={!peutAcheter || mutation.isPending}
              className="w-full"
            >
              {mutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Acheter cette prière ({coutXp} XP)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Prières déjà achetées (lecture seule) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">
            Prières déjà acquises ({prieresAchetees?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingAchats ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Chargement…
            </div>
          ) : !prieresAchetees || prieresAchetees.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune prière acquise pour le moment.
            </p>
          ) : (
            prieresAchetees.map((pp) => (
              <div
                key={pp.id}
                className="space-y-1 rounded-lg border border-border p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="font-heading text-primary">
                      {pp.nom_personnalise ?? pp.prieres?.nom}
                    </strong>
                    {pp.prieres?.domaine && (
                      <Badge variant="outline">{pp.prieres.domaine}</Badge>
                    )}
                    <Badge variant="secondary">Niv. {pp.niveau_priere}</Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() =>
                      setASupprimer({
                        personnage_priere_id: pp.id,
                        nom:
                          pp.nom_personnalise ?? pp.prieres?.nom ?? "Prière",
                        xp_depense: pp.xp_depense,
                      })
                    }
                    disabled={desacheterMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {pp.zone_choisie} • {pp.portee_choisie} • {pp.duree_choisie}
                </p>
                <p className="text-xs">
                  <strong>{pp.xp_depense} XP</strong> •{" "}
                  {calculerCoutPS(pp.xp_depense)} PS
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={aSupprimer !== null}
        onOpenChange={(open) => !open && setASupprimer(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette prière ?</AlertDialogTitle>
            <AlertDialogDescription>
              La prière « {aSupprimer?.nom} » sera supprimée et vous récupérerez{" "}
              <strong>{aSupprimer?.xp_depense ?? 0} XP</strong>. Cette action est
              immédiate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desacheterMutation.isPending}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={desacheterMutation.isPending}
              onClick={() => {
                if (aSupprimer) {
                  desacheterMutation.mutate(aSupprimer.personnage_priere_id);
                }
              }}
            >
              {desacheterMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Supprimer
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
    </div>
  );
};

export default Etape7_Prieres_V2;
