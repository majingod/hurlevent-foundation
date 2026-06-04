import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";

interface AdminStats {
  nb_joueurs: number;
  nb_personnages_actifs: number;
  nb_presences_attente: number;
  nb_competences_attente: number;
  nb_races_attente: number;
  prochain_evenement_titre: string | null;
  prochain_evenement_date: string | null;
}

const AdminDashboard = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("vue_stats_admin").select("*").single();
      return data as AdminStats;
    },
  });

  if (isLoading) {
    return (
      <AdminLayout title="Tableau de bord administrateur" showSearch={false}>
        <p className="text-center py-12 text-muted-foreground">Chargement…</p>
      </AdminLayout>
    );
  }

  const statCards = [
    { title: "Races à approuver", value: stats?.nb_races_attente ?? 0, dot: "#6b1f2e", actionable: true, path: "/administration/approbations?seg=races" },
    { title: "Compétences-maître", value: stats?.nb_competences_attente ?? 0, dot: "#c084fc", actionable: true, path: "/administration/approbations?seg=competences" },
    { title: "Présences à confirmer", value: stats?.nb_presences_attente ?? 0, dot: "#eab308", actionable: true, path: "/administration/approbations?seg=presences" },
    { title: "Personnages actifs", value: stats?.nb_personnages_actifs ?? 0, dot: "#5b8fb0", actionable: false, path: "/administration/personnages" },
  ];

  return (
    <AdminLayout title="Tableau de bord administrateur" showSearch={false}>
      <div className="space-y-8">
        <p className="-mt-4 text-sm text-muted-foreground">
          Vue d'ensemble — les cartes chiffrées sont cliquables et ouvrent la file correspondante.
        </p>

        {/* Cartes stat — pastille colorée + grande valeur or */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {statCards.map((stat) => (
            <button
              key={stat.title}
              onClick={() => navigate(stat.path)}
              className="text-left rounded-lg border border-primary/10 bg-card/50 backdrop-blur-sm p-[18px] transition-all duration-300 hover:border-primary/40 hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between text-[0.74rem] uppercase tracking-wide text-muted-foreground">
                <span>{stat.title}</span>
                <span className="h-2 w-2 rounded-full" style={{ background: stat.dot }} />
              </div>
              <p className={`font-heading text-[2rem] leading-tight font-bold mt-2 ${stat.actionable ? "text-primary" : "text-foreground"}`}>
                {stat.value}
              </p>
            </button>
          ))}
        </div>

        {/* Prochain événement */}
        {stats?.prochain_evenement_titre && (
          <div>
            <h2 className="font-heading text-lg mb-3">Prochain événement</h2>
            <div className="flex items-center gap-4 rounded-lg border border-primary/25 bg-primary/[0.06] p-[18px]">
              <span className="text-3xl">📅</span>
              <div>
                <p className="font-medium text-foreground">{stats.prochain_evenement_titre}</p>
                {stats.prochain_evenement_date && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {new Date(stats.prochain_evenement_date).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
