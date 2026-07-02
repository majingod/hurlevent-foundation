import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Users, Shield, Calendar, Skull, Database, ScrollText } from "lucide-react";
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

interface Tuile {
  label: string;
  icon: React.ElementType;
  path: string;
  valeur?: string | number;
  actionable?: boolean;
  sousTexte?: string;
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

  const dateProchain = stats?.prochain_evenement_date
    ? new Date(stats.prochain_evenement_date).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })
    : null;

  const groupes: { label: string; cols: string; tuiles: Tuile[] }[] = [
    {
      label: "À traiter",
      cols: "grid-cols-3",
      tuiles: [
        { label: "Races", icon: CheckCircle, valeur: stats?.nb_races_attente ?? 0, actionable: true, path: "/administration/approbations?seg=races" },
        { label: "Compét.-maître", icon: CheckCircle, valeur: stats?.nb_competences_attente ?? 0, actionable: true, path: "/administration/approbations?seg=competences" },
        { label: "Présences", icon: CheckCircle, valeur: stats?.nb_presences_attente ?? 0, actionable: true, path: "/administration/approbations?seg=presences" },
      ],
    },
    {
      label: "Communauté",
      cols: "grid-cols-2",
      tuiles: [
        { label: "Joueurs", icon: Users, valeur: stats?.nb_joueurs ?? 0, path: "/administration/joueurs" },
        { label: "Personnages actifs", icon: Shield, valeur: stats?.nb_personnages_actifs ?? 0, path: "/administration/personnages" },
        {
          label: "Événements", icon: Calendar, path: "/administration/evenements",
          valeur: dateProchain ?? "—",
          sousTexte: stats?.prochain_evenement_titre ?? "Aucun à venir",
        },
        { label: "Cimetière", icon: Skull, path: "/administration/cimetiere" },
      ],
    },
    {
      label: "Configuration & suivi",
      cols: "grid-cols-2",
      tuiles: [
        { label: "Données de jeu", icon: Database, path: "/administration/donnees" },
        { label: "Journal d'audit", icon: ScrollText, path: "/administration/journal" },
      ],
    },
  ];

  return (
    <AdminLayout title="Tableau de bord administrateur" showSearch={false}>
      <div className="space-y-8">
        <p className="-mt-4 text-sm text-muted-foreground">
          Chaque tuile ouvre la section correspondante.
        </p>
        {groupes.map((g) => (
          <div key={g.label}>
            <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {g.label}
            </p>
            <div className={`grid ${g.cols} gap-2.5 lg:grid-cols-4`}>
              {g.tuiles.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.label}
                    onClick={() => navigate(t.path)}
                    className={`rounded-lg border bg-card/50 p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 ${
                      t.actionable ? "border-primary/40" : "border-primary/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon className="h-4 w-4 text-primary" />
                      {t.valeur !== undefined && (
                        <span className={`font-heading text-xl font-bold leading-none ${t.actionable ? "text-primary" : "text-foreground"}`}>
                          {t.valeur}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs font-medium leading-tight text-foreground/90">{t.label}</p>
                    {t.sousTexte && (
                      <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{t.sousTexte}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
