import { useState, useEffect, useMemo } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MenuNavigation = Database["public"]["Tables"]["menu_navigation"]["Row"];
export type SectionMenu = Database["public"]["Tables"]["sections_menu"]["Row"];

export function useMenuNavigation(role: string | null | undefined) {
  const [rawData, setRawData] = useState<MenuNavigation[] | null>(null);
  const [sections, setSections] = useState<SectionMenu[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PostgrestError | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [menuRes, sectionsRes] = await Promise.all([
        supabase
          .from("menu_navigation")
          .select("*")
          .eq("est_actif", true)
          .order("ordre", { ascending: true }),
        supabase
          .from("sections_menu")
          .select("*")
          .order("ordre", { ascending: true }),
      ]);
      if (cancelled) return;
      if (menuRes.error) setError(menuRes.error);
      else setRawData(menuRes.data);
      if (!sectionsRes.error) setSections(sectionsRes.data);
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

  return { data, sections, loading, error };
}
