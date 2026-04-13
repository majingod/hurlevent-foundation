import { useParams } from "react-router-dom";

const PersonnageFiche = () => {
  const { id } = useParams();

  return (
    <div className="container py-12">
      <h1 className="font-heading text-3xl font-bold text-primary">Fiche de personnage</h1>
      <p className="mt-2 text-muted-foreground">Personnage : {id}</p>
    </div>
  );
};

export default PersonnageFiche;
