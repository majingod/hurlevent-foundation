import { useParams, Navigate } from "react-router-dom";
import FichePersonnageView from "@/components/personnage/FichePersonnageView";

const PersonnageFiche = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <Navigate to="/tableau-de-bord" replace />;
  }

  return <FichePersonnageView personnageId={id} mode="route" />;
};

export default PersonnageFiche;
