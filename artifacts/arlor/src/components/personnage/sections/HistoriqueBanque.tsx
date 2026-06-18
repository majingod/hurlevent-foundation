import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MouvementBanque {
  id: string;
  type_mouvement: string;
  montant: number;
  libelle: string;
  acteur_nom: string | null;
  created_at: string;
}

interface HistoriqueBanqueProps {
  joueurId: string;
  /** Côté admin : affiche « par {acteur} ». Côté joueur : acteur_nom est NULL (RLS), donc masqué. */
  vueAdmin?: boolean;
}

type FiltreCle = "tous" | "gains" | "transferts" | "ajustements";

const FILTRES: { cle: FiltreCle; label: string; type?: string }[] = [
  { cle: "tous", label: "Tous" },
  { cle: "gains", label: "Gains", type: "gain_mini_gn" },
  { cle: "transferts", label: "Transferts", type: "transfert_vers_personnage" },
  { cle: "ajustements", label: "Ajustements", type: "ajustement_admin" },
];

const LIMITE = 5;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-CA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const HistoriqueBanque = ({
  joueurId,
  vueAdmin = false,
}: HistoriqueBanqueProps) => {
  const [filtre, setFiltre] = useState<FiltreCle>("tous");
  const [toutVu, setToutVu] = useState(false);

  const { data: mouvements, isLoading } = useQuery({
    queryKey: ["banque-mouvements", joueurId],
    queryFn: async (): Promise<MouvementBanque[]> => {
      const { data, error } = await supabase
        .from("vue_banque_mouvements")
        .select("id, type_mouvement, montant, libelle, acteur_nom, created_at")
        .eq("joueur_id", joueurId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MouvementBanque[];
    },
  });

  const typeFiltre = FILTRES.find((f) => f.cle === filtre)?.type;
  const filtres = (mouvements ?? []).filter(
    (m) => !typeFiltre || m.type_mouvement === typeFiltre,
  );
  const visibles = toutVu ? filtres : filtres.slice(0, LIMITE);
  const reste = filtres.length - visibles.length;

  if (isLoading) {
    return (
      <p className="mt-3.5 text-xs text-muted-foreground">
        Chargement de l'historique…
      </p>
    );
  }

  return (
    <div className="mt-3.5">
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {FILTRES.map((f) => {
          const actif = f.cle === filtre;
          return (
            <button
              key={f.cle}
              type="button"
              onClick={() => {
                setFiltre(f.cle);
                setToutVu(false);
              }}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                actif
                  ? "border-primary bg-primary/10 font-semibold text-primary"
                  : "border-border text-muted-foreground hover:bg-primary/5"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filtres.length === 0 ? (
        <p className="py-3 text-xs text-muted-foreground">
          Aucun mouvement dans cette catégorie.
        </p>
      ) : (
        <div className="flex flex-col">
          {visibles.map((m, i) => {
            const positif = m.montant > 0;
            return (
              <div
                key={m.id}
                className={`flex items-start justify-between gap-3 py-2 ${
                  i === 0 ? "" : "border-t border-border/50"
                }`}
              >
                <div className="min-w-0">
                  <div className="break-words text-[13px] leading-tight text-foreground">
                    {m.libelle}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {fmtDate(m.created_at)}
                    {vueAdmin && m.acteur_nom ? ` · par ${m.acteur_nom}` : ""}
                  </div>
                </div>
                <div
                  className={`shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums ${
                    positif ? "text-[hsl(140_40%_50%)]" : "text-[hsl(0_70%_62%)]"
                  }`}
                >
                  {positif ? "+" : ""}
                  {m.montant}
                </div>
              </div>
            );
          })}
          {reste > 0 && (
            <button
              type="button"
              onClick={() => setToutVu(true)}
              className="mt-2 self-start py-1 text-xs text-primary"
            >
              Voir les {reste} autres ▾
            </button>
          )}
        </div>
      )}
    </div>
  );
};
