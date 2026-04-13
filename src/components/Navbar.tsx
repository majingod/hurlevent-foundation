import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const isAdmin = role === "admin" || role === "animateur";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-heading text-xl font-bold text-primary">Hurlevent</span>
        </Link>

        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">Accueil</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/regles">Règles</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/evenements">Événements</Link>
          </Button>

          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/personnage/nouveau">Mon personnage</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/tableau-de-bord">Tableau de bord</Link>
              </Button>
              {isAdmin && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/administration">Administration</Link>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleSignOut} className="ml-2 border-primary/30 text-primary hover:bg-primary/10">
                Déconnexion
              </Button>
            </>
          ) : (
            <Button size="sm" asChild className="ml-2">
              <Link to="/connexion">Connexion</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
