import { useEffect, useState } from "react";
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
import { ArrowUp, Loader2, Sparkles, Trash2 } from "lucide-react";
import { BadgeAcquis } from "@/components/createur/BadgeAcquis";
import { LabelAjoutAnnulable } from "@/components/createur/LabelAjoutAnnulable";
import ConstructeurMagie, {
  type ValeursConstructeur,
} from "@/components/createur/ConstructeurMagie";
import ModifierMagieSheet, {
  type ModifierMagieInstance,
} from "@/components/createur/ModifierMagieSheet";
import DescriptionDepliable from "@/components/createur/DescriptionDepliable";
import { useDernierePhotoCompo } from "@/hooks/useDernierePhotoCompo";
import { estSortAcquis, plancherInstanceSort } from "@/lib/acquisCampagne";
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
   * XP encore disponibles pour le personnage (xp_total - xp_depense).
   * Sert au grisage UI du bouton d'achat quand le budget est insuffisant.
   * Le serveur reste l'arbitre final de la validation.
   */
  xpDisponible?: number;
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

const Etape6_Sorts_V2 = ({
  personnageId,
  etapeCreation,
  xpDisponible = 0,
  onSuccess,
  onError,
  onPrevious,
  modeCampagne = false,
}: Etape6Props) => {
  const queryClient = useQueryClient();

  // PR-C2 : photo de compo (frontière des acquis). Fetch seulement en campagne.
  const { data: photo } = useDernierePhotoCompo(personnageId, modeCampagne);

  const [cercleSelectionne, setCercleSelectionne] = useState<string | null>(null);
  const [sortId, setSortId] = useState<string | null>(null);
  const [valeurs, setValeurs] = useState<ValeursConstructeur>({
    zone: "",
    portee: "",
    duree: "",
    niveau: 1,
    nom: "",
  });
  const [aSupprimer, setASupprimer] = useState<{
    personnage_sort_id: string;
    nom: string;
    xp_depense: number;
  } | null>(null);
  // PR-B : instance ciblée par le geste « Modifier » (sheet plancher photo).
  const [enModification, setEnModification] = useState<{
    instance: ModifierMagieInstance;
    base: {
      zoneEffet: string;
      porteeMax: string;
      dureeMax: string;
      coutXpBase: number;
      groupe: string;
    };
    niveauMax: number;
    plancher: ReturnType<typeof plancherInstanceSort>;
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

  // Compétence "Acquisition de Sort" : niveau ≥ 1 (gate opt-in étape 6)
  const { data: acquisitionSort, isLoading: loadingAcquisition } = useQuery({
    queryKey: ["acquisition-sort", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnage_competences")
        .select("niveau_acquis, competences!inner(nom)")
        .eq("personnage_id", personnageId)
        .eq("competences.nom", "Acquisition de Sort")
        .order("niveau_acquis", { ascending: false })
        .limit(1);
      if (error) throw error;
      const niveau = data?.[0]?.niveau_acquis ?? 0;
      return niveau;
    },
    enabled: !!personnageId,
  });

  const niveauAcquisition = acquisitionSort ?? 0;
  const conditionsRemplies = niveauAcquisition >= 1;

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
        .select(
          "*, sorts(nom, cercle, zone_effet, portee, duree, cout_xp_base)",
        )
        .eq("personnage_id", personnageId)
        .order("date_acquisition");
      if (error) throw error;
      return (data ?? []) as (PersonnageSortRow & {
        sorts: {
          nom: string | null;
          cercle: string | null;
          zone_effet: string | null;
          portee: string | null;
          duree: string | null;
          cout_xp_base: number | null;
        } | null;
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
      setValeurs({ zone: "", portee: "", duree: "", niveau: 1, nom: "" });
      return;
    }
    const zoneUnique =
      !!sortSelectionne.zone_effet && isZoneUnique(sortSelectionne.zone_effet);
    const zones = zoneUnique
      ? ZONES_PAR_TYPE[sortSelectionne.zone_effet!] ?? []
      : [];
    setValeurs({
      zone: zoneUnique ? zones[0] ?? "" : "",
      portee: "",
      duree: "",
      niveau: sortSelectionne.niveau ?? 1,
      nom: sortSelectionne.nom,
    });
  }, [sortId, sortSelectionne]);

  const coutXpBase = Number(sortSelectionne?.cout_xp_base ?? 0);
  const coutXp =
    sortSelectionne && valeurs.zone && valeurs.portee && valeurs.duree
      ? calculerCoutXP(
          valeurs.zone,
          valeurs.portee,
          valeurs.duree,
          valeurs.niveau,
          coutXpBase,
        )
      : 0;

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

  const peutAcheter =
    !!sortSelectionne &&
    !!valeurs.zone &&
    !!valeurs.portee &&
    !!valeurs.duree &&
    valeurs.nom.trim().length > 0 &&
    coutXp > 0;

  const handleAcheter = () => {
    if (!peutAcheter || !sortSelectionne) return;
    mutation.mutate({
      p_personnage_id: personnageId,
      p_sort_id: sortSelectionne.id,
      p_zone_choisie: valeurs.zone,
      p_portee_choisie: valeurs.portee,
      p_duree_choisie: valeurs.duree,
      p_niveau_sort: valeurs.niveau,
      p_nom_personnalise: valeurs.nom.trim(),
    });
  };

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
              Étape 6 — Sorts arcaniques indisponibles
            </CardTitle>
            <CardDescription>
              Pour acquérir des sorts, ce personnage doit posséder la compétence
              « Acquisition de Sort » au niveau 1 minimum.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>
              • Acquisition de Sort :{" "}
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
          <div className="flex flex-wrap gap-2">
            {cerclesDisponibles.map((c) => {
              const selectionne = cercleSelectionne === c.cercle;
              return (
                <Button
                  key={c.cercle ?? ""}
                  type="button"
                  variant={selectionne ? "default" : "outline"}
                  onClick={() => setCercleSelectionne(c.cercle)}
                  className="h-auto flex-col items-start gap-0 px-3 py-2"
                >
                  <span>{c.cercle}</span>
                  <span
                    className={`text-xs font-normal ${
                      selectionne
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    }`}
                  >
                    ≤ niv {c.niveau_max_sorts}
                  </span>
                </Button>
              );
            })}
          </div>
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
                        {s.portee && (
                          <Badge variant="outline">portée ≤ {s.portee}</Badge>
                        )}
                        {s.duree && (
                          <Badge variant="outline">durée ≤ {s.duree}</Badge>
                        )}
                      </div>
                    </div>
                    <DescriptionDepliable
                      courte={s.description_courte}
                      complete={s.description}
                    />
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
            <ConstructeurMagie
              type="sort"
              zoneEffet={sortSelectionne.zone_effet ?? ""}
              porteeMax={sortSelectionne.portee ?? ""}
              dureeMax={sortSelectionne.duree ?? ""}
              coutXpBase={coutXpBase}
              niveauMax={Math.max(1, niveauMaxCercle)}
              valeurs={valeurs}
              onChange={setValeurs}
              plancher={null}
            />

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
            sortsAchetes.map((ps) => {
              // PR-C2 : sort scellé par la photo de compo (désachat refusé).
              const acquis = estSortAcquis(modeCampagne, photo, ps.sort_id, ps.id);
              return (
              <div
                key={ps.id}
                className={`space-y-1 rounded-lg border p-3 text-sm ${
                  acquis
                    ? "border-gold/60 border-l-4 border-l-gold bg-gold/15"
                    : modeCampagne
                      ? "border-emerald-600/40 bg-emerald-600/10"
                      : "border-border"
                }`}
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
                    {acquis && <BadgeAcquis />}
                    {!acquis && modeCampagne && <LabelAjoutAnnulable />}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 border-primary/50 text-primary"
                      onClick={() => {
                        const valeursActuelles = {
                          niveau: ps.niveau_sort,
                          zone: ps.zone_choisie ?? "",
                          portee: ps.portee_choisie ?? "",
                          duree: ps.duree_choisie ?? "",
                        };
                        setEnModification({
                          instance: {
                            id: ps.id,
                            baseId: ps.sort_id,
                            nomBase: ps.sorts?.nom ?? "Sort",
                            nomPersonnalise: ps.nom_personnalise,
                            niveau: ps.niveau_sort,
                            zone: ps.zone_choisie ?? "",
                            portee: ps.portee_choisie ?? "",
                            duree: ps.duree_choisie ?? "",
                            xpDepense: ps.xp_depense,
                          },
                          base: {
                            zoneEffet: ps.sorts?.zone_effet ?? "",
                            porteeMax: ps.sorts?.portee ?? "",
                            dureeMax: ps.sorts?.duree ?? "",
                            coutXpBase: Number(ps.sorts?.cout_xp_base ?? 0),
                            groupe: ps.sorts?.cercle ?? "",
                          },
                          niveauMax: Math.max(
                            1,
                            cerclesDisponibles?.find(
                              (c) => c.cercle === ps.sorts?.cercle,
                            )?.niveau_max_sorts ?? 1,
                          ),
                          plancher: plancherInstanceSort(
                            modeCampagne,
                            photo,
                            ps.sort_id,
                            ps.id,
                            valeursActuelles,
                          ),
                        });
                      }}
                    >
                      <ArrowUp className="h-4 w-4" />
                      Modifier
                    </Button>
                    {!acquis && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
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
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">
                    {ps.zone_choisie} · {COUT_ZONE[ps.zone_choisie ?? ""] ?? 0}
                    pt
                  </Badge>
                  <Badge variant="outline">
                    {ps.portee_choisie} ·{" "}
                    {PORTEES.find((p) => p.label === ps.portee_choisie)?.cout ??
                      0}
                    pt
                  </Badge>
                  <Badge variant="outline">
                    {ps.duree_choisie} ·{" "}
                    {DUREES.find((d) => d.label === ps.duree_choisie)?.cout ??
                      0}
                    pt
                  </Badge>
                </div>
                <p className="text-xs">
                  <strong>{ps.xp_depense} XP</strong> •{" "}
                  {calculerCoutPS(ps.xp_depense)} PS
                </p>
              </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {enModification && (
        <ModifierMagieSheet
          type="sort"
          open
          onClose={() => setEnModification(null)}
          personnageId={personnageId}
          instance={enModification.instance}
          base={enModification.base}
          niveauMax={enModification.niveauMax}
          plancher={enModification.plancher}
          xpDisponible={xpDisponible}
          modeCampagne={modeCampagne}
        />
      )}

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
