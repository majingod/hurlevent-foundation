import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BarChart3, Users, Shield, Calendar, CheckCircle, Database, ScrollText } from "lucide-react";

interface AdminItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}
interface AdminPole {
  label: string;
  items: AdminItem[];
}

const ADMIN_POLES: AdminPole[] = [
  {
    label: "À traiter",
    items: [
      { id: "dashboard", label: "Tableau de bord", icon: BarChart3, path: "/administration/dashboard" },
      { id: "approbations", label: "File d'approbations", icon: CheckCircle, path: "/administration/approbations" },
      { id: "journal", label: "Journal d'audit", icon: ScrollText, path: "/administration/journal" },
    ],
  },
  {
    label: "Communauté",
    items: [
      { id: "joueurs", label: "Joueurs", icon: Users, path: "/administration/joueurs" },
      { id: "personnages", label: "Personnages", icon: Shield, path: "/administration/personnages" },
      { id: "evenements", label: "Événements", icon: Calendar, path: "/administration/evenements" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { id: "donnees", label: "Données de jeu", icon: Database, path: "/administration/donnees" },
    ],
  },
];

interface AdminLayoutProps {
  title: string;
  children: ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
}

const AdminLayout = ({
  title,
  children,
  searchPlaceholder = "Rechercher…",
  searchValue = "",
  onSearchChange,
  showSearch = true,
}: AdminLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="container py-8 max-w-6xl animate-in fade-in duration-500">
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-8 tracking-tight">
        {title}
      </h1>

      <div className="flex flex-col md:flex-row gap-8">
        {/* ── Sidebar Navigation (3 pôles) ── */}
        <nav className="md:w-56 flex-shrink-0">
          <div className="flex flex-col gap-4 md:sticky md:top-24">
            {ADMIN_POLES.map((pole) => (
              <div key={pole.label}>
                <p className="px-3 mb-1 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {pole.label}
                </p>
                <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
                  {pole.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigate(item.path)}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(184,146,70,0.3)]"
                            : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        }`}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* ── Content ── */}
        <main className="flex-1 min-w-0">
          {showSearch && (
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="pl-10"
              />
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
