import { useState, useEffect } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SectionEncyclopedie = Database["public"]["Tables"]["sections_encyclopedie"]["Row"];

export function useSectionsEncyclopedie() {
  const [data, setData] = useState<SectionEncyclopedie[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PostgrestError | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("sections_encyclopedie")
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
