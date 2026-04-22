import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users, UserRound, Calendar, Clock, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    nbJoueurs: 0,
    nbPersonnagesActifs: 0,
    nbPresencesAttente: 0,
    nbCompetencesAttente: 0,
    prochainEvenement: null as any,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.rpc("get_stats_admin");
        if (error) throw error;
        setStats(data || stats);
      } catch (error) {
        console.error("Erreur chargement stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const cards = [
    { title: "Joueurs inscrits", value: stats.nbJoueurs, icon: Users, color: "blue", link: "/administration/joueurs" },
    { title: "Personnages actifs", value: stats.nbPersonnagesActifs, icon: UserRound, color: "green", link: "/administration/personnages" },
    { title: "Présences en attente", value: stats.nbPresencesAttente, icon: Calendar, color: "yellow", link: "/administration/evenements" },
    { title: "Compétences en attente", value: stats.nbCompetencesAttente, icon: Clock, color: "purple", link: "/administration/competences-maitre" },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link to={card.link} key={idx}>
              <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-white/70 flex items-center justify-between">
                    {card.title}
                    <Icon className={`h-4 w-4 text-${card.color}-400`} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{card.value}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {stats.prochainEvenement && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle>Prochain événement</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">{stats.prochainEvenement.titre}</p>
              <p className="text-sm text-white/60">
                {new Date(stats.prochainEvenement.date_evenement).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/evenements">
                Voir <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminDashboard;
