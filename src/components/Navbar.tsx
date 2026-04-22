import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, User, LogOut, LayoutDashboard, ChevronDown, Users, Calendar, Sparkles, Database, UserRound, ScrollText, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";

const Navbar = () => {
  const { user, role, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      console.error("Erreur lors de la déconnexion:", err);
    } finally {
      setIsOpen(false);
    }
  };

  const isAdmin = role === 'admin' || role === 'animateur';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="font-cinzel text-2xl text-gold">
          HURLEVENT
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-sm font-medium text-white/80 hover:text-gold transition-colors">Accueil</Link>
          <Link to="/regles" className="text-sm font-medium text-white/80 hover:text-gold transition-colors">Règles</Link>
          <Link to="/encyclopedie" className="text-sm font-medium text-white/80 hover:text-gold transition-colors">Encyclopédie</Link>
          <Link to="/evenements" className="text-sm font-medium text-white/80 hover:text-gold transition-colors">Événements</Link>

          {user && (
            <>
              <Link to="/tableau-de-bord" className="text-sm font-medium text-white/80 hover:text-gold transition-colors">
                Tableau de bord
              </Link>

              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 text-sm font-medium text-gold hover:text-gold/80 transition-colors">
                      Administration
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-gray-900 border-gray-800 text-white min-w-[220px]">
                    <DropdownMenuLabel className="text-gold">Gestion</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-gray-800" />
                    <DropdownMenuItem asChild className="hover:bg-gray-800 focus:bg-gray-800 cursor-pointer">
                      <Link to="/administration/dashboard" className="flex items-center gap-2">
                        <LayoutDashboard className="h-4 w-4" /> Tableau de bord
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="hover:bg-gray-800 focus:bg-gray-800 cursor-pointer">
                      <Link to="/administration/joueurs" className="flex items-center gap-2">
                        <Users className="h-4 w-4" /> Joueurs
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="hover:bg-gray-800 focus:bg-gray-800 cursor-pointer">
                      <Link to="/administration/personnages" className="flex items-center gap-2">
                        <UserRound className="h-4 w-4" /> Personnages
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="hover:bg-gray-800 focus:bg-gray-800 cursor-pointer">
                      <Link to="/administration/evenements" className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" /> Événements
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="hover:bg-gray-800 focus:bg-gray-800 cursor-pointer">
                      <Link to="/administration/competences-maitre" className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" /> Compétences Maître
                      </Link>
                    </DropdownMenuItem>
                    {role === 'admin' && (
                      <DropdownMenuItem asChild className="hover:bg-gray-800 focus:bg-gray-800 cursor-pointer">
                        <Link to="/administration/donnees" className="flex items-center gap-2">
                          <Database className="h-4 w-4" /> Données de jeu
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </nav>

        {/* User Menu - Desktop */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-gold gap-2">
                  <User className="h-4 w-4" />
                  {user.email?.split('@')[0] || "Compte"}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-gray-900 border-gray-800 text-white">
                <DropdownMenuLabel className="text-gold">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-800" />
                <DropdownMenuItem asChild className="hover:bg-gray-800 focus:bg-gray-800 cursor-pointer">
                  <Link to="/tableau-de-bord" className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" /> Tableau de bord
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="hover:bg-gray-800 focus:bg-gray-800 cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" /> Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/connexion">
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-gold">
                <User className="mr-2 h-4 w-4" /> Connexion
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
          <SheetContent className="bg-black border-white/10 w-[280px]">
            <div className="flex flex-col gap-4 mt-8">
              <Link to="/" onClick={() => setIsOpen(false)} className="text-lg text-white/80 hover:text-gold">Accueil</Link>
              <Link to="/regles" onClick={() => setIsOpen(false)} className="text-lg text-white/80 hover:text-gold">Règles</Link>
              <Link to="/encyclopedie" onClick={() => setIsOpen(false)} className="text-lg text-white/80 hover:text-gold">Encyclopédie</Link>
              <Link to="/evenements" onClick={() => setIsOpen(false)} className="text-lg text-white/80 hover:text-gold">Événements</Link>
              
              {user ? (
                <>
                  <Link to="/tableau-de-bord" onClick={() => setIsOpen(false)} className="text-lg text-white/80 hover:text-gold">
                    Tableau de bord
                  </Link>
                  
                  {isAdmin && (
                    <div className="space-y-2">
                      <p className="text-lg text-gold font-medium">Administration</p>
                      <div className="pl-4 space-y-2 border-l border-white/20">
                        <Link to="/administration/dashboard" onClick={() => setIsOpen(false)} className="block text-white/80 hover:text-gold">Tableau de bord</Link>
                        <Link to="/administration/joueurs" onClick={() => setIsOpen(false)} className="block text-white/80 hover:text-gold">Joueurs</Link>
                        <Link to="/administration/personnages" onClick={() => setIsOpen(false)} className="block text-white/80 hover:text-gold">Personnages</Link>
                        <Link to="/administration/evenements" onClick={() => setIsOpen(false)} className="block text-white/80 hover:text-gold">Événements</Link>
                        <Link to="/administration/competences-maitre" onClick={() => setIsOpen(false)} className="block text-white/80 hover:text-gold">Compétences Maître</Link>
                        {role === 'admin' && (
                          <Link to="/administration/donnees" onClick={() => setIsOpen(false)} className="block text-white/80 hover:text-gold">Données de jeu</Link>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <button onClick={handleLogout} className="text-lg text-white/80 hover:text-gold text-left">
                    Déconnexion
                  </button>
                </>
              ) : (
                <Link to="/connexion" onClick={() => setIsOpen(false)} className="text-lg text-white/80 hover:text-gold">
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