import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfil } from "@/contexts/ProfilContext";

export interface Notif {
  id: string;
  message: string;
  type: string;
  lu: boolean;
  created_at: string;
  reference_id: string | null;
  profil_id: string | null;
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
  const { profilActif } = useProfil();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const profilId = profilActif?.id ?? null;
  // Le staff voit les notifs d'organisation ; le joueur les a masquées.
  // Rôle + profil actif dans la clé → refetch automatique au switch d'identité
  // (et quand le rôle se résout).
  const estStaff = role === "animateur" || role === "admin";
  const cleQuery = ["notifications", userId, profilId, estStaff] as const;

  const query = useQuery({
    queryKey: cleQuery,
    enabled: !!userId,
    queryFn: async (): Promise<Notif[]> => {
      let req = supabase
        .from("notifications")
        .select("id, message, type, lu, created_at, reference_id, profil_id")
        .eq("user_id", userId!);
      // Identité active : ses notifs (profil_id = actif) + les annonces de
      // compte (profil_id IS NULL). Les notifs des autres identités sont exclues.
      req = profilId
        ? req.or(`profil_id.eq.${profilId},profil_id.is.null`)
        : req.is("profil_id", null);
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
    // Limité à l'identité active + compte-wide : ne JAMAIS marquer lu les notifs
    // des autres identités (sinon la pastille cross-identité s'éteindrait à tort).
    let req = supabase
      .from("notifications")
      .update({ lu: true })
      .eq("user_id", userId)
      .eq("lu", false);
    req = profilId
      ? req.or(`profil_id.eq.${profilId},profil_id.is.null`)
      : req.is("profil_id", null);
    const { error } = await req;
    if (error) queryClient.invalidateQueries({ queryKey: cleQuery });
  };

  return { notifs, nbNonLus, isLoading: query.isLoading, lireUne, toutLire };
}

// Pastille cross-identité : vrai s'il existe au moins une notif NON LUE rattachée
// à une AUTRE identité du compte (profil_id non nul ≠ profil actif).
// Requête légère (count head, aucune ligne ramenée).
export function useAutresIdentitesNonLues(): boolean {
  const { user } = useAuth();
  const { profilActif } = useProfil();
  const userId = user?.id ?? null;
  const profilId = profilActif?.id ?? null;

  const { data } = useQuery({
    queryKey: ["notifs-autres-identites", userId, profilId],
    enabled: !!userId,
    queryFn: async (): Promise<boolean> => {
      let req = supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("lu", false)
        .not("profil_id", "is", null);
      if (profilId) req = req.neq("profil_id", profilId);
      const { count, error } = await req;
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  return data ?? false;
}

// Temps réel : invalide la cloche, la carte et la pastille dès qu'une notif du
// compte change (INSERT/UPDATE/DELETE). À monter UNE SEULE fois (Navbar).
// Filtre realtime sur user_id = compte ; la RLS « Lecture notifications » reste
// la barrière (chaque client ne reçoit que les notifs de son compte).
export function useRealtimeNotifications(): void {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({
            predicate: (q) =>
              Array.isArray(q.queryKey) &&
              (q.queryKey[0] === "notifications" ||
                q.queryKey[0] === "notifs-autres-identites"),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
