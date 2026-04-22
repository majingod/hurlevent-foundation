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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="font-cinzel text-3xl mb-6">Tableau de bord administration</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Card key={idx} className="bg-white/5 border-white/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-white/70">
                  {card.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-gold" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <Link to={card.link}>
                  <Button variant="link" className="mt-2 p-0 text-gold">
                    Voir <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {stats.prochainEvenement && (
        <Card className="mt-8 bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Prochain événement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">{stats.prochainEvenement.titre}</p>
            <p className="text-white/60">
              {new Date(stats.prochainEvenement.date_evenement).toLocaleDateString("fr-FR", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
            </p>
            <Link to="/administration/evenements">
              <Button variant="outline" className="mt-4 border-gold text-gold hover:bg-gold/10">
                Gérer les événements
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminDashboard;