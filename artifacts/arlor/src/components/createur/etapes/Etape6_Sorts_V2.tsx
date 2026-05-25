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

type SortRow = Database["public"]["Tables"]["sorts"]["Row"];
type PersonnageSortRow = Database["public"]["Tables"]["personnage_sorts"]["Row"];
type CercleDispo =
  Database["public"]["Views"]["vue_cercles_disponibles"]["Row"];

interface Etape6Props {
  personnageId: string;
  /**
   * Etape de creation actuelle cote serveur (personnages.etape_creation).
   * Sert de garde a l'auto-skip : on ne skip qu'en avancement (forward).
   */
  etapeCreation?: number;
  /**
   * Drapeau parent : true seulement si on est sur l'etape la plus haute
   * jamais atteinte dans cette session. Si false (l'utilisateur est revenu
   * en arriere), l'auto-skip est desactive meme si etapeCreation === 6.
   * Defaut true pour compatibilite.
   */
  autoSkipActif?: boolean;
  /**
   * XP encore disponibles pour le personnage (xp_total - xp_depense).
   * Sert au grisage UI du bouton d'achat quand le budget est insuffisant.
   * Le serveur reste l'arbitre final de la validation.
   */
  xpDisponible?: number;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onPrevious?: () => void;
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

const Etape6_Sorts_V2 = ({
  personnageId,
  etapeCreation,
  autoSkipActif = true,
  xpDisponible = 0,
  onSuccess,
  onError,
  onPrevious,
}: Etape6Props) => {
  const queryClient = useQueryClient();

  const [cercleSelectionne, setCercleSelectionne] = useState<string | null>(null);
  const [sortId, setSortId] = useState<string | null>(null);
  const [zoneChoisie, setZoneChoisie] = useState<string>("");
  const [porteeChoisie, setPorteeChoisie] = useState<string>("");
  const [dureeChoisie, setDureeChoisie] = useState<string>("");
  const [niveauSort, setNiveauSort] = useState<number>(1);
  const [nomPersonnalise, setNomPersonnalise] = useState<string>("");
  const [aSupprimer, setASupprimer] = useState<{
    personnage_sort_id: string;
    nom: string;
    xp_depense: number;
  } | null>(null);

  // Cercles disponibles (vue_cercles_disponibles)
  const { data: cerclesDisponibles, isLoading: loadingCercles } = useQuery({
    queryKey: ["cercles-disponibles", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vue_cercles_disponibles")
        .select("cercle, niveau_max_sorts, personnage_id")
        .eq("personnage_id", personnageId)
        .order("cercle");
      if (error) throw error;
      return (data ?? []) as CercleDispo[];
    },
    enabled: !!personnageId,
  });

  const cercleObj = cerclesDisponibles?.find(
    (c) => c.cercle === cercleSelectionne,
  );
  const niveauMaxCercle = cercleObj?.niveau_max_sorts ?? 0;

  // Sorts du cercle (niveau ≤ niveau_max_sorts)
  const { data: sorts, isLoading: loadingSorts } = useQuery({
    queryKey: ["sorts-cercle", cercleSelectionne, niveauMaxCercle],
    queryFn: async () => {
      if (!cercleSelectionne) return [] as SortRow[];
      const { data, error } = await supabase
        .from("sorts")
        .select("*")
        .eq("cercle", cercleSelectionne)
        .lte("niveau", niveauMaxCercle)
        .eq("est_actif", true)
        .order("niveau")
        .order("nom");
      if (error) throw error;
      return (data ?? []) as SortRow[];
    },
    enabled: !!cercleSelectionne && niveauMaxCercle > 0,
  });

  // Sorts déjà achetés (lecture seule)
  const { data: sortsAchetes, isLoading: loadingAchats } = useQuery({
    queryKey: ["personnage-sorts", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnage_sorts")
        .select("*, sorts(nom, cercle)")
        .eq("personnage_id", personnageId)
        .order("date_acquisition");
      if (error) throw error;
      return (data ?? []) as (PersonnageSortRow & {
        sorts: { nom: string | null; cercle: string | null } | null;
      })[];
    },
    enabled: !!personnageId,
  });

  const sortSelectionne = sorts?.find((s) => s.id === sortId) ?? null;

  // Reset quand on change de cercle
  useEffect(() => {
    setSortId(null);
  }, [cercleSelectionne]);

  // Reset / pré-remplissage quand on change de sort
  useEffect(() => {
    if (!sortSelectionne) {
      setZoneChoisie("");
      setPorteeChoisie("");
      setDureeChoisie("");
      setNiveauSort(1);
      setNomPersonnalise("");
      return;
    }
    setNomPersonnalise(sortSelectionne.nom);
    setNiveauSort(sortSelectionne.niveau ?? 1);
    if (
      sortSelectionne.zone_effet &&
      isZoneUnique(sortSelectionne.zone_effet)
    ) {
      const zones = ZONES_PAR_TYPE[sortSelectionne.zone_effet] ?? [];
      setZoneChoisie(zones[0] ?? "");
    } else {
      setZoneChoisie("");
    }
    setPorteeChoisie("");
    setDureeChoisie("");
  }, [sortId, sortSelectionne]);

  const zonesDisponibles = useMemo(() => {
    if (!sortSelectionne?.zone_effet) return [] as string[];
    return ZONES_PAR_TYPE[sortSelectionne.zone_effet] ?? [];
  }, [sortSelectionne]);

  const porteesDispo = useMemo(
    () =>
      sortSelectionne?.portee
        ? filterPorteesDisponibles(sortSelectionne.portee)
        : PORTEES,
    [sortSelectionne],
  );

  const dureesDispo = useMemo(
    () =>
      sortSelectionne?.duree
        ? filterDureesDisponibles(sortSelectionne.duree)
        : DUREES,
    [sortSelectionne],
  );

  const coutXpBase = Number(sortSelectionne?.cout_xp_base ?? 0);
  const coutXp =
    sortSelectionne && zoneChoisie && porteeChoisie && dureeChoisie
      ? calculerCoutXP(
          zoneChoisie,
          porteeChoisie,
          dureeChoisie,
          niveauSort,
          coutXpBase,
        )
      : 0;
  const coutPS = coutXp > 0 ? calculerCoutPS(coutXp) : 0;

  const zoneEstUnique = sortSelectionne?.zone_effet
    ? isZoneUnique(sortSelectionne.zone_effet)
    : false;
  const noteZone = sortSelectionne?.zone_effet
    ? getNoteZone(sortSelectionne.zone_effet)
    : null;

  const mutation = useMutation({
    mutationFn: async (params: AcheterSortParams) => {
      const { data, error } = await supabase.rpc("acheter_sort", params);
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
      setSortId(null);
      setCercleSelectionne(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  const desacheterMutation = useMutation({
    mutationFn: async (personnageSortId: string) => {
      const { data, error } = await supabase.rpc("desacheter_sort", {
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey.includes(personnageId),
      });
      toast.success("Sort supprimé et XP remboursés.");
      setASupprimer(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error);
    },
  });

  // Avance etape_creation de 6 a 7 cote serveur. Les etapes 5-9 n'ont pas
  // de sauvegarder_etape_N : sans cet appel, le bouton « Suivant » ne ferait
  // que relire etape_creation et resterait bloque sur l'etape courante.
  const avancerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("avancer_etape", {
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

  // Auto-skip : si l'utilisateur arrive sur l'etape 6 en avancement
  // (etapeCreation === 6) et qu'aucun cercle n'est disponible (l'etape
  // d'acquisition de cercles n'a rien produit), on fait avancer
  // etape_creation cote serveur immediatement, sans clic. Le useRef
  // empeche le re-trigger dans un meme mount. En backward
  // (etapeCreation > 6), l'effet ne se declenche pas et l'utilisateur
  // voit l'ecran statique avec le bouton « Suivant ».
  const skipDeclencheRef = useRef(false);
  useEffect(() => {
    if (!autoSkipActif) return;
    if (skipDeclencheRef.current) return;
    if (etapeCreation == null || etapeCreation > 6) return;
    if (loadingCercles) return;
    if (cerclesDisponibles && cerclesDisponibles.length > 0) return;
    if (avancerMutation.isPending) return;
    skipDeclencheRef.current = true;
    avancerMutation.mutate();
  }, [autoSkipActif, etapeCreation, loadingCercles, cerclesDisponibles, avancerMutation]);

  const peutAcheter =
    !!sortSelectionne &&
    !!zoneChoisie &&
    !!porteeChoisie &&
    !!dureeChoisie &&
    nomPersonnalise.trim().length > 0 &&
    coutXp > 0;

  const handleAcheter = () => {
    if (!peutAcheter || !sortSelectionne) return;
    mutation.mutate({
      p_personnage_id: personnageId,
      p_sort_id: sortSelectionne.id,
      p_zone_choisie: zoneChoisie,
      p_portee_choisie: porteeChoisie,
      p_duree_choisie: dureeChoisie,
      p_niveau_sort: niveauSort,
      p_nom_personnalise: nomPersonnalise.trim(),
    });
  };

  if (loadingCercles) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Chargement des cercles disponibles…
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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Étape 6 — Achat de sorts arcaniques
        </h2>
        <p className="text-sm text-muted-foreground">
          Choisissez un cercle, sélectionnez un sort, puis personnalisez sa
          zone, sa portée, sa durée et son niveau.
        </p>
      </div>

      {/* 1. Cercle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">
            1. Choisir un cercle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={cercleSelectionne ?? ""}
            onValueChange={(v) => setCercleSelectionne(v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un cercle" />
            </SelectTrigger>
            <SelectContent>
              {cerclesDisponibles.map((c) => (
                <SelectItem key={c.cercle ?? ""} value={c.cercle ?? ""}>
                  {c.cercle} — sorts jusqu'au niveau {c.niveau_max_sorts}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 2. Sort */}
      {cercleSelectionne && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">
              2. Choisir un sort
            </CardTitle>
            <CardDescription>
              Sorts du cercle « {cercleSelectionne} » jusqu'au niveau{" "}
              {niveauMaxCercle}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingSorts ? (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Chargement des sorts…
              </div>
            ) : (sorts ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun sort disponible pour ce cercle.
              </p>
            ) : (
              (sorts ?? []).map((s) => (
                <Card
                  key={s.id}
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    sortId === s.id
                      ? "border-2 border-primary ring-2 ring-primary/20"
                      : ""
                  }`}
                  onClick={() => setSortId(s.id)}
                >
                  <CardContent className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="font-heading text-primary">
                        {s.nom}
                      </strong>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">Niv. {s.niveau}</Badge>
                        {s.type_sort && (
                          <Badge variant="secondary">{s.type_sort}</Badge>
                        )}
                        <Badge>{s.cout_xp_base} XP base</Badge>
                      </div>
                    </div>
                    {s.description && (
                      <p className="text-sm text-muted-foreground">
                        {s.description}
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
      {sortSelectionne && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">
              3. Personnaliser le sort
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
              <Label>Niveau du sort : {niveauSort}</Label>
              <Slider
                value={[niveauSort]}
                onValueChange={(v) => setNiveauSort(v[0])}
                min={1}
                max={Math.max(1, niveauMaxCercle)}
                step={1}
              />
            </div>

            {/* Nom personnalisé */}
            <div className="space-y-2">
              <Label>Nom personnalisé</Label>
              <Input
                value={nomPersonnalise}
                onChange={(e) => setNomPersonnalise(e.target.value)}
                placeholder="Nom du sort"
              />
            </div>

            {/* Récapitulatif coûts */}
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between">
                <span>Coût XP :</span>
                <strong className="text-primary">{coutXp} XP</strong>
              </div>
              <div className="flex justify-between">
                <span>Coût PS à l'incantation :</span>
                <strong>{coutPS} PS</strong>
              </div>
            </div>

            {(() => {
              const xpInsuffisants = peutAcheter && coutXp > xpDisponible;
              return (
                <Button
                  onClick={handleAcheter}
                  disabled={!peutAcheter || mutation.isPending || xpInsuffisants}
                  title={
                    xpInsuffisants
                      ? `XP insuffisants (manque ${coutXp - xpDisponible} XP)`
                      : undefined
                  }
                  className={`w-full ${xpInsuffisants ? "opacity-50" : ""}`}
                >
                  {mutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Acheter ce sort ({coutXp} XP)
                </Button>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Sorts déjà achetés (lecture seule) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">
            Sorts déjà achetés ({sortsAchetes?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingAchats ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Chargement…
            </div>
          ) : !sortsAchetes || sortsAchetes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun sort acheté pour le moment.
            </p>
          ) : (
            sortsAchetes.map((ps) => (
              <div
                key={ps.id}
                className="space-y-1 rounded-lg border border-border p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="font-heading text-primary">
                      {ps.nom_personnalise ?? ps.sorts?.nom}
                    </strong>
                    {ps.sorts?.cercle && (
                      <Badge variant="outline">{ps.sorts.cercle}</Badge>
                    )}
                    <Badge variant="secondary">Niv. {ps.niveau_sort}</Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() =>
                      setASupprimer({
                        personnage_sort_id: ps.id,
                        nom: ps.nom_personnalise ?? ps.sorts?.nom ?? "Sort",
                        xp_depense: ps.xp_depense,
                      })
                    }
                    disabled={desacheterMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ps.zone_choisie} • {ps.portee_choisie} • {ps.duree_choisie}
                </p>
                <p className="text-xs">
                  <strong>{ps.xp_depense} XP</strong> •{" "}
                  {calculerCoutPS(ps.xp_depense)} PS
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
            <AlertDialogTitle>Supprimer ce sort ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le sort « {aSupprimer?.nom} » sera supprimé et vous récupérerez{" "}
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
                  desacheterMutation.mutate(aSupprimer.personnage_sort_id);
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

export default Etape6_Sorts_V2;
