import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { HistoriqueBanque } from "./HistoriqueBanque";

interface BanqueXpCardProps {
  joueurId: string;
  personnageId: string;
  personnageNom: string | null;
  isOwner: boolean;
}

// Retour RPC forme standard
interface RpcStandard {
  succes: boolean;
  erreurs: { code: string; message: string; champ?: string }[];
  avertissements: string[];
  donnees: {
    xp_verse: number;
    nouveau_solde: number;
    perso_xp_total: number;
    banque_mouvement_id: string;
  } | null;
}

interface SoldeBanque {
  solde: number | null;
  total_gagne: number | null;
  total_transfere: number | null;
}

export const BanqueXpCard = ({
  joueurId,
  personnageId,
  personnageNom,
  isOwner,
}: BanqueXpCardProps) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [montant, setMontant] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);

  const { data: banque } = useQuery({
    queryKey: ["banque-joueur", joueurId],
    queryFn: async (): Promise<SoldeBanque> => {
      const { data, error } = await supabase
        .from("vue_banque_joueur")
        .select("solde, total_gagne, total_transfere")
        .eq("joueur_id", joueurId)
        .maybeSingle();
      if (error) throw error;
      return data ?? { solde: 0, total_gagne: 0, total_transfere: 0 };
    },
  });

  const solde = banque?.solde ?? 0;

  const transfert = useMutation({
    mutationFn: async (montantAVerser: number): Promise<RpcStandard> => {
      const { data, error } = await supabase.rpc(
        "transferer_banque_vers_personnage",
        { p_personnage_cible_id: personnageId, p_montant: montantAVerser },
      );
      if (error) throw error;
      return data as unknown as RpcStandard;
    },
    onSuccess: (res) => {
      if (!res.succes) {
        setErreur(res.erreurs?.[0]?.message ?? "Le versement a échoué.");
        return;
      }
      setErreur(null);
      setOpen(false);
      // Rafraîchit le solde banque + la fiche (xp_total mis à jour par trigger)
      queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey.includes(personnageId) || q.queryKey.includes(joueurId),
      });
    },
    onError: (e) => setErreur(e instanceof Error ? e.message : "Erreur réseau lors du versement."),
  });

  // Carte visible seulement si la banque a du contenu ou si le joueur en est propriétaire
  if (!isOwner && solde <= 0) return null;

  const clamp = (n: number) => Math.max(0, Math.min(solde, n));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Banque XP</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Solde banque</p>
            <p className="font-medium text-primary">{solde} XP</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total gagné</p>
            <p className="font-medium text-foreground">{banque?.total_gagne ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total transféré</p>
            <p className="font-medium text-foreground">{banque?.total_transfere ?? 0}</p>
          </div>
        </div>

        <HistoriqueBanque joueurId={joueurId} />

        {isOwner && (
          <Button
            className="w-full"
            disabled={solde <= 0}
            onClick={() => {
              setMontant(Math.min(5, solde));
              setErreur(null);
              setOpen(true);
            }}
          >
            Verser vers ce personnage…
          </Button>
        )}

        {erreur && !open && (
          <p className="text-sm text-destructive">{erreur}</p>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verser vers {personnageNom ?? "ce personnage"}</DialogTitle>
            <DialogDescription>
              Choisis le montant à transférer depuis ta banque. Cette action est définitive.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMontant((m) => clamp(m - 5))}
            >
              −
            </Button>
            <div className="flex-1 text-center text-2xl font-semibold text-primary">
              {montant} <span className="text-sm text-muted-foreground">XP</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMontant((m) => clamp(m + 5))}
            >
              +
            </Button>
          </div>

          <div className="flex justify-between text-sm text-muted-foreground">
            <span>
              Solde après :{" "}
              <span className="font-medium text-foreground">{clamp(solde - montant)} XP</span>
            </span>
          </div>

          {erreur && open && <p className="text-sm text-destructive">{erreur}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={montant <= 0 || transfert.isPending}
              onClick={() => transfert.mutate(montant)}
            >
              {transfert.isPending ? "Versement…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
