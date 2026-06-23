import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useProfil } from "@/contexts/ProfilContext";
import Sigil from "@/components/profil/Sigil";

interface Props {
  personnage: { id: string; nom: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Appelée après un transfert réussi (le parent invalide les listes). */
  onTransfered: () => void;
}

interface RetourTransfert {
  succes?: boolean;
  erreurs?: { code: string; message: string }[];
  avertissements?: { code: string; message: string }[];
  donnees?: { profil_cible_nom?: string } | null;
}

export default function ModaleTransfertPersonnage({
  personnage,
  open,
  onOpenChange,
  onTransfered,
}: Props) {
  const { profils, joueurId, profilActif, rechargerProfils } = useProfil();
  const [cibleId, setCibleId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Profils cibles = tous les profils du compte sauf le profil actif.
  const cibles = profils.filter((p) => p.id !== joueurId);

  const fermer = () => {
    setCibleId(null);
    onOpenChange(false);
  };

  const transferer = async () => {
    if (!personnage || !cibleId) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("transferer_personnage", {
      p_personnage_id: personnage.id,
      p_profil_cible_id: cibleId,
    });
    setBusy(false);

    if (error) {
      toast.error(`Transfert impossible : ${error.message}`);
      return;
    }
    const res = (data ?? {}) as RetourTransfert;
    if (!res.succes) {
      toast.error(res.erreurs?.[0]?.message ?? "Le transfert a échoué.");
      return;
    }
    const cibleNom = res.donnees?.profil_cible_nom ?? "l'autre profil";
    toast.success(`« ${personnage.nom} » transféré vers ${cibleNom}.`);
    // Avertissements éventuels (ex. historique de présence conservé sur l'ancien profil).
    res.avertissements?.forEach((a) => toast(a.message));
    // Rafraîchit les compteurs de personnages par profil (écran « Qui joue ? »).
    await rechargerProfils();
    onTransfered();
    fermer();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) fermer(); }}>
      <DialogContent className="border-white/10 bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-gold font-heading">Transférer le personnage</DialogTitle>
          <DialogDescription className="text-white/70">
            Déplacer «{personnage?.nom}» vers un autre profil de ton compte. Le personnage
            quittera {profilActif?.nom ?? "ce profil"}.
          </DialogDescription>
        </DialogHeader>

        {cibles.length === 0 ? (
          <p className="text-sm text-white/60">
            Aucun autre profil disponible. Crée un second profil pour pouvoir transférer un
            personnage.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {cibles.map((p) => {
              const sel = cibleId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setCibleId(p.id)}
                  className={`flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                    sel ? "border-gold bg-gold/10" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <Sigil nom={p.nom} size={44} actif={sel} />
                  <div>
                    <div className={`font-heading text-base ${sel ? "text-gold" : "text-white"}`}>
                      {p.nom}
                    </div>
                    <div className="text-xs text-white/50">
                      {p.nb_personnages} personnage{p.nb_personnages > 1 ? "s" : ""}
                    </div>
                  </div>
                  {sel && <span className="ml-auto text-gold">✓</span>}
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={fermer} disabled={busy}>
            Annuler
          </Button>
          <Button
            className="bg-gold text-black font-bold hover:bg-gold/80"
            onClick={transferer}
            disabled={busy || !cibleId}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transférer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
