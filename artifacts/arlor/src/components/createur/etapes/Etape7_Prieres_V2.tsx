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
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { BadgeAcquis } from "@/components/createur/BadgeAcquis";
import { LabelAjoutAnnulable } from "@/components/createur/LabelAjoutAnnulable";
import ConstructeurMagie, {
  type ValeursConstructeur,
} from "@/components/createur/ConstructeurMagie";
import DescriptionDepliable from "@/components/createur/DescriptionDepliable";
import { useDernierePhotoCompo } from "@/hooks/useDernierePhotoCompo";
import { estPriereAcquise } from "@/lib/acquisCampagne";
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

const Etape7_Prieres_V2 = ({
  personnageId,
  etapeCreation,
  xpDisponible = 0,
  onSuccess,
  onError,
  onPrevious,
  modeCampagne = false,
}: Etape7Props) => {
  const queryClient = useQueryClient();

  // PR-C2 : photo de compo (frontière des acquis). Fetch seulement en campagne.
  const { data: photo } = useDernierePhotoCompo(personnageId, modeCampagne);

  const [domaineSelectionne, setDomaineSelectionne] = useState<string | null>(
    null,
  );
  const [priereId, setPriereId] = useState<string | null>(null);
  const [valeurs, setValeurs] = useState<ValeursConstructeur>({
    zone: "",
    portee: "",
    duree: "",
    niveau: 1,
    nom: "",
  });
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
  // Pas de prérequis "est_croyant" pour Acquisition de Domaine selon le Manuel 2026.
  // Le backend a déjà été corrigé en session 26 (RPC acheter_priere + vue
  // vue_domaines_disponibles). Régression frontend corrigée en session 33.
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
      setValeurs({ zone: "", portee: "", duree: "", niveau: 1, nom: "" });
      return;
    }
    const zoneUnique =
      !!priereSelectionnee.zone_effet &&
      isZoneUnique(priereSelectionnee.zone_effet);
    const zones = zoneUnique
      ? ZONES_PAR_TYPE[priereSelectionnee.zone_effet!] ?? []
      : [];
    setValeurs({
      zone: zoneUnique ? zones[0] ?? "" : "",
      portee: "",
      duree: "",
      niveau: priereSelectionnee.niveau ?? 1,
      nom: priereSelectionnee.nom,
    });
  }, [priereId, priereSelectionnee]);

  const coutXpBase = Number(priereSelectionnee?.cout_xp_base ?? 0);
  const coutXp =
    priereSelectionnee && valeurs.zone && valeurs.portee && valeurs.duree
      ? calculerCoutXP(
          valeurs.zone,
          valeurs.portee,
          valeurs.duree,
          valeurs.niveau,
          coutXpBase,
        )
      : 0;

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

  const peutAcheter =
    !!priereSelectionnee &&
    !!valeurs.zone &&
    !!valeurs.portee &&
    !!valeurs.duree &&
    valeurs.nom.trim().length > 0 &&
    coutXp > 0;

  const handleAcheter = () => {
    if (!peutAcheter || !priereSelectionnee) return;
    mutation.mutate({
      p_personnage_id: personnageId,
      p_priere_id: priereSelectionnee.id,
      p_zone_choisie: valeurs.zone,
      p_portee_choisie: valeurs.portee,
      p_duree_choisie: valeurs.duree,
      p_niveau_priere: valeurs.niveau,
      p_nom_personnalise: valeurs.nom.trim(),
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
              « Acquisition de Prière » au niveau 1 minimum.
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
          <div className="flex flex-wrap gap-2">
            {domainesAffiches.map((d) => {
              const selectionne = domaineSelectionne === d.domaine;
              return (
                <Button
                  key={d.domaine ?? ""}
                  type="button"
                  variant={selectionne ? "default" : "outline"}
                  onClick={() => setDomaineSelectionne(d.domaine)}
                  className="h-auto flex-col items-start gap-0 px-3 py-2"
                >
                  <span>{d.domaine}</span>
                  <span
                    className={`text-xs font-normal ${
                      selectionne
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    }`}
                  >
                    ≤ niv {d.niveau_max_prieres}
                  </span>
                </Button>
              );
            })}
          </div>
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
                        {p.portee && (
                          <Badge variant="outline">portée ≤ {p.portee}</Badge>
                        )}
                        {p.duree && (
                          <Badge variant="outline">durée ≤ {p.duree}</Badge>
                        )}
                      </div>
                    </div>
                    <DescriptionDepliable
                      courte={p.description_courte}
                      complete={p.description}
                    />
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
            <ConstructeurMagie
              type="priere"
              zoneEffet={priereSelectionnee.zone_effet ?? ""}
              porteeMax={priereSelectionnee.portee ?? ""}
              dureeMax={priereSelectionnee.duree ?? ""}
              coutXpBase={coutXpBase}
              niveauMax={Math.max(1, niveauMaxDomaine)}
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
                  Acheter cette prière ({coutXp} XP)
                </Button>
              );
            })()}
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
            prieresAchetees.map((pp) => {
              // PR-C2 : prière scellée par la photo de compo (désachat refusé).
              const acquis = estPriereAcquise(modeCampagne, photo, pp.priere_id, pp.id);
              return (
              <div
                key={pp.id}
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
                      {pp.nom_personnalise ?? pp.prieres?.nom}
                    </strong>
                    {pp.prieres?.domaine && (
                      <Badge variant="outline">{pp.prieres.domaine}</Badge>
                    )}
                    <Badge variant="secondary">Niv. {pp.niveau_priere}</Badge>
                    {acquis && <BadgeAcquis />}
                    {!acquis && modeCampagne && <LabelAjoutAnnulable />}
                  </div>
                  {!acquis && (
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
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">
                    {pp.zone_choisie} · {COUT_ZONE[pp.zone_choisie ?? ""] ?? 0}
                    pt
                  </Badge>
                  <Badge variant="outline">
                    {pp.portee_choisie} ·{" "}
                    {PORTEES.find((p) => p.label === pp.portee_choisie)?.cout ??
                      0}
                    pt
                  </Badge>
                  <Badge variant="outline">
                    {pp.duree_choisie} ·{" "}
                    {DUREES.find((d) => d.label === pp.duree_choisie)?.cout ??
                      0}
                    pt
                  </Badge>
                </div>
                {pp.duree_incantation_calculee != null && (
                  <p className="text-xs text-muted-foreground">
                    Incantation : {pp.duree_incantation_calculee} s
                  </p>
                )}
                <p className="text-xs">
                  <strong>{pp.xp_depense} XP</strong> •{" "}
                  {calculerCoutPS(pp.xp_depense)} PS
                </p>
              </div>
              );
            })
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
