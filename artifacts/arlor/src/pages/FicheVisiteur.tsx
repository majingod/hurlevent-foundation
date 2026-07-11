import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import FichePersonnageView from "@/components/personnage/FichePersonnageView";
import { queryClientVisiteur } from "@/creation/visiteur/queryClientVisiteur";
import { PERSONNAGE_LOCAL_ID } from "@/creation/visiteur/clientVisiteur";
import { brouillonFinaliseDisponible } from "@/creation/visiteur/gardeFicheVisiteur";

/**
 * Page PUBLIQUE : fiche consultable du personnage visiteur finalisé (s322).
 *
 * Cul-de-sac corrigé : avant, un visiteur ne pouvait plus revoir son
 * personnage une fois `/visiteur` quitté. `FichePersonnageView` est déjà
 * client-agnostique (toutes les `lireFiche*` existent dans `clientVisiteur`)
 * et affiche déjà `BlocEmporter` (code de reprise + export .json) via
 * `estModeVisiteur()` — il ne manquait que cette route.
 */
const FicheVisiteur = () => {
  const navigate = useNavigate();
  const disponible = brouillonFinaliseDisponible();

  useEffect(() => {
    if (!disponible) {
      toast.info("Aucun personnage finalisé sur cet appareil.");
      navigate("/visiteur", { replace: true });
    }
  }, [disponible, navigate]);

  if (!disponible) return null;

  return (
    // BUG s312-1 : provider scopé — sans lui, toutes les queries du wizard
    // restent PAUSED en mode avion. Même wrapper que CreationVisiteur.
    <QueryClientProvider client={queryClientVisiteur}>
      <div className="mx-auto max-w-4xl px-4 pt-10">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 gap-2">
            <Link to="/visiteur">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
          </Button>
          <h1 className="font-heading text-3xl text-primary">
            Ta fiche de personnage
          </h1>
        </div>

        <div className="mt-6">
          <FichePersonnageView
            personnageId={PERSONNAGE_LOCAL_ID}
            mode="wizard-preview"
          />
        </div>
      </div>
    </QueryClientProvider>
  );
};

export default FicheVisiteur;
