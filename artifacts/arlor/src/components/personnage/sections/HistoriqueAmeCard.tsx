import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit2 } from "lucide-react";

interface HistoriqueAmeCardProps {
  historique: string | null;
  ame_personnage: string | null;
  /** Vrai quand l'utilisateur est propriétaire ET en mode route. Pilote les boutons d'édition. */
  canEdit: boolean;
  /** Vrai quand l'utilisateur est propriétaire (indépendamment du mode). Pilote le texte du message vide. */
  isOwner: boolean;
  /** Ouvre la carte d'édition (gérée par le parent). */
  onEdit: () => void;
}

export const HistoriqueAmeCard = ({
  historique,
  ame_personnage,
  canEdit,
  isOwner,
  onEdit,
}: HistoriqueAmeCardProps) => {
  return (
    <>
      {historique && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Historique</CardTitle>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-line">{historique}</p>
          </CardContent>
        </Card>
      )}

      {ame_personnage && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Âme</CardTitle>
            {canEdit && !historique && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-line">{ame_personnage}</p>
          </CardContent>
        </Card>
      )}

      {!historique && !ame_personnage && (
        <p className="text-center py-8 text-muted-foreground">
          {isOwner ? "Aucun historique ou âme renseigné. " : "Aucun historique ou âme renseigné."}
          {canEdit && (
            <Button size="sm" variant="link" onClick={onEdit}>
              Ajouter
            </Button>
          )}
        </p>
      )}
    </>
  );
};

export default HistoriqueAmeCard;
