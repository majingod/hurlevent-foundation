import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, role, loading } = useAuth();

  // Pendant le chargement, on n'affiche rien (ou un loader simple)
  if (loading) {
    return null;
  }

  // Pas connecté → page de connexion
  if (!user) {
    return <Navigate to="/connexion" replace />;
  }

  // Rôle requis et rôle insuffisant → tableau de bord joueur
  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/tableau-de-bord" replace />;
  }

  // Tout est bon, on affiche les enfants
  return <>{children}</>;
};

export default ProtectedRoute;