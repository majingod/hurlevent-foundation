import { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AdminLayoutProps {
  title: string;
  children: ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
}

// Cadre des pages d'administration : titre + recherche + contenu.
// La navigation admin (3 pôles) vit désormais dans la Navbar (menu à contexte,
// mode Organisation) — plus de barre latérale ni de dropdown ici.
const AdminLayout = ({
  title,
  children,
  searchPlaceholder = "Rechercher…",
  searchValue = "",
  onSearchChange,
  showSearch = true,
}: AdminLayoutProps) => {
  return (
    <div className="container py-8 max-w-6xl animate-in fade-in duration-500">
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-8 tracking-tight">
        {title}
      </h1>

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
    </div>
  );
};

export default AdminLayout;
