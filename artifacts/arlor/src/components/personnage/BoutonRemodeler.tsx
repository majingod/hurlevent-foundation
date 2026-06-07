import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Wrench, Lock, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/* Bouton « Remodeler le personnage » — gardé par etat_edition_personnage.
   Actif uniquement si peut_tout_editer ; sinon désactivé + raison (DB).
   Clic -> reouvrir_personnage -> éditeur (récap, étape 10). */

interface EtatEdition {
  etat: string;
  raison: string;
  peut_ajouter: boolean;
  peut_tout_editer: boolean;
}

interface Props {
  personnageId: string;
  /** compact = carte du tableau de bord (taille sm, pas de légende). */
  compact?: boolean;
}

export default function BoutonRemodeler({ personnageId, compact = false }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: etat, isLoading } = useQuery<EtatEdition | null>({
    queryKey: ["etat-edition", personnageId],
    enabled: !!personnageId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("etat_edition_personnage", {
        p_personnage_id: personnageId,
      });
      if (error) throw error;
      return (data ?? null) as EtatEdition | null;
    },
  });

  if (isLoading || !etat) return null;

  const peutEditer = etat.peut_tout_editer === true;
  const size = compact ? "sm" : "default";

  const handleRemodeler = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("reouvrir_personnage", {
      p_personnage_id: personnageId,
    });
    if (error) {
      setBusy(false);
      toast.error(`Impossible de rouvrir : ${error.message}`);
      return;
    }
    const payload = (data ?? {}) as {
      succes?: boolean;
      erreurs?: Array<{ message?: string }>;
    };
    if (payload.succes !== true) {
      setBusy(false);
      toast.error(payload.erreurs?.[0]?.message ?? "Réouverture refusée.");
      return;
    }
    await queryClient.invalidateQueries({
      queryKey: ["etat-edition", personnageId],
    });
    toast.success("Personnage rouvert — tu peux le remodeler.");
    navigate(`/personnage/nouveau?id=${personnageId}`);
  };

  if (!peutEditer) {
    return (
      <div className="w-full">
        <Button
          variant="outline"
          size={size}
          disabled
          className="w-full gap-2"
          title={etat.raison}
        >
          <Lock className="h-4 w-4" />
          Modification indisponible
        </Button>
        {!compact && (
          <p className="mt-1.5 text-xs text-muted-foreground">{etat.raison}</p>
        )}
      </div>
    );
  }

  return (
    <Button
      onClick={handleRemodeler}
      disabled={busy}
      size={size}
      variant="secondary"
      className="w-full gap-2 border border-gold/20 bg-gold/10 text-gold hover:bg-gold/20"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Wrench className="h-4 w-4" />
      )}
      Remodeler le personnage
    </Button>
  );
}
