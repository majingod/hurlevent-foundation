import {
  type LucideIcon,
  BarChart3,
  Users,
  Shield,
  Calendar,
  CheckCircle,
  Database,
  ScrollText,
  Skull,
} from "lucide-react";

export interface AdminItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
}
export interface AdminPole {
  label: string;
  items: AdminItem[];
}

// Source unique de la navigation d'administration (3 pôles).
// Utilisée par la Navbar (menu à contexte, mode Organisation).
export const ADMIN_POLES: AdminPole[] = [
  {
    label: "À traiter",
    items: [
      { id: "dashboard", label: "Tableau de bord", icon: BarChart3, path: "/administration/dashboard" },
      { id: "approbations", label: "File d'approbations", icon: CheckCircle, path: "/administration/approbations" },
    ],
  },
  {
    label: "Communauté",
    items: [
      { id: "joueurs", label: "Joueurs", icon: Users, path: "/administration/joueurs" },
      { id: "personnages", label: "Personnages", icon: Shield, path: "/administration/personnages" },
      { id: "evenements", label: "Événements", icon: Calendar, path: "/administration/evenements" },
      { id: "cimetiere", label: "Cimetière", icon: Skull, path: "/administration/cimetiere" },
    ],
  },
  {
    label: "Configuration & suivi",
    items: [
      { id: "donnees", label: "Données de jeu", icon: Database, path: "/administration/donnees" },
      { id: "journal", label: "Journal d'audit", icon: ScrollText, path: "/administration/journal" },
    ],
  },
];
