import { useState, useEffect, useMemo } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Langue = Database["public"]["Tables"]["langues"]["Row"];

export function useLangues(estAncienne?: boolean) {
  const [rawData, setRawData] = useState<Langue[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PostgrestError | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("langues")
        .select("*")
        .eq("est_actif", true)
        .order("ordre", { ascending: true });
      if (cancelled) return;
      if (error) setError(error);
      else setRawData(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo(() => {
    if (!rawData) return null;
    if (estAncienne === undefined) return rawData;
    return rawData.filter((langue) => langue.est_ancienne === estAncienne);
  }, [rawData, estAncienne]);

  return { data, loading, error };
}
