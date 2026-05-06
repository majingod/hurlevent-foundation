import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Clock, CheckCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";

interface AdminStats {
  nb_joueurs: number;
  nb_personnages_actifs: number;
  nb_presences_attente: number;
  nb_competences_attente: number;
  prochain_evenement_titre: string | null;
  prochain_evenement_date: string | null;
}

const AdminDashboard = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vue_stats_admin")
        .select("*")
        .single();
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
    {
      title: "Total joueurs",
      value: stats?.nb_joueurs ?? 0,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Personnages actifs",
      value: stats?.nb_personnages_actifs ?? 0,
      icon: Shield,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Présences à confirmer",
      value: stats?.nb_presences_attente ?? 0,
      icon: Clock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      title: "Compétences à approuver",
      value: stats?.nb_competences_attente ?? 0,
      icon: CheckCircle,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  return (
    <AdminLayout title="Tableau de bord administrateur" showSearch={false}>
      <div className="space-y-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="border-primary/10 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                    {stat.title}
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Prochain événement */}
        {stats?.prochain_evenement_titre && (
          <Card className="border-primary/20 bg-primary/5 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Prochain événement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium text-foreground">{stats.prochain_evenement_titre}</p>
              {stats.prochain_evenement_date && (
                <p className="text-sm text-muted-foreground">
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
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="border-primary/10 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base font-heading">Actions rapides</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Button
              onClick={() => navigate("/administration/joueurs")}
              variant="outline"
              className="justify-start"
            >
              👥 Gérer les joueurs
            </Button>
            <Button
              onClick={() => navigate("/administration/personnages")}
              variant="outline"
              className="justify-start"
            >
              🛡️ Gérer les personnages
            </Button>
            <Button
              onClick={() => navigate("/administration/evenements-admin")}
              variant="outline"
              className="justify-start"
            >
              📅 Gérer les événements
            </Button>
            <Button
              onClick={() => navigate("/administration/competences-maitre")}
              variant="outline"
              className="justify-start"
            >
              ⭐ Approbations maître
            </Button>
            <Button
              onClick={() => navigate("/administration/donnees")}
              variant="outline"
              className="justify-start"
            >
              📊 Données de jeu
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;

