import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Menu, User, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Récupération des éléments du menu depuis Supabase
  useEffect(() => {
    const fetchMenu = async () => {
      const { data, error } = await supabase
        .from("menu_navigation")
        .select("*")
        .eq("est_actif", true)
        .order("ordre", { ascending: true });

      if (!error && data) {
        setMenuItems(data);
      }
    };
    fetchMenu();
  }, []);

  // Gestion de l'authentification
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
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
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserRole(null);
      navigate('/');
    } catch (err) {
      console.error("Erreur lors de la déconnexion:", err);
    } finally {
      setIsOpen(false);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  // Filtre les éléments du menu en fonction du rôle de l'utilisateur
  const filteredMenuItems = menuItems.filter((item) => {
    if (!item.roles_autorises) return true;
    return userRole && item.roles_autorises.includes(userRole);
  });

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="font-cinzel text-2xl text-gold">
          HURLEVENT
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {filteredMenuItems.map((item) => (
            <Link
              key={item.id}
              to={item.url}
              className={`text-sm font-medium transition-colors hover:text-gold ${
                isActive(item.url) ? "text-gold" : "text-white/80"
              }`}
            >
              {item.libelle}
            </Link>
          ))}
        </nav>

        {/* User Menu - Desktop */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              <Link to="/tableau-de-bord">
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-gold">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Tableau de bord
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white/80 hover:text-gold">
                <LogOut className="mr-2 h-4 w-4" />
                Déconnexion
              </Button>
            </>
          ) : (
            <Link to="/connexion">
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-gold">
                <User className="mr-2 h-4 w-4" />
                Connexion
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent className="bg-black border-white/10">
            <div className="flex flex-col gap-6 mt-8">
              {filteredMenuItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.url}
                  onClick={() => setIsOpen(false)}
                  className={`text-lg font-medium transition-colors hover:text-gold ${
                    isActive(item.url) ? "text-gold" : "text-white/80"
                  }`}
                >
                  {item.libelle}
                </Link>
              ))}
              {user ? (
                <>
                  <Link
                    to="/tableau-de-bord"
                    onClick={() => setIsOpen(false)}
                    className={`text-lg font-medium transition-colors hover:text-gold ${
                      isActive("/tableau-de-bord") ? "text-gold" : "text-white/80"
                    }`}
                  >
                    Tableau de bord
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-lg font-medium text-white/80 hover:text-gold text-left"
                  >
                    Déconnexion
                  </button>
                </>
              ) : (
                <Link
                  to="/connexion"
                  onClick={() => setIsOpen(false)}
                  className="text-lg font-medium text-white/80 hover:text-gold"
                >
                  Connexion
                </Link>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default Navbar;