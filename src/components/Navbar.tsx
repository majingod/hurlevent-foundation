import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const Navbar = () => {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const testClick = (destination: string) => {
    alert(`Clic détecté vers : ${destination}\nRôle actuel : ${role}`);
    navigate(destination);
  };

  if (loading) {
    return <div className="text-white p-4">Chargement de l'authentification...</div>;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="font-cinzel text-2xl text-gold">
          HURLEVENT
        </Link>
        
        <nav className="flex items-center gap-4">
          <Button variant="link" onClick={() => testClick('/')} className="text-white/80">Accueil</Button>
          <Button variant="link" onClick={() => testClick('/regles')} className="text-white/80">Règles</Button>
          <Button variant="link" onClick={() => testClick('/evenements')} className="text-white/80">Événements</Button>
          
          {user ? (
            <>
              <Button variant="link" onClick={() => testClick('/tableau-de-bord')} className="text-white/80">
                Tableau de bord
              </Button>
              
              <Button 
                variant="link" 
                onClick={() => testClick('/administration/dashboard')} 
                className="text-gold font-bold"
              >
                TEST ADMIN
              </Button>
              
              <div className="text-white/60 text-sm border border-white/20 px-2 py-1 rounded">
                Rôle : <span className="text-gold">{role || 'aucun'}</span>
              </div>
              
              <Button variant="ghost" onClick={handleLogout} className="text-white/80">
                Déconnexion
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