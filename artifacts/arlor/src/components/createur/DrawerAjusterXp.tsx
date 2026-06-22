import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Minus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DrawerAjusterXpProps {
  personnageId: string;
  nom: string | null;
  xpTotal: number;
  xpDepense: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RpcRetour {
  succes?: boolean;
  erreurs?: { code?: string; message?: string; champ?: string }[];
  avertissements?: { code?: string; message?: string }[];
  donnees?: {
    xp_corrige?: number;
    xp_total?: number;
    xp_disponible?: number;
  } | null;
}

// Une ligne d'ajustement : crédit (+) ou retrait (−).
const LigneAjustement = ({
  sens,
  dispo,
  busy,
  onApply,
}: {
  sens: "credit" | "retrait";
  dispo: number;
  busy: boolean;
  onApply: (montantSigne: number, raison: string) => void;
}) => {
  const credit = sens === "credit";
  const [montant, setMontant] = useState("");
  const [raison, setRaison] = useState("");

  const n = Math.abs(parseInt(montant, 10)) || 0;
  const raisonOk = raison.trim().length > 0;
  const tropGrand = !credit && n > dispo;
  const peutValider = n > 0 && raisonOk && !tropGrand && !busy;

  return (
    <div
      className={`space-y-3 rounded-xl border p-4 ${
        credit
          ? "border-primary/40 bg-primary/5"
          : "border-destructive/50 bg-destructive/10"
      }`}
    >
      <div className="flex items-center gap-2">
        {credit ? (
          <Plus className="h-4 w-4 text-primary" />
        ) : (
          <Minus className="h-4 w-4 text-destructive" />
        )}
        <p
          className={`font-heading font-bold ${
            credit ? "text-primary" : "text-destructive"
          }`}
        >
          {credit ? "Créditer de l'XP" : "Retirer de l'XP"}
        </p>
        {!credit && (
          <span className="ml-auto text-xs text-muted-foreground">
            max retirable : <b className="text-foreground">{dispo}</b>
          </span>
        )}
      </div>

      <Input
        type="number"
        min={1}
        inputMode="numeric"
        value={montant}
        onChange={(e) => setMontant(e.target.value)}
        placeholder={credit ? "Nombre d'XP à ajouter" : "Nombre d'XP à retirer"}
      />

      <Input
        type="text"
        value={raison}
        onChange={(e) => setRaison(e.target.value)}
        placeholder="Raison (obligatoire)"
      />
      {!raisonOk && (
        <p className="text-[11.5px] text-muted-foreground">
          La raison est obligatoire (tracée dans le journal et notifiée au joueur).
        </p>
      )}

      {tropGrand && (
        <p className="text-xs text-destructive">
          Retrait supérieur à l'XP disponible ({dispo}). Désacheter des éléments
          d'abord.
        </p>
      )}

      <Button
        className="w-full"
        variant={credit ? "default" : "destructive"}
        disabled={!peutValider}
        onClick={() => onApply(credit ? n : -n, raison.trim())}
      >
        {credit ? `Créditer ${n || ""} XP`.trim() : `Retirer ${n || ""} XP`.trim()}
      </Button>
    </div>
  );
};

const DrawerAjusterXp = ({
  personnageId,
  nom,
  xpTotal,
  xpDepense,
  open,
  onOpenChange,
}: DrawerAjusterXpProps) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const dispo = xpTotal - xpDepense;

  const appliquer = async (montantSigne: number, raison: string) => {
    setBusy(true);
    setErreur(null);
    try {
      const { data, error } = await supabase.rpc("corriger_xp_personnage", {
        p_personnage_id: personnageId,
        p_montant: montantSigne,
        p_raison: raison,
      });
      if (error) throw error;

      const r = (data ?? {}) as unknown as RpcRetour;
      if (r.succes !== true) {
        setErreur(r.erreurs?.[0]?.message ?? "Correction refusée.");
        return;
      }

      // Succès : invalider toutes les queries du perso -> header XP rafraîchi.
      await queryClient.invalidateQueries({
        predicate: (q) => q.queryKey.includes(personnageId),
      });

      const avert = r.avertissements?.[0]?.message;
      toast.success(
        `Correction de ${montantSigne > 0 ? "+" : ""}${montantSigne} XP appliquée.`,
        avert ? { description: avert } : undefined,
      );
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur réseau.";
      setErreur(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-heading text-gold">
            Ajuster l'XP
          </DrawerTitle>
          <DrawerDescription>{nom ?? "Personnage"}</DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 overflow-y-auto px-4 pb-8">
          <div className="flex items-center gap-4 rounded-lg border border-gold/20 bg-gold/5 px-3 py-2">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gold/60">
                XP dispo
              </div>
              <div className="font-heading text-2xl text-gold">{dispo}</div>
            </div>
            <div className="self-center text-xs text-muted-foreground">
              {xpDepense} dépensés / {xpTotal} totaux
            </div>
          </div>

          {erreur && (
            <p className="rounded-md border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
              {erreur}
            </p>
          )}

          <LigneAjustement
            sens="credit"
            dispo={dispo}
            busy={busy}
            onApply={appliquer}
          />
          <LigneAjustement
            sens="retrait"
            dispo={dispo}
            busy={busy}
            onApply={appliquer}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default DrawerAjusterXp;
