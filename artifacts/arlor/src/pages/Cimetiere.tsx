import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import SteleMemorial, {
  type SteleMemorialData,
} from "@/components/cimetiere/SteleMemorial";

interface SteleRow extends SteleMemorialData {
  personnage_id_origine: string | null;
  created_at: string | null;
}

export default function Cimetiere() {
  const [selected, setSelected] = useState<SteleRow | null>(null);

  const { data: steles, isLoading } = useQuery({
    queryKey: ["cimetiere"],
    queryFn: async () => {
      const { data } = await supabase.from("vue_cimetiere").select("*");
      return (data ?? []) as SteleRow[];
    },
  });

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-6 text-center">
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-2">
          Cimetière des Héros
        </h1>
        <p className="text-muted-foreground">
          La mémoire de celles et ceux qui ont marqué Destéa.
        </p>
      </div>

      {isLoading ? (
        <p className="text-center py-12 text-muted-foreground">Chargement…</p>
      ) : !steles || steles.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <span className="block text-5xl opacity-40 mb-3">🪦</span>
          Le cimetière est encore vide.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {steles.map((st) => {
            const emoji =
              (st.snapshot?.race_emoji as string | undefined) ?? "🪦";
            const dateMort = st.date_mort
              ? new Date(st.date_mort).toLocaleDateString("fr-CA", {
                  year: "numeric",
                  month: "short",
                })
              : null;
            return (
              <button
                key={st.id}
                onClick={() => setSelected(st)}
                className="group flex flex-col items-center text-center bg-card border border-border rounded-t-3xl rounded-b-md px-3 pt-6 pb-4 hover:border-primary/50 transition-colors"
              >
                <span className="text-3xl mb-2 opacity-80 group-hover:opacity-100">
                  {emoji}
                </span>
                <span className="font-heading text-base text-foreground leading-tight">
                  {st.nom}
                </span>
                {st.snapshot?.race_nom ? (
                  <span className="text-xs text-muted-foreground mt-0.5">
                    {st.snapshot.race_nom as string}
                  </span>
                ) : null}
                {dateMort ? (
                  <span className="text-[0.66rem] text-muted-foreground/70 mt-1">
                    † {dateMort}
                  </span>
                ) : null}
                {st.epitaphe ? (
                  <span className="text-xs italic text-muted-foreground/80 mt-2 line-clamp-2">
                    « {st.epitaphe} »
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      <SteleMemorial stele={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
