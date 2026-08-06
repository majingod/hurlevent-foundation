// Wrapper léger : délègue le rendu visuel à <FichePersonnageView mode="wizard-preview" />.
// Conserve uniquement le titre wizard + boutons Précédent/Finaliser + mutation
// valider_personnage_final (handler PR #77 préservé verbatim).
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { clientActif } from "@/creation/clientActif";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Loader2, ScrollText } from "lucide-react";
import FichePersonnageView from "@/components/personnage/FichePersonnageView";
import {
  decisionApresDryRun,
  totalXpDormant,
  type AvertissementAccesDormant,
} from "./Etape10_Recapitulatif_V2.accesDormants";

interface Etape10Props {
  personnageId: string;
  onSuccess?: () => void;
  onPrevious?: () => void;
  modeAdmin?: boolean;
  onTerminerAdmin?: () => void;
  modeCampagne?: boolean;
  onTerminerCampagne?: () => void;
}

interface ValidationError {
  code?: string;
  message?: string;
  champ?: string;
}

interface ValidationWarning extends AvertissementAccesDormant {
  code?: string;
  message?: string;
}

interface ValidationResult {
  valide?: boolean;
  erreurs?: ValidationError[];
  avertissements?: ValidationWarning[];
  est_verrouille?: boolean;
  non_autorise?: boolean;
  message?: string;
  [k: string]: unknown;
}

const Etape10_Recapitulatif_V2 = ({
  personnageId,
  onSuccess,
  onPrevious,
  modeAdmin = false,
  onTerminerAdmin,
  modeCampagne = false,
  onTerminerCampagne,
}: Etape10Props) => {
  const [fenetreAccesDormants, setFenetreAccesDormants] = useState<
    AvertissementAccesDormant[] | null
  >(null);

  const finaliserMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await clientActif.validerPersonnageFinal({
        p_personnage_id: personnageId,
      });
      if (error) throw error;
      return data as ValidationResult | null;
    },
    onSuccess: (data) => {
      const result = (data ?? {}) as ValidationResult;

      if (result.non_autorise === true) {
        toast.error("Accès refusé", {
          description:
            "Vous n'êtes pas autorisé à finaliser ce personnage.",
        });
        return;
      }

      const avertissements = result.avertissements ?? [];
      const avertDesc = avertissements
        .map((a) => a.message ?? a.code)
        .filter(Boolean)
        .join("\n");

      if (result.valide === true) {
        toast.success(
          result.message ?? "Personnage finalisé et verrouillé !",
          avertDesc ? { description: avertDesc } : undefined,
        );
        onSuccess?.();
        return;
      }

      const errs = result.erreurs ?? [];
      const errDesc = errs
        .map((e) => e.message ?? e.code)
        .filter(Boolean)
        .join("\n");

      toast.error("Validation impossible", {
        description: errDesc || result.message || "Erreur inconnue.",
      });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // D51 (s379) : dry-run avant finalisation — la fenêtre des accès magiques
  // dormants ne doit apparaître QUE si le dry-run est valide (§4.1.2/3).
  const dryRunMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await clientActif.validerPersonnageFinal({
        p_personnage_id: personnageId,
        p_dry_run: true,
      });
      if (error) throw error;
      return data as ValidationResult | null;
    },
    onSuccess: (data) => {
      const result = (data ?? {}) as ValidationResult;

      if (result.non_autorise === true) {
        toast.error("Accès refusé", {
          description:
            "Vous n'êtes pas autorisé à finaliser ce personnage.",
        });
        return;
      }

      const decision = decisionApresDryRun(result);
      switch (decision.action) {
        case "erreur": {
          const errs = result.erreurs ?? [];
          const errDesc = errs
            .map((e) => e.message ?? e.code)
            .filter(Boolean)
            .join("\n");

          toast.error("Validation impossible", {
            description: errDesc || result.message || "Erreur inconnue.",
          });
          return;
        }
        case "ouvrir_fenetre":
          setFenetreAccesDormants(decision.avertissements);
          return;
        case "finaliser":
          finaliserMutation.mutate();
          return;
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold text-foreground flex items-center gap-2">
          <ScrollText className="h-5 w-5" />
          Récapitulatif et finalisation
        </h2>
        <p className="text-sm text-muted-foreground">
          {modeAdmin
            ? "Aperçu de la fiche. En mode admin, terminer l'édition ne change pas l'état du personnage."
            : modeCampagne
            ? "Aperçu de la fiche. Tes ajouts et améliorations sont déjà enregistrés ; tu peux terminer."
            : "Vérifiez l'ensemble des informations de votre personnage avant de le finaliser. Une fois finalisé, le personnage sera verrouillé."}
        </p>
      </div>

      <FichePersonnageView personnageId={personnageId} mode="wizard-preview" />

      <div className="flex justify-between">
        {onPrevious && (
          <Button variant="outline" onClick={onPrevious}>
            ← Précédent
          </Button>
        )}
        {modeAdmin ? (
          <Button
            size="lg"
            className="ml-auto"
            onClick={() => onTerminerAdmin?.()}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Terminer l'édition admin
          </Button>
        ) : modeCampagne ? (
          <Button
            size="lg"
            className="ml-auto"
            onClick={() => onTerminerCampagne?.()}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Terminer
          </Button>
        ) : (
          <Button
            size="lg"
            className="ml-auto"
            onClick={() => dryRunMutation.mutate()}
            disabled={dryRunMutation.isPending || finaliserMutation.isPending}
          >
            {dryRunMutation.isPending || finaliserMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finalisation…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Finaliser le personnage
              </>
            )}
          </Button>
        )}
      </div>

      {/* D51 (s379) : fenêtre des accès magiques dormants, ouverte uniquement
          si le dry-run renvoie des avertissements (D51-c). */}
      <Dialog
        open={fenetreAccesDormants !== null}
        onOpenChange={(open) => {
          if (!open) setFenetreAccesDormants(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="min-w-0 break-words">Finaliser malgré des accès inutilisés ?</DialogTitle>
            <DialogDescription>
              Ces accès magiques ne t'ouvrent sur aucun sort ni aucune prière.
              Une fois la fiche verrouillée, tu ne pourras plus récupérer
              cette XP.
            </DialogDescription>
          </DialogHeader>
          {fenetreAccesDormants && (
            <div className="space-y-2 py-2 text-sm">
              <p className="font-semibold">
                Accès sans effet ({fenetreAccesDormants.length}) :
              </p>
              <ul className="ml-4 list-disc space-y-1 text-xs">
                {fenetreAccesDormants.map((a, idx) => (
                  <li key={`${a.code}-${idx}`}>{a.message}</li>
                ))}
              </ul>
              <p className="pt-2 font-semibold text-primary">
                Total dormant : {totalXpDormant(fenetreAccesDormants)} XP
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setFenetreAccesDormants(null)}>
              Revenir aux sorts
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFenetreAccesDormants(null);
                finaliserMutation.mutate();
              }}
              disabled={finaliserMutation.isPending}
            >
              {finaliserMutation.isPending && (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              )}
              Finaliser quand même
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Etape10_Recapitulatif_V2;
