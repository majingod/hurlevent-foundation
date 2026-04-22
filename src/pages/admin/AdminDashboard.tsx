import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, UserRound, Calendar, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>({
    nb_joueurs: 0,
    nb_personnages_actifs: 0,
    nb_presences_attente: 0,
    nb_competences_attente: 0,
    prochain_evenement_titre: null,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("vue_stats_admin")
          .select("*")
          .single();

        if (error) throw error;
        setStats(data || {});
      } catch (err: any) {
        console.error("Erreur stats admin:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
        Erreur de chargement : {error}
      </div>
    );
  }

  const statCards = [
    {
      title: "Joueurs inscrits",
      value: stats.nb_joueurs,
      icon: Users,
      link: "/administration/joueurs",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Personnages actifs",
      value: stats.nb_personnages_actifs,
      icon: UserRound,
      link: "/administration/personnages",
      color: "text-green-400",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Présences en attente",
      value: stats.nb_presences_attente,
      icon: Calendar,
      link: "/administration/evenements",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
    },
    {
      title: "Compétences en attente",
      value: stats.nb_competences_attente,
      icon: Clock,
      link: "/administration/competences-maitre",
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-cinzel text-3xl">Tableau de bord</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} to={card.link}>
              <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition cursor-pointer h-full">
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
            </Link>
          );
        })}
      </div>

      {stats.prochain_evenement_titre && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">Prochain événement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/80">{stats.prochain_evenement_titre}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminDashboard;
