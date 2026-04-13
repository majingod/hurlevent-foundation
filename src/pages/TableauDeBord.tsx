import { useAuth } from "@/contexts/AuthContext";

const TableauDeBord = () => {
  const { user } = useAuth();

  return (
    <div className="container py-12">
      <h1 className="font-heading text-3xl font-bold text-primary">Tableau de bord</h1>
      <p className="mt-2 text-muted-foreground">Bienvenue, {user?.email}</p>
    </div>
  );
};

export default TableauDeBord;
