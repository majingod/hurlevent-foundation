import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, User, LogOut, Home, BookOpen, Library, Calendar, LayoutDashboard, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useMenuNavigation } from "@/hooks/useMenuNavigation";

const Navbar = () => {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const { data: menuItems = [], loading } = useMenuNavigation(userRole);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single()
          .then(({ data }) => {
            setUserRole(data?.role ?? null);
          });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single()
          .then(({ data }) => {
            setUserRole(data?.role ?? null);
          });
      } else {
        setUserRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    alert("Étape 1 : handleLogout appelé");
    try {
      alert("Étape 2 : tentative de déconnexion Supabase...");
      const { error } = await supabase.auth.signOut();
      if (error) {
        alert("Erreur Supabase : " + error.message);
        throw error;
      }
      alert("Étape 3 : déconnexion réussie, mise à jour état local");
      setUser(null);
      setUserRole(null);
      alert("Étape 4 : redirection vers l'accueil");
      navigate('/');
    } catch (err: any) {
      alert("Erreur attrapée : " + (err.message || "inconnue"));
    } finally {
      alert("Étape 5 : fermeture du menu");
      setIsOpen(false);
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-black/80 backdrop-blur supports-[backdrop-filter]:bg-black/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center space-x-2">
            <span className="font-cinzel text-xl font-bold text-burgundy">HURLEVENT</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {!loading && menuItems.map((item) => (
            <Link
              key={item.url}
              to={item.url}
              className={`text-sm font-medium transition-colors hover:text-gold ${
                isActive(item.url) ? "text-gold" : "text-white/80"
              }`}
            >
              {item.libelle}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {/* User Menu - Desktop */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                <Link
                  to="/tableau-de-bord"
                  className={`text-sm font-medium transition-colors hover:text-gold ${
                    isActive("/tableau-de-bord") ? "text-gold" : "text-white/80"
                  }`}
                >
                  Tableau de bord
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-white/80 hover:text-white hover:bg-white/5"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Déconnexion
                </Button>
              </>
            ) : (
              <Link to="/connexion">
                <Button variant="outline" size="sm" className="border-gold text-gold hover:bg-gold hover:text-black">
                  <User className="w-4 h-4 mr-2" />
                  Connexion
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-white/80 hover:text-white hover:bg-white/5">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[350px] bg-black border-l border-white/5">
              <nav className="flex flex-col gap-4 mt-8">
                {!loading && menuItems.map((item) => (
                  <Link
                    key={item.url}
                    to={item.url}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center text-lg font-medium transition-colors hover:text-gold ${
                      isActive(item.url) ? "text-gold" : "text-white/80"
                    }`}
                  >
                    {item.libelle}
                  </Link>
                ))}
                <div className="h-px bg-white/10 my-4" />
                {user ? (
                  <>
                    <Link
                      to="/tableau-de-bord"
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center text-lg font-medium transition-colors hover:text-gold ${
                        isActive("/tableau-de-bord") ? "text-gold" : "text-white/80"
                      }`}
                    >
                      <LayoutDashboard className="w-5 h-5 mr-3" />
                      Tableau de bord
                    </Link>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-left text-lg text-white/80 hover:text-white hover:bg-white/5 px-0"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-5 h-5 mr-3" />
                      Déconnexion
                    </Button>
                  </>
                ) : (
                  <Link
                    to="/connexion"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center text-lg font-medium text-white/80 hover:text-gold"
                  >
                    <User className="w-5 h-5 mr-3" />
                    Connexion
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
