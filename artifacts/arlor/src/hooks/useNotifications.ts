import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Notif {
  id: string;
  message: string;
  type: string;
  lu: boolean;
  created_at: string;
  reference_id: string | null;
}

// Types dont l'audience est l'organisation (admin/animateur) :
// masqués du tableau de bord JOUEUR uniquement. Le staff les voit (et peut
// cliquer dessus) — cf. notifNavigation. Étendre si d'autres types admin apparaissent.
export const TYPES_MASQUES_JOUEUR = ["demande_race_nouvelle"];

// Source unique des notifs joueur. Limite volontairement large : la cloche
// et la carte tranchent localement (slice). Compteur exact jusqu'à cette limite.
const LIMITE = 30;

export function useNotifications() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  // Le staff voit les notifs d'organisation ; le joueur les a masquées.
  // Rôle dans la clé → refetch automatique quand le rôle se résout.
  const estStaff = role === "animateur" || role === "admin";
  const cleQuery = ["notifications", userId, estStaff] as const;

  const query = useQuery({
    queryKey: cleQuery,
    enabled: !!userId,
    queryFn: async (): Promise<Notif[]> => {
      let req = supabase
        .from("notifications")
        .select("id, message, type, lu, created_at, reference_id")
        .eq("user_id", userId!);
      if (!estStaff) {
        req = req.not("type", "in", `(${TYPES_MASQUES_JOUEUR.join(",")})`);
      }
      const { data, error } = await req
        .order("created_at", { ascending: false })
        .limit(LIMITE);
      if (error) throw error;
      return (data ?? []) as Notif[];
    },
  });

  const notifs = query.data ?? [];
  const nbNonLus = notifs.filter((n) => !n.lu).length;

  const lireUne = async (id: string) => {
    queryClient.setQueryData<Notif[]>(cleQuery, (old) =>
      (old ?? []).map((n) => (n.id === id ? { ...n, lu: true } : n)),
    );
    const { error } = await supabase
      .from("notifications")
      .update({ lu: true })
      .eq("id", id);
    if (error) queryClient.invalidateQueries({ queryKey: cleQuery });
  };

  const toutLire = async () => {
    if (!userId) return;
    queryClient.setQueryData<Notif[]>(cleQuery, (old) =>
      (old ?? []).map((n) => ({ ...n, lu: true })),
    );
    const { error } = await supabase
      .from("notifications")
      .update({ lu: true })
      .eq("user_id", userId)
      .eq("lu", false);
    if (error) queryClient.invalidateQueries({ queryKey: cleQuery });
  };

  return { notifs, nbNonLus, isLoading: query.isLoading, lireUne, toutLire };
}
