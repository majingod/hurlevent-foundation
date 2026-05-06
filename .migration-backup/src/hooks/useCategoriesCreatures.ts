import { useState, useEffect } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CategorieCreature = Database["public"]["Tables"]["categories_creatures"]["Row"];

export function useCategoriesCreatures() {
  const [data, setData] = useState<CategorieCreature[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PostgrestError | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("categories_creatures")
        .select("*")
        .eq("est_actif", true)
        .order("ordre", { ascending: true });
      if (cancelled) return;
      if (error) setError(error);
      else setData(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
