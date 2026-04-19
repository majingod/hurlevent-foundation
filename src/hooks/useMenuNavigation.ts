import { useState, useEffect, useMemo } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MenuNavigation = Database["public"]["Tables"]["menu_navigation"]["Row"];

export function useMenuNavigation(role: string | null | undefined) {
  const [rawData, setRawData] = useState<MenuNavigation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PostgrestError | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("menu_navigation")
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
    return rawData.filter(
      (item) =>
        item.roles_autorises === null ||
        (role != null && item.roles_autorises.includes(role))
    );
  }, [rawData, role]);

  return { data, loading, error };
}
