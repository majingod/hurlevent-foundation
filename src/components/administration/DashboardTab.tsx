import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserRound, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface StatsAdmin {
  nb_joueurs: number;
  nb_personnages_actifs: number;
  nb_presences_attente: number;
  nb_competences_attente: number;
  prochain_evenement_titre: string | null;
  prochain_evenement_date: string | null;
}

export const DashboardTab = () => {
  const [stats, setStats] = useState<StatsAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("vue_stats_admin")
          .select("*")
          .single();

        if (error) throw error;
        setStats(data as StatsAdmin);
      } catch (err: any) {
        console.error("Erreur chargement stats admin:", err);
        setError(err.message || "Impossible de charger les statistiques");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
        Erreur : {error}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const statCards = [
    {
      title: "Joueurs inscrits",
      value: stats.nb_joueurs,
      icon: Users,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Personnages actifs",
      value: stats.nb_personnages_actifs,
      icon: UserRound,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Présences en attente",
      value: stats.nb_presences_attente,
      icon: Calendar,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
    },
    {
      title: "Compétences en attente",
      value: stats.nb_competences_attente,
      icon: Clock,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="bg-white/5 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-white/70">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{card.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Prochain événement */}
      {stats.prochain_evenement_titre && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-white/90">
              Prochain événement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/80 font-medium">{stats.prochain_evenement_titre}</p>
            {stats.prochain_evenement_date && (
              <p className="text-sm text-white/60 mt-1">
                {format(new Date(stats.prochain_evenement_date), "EEEE d MMMM yyyy", { locale: fr })}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
