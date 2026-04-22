import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const Navbar = () => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  // Fonction de test pour voir si le clic est détecté
  const testClick = (destination: string) => {
    alert(`Clic détecté vers : ${destination}`);
    navigate(destination);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="font-cinzel text-2xl text-gold">
          HURLEVENT
        </Link>
        
        <nav className="flex items-center gap-4">
          {/* Liens publics */}
          <Button variant="link" onClick={() => testClick('/')} className="text-white/80">Accueil</Button>
          <Button variant="link" onClick={() => testClick('/regles')} className="text-white/80">Règles</Button>
          <Button variant="link" onClick={() => testClick('/evenements')} className="text-white/80">Événements</Button>
          
          {user ? (
            <>
              <Button variant="link" onClick={() => testClick('/tableau-de-bord')} className="text-white/80">
                Tableau de bord
              </Button>
              
              {/* Test direct du lien admin */}
              <Button 
                variant="link" 
                onClick={() => testClick('/administration/dashboard')} 
                className="text-gold font-bold"
              >
                TEST ADMIN
              </Button>
              
              <Button variant="ghost" onClick={handleLogout} className="text-white/80">
                Déconnexion ({role || 'rôle inconnu'})
              </Button>
            </>
          ) : (
            <Link to="/connexion" className="text-white/80">Connexion</Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;