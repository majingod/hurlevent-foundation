import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  BarChart3,
  Users,
  Shield,
  Calendar,
  CheckCircle,
  Database,
} from "lucide-react";

interface AdminSection {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

const ADMIN_SECTIONS: AdminSection[] = [
  { id: "dashboard", label: "Tableau de bord", icon: BarChart3, path: "/administration/tableau-de-bord" },
  { id: "joueurs", label: "Joueurs", icon: Users, path: "/administration/joueurs" },
  { id: "personnages", label: "Personnages", icon: Shield, path: "/administration/personnages" },
  { id: "evenements", label: "Événements", icon: Calendar, path: "/administration/evenements-admin" },
  { id: "competences", label: "Compétences maître", icon: CheckCircle, path: "/administration/competences-maitre" },
  { id: "donnees", label: "Données de jeu", icon: Database, path: "/administration/donnees" },
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

  const currentSection = ADMIN_SECTIONS.find(s => s.path === location.pathname);

  return (
    <div className="container py-8 max-w-6xl">
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-8">
        {title}
      </h1>

      <div className="flex flex-col md:flex-row gap-8">
        {/* ── Sidebar Navigation ── */}
        <nav className="md:w-56 flex-shrink-0">
          <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible md:sticky md:top-24">
            {ADMIN_SECTIONS.map(section => {
              const Icon = section.icon;
              const isActive = currentSection?.id === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => navigate(section.path)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content ── */}
        <main className="flex-1 min-w-0">
          {/* Barre de recherche */}
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

          {/* Contenu */}
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
