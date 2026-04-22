import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const Navbar = () => {
  const { user, role, loading, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  if (loading) {
    return <div className="text-white p-4">Chargement...</div>;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between overflow-x-auto">
        <Link to="/" className="font-cinzel text-2xl text-gold shrink-0">
          HURLEVENT
        </Link>
        
        <nav className="flex items-center gap-4 ml-4">
          <Link to="/" className="text-white/80 hover:text-gold shrink-0">Accueil</Link>
          <Link to="/regles" className="text-white/80 hover:text-gold shrink-0">Règles</Link>
          <Link to="/evenements" className="text-white/80 hover:text-gold shrink-0">Événements</Link>
          
          {user ? (
            <>
              <Link to="/tableau-de-bord" className="text-white/80 hover:text-gold shrink-0">
                Tableau de bord
              </Link>
              
              <Link 
                to="/administration/dashboard" 
                className="text-gold font-bold hover:text-gold/80 shrink-0"
              >
                TEST ADMIN
              </Link>
              
              <span className="text-white/60 text-sm border border-white/20 px-2 py-1 rounded shrink-0">
                Rôle : <span className="text-gold">{role || 'aucun'}</span>
              </span>
              
              <button onClick={handleLogout} className="text-white/80 hover:text-gold shrink-0">
                Déconnexion
              </button>
            </>
          ) : (
            <Link to="/connexion" className="text-white/80 hover:text-gold shrink-0">Connexion</Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;