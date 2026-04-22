import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users, UserRound, Calendar, Clock, ChevronRight, Settings, ScrollText, Swords, Database, Sparkles } from "lucide-react";
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

  const statCards = [
    { title: "Joueurs inscrits", value: stats.nbJoueurs, icon: Users, color: "blue", link: "/administration/joueurs" },
    { title: "Personnages actifs", value: stats.nbPersonnagesActifs, icon: UserRound, color: "green", link: "/administration/personnages" },
    { title: "Présences en attente", value: stats.nbPresencesAttente, icon: Calendar, color: "yellow", link: "/administration/evenements" },
    { title: "Compétences en attente", value: stats.nbCompetencesAttente, icon: Clock, color: "purple", link: "/administration/competences-maitre" },
  ];

  const adminSections = [
    { title: "Joueurs", description: "Liste des joueurs, rôles et personnages", icon: Users, link: "/administration/joueurs", color: "bg-blue-500/10 border-blue-500/20" },
    { title: "Personnages", description: "Gérer les fiches de personnages", icon: UserRound, link: "/administration/personnages", color: "bg-green-500/10 border-green-500/20" },
    { title: "Événements", description: "Créer et gérer les événements", icon: Calendar, link: "/administration/evenements", color: "bg-yellow-500/10 border-yellow-500/20" },
    { title: "Compétences de Maître", description: "Valider les demandes d'apprentissage", icon: Sparkles, link: "/administration/competences-maitre", color: "bg-purple-500/10 border-purple-500/20" },
    { title: "Compétences Maître (Admin)", description: "Vue complète pour les administrateurs", icon: Swords, link: "/administration/competences-maitre", color: "bg-red-500/10 border-red-500/20" },
    { title: "Données de jeu", description: "Races, classes, compétences, etc.", icon: Database, link: "/administration/donnees", color: "bg-gray-500/10 border-gray-500/20", adminOnly: true },
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
      
      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card, idx) => {
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

      {/* Prochain événement */}
      {stats.prochainEvenement && (
        <Card className="mb-8 bg-white/5 border-white/10">
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

      {/* Navigation vers les sections admin */}
      <h2 className="font-cinzel text-2xl mb-4">Sections d'administration</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {adminSections.map((section) => (
          <Link to={section.link} key={section.title}>
            <Card className={`border ${section.color} hover:bg-white/10 transition cursor-pointer h-full`}>
              <CardHeader className="flex flex-row items-center gap-3">
                <section.icon className="h-5 w-5 text-gold" />
                <CardTitle className="text-white">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white/70">{section.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Alerte compétences en attente */}
      {stats.nbCompetencesAttente > 0 && (
        <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-400 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{stats.nbCompetencesAttente} demande{stats.nbCompetencesAttente > 1 ? 's' : ''} de compétence de maître en attente de validation.</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;