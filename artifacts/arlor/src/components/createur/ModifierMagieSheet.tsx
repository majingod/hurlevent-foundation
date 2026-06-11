import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import ConstructeurMagie, {
  type PlancherMagie,
  type ValeursConstructeur,
} from "@/components/createur/ConstructeurMagie";
import { COUT_ZONE, DUREES, PORTEES, ZONES_PAR_TYPE } from "@/constants/magie";
import {
  calculerCoutXP,
  filterDureesDisponibles,
  filterPorteesDisponibles,
  type BonusNiveau,
  type PalierSort,
} from "@/utils/calculsMagie";
import DescriptionDepliable from "@/components/createur/DescriptionDepliable";

// Coût pts par variable — mêmes barèmes que ConstructeurMagie / cout_pts_* SQL.
const ptsZone = (zone: string) => COUT_ZONE[zone] ?? 0;
const ptsPortee = (portee: string) =>
  PORTEES.find((p) => p.label === portee)?.cout ?? 0;
const ptsDuree = (duree: string) =>
  DUREES.find((d) => d.label === duree)?.cout ?? 0;

export interface ModifierMagieInstance {
  /** instance_id (personnage_sorts.id / personnage_prieres.id) */
  id: string;
  /** sort_id / priere_id */
  baseId: string;
  nomBase: string;
  nomPersonnalise: string | null;
  niveau: number;
  zone: string;
  portee: string;
  duree: string;
  xpDepense: number;
}

export interface ModifierMagieBase {
  zoneEffet: string;
  porteeMax: string;
  dureeMax: string;
  coutXpBase: number;
  /** cercle (sort) ou domaine (prière) */
  groupe: string;
  /** bonus par niveau dérivé (PR #361), affiché dans la barre de formule */
  bonusNiveau?: BonusNiveau | null;
  courte?: string | null;
  tronc?: string | null;
  paliers?: PalierSort[] | null;
}

interface ModifierMagieSheetProps {
  type: "sort" | "priere";
  open: boolean;
  onClose: () => void;
  personnageId: string;
  instance: ModifierMagieInstance;
  base: ModifierMagieBase;
  /** niveau_max du cercle/domaine */
  niveauMax: number;
  plancher: PlancherMagie | null;
  xpDisponible: number;
  modeCampagne: boolean;
}

/**
 * Éditeur « Modifier » partagé sorts/prières (PR-B). Branche les RPC
 * modifier_sort / modifier_priere (migration 20260610212504) : ConstructeurMagie
 * prérempli, plancher photo visualisé (pills verrouillées), coût par différence
 * signée (surcoût / remboursement). Le serveur reste l'arbitre — le grisage du
 * bouton est cosmétique.
 */
const ModifierMagieSheet = ({
  type,
  open,
  onClose,
  personnageId,
  instance,
  base,
  niveauMax,
  plancher,
  xpDisponible,
  modeCampagne,
}: ModifierMagieSheetProps) => {
  const queryClient = useQueryClient();

  const nomActuel = instance.nomPersonnalise ?? instance.nomBase;

  const [valeurs, setValeurs] = useState<ValeursConstructeur>({
    zone: instance.zone,
    portee: instance.portee,
    duree: instance.duree,
    niveau: instance.niveau,
    nom: nomActuel,
  });

  const complet = !!valeurs.zone && !!valeurs.portee && !!valeurs.duree;
  const coutApres = complet
    ? calculerCoutXP(
        valeurs.zone,
        valeurs.portee,
        valeurs.duree,
        valeurs.niveau,
        base.coutXpBase,
      )
    : instance.xpDepense;
  const diff = coutApres - instance.xpDepense;

  const nomTrim = valeurs.nom.trim();
  const inchange =
    valeurs.zone === instance.zone &&
    valeurs.portee === instance.portee &&
    valeurs.duree === instance.duree &&
    valeurs.niveau === instance.niveau &&
    nomTrim === nomActuel;

  const xpInsuffisants = diff > xpDisponible;

  // « Déjà au maximum » : plancher non null et aucun axe ne peut monter
  // (niveau au plafond du cercle + chaque variable au coût pts max dispo).
  const maxZonePts = Math.max(
    0,
    ...(ZONES_PAR_TYPE[base.zoneEffet] ?? []).map(ptsZone),
  );
  const maxPorteePts = Math.max(
    0,
    ...filterPorteesDisponibles(base.porteeMax).map((p) => p.cout),
  );
  const maxDureePts = Math.max(
    0,
    ...filterDureesDisponibles(base.dureeMax).map((d) => d.cout),
  );
  const dejaAuMaximum =
    plancher !== null &&
    plancher.niveau >= niveauMax &&
    ptsZone(plancher.zone) >= maxZonePts &&
    ptsPortee(plancher.portee) >= maxPorteePts &&
    ptsDuree(plancher.duree) >= maxDureePts;

  const mutation = useMutation({
    mutationFn: async () => {
      const params: Record<string, unknown> = {
        [type === "sort" ? "p_personnage_sort_id" : "p_personnage_priere_id"]:
          instance.id,
        [type === "sort" ? "p_niveau_sort" : "p_niveau_priere"]: valeurs.niveau,
        p_zone_choisie: valeurs.zone,
        p_portee_choisie: valeurs.portee,
        p_duree_choisie: valeurs.duree,
      };
      // Nom envoyé seulement s'il change : DEFAULT NULL ⇒ COALESCE conserve l'actuel.
      if (nomTrim !== nomActuel) params.p_nom_personnalise = nomTrim;

      const { data, error } = await (supabase as any).rpc(
        type === "sort" ? "modifier_sort" : "modifier_priere",
        params,
      );
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
      const mot = type === "sort" ? "Sort modifié" : "Prière modifiée";
      if (xpDiff > 0) toast.success(`${mot} (−${xpDiff} XP).`);
      else if (xpDiff < 0)
        toast.success(`${mot}, ${-xpDiff} XP remboursés.`);
      else toast.success(`${mot}.`);
      onClose();
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

  const boutonLabel =
    diff > 0
      ? `Modifier (+${diff} XP)`
      : diff < 0
        ? `Modifier (récupérer ${-diff} XP)`
        : "Modifier";

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Modifier « {nomActuel} »</SheetTitle>
          <SheetDescription>
            {base.groupe} · actuellement {instance.xpDepense} XP
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Bandeau d'état */}
          {plancher !== null ? (
            <div className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Acquis : confirmé à un GN. Améliorable seulement — jamais sous
                niv {plancher.niveau} · {plancher.zone} · {plancher.portee} ·{" "}
                {plancher.duree}.
              </span>
            </div>
          ) : modeCampagne ? (
            <div className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
              Ajout de la fenêtre courante : modification libre dans les deux
              sens (baisser = remboursement).
            </div>
          ) : null}

          {dejaAuMaximum && (
            <p className="text-xs text-muted-foreground">
              {type === "sort" ? "Ce sort est" : "Cette prière est"} déjà au
              maximum — seul le nom peut changer.
            </p>
          )}

          <DescriptionDepliable courte={base.courte} tronc={base.tronc} />

          <ConstructeurMagie
            type={type}
            zoneEffet={base.zoneEffet}
            porteeMax={base.porteeMax}
            dureeMax={base.dureeMax}
            coutXpBase={base.coutXpBase}
            niveauMax={niveauMax}
            valeurs={valeurs}
            onChange={setValeurs}
            plancher={plancher}
            bonusNiveau={base.bonusNiveau ?? null}
            paliers={base.paliers ?? null}
          />

          {/* Encadré différence signée */}
          {diff > 0 ? (
            <div className="space-y-0.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
              <p className="font-semibold">
                Coût de la modification : +{diff} XP
              </p>
              <p className="text-xs opacity-90">
                {instance.xpDepense} XP → {coutApres} XP · il vous reste{" "}
                {xpDisponible} XP
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
              XP insuffisants : il manque {diff - xpDisponible} XP
            </p>
          )}

          <Button
            className="w-full"
            disabled={
              !complet || inchange || xpInsuffisants || mutation.isPending
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {boutonLabel}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ModifierMagieSheet;
