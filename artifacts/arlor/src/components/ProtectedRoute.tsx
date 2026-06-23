import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, role, loading, roleLoading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/connexion" replace />;
  }

  // Si un rôle est requis, on vérifie que l'utilisateur a ce rôle OU est admin.
  // Le rôle arrive désormais en arrière-plan : on attend qu'il soit résolu
  // avant de trancher, sinon un admin serait redirigé à tort au boot.
  if (requiredRole) {
    if (roleLoading) {
      return null;
    }
    const hasPermission = role === requiredRole || role === 'admin';
    if (!hasPermission) {
      return <Navigate to="/tableau-de-bord" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;