import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

const Navbar = () => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate("/");
  };

  const isAdmin = role === "admin" || role === "animateur";

  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-heading text-xl font-bold text-primary">Hurlevent</span>
        </Link>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button aria-label="Menu" className="p-2">
              <Menu className="h-6 w-6 text-primary" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-72 border-l bg-[#0a0a0a] p-0"
            style={{ borderColor: "#c9a84c" }}
          >
            <SheetHeader className="px-6 pt-6 pb-4">
              <SheetTitle className="font-heading text-xl font-bold" style={{ color: "#c9a84c" }}>
                Hurlevent
              </SheetTitle>
            </SheetHeader>

            <nav className="flex flex-1 flex-col gap-1 px-4">
              <NavItem to="/" label="Accueil" onClick={close} />
              <NavItem to="/regles" label="Règles" onClick={close} />
              <NavItem to="/encyclopedie" label="Encyclopédie" onClick={close} />
              <NavItem to="/evenements" label="Événements" onClick={close} />

              {user && (
                <>
                  <NavItem to="/tableau-de-bord" label="Tableau de bord" onClick={close} />
                  {isAdmin && (
                    <NavItem to="/administration" label="Administration" onClick={close} />
                  )}
                </>
              )}

              <div className="mt-auto pt-8">
                {user ? (
                  <button
                    onClick={handleSignOut}
                    className="w-full rounded-md px-4 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/20"
                    style={{ color: "#6b1f2a" }}
                  >
                    Déconnexion
                  </button>
                ) : (
                  <NavItem to="/connexion" label="Connexion" onClick={close} />
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

const NavItem = ({ to, label, onClick }: { to: string; label: string; onClick: () => void }) => (
  <Link
    to={to}
    onClick={onClick}
    className="rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/20 hover:text-primary"
  >
    {label}
  </Link>
);

export default Navbar;
