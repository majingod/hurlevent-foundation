import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/connexion" replace />;
  }

  // Si un rôle est requis, on vérifie que l'utilisateur a ce rôle OU est admin
  if (requiredRole) {
    const hasPermission = role === requiredRole || role === 'admin';
    if (!hasPermission) {
      return <Navigate to="/tableau-de-bord" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;