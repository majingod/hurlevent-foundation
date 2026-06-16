import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

type Role = "joueur" | "animateur" | "admin";

const ROLE_LABEL: Record<Role, string> = {
  joueur: "Joueur",
  animateur: "Animateur",
  admin: "Admin",
};
const ROLE_BADGE: Record<Role, string> = {
  joueur: "border-border text-muted-foreground",
  animateur: "border-accent/80 text-[hsl(36_33%_80%)]",
  admin: "border-primary/50 text-primary",
};
const ROLE_DESC: Record<Role, string> = {
  joueur: "Accès joueur standard : ses propres profils et personnages.",
  animateur: "Staff : peut ajuster XP, niveau et banque, et voir les fiches.",
  admin: "Tous les droits, dont la gestion des rôles des comptes.",
};

interface RpcRetour {
  succes?: boolean;
  erreurs?: { message?: string }[];
}

interface Props {
  compte: { id: string; nom: string; role: Role } | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const DrawerRoleCompte = ({ compte, open, onOpenChange }: Props) => {
  const queryClient = useQueryClient();
  const [choix, setChoix] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setChoix(null);
  }, [open, compte?.id]);

  if (!compte) return null;

  // « sensible » = le changement implique le rôle Admin (cible OU actuel)
  const sensible = (r: Role) => r === "admin" || compte.role === "admin";
  const enAttenteConfirm =
    choix !== null && choix !== compte.role && sensible(choix);

  const appliquer = async (r: Role) => {
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)(
        "changer_role_compte",
        { p_compte_id: compte.id, p_role: r },
      );
      if (error) throw error;
      const ret = (data ?? {}) as RpcRetour;
      if (ret.succes !== true) {
        toast.error(ret.erreurs?.[0]?.message ?? "Changement de rôle refusé.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-joueurs"] });
      toast.success(`Rôle de ${compte.nom} → ${ROLE_LABEL[r]}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setBusy(false);
    }
  };

  const onClickRole = (r: Role) => {
    if (r === compte.role) return;
    if (sensible(r)) {
      setChoix(r); // demande confirmation (passage à/depuis Admin)
      return;
    }
    appliquer(r);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-heading text-primary">
            Changer le rôle
          </DrawerTitle>
          <DrawerDescription>
            Compte <b className="text-foreground">{compte.nom}</b> · rôle actuel{" "}
            <b className="text-foreground">{ROLE_LABEL[compte.role]}</b>
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-2 overflow-y-auto px-4 pb-8">
          {(["joueur", "animateur", "admin"] as Role[]).map((r) => {
            const actif = r === compte.role || choix === r;
            return (
              <button
                key={r}
                type="button"
                disabled={busy}
                onClick={() => onClickRole(r)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  actif
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/40 hover:bg-muted/60"
                }`}
              >
                <span
                  className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11px] ${ROLE_BADGE[r]}`}
                >
                  {ROLE_LABEL[r]}
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  {ROLE_DESC[r]}
                </span>
              </button>
            );
          })}

          {enAttenteConfirm && (
            <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
              <p className="text-[12.5px] leading-relaxed text-foreground">
                Passage{" "}
                <b>{choix === "admin" ? "vers Admin" : "depuis Admin"}</b> —
                action sensible. Confirmer le passage de{" "}
                <b>{compte.nom}</b> en <b>{ROLE_LABEL[choix as Role]}</b> ?
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => appliquer(choix as Role)}
                className="w-full rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
              >
                Confirmer le passage en {ROLE_LABEL[choix as Role]}
              </button>
            </div>
          )}

          <p className="px-1 pt-1 text-[11px] text-muted-foreground">
            Le rôle est au niveau du compte (pas du profil).
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default DrawerRoleCompte;
