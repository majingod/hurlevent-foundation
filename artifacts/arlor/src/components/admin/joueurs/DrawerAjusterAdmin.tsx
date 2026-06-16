import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

interface RpcRetour {
  succes?: boolean;
  erreurs?: { message?: string }[];
  avertissements?: { message?: string }[];
}

export type CibleAjuster =
  | {
      mode: "banque";
      profilId: string;
      profilNom: string;
      compteNom: string;
      solde: number;
    }
  | {
      mode: "perso";
      persoId: string;
      persoNom: string | null;
      profilNom: string;
      niveau: number;
      niveauCorrection: number;
      xpTotal: number;
      xpDepense: number;
    };

interface Props {
  cible: CibleAjuster | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type Onglet = "xp" | "nv" | "bq";

const DrawerAjusterAdmin = ({ cible, open, onOpenChange }: Props) => {
  const queryClient = useQueryClient();
  const [onglet, setOnglet] = useState<Onglet>("xp");
  const [deltaStr, setDeltaStr] = useState("0");
  const [raison, setRaison] = useState("");
  const [busy, setBusy] = useState(false);

  const cibleKey = cible
    ? cible.mode === "banque"
      ? `bq:${cible.profilId}`
      : `pe:${cible.persoId}`
    : null;

  // (ré)initialise à l'ouverture / au changement de cible
  useEffect(() => {
    if (!open || !cibleKey) return;
    setOnglet(cibleKey.startsWith("bq") ? "bq" : "xp");
    setDeltaStr("0");
    setRaison("");
  }, [open, cibleKey]);

  if (!cible) return null;

  const delta = parseInt(deltaStr, 10) || 0;

  // contexte de la cible courante (base + garde-fou)
  let base = 0;
  let unit = "";
  let label = "";
  let guard: "aucun" | "dispo" | "plancher" = "aucun";
  let dispo = 0;
  if (cible.mode === "banque") {
    base = cible.solde;
    unit = "XP";
    label = "Solde";
    guard = "aucun";
  } else if (onglet === "xp") {
    base = cible.xpTotal;
    unit = "XP";
    label = "XP total";
    guard = "dispo";
    dispo = cible.xpTotal - cible.xpDepense;
  } else {
    base = cible.niveau;
    unit = "";
    label = "Niveau";
    guard = "plancher";
  }
  const apres = base + delta;
  const u = unit ? " " + unit : "";

  let bloquant = "";
  let avert = "";
  if (guard === "dispo" && delta < 0 && -delta > dispo) {
    bloquant = `Retrait impossible : ${dispo} XP disponibles seulement.`;
  } else if (guard === "plancher" && apres < 1) {
    bloquant = `Le niveau ne peut pas descendre sous 1 (résultat ${apres}).`;
  } else if (guard === "aucun" && apres < 0) {
    avert = "Le solde deviendra négatif (autorisé).";
  } else if (guard === "dispo") {
    avert = "Retrait limité à l'XP disponible.";
  } else if (guard === "plancher") {
    avert = "Niveau minimum : 1.";
  }

  const peutAppliquer =
    delta !== 0 && raison.trim().length > 0 && !bloquant && !busy;

  const pas = (n: number) =>
    setDeltaStr(String((parseInt(deltaStr, 10) || 0) + n));

  const appliquer = async () => {
    if (!peutAppliquer) return;
    setBusy(true);
    try {
      const rpc = (supabase.rpc as any).bind(supabase);
      let resp;
      if (cible.mode === "banque") {
        resp = await rpc("ajuster_banque_xp", {
          p_joueur_id: cible.profilId,
          p_montant: delta,
          p_description: raison.trim(),
        });
      } else if (onglet === "xp") {
        resp = await rpc("corriger_xp_personnage", {
          p_personnage_id: cible.persoId,
          p_montant: delta,
          p_raison: raison.trim(),
        });
      } else {
        resp = await rpc("corriger_niveau_personnage", {
          p_personnage_id: cible.persoId,
          p_delta: delta,
          p_raison: raison.trim(),
        });
      }
      const { data, error } = resp;
      if (error) throw error;
      const ret = (data ?? {}) as RpcRetour;
      if (ret.succes !== true) {
        toast.error(ret.erreurs?.[0]?.message ?? "Ajustement refusé.");
        return;
      }
      // re-fetch : le trigger recalcule niveau/dispo. Le drawer RESTE ouvert
      // et relit la ligne fraîche via ses props (pas de += local).
      await queryClient.invalidateQueries({ queryKey: ["admin-joueurs"] });
      const a = ret.avertissements?.[0]?.message;
      toast.success(
        `${label} ${delta > 0 ? "+" : ""}${delta}${u} appliqué.`,
        a ? { description: a } : undefined,
      );
      setDeltaStr("0");
      setRaison("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setBusy(false);
    }
  };

  const titre =
    cible.mode === "banque" ? "Banque d'XP du joueur" : "Ajuster Niv./Xp";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-heading text-primary">{titre}</DrawerTitle>
          <DrawerDescription>
            {cible.mode === "banque" ? (
              <>
                Profil <b className="text-foreground">{cible.profilNom}</b> ·
                compte {cible.compteNom}
                <br />
                XP de participation (Mini-GN, ouvertures de terrain) — distincte
                de l'XP des personnages.
              </>
            ) : (
              <>
                Perso{" "}
                <b className="text-foreground">{cible.persoNom ?? "Sans nom"}</b>{" "}
                · profil {cible.profilNom}
              </>
            )}
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-8">
          {/* Pastilles cibles */}
          <div className="mb-3.5 flex gap-2">
            {cible.mode === "banque" ? (
              <div className="flex-1 rounded-xl border border-primary bg-primary/10 px-3 py-2.5 text-left">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Solde actuel
                </div>
                <div className="mt-0.5 text-lg font-bold tabular-nums text-primary">
                  {cible.solde} XP
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setOnglet("xp")}
                  className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    onglet === "xp"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/40"
                  }`}
                >
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    XP total
                  </div>
                  <div
                    className={`mt-0.5 text-lg font-bold tabular-nums ${
                      onglet === "xp" ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {cible.xpTotal}
                  </div>
                  <small className="text-[11px] text-muted-foreground">
                    dispo {cible.xpTotal - cible.xpDepense}
                  </small>
                </button>
                <button
                  type="button"
                  onClick={() => setOnglet("nv")}
                  className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    onglet === "nv"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/40"
                  }`}
                >
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Niveau
                  </div>
                  <div
                    className={`mt-0.5 text-lg font-bold tabular-nums ${
                      onglet === "nv" ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {cible.niveau}
                    {cible.niveauCorrection !== 0 && (
                      <span
                        className="ml-1 text-[11px] text-primary"
                        title="Correction manuelle de niveau"
                      >
                        ✎
                      </span>
                    )}
                  </div>
                  <small className="text-[11px] text-muted-foreground">
                    plancher 1
                  </small>
                </button>
              </>
            )}
          </div>

          {/* Stepper anti-débordement */}
          <div className="mb-1.5 flex items-stretch gap-2.5">
            <button
              type="button"
              onClick={() => pas(-1)}
              aria-label="Diminuer"
              className="flex w-[54px] shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary active:bg-primary/20"
            >
              <Minus className="h-5 w-5" />
            </button>
            <input
              className="min-w-0 flex-1 rounded-xl border border-border bg-muted px-3 py-2.5 text-center text-xl font-bold tabular-nums text-foreground focus:border-primary/70 focus:outline-none"
              type="number"
              inputMode="numeric"
              value={deltaStr}
              onChange={(e) => setDeltaStr(e.target.value)}
            />
            <button
              type="button"
              onClick={() => pas(1)}
              aria-label="Augmenter"
              className="flex w-[54px] shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary active:bg-primary/20"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {/* Aperçu */}
          <div className="my-2 text-center text-[13px] text-muted-foreground">
            {delta === 0 ? (
              <>
                {label} :{" "}
                <b className="text-foreground tabular-nums">
                  {base}
                  {u}
                </b>
              </>
            ) : (
              <>
                {label} :{" "}
                <b className="text-foreground tabular-nums">
                  {base}
                  {u}
                </b>
                <span className="mx-1.5 text-primary">→</span>
                <b className="text-foreground tabular-nums">
                  {apres}
                  {u}
                </b>{" "}
                <small>
                  ({delta > 0 ? "+" : ""}
                  {delta})
                </small>
              </>
            )}
          </div>

          {/* Raison */}
          <div className="mb-3">
            <label className="mb-1.5 block text-[11px] text-muted-foreground">
              Raison <span className="text-destructive">*</span>
            </label>
            <input
              className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground focus:border-primary/70 focus:outline-none"
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              placeholder="ex. Récompense scénario"
            />
          </div>

          <button
            type="button"
            disabled={!peutAppliquer}
            onClick={appliquer}
            className="w-full rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            Appliquer
          </button>
          <p
            className={`mt-2 min-h-[14px] text-center text-[11px] ${
              bloquant ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {bloquant || avert}
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default DrawerAjusterAdmin;
