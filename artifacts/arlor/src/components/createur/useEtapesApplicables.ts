import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * NAV-2 (s175) — applicabilité dynamique des étapes du wizard.
 *
 * Certaines étapes ne concernent pas tous les personnages :
 *  - É6 (Sorts)        : compétence « Acquisition de Sort »   niveau ≥ 1
 *  - É7 (Prières)      : compétence « Acquisition de Prière » niveau ≥ 1
 *  - É8 (Assemblages)  : vue_artisanat_quotas.niveau_runes    ≥ 1
 *  - toutes les autres : toujours applicables.
 *
 * Les queryKeys / queryFns ci-dessous sont des COPIES EXACTES de celles des
 * étapes correspondantes (Etape6/7/8) : le cache TanStack est donc partagé.
 * Les achats/désachats d'É5 invalident déjà ces clés (predicate large
 * `queryKey.includes(personnageId)` dans Etape5_Competences_V2), si bien que
 * É6/É7/É8 apparaissent / disparaissent du stepper dès l'achat de la
 * compétence, sans rechargement de page.
 */
export interface EtapesApplicables {
  /** true une fois les 3 queries résolues (pas en chargement) */
  chargee: boolean;
  /** applicabilité de l'étape n : 6/7/8 selon conditions, sinon true */
  applicable: (n: number) => boolean;
}

export function useEtapesApplicables(
  personnageId: string | null,
): EtapesApplicables {
  // É6 — compétence « Acquisition de Sort » niveau ≥ 1
  // (copie de la query d'Etape6_Sorts_V2.tsx)
  const sortQuery = useQuery({
    queryKey: ["acquisition-sort", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnage_competences")
        .select("niveau_acquis, competences!inner(nom)")
        .eq("personnage_id", personnageId!)
        .eq("competences.nom", "Acquisition de Sort")
        .order("niveau_acquis", { ascending: false })
        .limit(1);
      if (error) throw error;
      const niveau = data?.[0]?.niveau_acquis ?? 0;
      return niveau;
    },
    enabled: !!personnageId,
  });

  // É7 — compétence « Acquisition de Prière » niveau ≥ 1
  // (copie de la query d'Etape7_Prieres_V2.tsx)
  const priereQuery = useQuery({
    queryKey: ["acquisition-priere", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnage_competences")
        .select("niveau_acquis, competences!inner(nom)")
        .eq("personnage_id", personnageId!)
        .eq("competences.nom", "Acquisition de Prière")
        .order("niveau_acquis", { ascending: false })
        .limit(1);
      if (error) throw error;
      const niveau = data?.[0]?.niveau_acquis ?? 0;
      return niveau;
    },
    enabled: !!personnageId,
  });

  // É8 — vue_artisanat_quotas.niveau_runes ≥ 1
  // (copie de la query d'Etape8_Assemblages_V2.tsx)
  const quotasQuery = useQuery({
    queryKey: ["artisanat-quotas", personnageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vue_artisanat_quotas")
        .select("*")
        .eq("personnage_id", personnageId!)
        .maybeSingle();
      if (error) throw error;
      return data as { niveau_runes: number | null } | null;
    },
    enabled: !!personnageId,
  });

  const chargee =
    !!personnageId &&
    !sortQuery.isPending &&
    !priereQuery.isPending &&
    !quotasQuery.isPending;

  const applicable = (n: number): boolean => {
    switch (n) {
      case 6:
        return (sortQuery.data ?? 0) >= 1;
      case 7:
        return (priereQuery.data ?? 0) >= 1;
      case 8:
        return (quotasQuery.data?.niveau_runes ?? 0) >= 1;
      default:
        return true;
    }
  };

  return { chargee, applicable };
}
